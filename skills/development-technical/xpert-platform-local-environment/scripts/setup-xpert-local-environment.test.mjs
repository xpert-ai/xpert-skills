import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const setup = join(dirname(fileURLToPath(import.meta.url)), 'setup-xpert-local-environment.mjs')
const template = [
  'NODE_ENV=production',
  'LOG_DIR=/var/lib/xpert/data/logs',
  'XPERT_TEMPLATE_DIR=/var/lib/xpert/data/xpert-template',
  'DB_PASS=template-password',
  'REDIS_PASSWORD=template-redis-password',
  ''
].join('\n')

function fixture(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'xpert setup '))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  const platform = join(workspace, 'platform')
  const state = join(workspace, 'private-state')
  const bin = join(workspace, 'bin')
  mkdirSync(join(platform, 'docker'), { recursive: true })
  mkdirSync(bin)
  writeFileSync(join(platform, '.gitignore'), '.env\ndocker/.env\n')
  writeFileSync(join(platform, 'docker/env.example'), template)
  writeFileSync(join(platform, 'package.json'), JSON.stringify({
    packageManager: 'pnpm@10.24.0',
    scripts: { bootstrap: 'unused', 'start:api': 'unused', 'start:cloud': 'unused' }
  }))
  const git = spawnSync('git', ['init', '--quiet', platform], { encoding: 'utf8' })
  assert.equal(git.status, 0, git.stderr)
  const stub = `#!/usr/bin/env node
const fs = require('node:fs');
const name = require('node:path').basename(process.argv[1]);
const args = process.argv.slice(2);
if (name === 'security') {
  fs.writeFileSync(process.env.TEST_SECURITY_CALL, 'unexpected credential lookup');
  process.exit(1);
}
if (name === 'lsof' && !args.includes('-v')) {
  if (!process.env.TEST_LISTENER_CWD) process.exit(1);
  if (args.includes('-d')) console.log('n' + process.env.TEST_LISTENER_CWD);
  else {
    const countPath = process.env.TEST_LISTENER_COUNT;
    const count = fs.existsSync(countPath) ? Number(fs.readFileSync(countPath, 'utf8')) : 0;
    fs.writeFileSync(countPath, String(count + 1));
    console.log(count < 2 ? '4242' : '4343');
  }
} else if (name !== 'docker' || args[0] !== 'ps') console.log('test-version');
`
  for (const name of ['docker', 'corepack', 'lsof', 'security']) {
    writeFileSync(join(bin, name), stub, { mode: 0o755 })
  }
  const run = (mode = 'source', extraEnv = {}) => {
    const env = { ...process.env, ...extraEnv, PATH: `${bin}:${process.env.PATH}`,
      TEST_SECURITY_CALL: join(workspace, 'security-called') }
    delete env.XPERT_TOKEN
    delete env.XPERT_USERNAME
    delete env.XPERT_PASSWORD
    const result = spawnSync(process.execPath, [setup,
      '--workspace', workspace, '--platform', platform, '--state-dir', state,
      '--mode', mode, '--skip-bootstrap', '--skip-start', '--apply',
      '--api-url', 'http://127.0.0.1:1/api/health/ready', '--web-url', 'http://127.0.0.1:1/'
    ], { env, encoding: 'utf8', timeout: 20000 })
    assert.equal(result.status, 0, result.stderr)
    return { ...result, receipt: JSON.parse(readFileSync(join(state, 'state.json'), 'utf8')) }
  }
  const read = (relative) => readFileSync(join(platform, relative), 'utf8')
  return { workspace, platform, state, run, read }
}

test('fresh source configuration uses private host paths and aligned secrets without credential-store access', (t) => {
  const f = fixture(t)
  const result = f.run()
  const source = f.read('.env')
  const docker = f.read('docker/.env')
  assert.ok(source.includes(`LOG_DIR=${f.state}/logs\n`))
  assert.ok(source.includes(`XPERT_TEMPLATE_DIR=${f.state}/xpert-template\n`))
  assert.ok(!source.includes('/var/lib/xpert'))
  assert.ok(docker.includes('LOG_DIR=/var/lib/xpert/data/logs\n'))
  const password = source.match(/^DB_PASS=(.+)$/m)[1]
  assert.notEqual(password, 'template-password')
  assert.ok(docker.includes(`DB_PASS=${password}\n`))
  assert.ok(!JSON.stringify(result.receipt).includes(password))
  assert.ok(!result.stdout.includes(password))
  assert.equal(statSync(join(f.platform, '.env')).mode & 0o777, 0o600)
  assert.equal(statSync(f.state).mode & 0o777, 0o700)
  assert.deepEqual(result.receipt.remainingActions, [])
  assert.equal(existsSync(join(f.workspace, 'security-called')), false)
})

test('source generated from existing Docker config remaps overriding log path and preserves Docker bytes', (t) => {
  const f = fixture(t)
  const docker = template + 'LOG_FILE_PATH=/var/lib/xpert/data/override.log\n'
  writeFileSync(join(f.platform, 'docker/.env'), docker, { mode: 0o600 })
  f.run()
  assert.equal(f.read('docker/.env'), docker)
  assert.ok(f.read('.env').includes(`LOG_FILE_PATH=${f.state}/logs/xpert-server.log\n`))
})

test('existing source configuration is preserved byte for byte on repeated setup', (t) => {
  const f = fixture(t)
  const source = template + 'LOG_FILE_PATH=/custom/user.log\n'
  writeFileSync(join(f.platform, '.env'), source, { mode: 0o600 })
  f.run()
  const docker = f.read('docker/.env')
  f.run()
  assert.equal(f.read('.env'), source)
  assert.equal(f.read('docker/.env'), docker)
})

test('Docker-only configuration retains container paths and creates no source env', (t) => {
  const f = fixture(t)
  f.run('docker')
  assert.equal(existsSync(join(f.platform, '.env')), false)
  assert.ok(f.read('docker/.env').includes('XPERT_TEMPLATE_DIR=/var/lib/xpert/data/xpert-template\n'))
})

test('receipt records verified listener PID separately from launcher metadata', (t) => {
  const f = fixture(t)
  const { receipt } = f.run('source', {
    TEST_LISTENER_CWD: f.platform, TEST_LISTENER_COUNT: join(f.workspace, 'listener-count')
  })
  assert.equal(receipt.processes.api.pid, 4242)
  assert.equal(receipt.processes.api.listenerPid, 4343)
  assert.equal(receipt.processes.cloud.listenerPid, 4343)
  assert.equal(receipt.processes.provenance.apiOwnedBySelectedCheckout, true)
})
