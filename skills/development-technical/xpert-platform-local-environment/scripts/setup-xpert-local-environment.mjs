#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join, parse, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const OFFICIAL_REPOSITORY = 'https://github.com/xpert-ai/xpert.git'
const VALUE_OPTIONS = new Set([
  'workspace',
  'platform',
  'plugin-dir',
  'repo-url',
  'ref',
  'mode',
  'compose-project',
  'api-url',
  'web-url',
  'state-dir',
  'wait-seconds'
])
const FLAG_OPTIONS = new Set([
  'apply',
  'skip-bootstrap',
  'skip-start',
  'reuse-infra',
  'json',
  'help'
])

function usage() {
  console.log(`Usage:
  node setup-xpert-local-environment.mjs [options]

Options:
  --workspace <path>         Existing workspace root (default: current directory)
  --platform <path>          Exact Xpert checkout (default: <workspace>/xpert)
  --plugin-dir <path>        Optional local plugin root for workspace allowlisting
  --repo-url <url>           Clone source (default: official public Xpert repository)
  --ref <branch-or-tag>      Clone ref; an existing checkout must already match
  --mode <source|docker>     Default: source
  --compose-project <name>   Override deterministic Compose project name
  --api-url <url>            Override API readiness URL
  --web-url <url>            Override Cloud UI URL
  --state-dir <path>         Logs/receipt directory outside the platform checkout
  --wait-seconds <number>    Health wait timeout (default: 300)
  --reuse-infra              Reuse occupied Postgres/Redis ports in source mode
  --skip-bootstrap           Do not run the repository bootstrap
  --skip-start               Configure/bootstrap without starting services
  --apply                    Execute the plan; without this flag the command is dry-run
  --json                     JSON dry-run output (not supported with --apply)
  --help                     Show this help

Setup never overwrites existing .env files, switches an existing checkout, kills
processes, stops Compose projects, deletes volumes, or prints secrets.`)
}

