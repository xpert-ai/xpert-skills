#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

function fail(message) {
  console.error(`[xpert-assistant-dsl-validator] ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { yamlPath: null, contributionSource: null, builtYaml: null }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--contribution-source') {
      const value = argv[index + 1]
      if (!value) fail('--contribution-source requires a path')
      args.contributionSource = path.resolve(value)
      index += 1
    } else if (token === '--built-yaml') {
      const value = argv[index + 1]
      if (!value) fail('--built-yaml requires a path')
      args.builtYaml = path.resolve(value)
      index += 1
    } else if (!args.yamlPath) {
      args.yamlPath = path.resolve(token)
    } else {
      fail(`Unexpected argument: ${token}`)
    }
  }
  if (!args.yamlPath) {
    fail('Usage: validate-assistant-dsl.mjs <assistant.yaml> [--contribution-source <source.ts>] [--built-yaml <dist.yaml>]')
  }
  return args
}

function loadYamlParser(targetPath) {
  const targetRequire = createRequire(path.join(path.dirname(targetPath), 'package.json'))
  try {
    return targetRequire('yaml')
  } catch {
    const cwdRequire = createRequire(path.join(process.cwd(), 'package.json'))
    try {
      return cwdRequire('yaml')
    } catch {
      fail("The 'yaml' package is required in the target repository or current working directory")
    }
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function detectCycle(agentKeys, edges) {
  const outgoing = new Map(agentKeys.map((key) => [key, []]))
  for (const edge of edges) outgoing.get(edge.from)?.push(edge.to)
  const visiting = new Set()
  const visited = new Set()

  function visit(key) {
    if (visiting.has(key)) return true
    if (visited.has(key)) return false
    visiting.add(key)
    for (const child of outgoing.get(key) ?? []) {
      if (visit(child)) return true
    }
    visiting.delete(key)
    visited.add(key)
    return false
  }

  return agentKeys.some(visit)
}

function findSkillObjects(source) {
  const matches = []
  const skillsMatch = source.match(/(?:templateSkills|skills)\s*=\s*\[([\s\S]*?)\]\s*(?:\n|;)/)
  if (!skillsMatch) return matches
  for (const objectMatch of skillsMatch[1].matchAll(/\{([\s\S]*?)\}/g)) {
    const body = objectMatch[1]
    const componentKey = body.match(/componentKey\s*:\s*['"]([^'"]+)['"]/)?.[1]
    if (!componentKey) continue
    matches.push({
      componentKey,
      hasPluginName: /pluginName\s*:/.test(body),
      hasTargetAgentKey: /targetAgentKey\s*:/.test(body),
      targetAgentKey: body.match(/targetAgentKey\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? null
    })
  }
  return matches
}

const args = parseArgs(process.argv.slice(2))
if (!fs.existsSync(args.yamlPath)) fail(`YAML file not found: ${args.yamlPath}`)

const yaml = loadYamlParser(args.yamlPath)
let document
try {
  document = yaml.parse(fs.readFileSync(args.yamlPath, 'utf8'))
} catch (error) {
  fail(`Could not parse YAML: ${error instanceof Error ? error.message : String(error)}`)
}

const errors = []
const warnings = []
if (!isObject(document?.team)) errors.push('team must be an object')
if (document?.team?.type !== 'agent') errors.push("team.type must be 'agent'")
if (!Array.isArray(document?.nodes)) errors.push('nodes must be an array')
if (!Array.isArray(document?.connections)) errors.push('connections must be an array')

const nodes = Array.isArray(document?.nodes) ? document.nodes : []
const connections = Array.isArray(document?.connections) ? document.connections : []
const nodeByKey = new Map()
for (const node of nodes) {
  if (!node?.key) {
    errors.push('Every node must have a key')
    continue
  }
  if (nodeByKey.has(node.key)) errors.push(`Duplicate node key: ${node.key}`)
  nodeByKey.set(node.key, node)
}

const agents = nodes.filter((node) => node?.type === 'agent')
const agentKeys = agents.map((node) => node.key)
const primaryAgentKey = document?.team?.agent?.key
if (!primaryAgentKey) errors.push('team.agent.key is required')
else if (!agentKeys.includes(primaryAgentKey)) errors.push(`Primary Agent node is missing: ${primaryAgentKey}`)

const agentConnections = connections.filter((connection) => connection?.type === 'agent')
for (const connection of connections) {
  if (!connection?.from || !nodeByKey.has(connection.from)) {
    errors.push(`Connection '${connection?.key ?? '<unknown>'}' has a missing from node: ${connection?.from}`)
  }
  if (!connection?.to || !nodeByKey.has(connection.to)) {
    errors.push(`Connection '${connection?.key ?? '<unknown>'}' has a missing to node: ${connection?.to}`)
  }
}

for (const agent of agents) {
  const entity = agent.entity ?? {}
  if (entity.key && entity.key !== agent.key) errors.push(`Agent entity key differs from node key: ${agent.key}`)
  if (agent.key === primaryAgentKey) continue
  if (!entity.leaderKey) {
    errors.push(`Child Agent is missing entity.leaderKey: ${agent.key}`)
    continue
  }
  const parents = agentConnections.filter((connection) => connection.to === agent.key)
  if (parents.length !== 1) errors.push(`Child Agent must have exactly one incoming Agent connection: ${agent.key}`)
  else if (parents[0].from !== entity.leaderKey) {
    errors.push(`leaderKey and Agent connection parent differ for ${agent.key}`)
  }
  if (parents.length === 1 && parents[0].required !== true) {
    warnings.push(`Child Agent connection is not required: ${parents[0].key ?? agent.key}`)
  }
}

for (const connection of agentConnections) {
  if (!agentKeys.includes(connection.from) || !agentKeys.includes(connection.to)) {
    errors.push(`Agent connection must join two Agent nodes: ${connection.key ?? `${connection.from}/${connection.to}`}`)
  }
}
if (detectCycle(agentKeys, agentConnections)) errors.push('Agent graph contains a cycle')

const knowledgeConnections = connections.filter((connection) => connection?.type === 'knowledge')
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
for (const node of nodes.filter((node) => node?.type === 'knowledge')) {
  if (uuidPattern.test(node.key)) errors.push(`Reusable DSL contains an organization-bound knowledge UUID: ${node.key}`)
}
for (const connection of knowledgeConnections) {
  if (!agentKeys.includes(connection.from)) errors.push(`Knowledge connection source is not an Agent: ${connection.from}`)
  if (nodeByKey.get(connection.to)?.type !== 'knowledge') {
    errors.push(`Knowledge connection target is not a knowledge node: ${connection.to}`)
  }
}

for (const agent of agents) {
  const declared = Array.isArray(agent.entity?.knowledgebaseIds) ? [...agent.entity.knowledgebaseIds].sort() : []
  const connected = knowledgeConnections.filter((connection) => connection.from === agent.key).map((connection) => connection.to).sort()
  if (declared.length && JSON.stringify(declared) !== JSON.stringify(connected)) {
    warnings.push(`knowledgebaseIds differ from knowledge connections for ${agent.key}`)
  }
}

const mutePaths = document?.team?.agentConfig?.mute
if (mutePaths != null && !Array.isArray(mutePaths)) errors.push('team.agentConfig.mute must be an array')
for (const pathValue of Array.isArray(mutePaths) ? mutePaths : []) {
  const key = Array.isArray(pathValue) ? pathValue.at(-1) : null
  if (!key || !agentKeys.includes(key)) errors.push(`Mute path references a missing Agent: ${JSON.stringify(pathValue)}`)
}

if (document?.team?.version == null) warnings.push('team.version is missing')

let skillDependencies = []
if (args.contributionSource) {
  if (!fs.existsSync(args.contributionSource)) fail(`Contribution source not found: ${args.contributionSource}`)
  skillDependencies = findSkillObjects(fs.readFileSync(args.contributionSource, 'utf8'))
  for (const skill of skillDependencies) {
    if (!skill.hasPluginName) errors.push(`Skill '${skill.componentKey}' is missing pluginName`)
    if (!skill.hasTargetAgentKey) errors.push(`Skill '${skill.componentKey}' is missing targetAgentKey`)
    if (skill.targetAgentKey && !agentKeys.includes(skill.targetAgentKey)) {
      errors.push(`Skill '${skill.componentKey}' targets a missing Agent: ${skill.targetAgentKey}`)
    }
  }
}

let builtYamlMatches = null
if (args.builtYaml) {
  if (!fs.existsSync(args.builtYaml)) fail(`Built YAML not found: ${args.builtYaml}`)
  builtYamlMatches = fs.readFileSync(args.yamlPath, 'utf8') === fs.readFileSync(args.builtYaml, 'utf8')
  if (!builtYamlMatches) errors.push('Built YAML differs from source YAML')
}

const summary = {
  yaml: args.yamlPath,
  version: document?.team?.version ?? null,
  primaryAgentKey: primaryAgentKey ?? null,
  agentKeys,
  agentConnectionCount: agentConnections.length,
  knowledgeConnectionCount: knowledgeConnections.length,
  skillDependencies,
  builtYamlMatches,
  warnings,
  errors
}

console.log(JSON.stringify(summary, null, 2))
if (errors.length) process.exit(1)
