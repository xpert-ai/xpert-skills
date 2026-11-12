#!/usr/bin/env python3
"""Exercise the helper against the selected platform's real MCP SDK on loopback.

Uses a temporary fixture server, never a platform account or business plugin.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
from unittest.mock import patch


SERVER = r"""
const http = require('node:http');
const {createRequire} = require('node:module');
const host = createRequire(process.argv[1] + '/package.json');
const {McpServer, createMcpHandler, fromJsonSchema} = host('@modelcontextprotocol/server');
const {toNodeHandler} = host('@modelcontextprotocol/node');
const respond = (res, status, body) => {
  res.writeHead(status, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(body));
};
const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (req.headers['organization-id'] !== 'fixture-org' || req.headers['tenant-id'] !== 'fixture-tenant') {
      return respond(res, 400, {error: 'Fixture requires organization and tenant context'});
    }
    const mcpRequest = req.url === '/api/mcp/p/probe';
    if (req.headers.authorization !== `Bearer ${mcpRequest ? 'fixture-mcp' : 'fixture-admin'}`) {
      return respond(res, 401, {error: 'Wrong fixture credential audience'});
    }
    if (!mcpRequest) {
      if (req.url.endsWith('/by-names')) {
        return respond(res, 200, [{name: '@fixture/probe', runningVersion: '1.0.0', loadStatus: 'loaded'}]);
      }
      if (req.url.endsWith('/enable')) return respond(res, 200, {publication: {id: 'fixture-publication'}});
      if (req.url.endsWith('/credential')) return respond(res, 200, {
        secret: 'fixture-mcp', connectionInfo: {
          endpoint: `http://127.0.0.1:${server.address().port}/api/mcp/p/probe`, protocolVersion: '2026-07-28'
        }
      });
      return respond(res, 404, {error: 'Unknown fixture route'});
    }
    // Match Xpert's non-interactive stateless path: each request gets an SDK server.
    const mcp = new McpServer({name: 'acceptance-transport-fixture', version: '1.0.0'});
    mcp.registerTool('fixture_probe', {
      description: 'Transport fixture only',
      inputSchema: fromJsonSchema({type: 'object', properties: {value: {type: 'string'}},
                                   required: ['value'], additionalProperties: false}),
      outputSchema: fromJsonSchema({anyOf: [
        {type: 'object', properties: {ok: {type: 'boolean', const: true}, value: {type: 'string'}},
         required: ['ok', 'value'], additionalProperties: false},
        {type: 'object', properties: {ok: {type: 'boolean', const: false}, error: {type: 'string'}},
         required: ['ok', 'error'], additionalProperties: false}
      ]})
    }, async ({value}) => value === 'fixture-error'
      ? {content: [{type: 'text', text: 'Fixture failure'}], isError: true, structuredContent: {ok: false, error: 'fixture'}}
      : {content: [{type: 'text', text: value}], structuredContent: {ok: true, value}});
    const handler = createMcpHandler(() => mcp, {legacy: 'stateless', responseMode: 'auto'});
    try { await toNodeHandler(handler)(req, res, body); }
    finally { await handler.close(); }
  } catch (error) {
    if (!res.headersSent) respond(res, 500, {error: String(error)});
    else res.end();
  }
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({port: server.address().port})));
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', required=True, type=Path)
    parser.add_argument('--node', default='node')
    parser.add_argument('--helper', type=Path, default=Path(__file__).with_name('plugin-acceptance.py'))
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('acceptance', args.helper)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory(prefix='xpert-mcp-transport-') as temporary:
        root = Path(temporary)
        with (root / 'server.log').open('w+') as log:
            process = subprocess.Popen([args.node, '-e', SERVER, str(args.platform.resolve(strict=True))],
                                       stdout=subprocess.PIPE, stderr=log, text=True)
            try:
                import selectors
                with selectors.DefaultSelector() as selector:
                    selector.register(process.stdout, selectors.EVENT_READ)
                    if not selector.select(timeout=20):
                        raise RuntimeError('Fixture SDK server did not start within 20 seconds')
                    first = process.stdout.readline()
                if not first:
                    log.seek(0)
                    raise RuntimeError('Fixture SDK server failed: ' + log.read()[-1500:])
                port = json.loads(first)['port']
                environment = {'XPERT_API_URL': f'http://127.0.0.1:{port}', 'XPERT_TOKEN': 'fixture-admin',
                               'XPERT_TENANT_ID': 'fixture-tenant', 'XPERT_ORG_ID': 'fixture-org'}
                cases = root / 'cases.json'
                checks = []
                with patch.dict(os.environ, environment):
                    for expected, should_pass in [('transport-fixture', True), ('wrong-expectation', False)]:
                        cases.write_text(json.dumps([
                            {'name': 'fixture_probe', 'arguments': {'value': 'transport-fixture'},
                             'expect': {'result': {'structuredContent': {'ok': True, 'value': expected}}}},
                            {'name': 'fixture_probe', 'arguments': {'value': 'fixture-error'},
                             'expect': {'result': {'isError': True, 'structuredContent': {'ok': False, 'error': 'fixture'}}}}
                        ]))
                        result = module.verify(module.Client('organization'),
                                               SimpleNamespace(plugin='@fixture/probe', component='tools', cases=cases))
                        assert result['casesPassed'] is should_pass, {'tools': result['tools'], 'cases': result['cases']}
                        assert result['acceptancePassed'] is False
                        assert result['protocol']['advertised'] == '2026-07-28'
                        assert result['protocol']['negotiated'] == '2025-11-25'
                        assert result['cases'][1]['passed'] is True
                        checks.append({'expectedMatched': should_pass, 'actualMatched': result['casesPassed']})
                print(json.dumps({'fixture': 'real-platform-mcp-sdk', 'checks': checks,
                                  'businessPluginAcceptance': False, 'realPlatformAccountUsed': False}))
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == '__main__':
    main()