function parseArgs(argv) {
  const options = {
    workspace: process.cwd(),
    mode: 'source',
    'repo-url': OFFICIAL_REPOSITORY,
    'wait-seconds': '300',
    apply: false,
    'skip-bootstrap': false,
    'skip-start': false,
    'reuse-infra': false,
    json: false,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (FLAG_OPTIONS.has(key)) {
      options[key] = true
      continue
    }
    if (!VALUE_OPTIONS.has(key)) throw new Error(`Unknown option: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`)
    options[key] = value
    index += 1
  }

  if (!['source', 'docker'].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`)
  }
  const waitSeconds = Number(options['wait-seconds'])
  if (!Number.isInteger(waitSeconds) || waitSeconds < 10 || waitSeconds > 1800) {
    throw new Error('--wait-seconds must be an integer between 10 and 1800')
  }
  if (options.json && options.apply) throw new Error('--json is supported only for dry-run output')
  return { ...options, waitSeconds }
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
  })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: options.inherit ? '' : (result.stdout || '').trim(),
    stderr: options.inherit ? '' : (result.stderr || '').trim()
  }
}

function requireCommand(command, args = ['--version']) {
  const result = run(command, args)
  if (!result.ok) throw new Error(`Required command is unavailable: ${command}`)
  return result.stdout.split('\n')[0] || 'available'
}

function canonicalPath(path) {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

function isInside(path, parent) {
  const childPath = canonicalPath(path)
  const parentPath = canonicalPath(parent)
  return childPath === parentPath || childPath.startsWith(`${parentPath}/`)
}

function assertSafeTarget(path, label) {
  const resolvedPath = resolve(path)
  const root = parse(resolvedPath).root
  if (resolvedPath === root) throw new Error(`${label} cannot be a filesystem root: ${resolvedPath}`)
  return resolvedPath
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function composeProjectFor(platformPath) {
  const hash = createHash('sha256').update(resolve(platformPath)).digest('hex').slice(0, 8)
  const name = basename(platformPath).toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'xpert'
  return `${name}-${hash}`
}

function environmentKey(platformPath) {
  return composeProjectFor(platformPath)
}

function gitInfo(platformPath) {
  if (!existsSync(platformPath)) return null
  const root = run('git', ['rev-parse', '--show-toplevel'], { cwd: platformPath })
  if (!root.ok || canonicalPath(root.stdout) !== canonicalPath(platformPath)) {
    throw new Error(`Existing platform target is not a Git repository root: ${platformPath}`)
  }
  const branch = run('git', ['branch', '--show-current'], { cwd: platformPath })
  const commit = run('git', ['rev-parse', 'HEAD'], { cwd: platformPath })
  const status = run('git', ['status', '--porcelain'], { cwd: platformPath })
  const remote = run('git', ['remote', 'get-url', 'origin'], { cwd: platformPath })
  return {
    branch: branch.ok ? branch.stdout || '(detached)' : null,
    commit: commit.ok ? commit.stdout : null,
    dirtyEntries: status.ok && status.stdout ? status.stdout.split('\n').filter(Boolean).length : 0,
    hasOrigin: remote.ok
  }
}

function assertRequestedRef(platformPath, requestedRef) {
  if (!requestedRef) return
  const head = run('git', ['rev-parse', 'HEAD'], { cwd: platformPath })
  const target = run('git', ['rev-parse', `${requestedRef}^{commit}`], { cwd: platformPath })
  if (!target.ok) {
    throw new Error(`Requested ref is not available in the existing checkout: ${requestedRef}`)
  }
  if (!head.ok || head.stdout !== target.stdout) {
    throw new Error(`Existing checkout does not match --ref ${requestedRef}; setup will not switch it automatically.`)
  }
}

function validateRepositoryUrl(value) {
  try {
    const url = new URL(value)
    if (url.username || url.password) throw new Error('Repository URL must not embed credentials.')
  } catch (error) {
    if (error instanceof Error && error.message.includes('credentials')) throw error
    if (!value.includes(':')) throw new Error(`Invalid repository URL: ${value}`)
  }
}

function parseEnv(text) {
  const values = new Map()
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match) values.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ''))
  }
  return values
}

function renderEnv(source, overrides) {
  const applied = new Set()
  const lines = source.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)
    if (!match || !overrides.has(match[1])) return line
    const key = match[1]
    applied.add(key)
    return `${key}=${overrides.get(key)}`
  })
  for (const [key, value] of overrides) {
    if (!applied.has(key)) lines.push(`${key}=${value}`)
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}

function randomSecret(bytes = 32) {
  return randomBytes(bytes).toString('hex')
}

function freshSecretOverrides() {
  return new Map([
    ['DB_PASS', randomSecret(24)],
    ['REDIS_PASSWORD', randomSecret(24)],
    ['SESSION_SECRET', randomSecret()],
    ['JWT_SECRET', randomSecret()],
    ['JWT_REFRESH_SECRET', randomSecret()],
    ['SECRETS_ENCRYPTION_KEY', randomSecret()],
    ['XPERT_MCP_APP_TOKEN_SECRET', randomSecret()],
    ['XPERT_MCP_REQUEST_STATE_SECRET', randomSecret()]
  ])
}

function ensureIgnored(platformPath, targetPath) {
  const relativePath = targetPath.slice(canonicalPath(platformPath).length + 1)
  const result = run('git', ['check-ignore', '-q', '--', relativePath], { cwd: platformPath })
  if (!result.ok) throw new Error(`Refusing to create a local configuration file that is not ignored: ${targetPath}`)
}

function writeExclusive(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  const handle = openSync(path, 'wx', 0o600)
  try {
    writeFileSync(handle, content, { encoding: 'utf8' })
  } finally {
    closeSync(handle)
  }
}

function materializeConfiguration({ platformPath, workspace, pluginPath, mode }) {
  const templatePath = join(platformPath, 'docker', 'env.example')
  const sourceEnvPath = join(platformPath, '.env')
  const dockerEnvPath = join(platformPath, 'docker', '.env')
  if (!existsSync(templatePath)) throw new Error(`Environment template is missing: ${templatePath}`)

  const sourceExists = existsSync(sourceEnvPath)
  const dockerExists = existsSync(dockerEnvPath)
  const existingBasePath = dockerExists ? dockerEnvPath : (sourceExists ? sourceEnvPath : null)
  const base = readFileSync(existingBasePath || templatePath, 'utf8')
  const commonOverrides = existingBasePath ? new Map() : freshSecretOverrides()
  const sourceOverrides = new Map(commonOverrides)
  sourceOverrides.set('NODE_ENV', 'development')
  sourceOverrides.set('PORT', '3000')
  sourceOverrides.set('WEB_PORT', '4200')
  sourceOverrides.set('API_BASE_URL', 'http://localhost:3000')
  sourceOverrides.set('VITE_API_BASE_URL', 'http://localhost:3000')
  sourceOverrides.set('CLIENT_BASE_URL', 'http://localhost:4200')
  sourceOverrides.set('CORS_ALLOW_ORIGINS', 'http://localhost:4200')
  sourceOverrides.set('DB_HOST', 'localhost')
  sourceOverrides.set('REDIS_HOST', 'localhost')
  sourceOverrides.set('PLUGIN_WORKSPACE_ROOTS', canonicalPath(pluginPath || workspace))
  const dockerOverrides = new Map(commonOverrides)
  dockerOverrides.set('API_BASE_URL', 'http://localhost:3000')
  dockerOverrides.set('CLIENT_BASE_URL', 'http://localhost')

  const changes = []
  if (!dockerExists) {
    ensureIgnored(platformPath, dockerEnvPath)
    writeExclusive(dockerEnvPath, renderEnv(base, dockerOverrides))
    changes.push({ path: dockerEnvPath, action: 'generated' })
  } else {
    changes.push({ path: dockerEnvPath, action: 'preserved' })
  }
  if (mode === 'source') {
    if (!sourceExists) {
      ensureIgnored(platformPath, sourceEnvPath)
      writeExclusive(sourceEnvPath, renderEnv(base, sourceOverrides))
      changes.push({ path: sourceEnvPath, action: 'generated' })
    } else {
      changes.push({ path: sourceEnvPath, action: 'preserved' })
    }
  }
  return changes
}

function pluginAllowlisted(sourceEnvPath, pluginPath) {
  if (!pluginPath || !existsSync(sourceEnvPath)) return pluginPath ? false : null
  const roots = parseEnv(readFileSync(sourceEnvPath, 'utf8')).get('PLUGIN_WORKSPACE_ROOTS')
  if (!roots) return false
  return roots.split(/[;,]/).map((item) => item.trim()).filter(Boolean)
    .some((root) => existsSync(root) && isInside(pluginPath, root))
}

function listenersForPort(port, platformPath) {
  const pidsResult = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
  if (!pidsResult.ok || !pidsResult.stdout) return []
  const pids = [...new Set(pidsResult.stdout.split('\n').map(Number).filter(Number.isInteger))]
  return pids.map((pid) => {
    const cwdResult = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
    const cwdLine = cwdResult.stdout.split('\n').find((line) => line.startsWith('n'))
    const cwd = cwdLine ? cwdLine.slice(1) : null
    return { pid, cwd, ownedByPlatform: Boolean(cwd && isInside(cwd, platformPath)) }
  })
}

function assertSourcePort(port, platformPath, label) {
  const listeners = listenersForPort(port, platformPath)
  if (listeners.length && !listeners.some((item) => item.ownedByPlatform)) {
    const owners = listeners.map((item) => `${item.pid}:${item.cwd || 'unknown-cwd'}`).join(', ')
    throw new Error(`${label} port ${port} is owned by another process (${owners}). Setup will not kill or adopt it.`)
  }
  return listeners.find((item) => item.ownedByPlatform) || null
}

function dockerProjectContainers(project) {
  const result = run('docker', [
    'ps', '-a',
    '--filter', `label=com.docker.compose.project=${project}`,
    '--format', '{{json .}}'
  ])
  if (!result.ok || !result.stdout) return []
  return result.stdout.split('\n').filter(Boolean).flatMap((line) => {
    try {
      const item = JSON.parse(line)
      return [{ id: item.ID || null, name: item.Names || item.Name || null, ports: item.Ports || '' }]
    } catch {
      return []
    }
  })
}

function dockerProjectPublishesPort(project, port) {
  return dockerProjectContainers(project).some((item) => {
    return item.ports.split(',').some((part) => {
      const match = part.match(/:(\d+)->/)
      return match && Number(match[1]) === port
    })
  })
}

function portFromUrl(value) {
  const url = new URL(value)
  if (url.port) return Number(url.port)
  return url.protocol === 'https:' ? 443 : 80
}

function portOccupied(port) {
  const result = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
  return result.ok && Boolean(result.stdout)
}

function startDetached({ command, args, cwd, logPath }) {
  mkdirSync(dirname(logPath), { recursive: true })
  const log = openSync(logPath, 'a', 0o600)
  const childEnv = { ...process.env }
  delete childEnv.VSCODE_INSPECTOR_OPTIONS
  if (childEnv.NODE_OPTIONS?.includes('--inspect')) delete childEnv.NODE_OPTIONS
  const child = spawn(command, args, {
    cwd,
    env: childEnv,
    detached: true,
    stdio: ['ignore', log, log]
  })
  child.unref()
  closeSync(log)
  return child.pid
}

async function probe(url, kind) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual' })
    if (kind === 'api') {
      if (!response.ok) return false
      try {
        const payload = await response.json()
        return payload?.status === 'ready'
      } catch {
        return false
      }
    }
    return response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function waitFor(url, kind, seconds, label) {
  const deadline = Date.now() + seconds * 1000
  let nextNotice = Date.now()
  while (Date.now() < deadline) {
    if (await probe(url, kind)) return true
    if (Date.now() >= nextNotice) {
      console.log(`Waiting for ${label}: ${url}`)
      nextNotice = Date.now() + 10000
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
  }
  return false
}

function credentialsAvailable() {
  if (process.env.XPERT_TOKEN) return true
  if (process.env.XPERT_USERNAME && process.env.XPERT_PASSWORD) return true
  if (process.platform !== 'darwin') return false
  const username = run('security', ['find-generic-password', '-s', 'xpert-local-plugin-username'])
  const password = run('security', ['find-generic-password', '-s', 'xpert-local-plugin-password'])
  const legacyToken = run('security', ['find-generic-password', '-s', 'xpert-local-plugin-token'])
  return (username.ok && password.ok) || legacyToken.ok
}

function packageScripts(platformPath) {
  const packageJson = readJson(join(platformPath, 'package.json'))
  if (!packageJson) throw new Error(`Missing or invalid package.json: ${platformPath}`)
  return {
    packageManager: packageJson.packageManager || null,
    scripts: packageJson.scripts || {}
  }
}

function pluginCompatibility(platformPath, pluginPath) {
  if (!pluginPath) return null
  const pluginPackage = readJson(join(pluginPath, 'package.json'))
  const sdkVersion = readJson(join(platformPath, 'packages', 'plugin-sdk', 'package.json'))?.version || null
  const contractsVersion = readJson(join(platformPath, 'packages', 'contracts', 'package.json'))?.version || null
  const sdkPeer = pluginPackage?.peerDependencies?.['@xpert-ai/plugin-sdk'] || null
  const contractsPeer = pluginPackage?.peerDependencies?.['@xpert-ai/contracts'] || null
  const status = (range, version) => {
    if (!range) return 'not_declared'
    if (!version) return 'platform_version_unknown'
    if (range === '*' || range === version || range === `^${version}` || range === `~${version}`) return 'compatible'
    return 'requires_plugin_validation'
  }
  return {
    sdkPeer,
    sdkVersion,
    sdkCompatibility: status(sdkPeer, sdkVersion),
    contractsPeer,
    contractsVersion,
    contractsCompatibility: status(contractsPeer, contractsVersion)
  }
}

function dryRunPlan(options, paths) {
  const platformExists = existsSync(paths.platformPath)
  const steps = []
  if (!platformExists) {
    steps.push({ action: 'clone', repository: options['repo-url'], ref: options.ref || null, target: paths.platformPath })
  } else {
    steps.push({ action: 'reuse_checkout', target: paths.platformPath })
  }
  steps.push({ action: 'preserve_or_generate_missing_configuration', mode: options.mode })
  if (options.mode === 'source' && !options['skip-bootstrap']) steps.push({ action: 'run_repository_bootstrap' })
  if (!options['skip-start']) {
    steps.push({ action: 'start_namespaced_infrastructure', composeProject: paths.composeProject })
    steps.push({ action: options.mode === 'source' ? 'start_source_api_and_cloud' : 'start_full_docker_platform' })
    steps.push({ action: 'verify_api_ui_and_runtime_ownership' })
  }
  steps.push({ action: 'write_secret_free_receipt', stateDir: paths.stateDir })
  return {
    dryRun: true,
    mode: options.mode,
    workspace: paths.workspace,
    platform: paths.platformPath,
    plugin: paths.pluginPath,
    composeProject: paths.composeProject,
    apiUrl: paths.apiUrl,
    webUrl: paths.webUrl,
    stateDir: paths.stateDir,
    steps
  }
}

let options
try {
  options = parseArgs(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  usage()
  process.exit(2)
}

if (options.help) {
  usage()
  process.exit(0)
}

const workspace = assertSafeTarget(options.workspace, 'Workspace')
const platformPath = assertSafeTarget(options.platform || join(workspace, 'xpert'), 'Platform path')
const pluginPath = options['plugin-dir'] ? assertSafeTarget(options['plugin-dir'], 'Plugin path') : null
const composeProject = options['compose-project'] || composeProjectFor(platformPath)
const apiUrl = options['api-url'] || 'http://localhost:3000/api/health/ready'
const webUrl = options['web-url'] || (options.mode === 'source' ? 'http://localhost:4200/' : 'http://localhost/')
const stateDir = assertSafeTarget(
  options['state-dir'] || join(workspace, '.xpert-local-environment', environmentKey(platformPath)),
  'State directory'
)
const paths = { workspace, platformPath, pluginPath, composeProject, apiUrl, webUrl, stateDir }

try {
  validateRepositoryUrl(options['repo-url'])
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(2)
}

if (!options.apply) {
  const plan = dryRunPlan(options, paths)
  if (options.json) console.log(JSON.stringify(plan, null, 2))
  else {
    console.log('Xpert local setup plan (dry-run)')
    console.log(`Mode: ${plan.mode}`)
    console.log(`Platform: ${plan.platform}`)
    console.log(`Compose project: ${plan.composeProject}`)
    for (const [index, step] of plan.steps.entries()) console.log(`${index + 1}. ${step.action}`)
    console.log('Run the same command with --apply to execute this plan.')
  }
  process.exit(0)
}

try {
  if (!existsSync(workspace)) throw new Error(`Workspace does not exist: ${workspace}`)
  const toolVersions = {
    node: process.version,
    git: requireCommand('git'),
    docker: requireCommand('docker'),
    dockerCompose: requireCommand('docker', ['compose', 'version']),
    corepack: null,
    lsof: null
  }
  if (options.mode === 'source') {
    toolVersions.corepack = requireCommand('corepack')
    toolVersions.lsof = requireCommand('lsof', ['-v'])
  }
  if (pluginPath && !existsSync(join(pluginPath, 'package.json'))) {
    throw new Error(`Plugin path has no package.json: ${pluginPath}`)
  }
  const apiPort = portFromUrl(apiUrl)
  const webPort = portFromUrl(webUrl)
  let adoptedApi = null
  let adoptedWeb = null
  if (options.mode === 'source') {
    adoptedApi = assertSourcePort(apiPort, platformPath, 'API')
    adoptedWeb = assertSourcePort(webPort, platformPath, 'Cloud')
  } else {
    for (const [port, label] of [[apiPort, 'API'], [webPort, 'web'], [5432, 'Postgres'], [6379, 'Redis']]) {
      if (portOccupied(port) && !dockerProjectPublishesPort(composeProject, port)) {
        throw new Error(`${label} port ${port} is already occupied by another environment.`)
      }
    }
  }

  if (!existsSync(platformPath)) {
    const cloneArgs = ['clone']
    if (options.ref) cloneArgs.push('--branch', options.ref, '--single-branch')
    cloneArgs.push(options['repo-url'], platformPath)
    console.log(`Cloning Xpert into ${platformPath}`)
    const cloned = run('git', cloneArgs, { cwd: workspace, inherit: true })
    if (!cloned.ok) throw new Error('Git clone failed.')
  }

  const initialGit = gitInfo(platformPath)
  assertRequestedRef(platformPath, options.ref)
  const packageInfo = packageScripts(platformPath)
  const requiredScripts = options.mode === 'source'
    ? ['bootstrap', 'start:api', 'start:cloud']
    : []
  for (const key of requiredScripts) {
    if (typeof packageInfo.scripts[key] !== 'string') throw new Error(`Required platform script is missing: ${key}`)
  }

  const configuration = materializeConfiguration({ platformPath, workspace, pluginPath, mode: options.mode })

  if (options.mode === 'source' && !options['skip-bootstrap']) {
    console.log('Running repository bootstrap')
    const bootstrapped = run('corepack', ['pnpm', 'bootstrap'], { cwd: platformPath, inherit: true })
    if (!bootstrapped.ok) throw new Error('Repository bootstrap failed.')
  }

  mkdirSync(stateDir, { recursive: true })
  const processes = {
    api: adoptedApi ? { pid: adoptedApi.pid, adopted: true, log: null } : null,
    cloud: adoptedWeb ? { pid: adoptedWeb.pid, adopted: true, log: null } : null
  }
  let infrastructure = options['skip-start'] ? 'not_started' : 'pending'

  if (!options['skip-start']) {
    if (options.mode === 'source') {
      const infraOccupied = portOccupied(5432) || portOccupied(6379)
      if (infraOccupied && !options['reuse-infra']) {
        throw new Error('Postgres or Redis port is occupied. Inspect ownership, then rerun with --reuse-infra only when reuse is intentional.')
      }
      if (infraOccupied) {
        infrastructure = 'reused'
      } else {
        console.log(`Starting infrastructure in Compose project ${composeProject}`)
        const compose = run('docker', [
          'compose', '-p', composeProject,
          '-f', join(platformPath, 'docker', 'docker-compose.infra.yml'),
          'up', '-d', 'db', 'redis'
        ], { cwd: platformPath, inherit: true })
        if (!compose.ok) throw new Error('Infrastructure startup failed.')
        infrastructure = 'started'
      }

      if (!processes.api) {
        const log = join(stateDir, 'api.log')
        processes.api = {
          pid: startDetached({ command: 'corepack', args: ['pnpm', 'start:api'], cwd: platformPath, logPath: log }),
          adopted: false,
          log
        }
      }
      if (!processes.cloud) {
        const log = join(stateDir, 'cloud.log')
        processes.cloud = {
          pid: startDetached({ command: 'corepack', args: ['pnpm', 'start:cloud'], cwd: platformPath, logPath: log }),
          adopted: false,
          log
        }
      }
    } else {
      console.log(`Starting full Docker platform in Compose project ${composeProject}`)
      mkdirSync(join(platformPath, 'docker', 'volumes', 'api', 'public'), { recursive: true })
      mkdirSync(join(platformPath, 'docker', 'volumes', 'api', 'data'), { recursive: true })
      const compose = run('docker', [
        'compose', '-p', composeProject,
        '-f', join(platformPath, 'docker', 'docker-compose.yml'),
        'up', '-d'
      ], { cwd: join(platformPath, 'docker'), inherit: true })
      if (!compose.ok) throw new Error('Full Docker platform startup failed.')
      infrastructure = 'started'
    }
  }

  const [apiReady, webReady] = await Promise.all(options['skip-start']
    ? [probe(apiUrl, 'api'), probe(webUrl, 'web')]
    : [
        waitFor(apiUrl, 'api', options.waitSeconds, 'API'),
        waitFor(webUrl, 'web', options.waitSeconds, 'Cloud UI')
      ])
  if (!options['skip-start'] && (!apiReady || !webReady)) {
    throw new Error(`Platform health timed out. Inspect logs under ${stateDir}.`)
  }

  const finalApiOwner = options.mode === 'source' ? assertSourcePort(apiPort, platformPath, 'API') : null
  const finalWebOwner = options.mode === 'source' ? assertSourcePort(webPort, platformPath, 'Cloud') : null
  if (!options['skip-start'] && options.mode === 'source' && (!finalApiOwner || !finalWebOwner)) {
    throw new Error('Endpoints responded but source process provenance could not be proven.')
  }
  if (!options['skip-start'] && options.mode === 'docker') {
    const finalContainers = dockerProjectContainers(composeProject)
    if (!finalContainers.some((item) => /-api-\d+$/.test(item.name || ''))
      || !finalContainers.some((item) => /-webapp-\d+$/.test(item.name || ''))) {
      throw new Error('Endpoints responded but API/webapp ownership by the selected Compose project could not be proven.')
    }
  }

  const allowlisted = options.mode === 'source' && pluginPath
    ? pluginAllowlisted(join(platformPath, '.env'), pluginPath)
    : null
  const compatibility = pluginCompatibility(platformPath, pluginPath)
  const hasDeployCommand = typeof packageInfo.scripts['plugin:deploy:local'] === 'string'
  const hasAssistantCommand = typeof packageInfo.scripts['assistant:suite:init'] === 'string'
  const authReady = credentialsAvailable()
  const platformReady = Boolean(apiReady && webReady)
  const pluginTestReady = Boolean(platformReady && pluginPath && allowlisted && hasDeployCommand && authReady)
  const status = pluginTestReady ? 'plugin_test_ready' : (platformReady ? 'platform_ready' : 'configured')
  const remainingActions = []
  if (pluginPath && allowlisted !== true) remainingActions.push('Add the plugin path to PLUGIN_WORKSPACE_ROOTS without replacing existing configuration.')
  if (pluginPath && !hasDeployCommand) remainingActions.push('Inspect the checked-out platform local plugin deployment contract.')
  if (pluginPath && !authReady) remainingActions.push('Configure local Xpert deployment credentials through the approved credential store.')
  if (!pluginPath) remainingActions.push('Select a plugin and use xpert-plugin-development for deployment/runtime verification.')

  const finalGit = gitInfo(platformPath)
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status,
    mode: options.mode,
    workspace,
    platform: {
      path: canonicalPath(platformPath),
      branch: finalGit.branch,
      commit: finalGit.commit,
      dirtyEntriesBeforeSetup: initialGit.dirtyEntries,
      dirtyEntriesAfterSetup: finalGit.dirtyEntries,
      packageManager: packageInfo.packageManager
    },
    system: toolVersions,
    configuration,
    compose: {
      project: composeProject,
      infrastructure,
      containers: dockerProjectContainers(composeProject).map((item) => ({
        name: item.name,
        ports: item.ports
      }))
    },
    processes: {
      ...processes,
      provenance: options.mode === 'source' ? {
        apiOwnedBySelectedCheckout: Boolean(finalApiOwner),
        cloudOwnedBySelectedCheckout: Boolean(finalWebOwner)
      } : null
    },
    endpoints: {
      api: { url: apiUrl, ready: Boolean(apiReady) },
      web: { url: webUrl, reachable: Boolean(webReady) }
    },
    plugin: pluginPath ? {
      path: canonicalPath(pluginPath),
      workspaceAllowlisted: allowlisted,
      deploymentCredentialsAvailable: authReady,
      compatibility
    } : null,
    discoveredCommands: {
      bootstrap: typeof packageInfo.scripts.bootstrap === 'string',
      pluginDeployLocal: hasDeployCommand,
      assistantSuiteInit: hasAssistantCommand,
      remoteViewPreview: typeof packageInfo.scripts['remote-view:preview'] === 'string'
    },
    remainingActions,
    unverifiedLayers: ['plugin_running', 'assistant_ready', 'application_accepted']
  }
  const receiptPath = join(stateDir, 'state.json')
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })

  console.log(`Status: ${status}`)
  console.log(`Platform: ${receipt.platform.path}`)
  console.log(`Revision: ${receipt.platform.branch} @ ${receipt.platform.commit}`)
  console.log(`API ready: ${receipt.endpoints.api.ready}`)
  console.log(`Cloud reachable: ${receipt.endpoints.web.reachable}`)
  console.log(`Receipt: ${receiptPath}`)
  for (const action of remainingActions) console.log(`Action required: ${action}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  try {
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(join(stateDir, 'state.json'), `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      status: 'failed',
      mode: options.mode,
      workspace,
      platform: platformPath,
      composeProject,
      error: message,
      unverifiedLayers: ['platform_ready', 'plugin_running', 'assistant_ready', 'application_accepted']
    }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  } catch {
    // The original setup failure remains the actionable result.
  }
  console.error(`Setup failed: ${message}`)
  process.exit(1)
}
