#!/usr/bin/env python3
"""Check generated providers against the selected platform's actual registry.

Uses temporary, unimplemented fixtures. Does not install plugins or test business
behavior. The platform SDK and its local build tools must already be built.
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile


CHECK = r"""
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const [platform, first, second] = process.argv.slice(1);
const host = createRequire(platform + '/package.json');
const sdk = require(platform + '/packages/plugin-sdk');
const {Reflector} = host('@nestjs/core');
const modules = [require(first + '/dist/index.js'), require(second + '/dist/index.js')];
const instances = modules.map((m, index) => {
  Reflect.defineMetadata(sdk.ORGANIZATION_METADATA_KEY, 'global', m.ToolProvider);
  Reflect.defineMetadata(sdk.PLUGIN_METADATA_KEY, '@scaffold-test/plugin-' + index, m.ToolProvider);
  return new m.ToolProvider();
});
const registry = () => new sdk.XpertToolProviderRegistry({getProviders: () => []}, new Reflector());
const shared = registry();
for (const instance of instances) shared.upsert(instance);
assert.equal(shared.listAllRegistrations().length, 2);
const descriptors = instances.map(instance => sdk.describeXpertToolProvider(instance));
assert.notEqual(descriptors[0].options.componentKey, descriptors[1].options.componentKey);

// Component identities are plugin-qualified; equal keys across plugins are valid.
sdk.XpertToolProvider({...descriptors[1].options,
  componentKey: descriptors[0].options.componentKey})(modules[1].ToolProvider);
const separatePlugins = registry();
for (const instance of instances) separatePlugins.upsert(instance);
assert.equal(separatePlugins.listAllRegistrations().length, 2);

// Two providers in the same plugin still cannot claim the same component key.
Reflect.defineMetadata(sdk.PLUGIN_METADATA_KEY, '@scaffold-test/plugin-0', modules[1].ToolProvider);
const collision = registry();
collision.upsert(instances[0]);
assert.throws(() => collision.upsert(instances[1]), /Component key .*already registered/);
console.log(JSON.stringify({sameScopeProviders: 2, crossPluginComponentReuse: true, duplicateComponentRejected: true,
  componentKeys: descriptors.map(d => d.options.componentKey),
  businessImplemented: false, livePlatformAcceptance: false}));
"""


def run(command, **kwargs):
    result = subprocess.run(command, text=True, capture_output=True, **kwargs)
    if result.returncode:
        sys.stderr.write(result.stdout + result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', required=True, type=Path)
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    platform = args.platform.resolve(strict=True)
    generator = Path(__file__).with_name('scaffold-tool-plugin.py')
    environment = {**os.environ, 'NODE_PATH': str(platform / 'node_modules')}
    with tempfile.TemporaryDirectory(prefix='xpert-scaffold-registry-') as temporary:
        fixtures = []
        for name in ['alpha', 'beta']:
            fixture = Path(temporary) / name
            run([sys.executable, str(generator), '--platform', str(platform),
                 '--dest', str(fixture), '--name', f'@scaffold-test/plugin-{name}',
                 '--tool', f'{name}_tool', '--namespace', name, '--level', 'tenant',
                 '--node', args.node])
            run([args.node, str(fixture / 'scripts/workflow.mjs'), 'build',
                 '--platform', str(platform)], env=environment)
            peers = fixture / 'node_modules/@xpert-ai'
            peers.mkdir(parents=True)
            for package in ['plugin-sdk', 'contracts']:
                (peers / package).symlink_to(platform / 'packages' / package, target_is_directory=True)
            fixtures.append(str(fixture))
        result = run([args.node, '-e', CHECK, str(platform), *fixtures], env=environment)
        sys.stdout.write(result)


if __name__ == '__main__':
    main()
