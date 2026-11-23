#!/usr/bin/env python3
"""Create an unimplemented host-native tool plugin; never supplies business logic."""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', required=True, type=Path)
    parser.add_argument('--dest', required=True, type=Path)
    parser.add_argument('--name', required=True)
    parser.add_argument('--tool', required=True)
    parser.add_argument('--namespace', required=True)
    parser.add_argument('--level', required=True, choices=['tenant', 'system', 'organization'])
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    if not re.fullmatch(r'@[a-z0-9-]+/plugin-[a-z0-9-]+', args.name):
        parser.error('Use a scoped package name such as @acme/plugin-example')
    if not re.fullmatch(r'[a-z][a-z0-9_]*', args.tool + ''):
        parser.error('Tool name must use lowercase letters, digits and underscores')
    if not re.fullmatch(r'[a-z][a-z0-9_]*', args.namespace):
        parser.error('Namespace must use lowercase letters, digits and underscores')
    platform = args.platform.resolve(strict=True)
    dest = args.dest.resolve()
    if dest.exists():
        parser.error('Destination already exists; existing projects are never overwritten')
    sdk = json.loads((platform / 'packages/plugin-sdk/package.json').read_text())
    if not (platform / 'packages/plugin-sdk/dist/index.d.ts').is_file():
        parser.error('Build the selected platform SDK once before using its local toolchain')
    probe = """const {createRequire}=require('node:module');
const r=createRequire(process.argv[1]+'/package.json');
console.log(JSON.stringify(Object.fromEntries(['typescript','esbuild','zod','@types/node'].map(n=>[n,r(n+'/package.json').version]))));"""
    versions = json.loads(subprocess.check_output([args.node, '-e', probe, str(platform)], text=True))
    manifest = {
        'name': args.name, 'version': '0.1.0', 'description': 'Unimplemented Xpert tool plugin',
        'main': './dist/index.js', 'types': './dist/types/index.d.ts',
        'exports': {'.': {'types': './dist/types/index.d.ts', 'default': './dist/index.js'}, './package.json': './package.json'},
        'files': ['dist', 'docs', 'README.md'],
        'scripts': {command: f'node scripts/workflow.mjs {command}' for command in ['build', 'test', 'pack', 'verify-archive']},
        'xpert': {'plugin': {'level': args.level, 'artifactNamespace': args.namespace}},
        'peerDependencies': {'@xpert-ai/plugin-sdk': sdk['version']},
        'dependencies': {'zod': versions['zod']},
        'devDependencies': {**{n: versions[n] for n in ['typescript', 'esbuild', '@types/node']}, '@xpert-ai/plugin-sdk': sdk['version']},
        'author': 'Local plugin developers', 'license': 'AGPL-3.0'
    }
    assets = Path(__file__).resolve().parent.parent / 'assets/tool-plugin'
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.plugin-scaffold-', dir=dest.parent) as temporary:
        stage = Path(temporary) / 'plugin'
        shutil.copytree(assets, stage)
        (stage / 'package.json').write_text(json.dumps(manifest, indent=2) + '\n')
        identity = f"""export const identity = {json.dumps({'tool': args.tool, 'namespace': args.namespace, 'provider': args.namespace + '_tools', 'middleware': args.namespace + '_middleware', 'title': args.tool.replace('_', ' ').title()}, indent=2)} as const
export const installLevel = {json.dumps(args.level)} as const
"""
        (stage / 'src/lib/identity.ts').write_text(identity)
        (stage / 'docs/docs.json').write_text(json.dumps({
            '$schema': 'https://mintlify.com/docs.json', 'theme': 'mint', 'name': args.name,
            'colors': {'primary': '#2563eb'},
            'navigation': {'groups': [{'group': 'Plugin', 'pages': ['overview']}]}
        }, indent=2) + '\n')
        stage.rename(dest)
    print(json.dumps({'path': str(dest), 'sdkVersion': sdk['version'], 'businessImplemented': False,
                      'next': 'Replace the feature, schemas and failing business test; run workflow commands with --platform.'}))


if __name__ == '__main__':
    main()
