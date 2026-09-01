#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const VALUE_OPTIONS = new Set([
  'workspace',
  'platform',
  'plugin-dir',
  'mode',
  'api-url',
  'web-url',
  'compose-project'
])

function usage() {
  console.log(`Usage:
  node inspect-xpert-local-environment.mjs [options]

Options:
  --workspace <path>         Workspace containing or intended to contain Xpert
  --platform <path>          Exact Xpert checkout (default: <workspace>/xpert)
  --plugin-dir <path>        Optional plugin root to check for source visibility
  --mode <auto|source|docker>
  --api-url <url>            Override API readiness URL
  --web-url <url>            Override Cloud UI URL
  --compose-project <name>   Override the derived Compose project name
  --json                     Print JSON only
  --strict                   Exit non-zero for readiness errors
  --help                     Show this help

This command is read-only. It never prints environment values or credentials.`)
}

function parseArgs(argv) {
  const options = {
    workspace: process.cwd(),
    mode: 'auto',
    json: false,
    strict: false,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--json' || token === '--strict' || token === '--help') {
      options[token.slice(2)] = true
      continue
    }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (!VALUE_OPTIONS.has(key)) throw new Error(`Unknown option: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`)
    options[key] = value
    index += 1
  }

  if (!['auto', 'source', 'docker'].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`)
  }
  return options
}

function run(command, args = [], cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  }
}

function commandVersion(command, args = ['--version']) {
  const result = run(command, args)
  return {
    available: result.ok,
    version: result.ok ? result.stdout.split('\n')[0] || null : null
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
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

function sanitizeRemote(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    return value.replace(/\/\/[^/@]+@/, '//<redacted>@')
  }
}

function inspectRepository(path) {
  if (!existsSync(path)) return null
  const root = run('git', ['rev-parse', '--show-toplevel'], path)
  if (!root.ok || canonicalPath(root.stdout) !== canonicalPath(path)) return null
  const packageJson = readJson(join(path, 'package.json'))
  const branch = run('git', ['branch', '--show-current'], path)
  const commit = run('git', ['rev-parse', 'HEAD'], path)
  const status = run('git', ['status', '--porcelain'], path)
  const remote = run('git', ['remote', 'get-url', 'origin'], path)
  const scripts = packageJson?.scripts || {}
  const expectedScripts = [
    'bootstrap',
    'start:api',
    'start:cloud',
    'plugin:deploy:local',
    'assistant:suite:init',
    'remote-view:preview'
  ]

  return {
    path: canonicalPath(path),
    packageName: packageJson?.name || null,
    packageManager: packageJson?.packageManager || null,
    nodeEngine: packageJson?.engines?.node || null,
    branch: branch.ok ? branch.stdout || '(detached)' : null,
    commit: commit.ok ? commit.stdout : null,
    dirtyEntries: status.ok && status.stdout ? status.stdout.split('\n').filter(Boolean).length : 0,
    remote: remote.ok ? sanitizeRemote(remote.stdout) : null,
    sdkVersion: readJson(join(path, 'packages', 'plugin-sdk', 'package.json'))?.version || null,
    contractsVersion: readJson(join(path, 'packages', 'contracts', 'package.json'))?.version || null,
    scripts: Object.fromEntries(expectedScripts.map((key) => [key, typeof scripts[key] === 'string']))
  }
}

function inspectPlugin(path) {
  if (!path || !existsSync(path)) return null
  const packageJson = readJson(join(path, 'package.json'))
  return {
    path: canonicalPath(path),
    packageName: packageJson?.name || null,
    sdkPeer: packageJson?.peerDependencies?.['@xpert-ai/plugin-sdk'] || null,
    contractsPeer: packageJson?.peerDependencies?.['@xpert-ai/contracts'] || null,
    hasPackageJson: Boolean(packageJson)
  }
}

function parseEnv(path) {
  if (!existsSync(path)) return null
  const values = new Map()
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match) values.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ''))
  }
  return values
}

function pluginWorkspaceVisible(sourceEnv, pluginPath) {
  if (!sourceEnv || !pluginPath) return null
  const raw = sourceEnv.get('PLUGIN_WORKSPACE_ROOTS')
  if (!raw) return false
  return raw.split(/[;,]/).map((item) => item.trim()).filter(Boolean)
    .some((root) => existsSync(root) && isInside(pluginPath, root))
}

function portFromUrl(value) {
  const url = new URL(value)
  if (url.port) return Number(url.port)
  return url.protocol === 'https:' ? 443 : 80
}

function listenersForPort(port, platformPath) {
  const pidsResult = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
  if (!pidsResult.ok || !pidsResult.stdout) return []
  const pids = [...new Set(pidsResult.stdout.split('\n').map(Number).filter(Number.isInteger))]
  return pids.map((pid) => {
    const executable = run('ps', ['-p', String(pid), '-o', 'comm='])
    const cwdResult = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
    const cwdLine = cwdResult.stdout.split('\n').find((line) => line.startsWith('n'))
    const cwd = cwdLine ? cwdLine.slice(1) : null
    return {
      pid,
      executable: executable.ok ? basename(executable.stdout) : null,
      cwd,
      ownedByPlatform: Boolean(cwd && isInside(cwd, platformPath))
    }
  })
}

function composeProjectFor(platformPath) {
  const hash = createHash('sha256').update(canonicalPath(platformPath)).digest('hex').slice(0, 8)
  const name = basename(platformPath).toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'xpert'
  return `${name}-${hash}`
}

function inspectComposeProject(project) {
  const list = run('docker', [
    'ps', '-a',
    '--filter', `label=com.docker.compose.project=${project}`,
    '--format', '{{json .}}'
  ])
  if (!list.ok || !list.stdout) return []
  return list.stdout.split('\n').filter(Boolean).map((line) => {
    try {
      const item = JSON.parse(line)
      return {
        id: item.ID || null,
        name: item.Names || item.Name || null,
        status: item.Status || null,
        ports: item.Ports || null
      }
    } catch {
      return { id: null, name: null, status: 'unparseable', ports: null }
    }
  })
}

async function probe(url, kind) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual' })
    const result = { url, reachable: response.status < 500, status: response.status }
    if (kind === 'api' && response.ok) {
      try {
        const payload = await response.json()
        result.ready = payload?.status === 'ready'
      } catch {
        result.ready = false
      }
    }
    return result
  } catch (error) {
    return {
      url,
      reachable: false,
      ready: false,
      error: error instanceof Error ? error.name : 'request_failed'
    }
  } finally {
    clearTimeout(timeout)
  }
}

function minimumNodeMajor(engine) {
  if (typeof engine !== 'string') return null
  const match = engine.match(/(?:>=|\^|~)?\s*(\d{2,})/)
  return match ? Number(match[1]) : null
}

function compatibilityStatus(range, version) {
  if (!range) return 'not_declared'
  if (!version) return 'platform_version_unknown'
  if (range === '*' || range === version || range === `^${version}` || range === `~${version}`) return 'compatible'
  return 'requires_plugin_validation'
}

function printHuman(report) {
  console.log('Xpert Local Environment')
  console.log(`Status: ${report.status}`)
  console.log(`Mode: ${report.mode}`)
  console.log(`Platform: ${report.platform?.path || 'missing'}`)
  if (report.platform) {
    console.log(`Revision: ${report.platform.branch} @ ${report.platform.commit}`)
    console.log(`Dirty entries: ${report.platform.dirtyEntries}`)
  }
  console.log(`Compose project: ${report.compose.project}`)
  console.log(`API: ${report.endpoints.api.ready ? 'ready' : 'not ready'} (${report.endpoints.api.url})`)
  console.log(`Cloud: ${report.endpoints.web.reachable ? 'reachable' : 'not reachable'} (${report.endpoints.web.url})`)
  console.log(`Source config: ${report.configuration.sourceEnv ? 'present' : 'missing'}`)
  console.log(`Docker config: ${report.configuration.dockerEnv ? 'present' : 'missing'}`)
  if (report.plugin) {
    console.log(`Plugin: ${report.plugin.path}`)
    console.log(`Plugin workspace allowlisted: ${String(report.plugin.workspaceAllowlisted)}`)
  }
  if (report.issues.length) {
    console.log('Issues:')
    for (const issue of report.issues) console.log(`  [${issue.severity}] ${issue.message}`)
  } else {
    console.log('Issues: none')
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

const workspace = resolve(options.workspace)
const platformPath = resolve(options.platform || join(workspace, 'xpert'))
const pluginPath = options['plugin-dir'] ? resolve(options['plugin-dir']) : null
const platform = inspectRepository(platformPath)
const plugin = inspectPlugin(pluginPath)
const composeProject = options['compose-project'] || composeProjectFor(platformPath)
const composeContainers = inspectComposeProject(composeProject)
const sourceApiUrl = options['api-url'] || 'http://localhost:3000/api/health/ready'
const inferredMode = options.mode === 'auto'
  ? (composeContainers.some((item) => /-(?:api|webapp)-\d+$/.test(item.name || '')) ? 'docker' : 'source')
  : options.mode
const sourceWebUrl = options['web-url'] || (inferredMode === 'docker' ? 'http://localhost/' : 'http://localhost:4200/')
const apiPort = portFromUrl(sourceApiUrl)
const webPort = portFromUrl(sourceWebUrl)
const sourceEnvPath = join(platformPath, '.env')
const dockerEnvPath = join(platformPath, 'docker', '.env')
const sourceEnv = parseEnv(sourceEnvPath)
const apiListeners = platform ? listenersForPort(apiPort, platformPath) : []
const webListeners = platform ? listenersForPort(webPort, platformPath) : []
const [apiProbe, webProbe] = await Promise.all([
  probe(sourceApiUrl, 'api'),
  probe(sourceWebUrl, 'web')
])
const system = {
  node: { available: true, version: process.version },
  git: commandVersion('git'),
  corepack: commandVersion('corepack'),
  docker: commandVersion('docker'),
  dockerCompose: commandVersion('docker', ['compose', 'version']),
  lsof: commandVersion('lsof', ['-v'])
}
const issues = []

if (!system.git.available) issues.push({ severity: 'error', message: 'Git is required.' })
if (!platform) issues.push({ severity: 'error', message: `Selected Xpert checkout is missing or invalid: ${platformPath}` })
if (inferredMode === 'source' && !system.corepack.available) {
  issues.push({ severity: 'error', message: 'Corepack is required for source mode.' })
}
if (inferredMode === 'source' && !system.lsof.available) {
  issues.push({ severity: 'error', message: 'lsof is required to prove source process ownership.' })
}
if (!system.dockerCompose.available) {
  issues.push({ severity: 'error', message: 'Docker Compose is required for Xpert infrastructure.' })
}
if (platform) {
  const minimum = minimumNodeMajor(platform.nodeEngine)
  const current = Number(process.versions.node.split('.')[0])
  if (minimum && current < minimum) {
    issues.push({ severity: 'error', message: `Platform requires Node ${platform.nodeEngine}; current runtime is ${process.version}.` })
  }
  if (!platform.packageManager) issues.push({ severity: 'warning', message: 'Platform does not declare packageManager.' })
  for (const key of ['bootstrap', 'start:api', 'start:cloud', 'plugin:deploy:local']) {
    if (!platform.scripts[key]) issues.push({ severity: 'warning', message: `Platform script is missing: ${key}` })
  }
}
if (options['plugin-dir'] && !plugin) {
  issues.push({ severity: 'error', message: `Plugin directory is missing or has no readable package.json: ${pluginPath}` })
}
if (inferredMode === 'source') {
  if (!existsSync(sourceEnvPath)) issues.push({ severity: 'error', message: 'Source .env is missing.' })
  if (apiListeners.length && !apiListeners.some((item) => item.ownedByPlatform)) {
    issues.push({ severity: 'error', message: `API port ${apiPort} is owned by a different checkout or process.` })
  }
  if (webListeners.length && !webListeners.some((item) => item.ownedByPlatform)) {
    issues.push({ severity: 'error', message: `Cloud port ${webPort} is owned by a different checkout or process.` })
  }
  if (plugin && pluginWorkspaceVisible(sourceEnv, plugin.path) !== true) {
    issues.push({ severity: 'error', message: 'Plugin path is not inside a configured PLUGIN_WORKSPACE_ROOTS boundary.' })
  }
} else {
  if (!existsSync(dockerEnvPath)) issues.push({ severity: 'error', message: 'Docker .env is missing.' })
  if (!composeContainers.length) issues.push({ severity: 'error', message: `No containers belong to Compose project ${composeProject}.` })
  if (!composeContainers.some((item) => /-api-\d+$/.test(item.name || ''))) {
    issues.push({ severity: 'error', message: `Compose project ${composeProject} has no API container.` })
  }
  if (!composeContainers.some((item) => /-webapp-\d+$/.test(item.name || ''))) {
    issues.push({ severity: 'error', message: `Compose project ${composeProject} has no webapp container.` })
  }
}
if (!apiProbe.ready) issues.push({ severity: 'error', message: 'API readiness endpoint is not ready.' })
if (!webProbe.reachable) issues.push({ severity: 'error', message: 'Cloud UI is not reachable.' })

const status = issues.some((item) => item.severity === 'error') ? 'not_ready' : 'ready'
const report = {
  schemaVersion: 1,
  inspectedAt: new Date().toISOString(),
  status,
  mode: inferredMode,
  workspace,
  platform,
  system,
  configuration: {
    sourceEnv: existsSync(sourceEnvPath),
    dockerEnv: existsSync(dockerEnvPath)
  },
  compose: {
    project: composeProject,
    containers: composeContainers
  },
  endpoints: {
    api: apiProbe,
    web: webProbe
  },
  listeners: {
    api: apiListeners,
    web: webListeners
  },
  plugin: plugin ? {
    ...plugin,
    sdkVersion: platform?.sdkVersion || null,
    contractsVersion: platform?.contractsVersion || null,
    sdkCompatibility: compatibilityStatus(plugin.sdkPeer, platform?.sdkVersion),
    contractsCompatibility: compatibilityStatus(plugin.contractsPeer, platform?.contractsVersion),
    workspaceAllowlisted: inferredMode === 'source'
      ? pluginWorkspaceVisible(sourceEnv, plugin.path)
      : null
  } : null,
  issues
}

if (options.json) console.log(JSON.stringify(report, null, 2))
else printHuman(report)

if (options.strict && status !== 'ready') process.exit(1)
