import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { inspectNsjailReadiness } from './inspect-nsjail-readiness.mjs'

async function fixture(t, handler) {
  const root = mkdtempSync(join(tmpdir(), 'xpert-nsjail-check-'))
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    rmSync(root, { recursive: true, force: true })
  })
  const env = new Map([
    ['NSJAIL_RUNNER_URL', `http://127.0.0.1:${server.address().port}`],
    ['NSJAIL_RUNNER_TOKEN', 'test-only-secret'], ['SANDBOX_VOLUME', root]
  ])
  return env
}

test('missing runner configuration cannot pass as sandbox readiness', async () => {
  const result = await inspectNsjailReadiness(new Map())
  assert.equal(result.rpcReady, false)
  assert.deepEqual(result.missingKeys, ['NSJAIL_RUNNER_URL', 'NSJAIL_RUNNER_TOKEN', 'SANDBOX_VOLUME'])
})

test('authenticated health verifies protocol without claiming command execution', async (t) => {
  const env = await fixture(t, (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer test-only-secret')
    assert.equal(req.url, '/health')
    res.end(JSON.stringify({ status: 'ok', protocolVersion: 2, capabilities: { projectContentReadOnly: true } }))
  })
  const result = await inspectNsjailReadiness(env)
  assert.equal(result.rpcReady, true)
  assert.equal(result.protocolVersion, 2)
  assert.equal(result.projectContentReadOnly, true)
  assert.equal(result.execution, 'not_checked')
  assert.ok(!JSON.stringify(result).includes('test-only-secret'))
})

test('authentication rejection does not expose response bodies', async (t) => {
  const env = await fixture(t, (req, res) => {
    res.writeHead(401).end(req.headers.authorization)
  })
  const result = await inspectNsjailReadiness(env)
  assert.equal(result.rpcReady, false)
  assert.match(result.error, /HTTP 401/)
  assert.ok(!JSON.stringify(result).includes('test-only-secret'))
})

test('health request does not follow redirects with the runner credential', async (t) => {
  let requests = 0
  const env = await fixture(t, (req, res) => {
    requests++
    res.writeHead(302, { Location: '/other' }).end()
  })
  const result = await inspectNsjailReadiness(env)
  assert.equal(result.rpcReady, false)
  assert.match(result.error, /HTTP 302/)
  assert.equal(requests, 1)
})

test('a listening service returning non-runner JSON is not ready', async (t) => {
  const env = await fixture(t, (req, res) => res.end('{"status":"ready"}'))
  assert.equal((await inspectNsjailReadiness(env)).rpcReady, false)
})

test('an absent workspace fails before contacting the runner', async (t) => {
  let requests = 0
  const env = await fixture(t, (req, res) => { requests++; res.end('{}') })
  env.set('SANDBOX_VOLUME', join(env.get('SANDBOX_VOLUME'), 'missing'))
  const result = await inspectNsjailReadiness(env)
  assert.equal(result.workspaceExists, false)
  assert.equal(requests, 0)
})
