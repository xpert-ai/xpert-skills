#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const defaultSchemaPath = path.join(skillDir, 'schemas/assistant-dsl.schema.json')

function fail(message) {
  console.error(`[xpert-assistant-dsl-validator] ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { yamlPath: null, contributionSource: null, builtYaml: null, schemaPath: defaultSchemaPath }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--contribution-source') {
      if (!argv[index + 1]) fail('--contribution-source requires a path')
      args.contributionSource = path.resolve(argv[index + 1])
      index += 1
    } else if (token === '--built-yaml') {
      if (!argv[index + 1]) fail('--built-yaml requires a path')
      args.builtYaml = path.resolve(argv[index + 1])
      index += 1
    } else if (token === '--schema') {
      if (!argv[index + 1]) fail('--schema requires a path')
      args.schemaPath = path.resolve(argv[index + 1])
      index += 1
    } else if (!args.yamlPath) {
      args.yamlPath = path.resolve(token)
    } else {
      fail(`Unexpected argument: ${token}`)
    }
  }
  if (!args.yamlPath) {
    fail('Usage: validate-assistant-dsl.mjs <assistant.yaml> [--contribution-source <source.ts>] [--built-yaml <dist.yaml>] [--schema <schema.json>]')
  }
  return args
}

function loadYamlParser(targetPath) {
  const bases = [path.dirname(targetPath)]
  let current = process.cwd()
  while (true) {
    bases.push(current, path.join(current, 'xpert'))
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  for (const base of new Set(bases)) {
    try {
      return createRequire(path.join(base, 'package.json'))('yaml')
    } catch {
      // Try the next repository root.
    }
  }
  fail("The 'yaml' package is required in the target repository or current working directory")
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) && JSON.stringify(left) === JSON.stringify(right)
}

function validateStringList(value, pathLabel, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${pathLabel} must be an array`)
    return
  }
  if (value.length > 10) errors.push(`${pathLabel} must contain at most 10 items`)
  const normalized = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      errors.push(`${pathLabel} contains an empty or non-string item`)
      continue
    }
    normalized.push(item.trim())
  }
  if (new Set(normalized).size !== normalized.length) errors.push(`${pathLabel} contains duplicate items`)
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

function extractLiteralStringArray(source, propertyName) {
  const marker = new RegExp(`\\b${propertyName}\\s*:\\s*\\[`, 'g')
  const match = marker.exec(source)
  if (!match) return null
  const start = source.indexOf('[', match.index)
  let depth = 0
  let quote = null
  let escaped = false
  let end = -1
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
    } else if (char === '[') {
      depth += 1
    } else if (char === ']') {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }
  if (end < 0) return null
  const body = source.slice(start + 1, end)
  if (body.includes('${')) return null
  const values = []
  const stringPattern = /'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"|`((?:\\.|[^`])*)`/g
  for (const item of body.matchAll(stringPattern)) {
    values.push((item[1] ?? item[2] ?? item[3] ?? '').replace(/\\(['"\\`])/g, '$1'))
  }
  return values.length ? values : null
}

function reportUnknownFields(value, allowed, pathLabel, errors) {
  if (!isObject(value)) return
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`Unknown public field ${pathLabel}.${key}`)
  }
}

const args = parseArgs(process.argv.slice(2))
if (!fs.existsSync(args.yamlPath)) fail(`YAML file not found: ${args.yamlPath}`)
if (!fs.existsSync(args.schemaPath)) fail(`Schema file not found: ${args.schemaPath}`)

const schema = JSON.parse(fs.readFileSync(args.schemaPath, 'utf8'))
const yaml = loadYamlParser(args.yamlPath)
let document
try {
  document = yaml.parse(fs.readFileSync(args.yamlPath, 'utf8'))
} catch (error) {
  fail(`Could not parse YAML: ${error instanceof Error ? error.message : String(error)}`)
}

const errors = []
const warnings = []
const rootFields = new Set(Object.keys(schema.properties ?? {}))
const teamFields = new Set(Object.keys(schema.properties?.team?.properties ?? {}))
const featureFields = new Set(Object.keys(schema.$defs?.features?.properties ?? {}))
const nodeFields = new Set(Object.keys(schema.properties?.nodes?.items?.properties ?? {}))
const connectionFields = new Set(Object.keys(schema.properties?.connections?.items?.properties ?? {}))
const agentEntityFields = new Set([
  'key', 'name', 'title', 'description', 'avatar', 'prompt', 'promptTemplates', 'parameters',
  'outputVariables', 'options', 'copilotModel', 'leaderKey', 'collaboratorNames', 'toolsetIds', 'knowledgebaseIds'
])
const agentOptionFields = new Set([
  'hidden', 'disableMessageHistory', 'historyVariable', 'memories', 'parallelToolCalls', 'retry',
  'fallback', 'errorHandling', 'recall', 'availableTools', 'tools', 'structuredOutputMethod',
  'vision', 'attachment', 'fileUnderstanding', 'middlewares'
])

if (!isObject(document)) errors.push('Document root must be an object')
else reportUnknownFields(document, rootFields, '$', errors)
if (!isObject(document?.team)) errors.push('team must be an object')
else reportUnknownFields(document.team, teamFields, 'team', errors)
if (document?.team?.type !== 'agent') errors.push("team.type must be 'agent'")
if (!document?.team?.name || typeof document.team.name !== 'string') errors.push('team.name is required')
if (!Array.isArray(document?.nodes)) errors.push('nodes must be an array')
if (!Array.isArray(document?.connections)) errors.push('connections must be an array')

const features = document?.team?.features
if (features != null && !isObject(features)) {
  errors.push('team.features must be an object')
} else if (features) {
  reportUnknownFields(features, featureFields, 'team.features', errors)
}
const opener = features?.opener
if (opener != null) {
  if (!isObject(opener)) errors.push('team.features.opener must be an object')
  else {
    reportUnknownFields(opener, new Set(['enabled', 'message', 'questions']), 'team.features.opener', errors)
    if (typeof opener.enabled !== 'boolean') errors.push('team.features.opener.enabled must be boolean')
    if (typeof opener.message !== 'string') errors.push('team.features.opener.message must be string')
    validateStringList(opener.questions, 'team.features.opener.questions', errors)
    if (opener.enabled && !opener.questions?.length) errors.push('Enabled opener requires at least one question')
  }
}
const summarize = document?.team?.summarize
if (summarize?.maxMessages != null && summarize?.retainMessages != null && summarize.retainMessages >= summarize.maxMessages) {
  errors.push('team.summarize.retainMessages must be less than maxMessages')
}
if (document?.team?.agentConfig?.toolsMemory != null) warnings.push('team.agentConfig.toolsMemory is deprecated')
if (document?.team?.agentConfig?.disableOutputs != null) warnings.push('team.agentConfig.disableOutputs is deprecated; use mute')

const nodes = Array.isArray(document?.nodes) ? document.nodes : []
const connections = Array.isArray(document?.connections) ? document.connections : []
const nodeByKey = new Map()
for (const node of nodes) {
  if (isObject(node)) reportUnknownFields(node, nodeFields, `node[${node.key ?? '?'}]`, errors)
  if (!node?.key) {
    errors.push('Every node must have a key')
    continue
  }
  if (nodeByKey.has(node.key)) errors.push(`Duplicate node key: ${node.key}`)
  nodeByKey.set(node.key, node)
}
for (const connection of connections) {
  if (isObject(connection)) reportUnknownFields(connection, connectionFields, `connection[${connection.key ?? '?'}]`, errors)
}

const agents = nodes.filter((node) => node?.type === 'agent')
const agentKeys = agents.map((node) => node.key)
const parameterTypes = new Set([
  'text', 'paragraph', 'string', 'number', 'object', 'select', 'file', 'array[string]',
  'array[number]', 'array[object]', 'array[file]', 'array[document]', 'boolean', 'secret'
])
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
  reportUnknownFields(entity, agentEntityFields, `agent[${agent.key}].entity`, errors)
  if (isObject(entity.options)) {
    reportUnknownFields(entity.options, agentOptionFields, `agent[${agent.key}].entity.options`, errors)
    if (entity.options.vision != null) warnings.push(`Agent option vision is deprecated: ${agent.key}`)
  }
  if (entity.key && entity.key !== agent.key) errors.push(`Agent entity key differs from node key: ${agent.key}`)
  if (entity.parameters != null && !Array.isArray(entity.parameters)) {
    errors.push(`Agent parameters must be an array or null: ${agent.key}`)
  }
  const parameterNames = new Set()
  for (const parameter of Array.isArray(entity.parameters) ? entity.parameters : []) {
    if (!parameter?.name || typeof parameter.name !== 'string') {
      errors.push(`Agent parameter is missing a name: ${agent.key}`)
      continue
    }
    if (parameterNames.has(parameter.name)) errors.push(`Duplicate Agent parameter '${parameter.name}' on ${agent.key}`)
    parameterNames.add(parameter.name)
    if (!parameterTypes.has(parameter.type)) errors.push(`Unsupported Agent parameter type '${parameter.type}' for ${agent.key}.${parameter.name}`)
    if (parameter.optional != null && typeof parameter.optional !== 'boolean') errors.push(`Agent parameter optional must be boolean for ${agent.key}.${parameter.name}`)
    if (parameter.maximum != null && (typeof parameter.maximum !== 'number' || parameter.maximum <= 0)) {
      errors.push(`Agent parameter maximum must be a positive number for ${agent.key}.${parameter.name}`)
    }
    if (!parameter.description) warnings.push(`Agent parameter is missing a description: ${agent.key}.${parameter.name}`)
  }
  if (agent.key === primaryAgentKey) continue
  if (!entity.leaderKey) {
    errors.push(`Child Agent is missing entity.leaderKey: ${agent.key}`)
    continue
  }
  const parents = agentConnections.filter((connection) => connection.to === agent.key)
  if (parents.length !== 1) errors.push(`Child Agent must have exactly one incoming Agent connection: ${agent.key}`)
  else if (parents[0].from !== entity.leaderKey) errors.push(`leaderKey and Agent connection parent differ for ${agent.key}`)
  if (parents.length === 1 && parents[0].required !== true) warnings.push(`Child Agent connection is not required: ${parents[0].key ?? agent.key}`)
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
  if (nodeByKey.get(connection.to)?.type !== 'knowledge') errors.push(`Knowledge connection target is not a knowledge node: ${connection.to}`)
}
for (const agent of agents) {
  const declared = Array.isArray(agent.entity?.knowledgebaseIds) ? [...agent.entity.knowledgebaseIds].sort() : []
  const connected = knowledgeConnections.filter((connection) => connection.from === agent.key).map((connection) => connection.to).sort()
  if (declared.length && JSON.stringify(declared) !== JSON.stringify(connected)) warnings.push(`knowledgebaseIds differ from knowledge connections for ${agent.key}`)
}

const mutePaths = document?.team?.agentConfig?.mute
if (mutePaths != null && !Array.isArray(mutePaths)) errors.push('team.agentConfig.mute must be an array')
for (const pathValue of Array.isArray(mutePaths) ? mutePaths : []) {
  const key = Array.isArray(pathValue) ? pathValue.at(-1) : null
  if (!key || !agentKeys.includes(key)) errors.push(`Mute path references a missing Agent: ${JSON.stringify(pathValue)}`)
}
if (document?.team?.version == null) warnings.push('team.version is missing')

let skillDependencies = []
let contributionStartPrompts = null
if (args.contributionSource) {
  if (!fs.existsSync(args.contributionSource)) fail(`Contribution source not found: ${args.contributionSource}`)
  const contributionSource = fs.readFileSync(args.contributionSource, 'utf8')
  skillDependencies = findSkillObjects(contributionSource)
  for (const skill of skillDependencies) {
    if (!skill.hasPluginName) errors.push(`Skill '${skill.componentKey}' is missing pluginName`)
    if (!skill.hasTargetAgentKey) errors.push(`Skill '${skill.componentKey}' is missing targetAgentKey`)
    if (skill.targetAgentKey && !agentKeys.includes(skill.targetAgentKey)) errors.push(`Skill '${skill.componentKey}' targets a missing Agent: ${skill.targetAgentKey}`)
  }
  contributionStartPrompts = extractLiteralStringArray(contributionSource, 'startPrompts')
  if (contributionStartPrompts) {
    validateStringList(contributionStartPrompts, 'contribution.startPrompts', errors)
    if (opener?.enabled && !sameArray(contributionStartPrompts, opener.questions)) {
      errors.push('contribution.startPrompts must equal enabled team.features.opener.questions')
    }
  } else if (/\bstartPrompts\s*:/.test(contributionSource)) {
    warnings.push('Could not statically resolve contribution.startPrompts; add a parsed generated-template contract test')
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
  schema: args.schemaPath,
  version: document?.team?.version ?? null,
  primaryAgentKey: primaryAgentKey ?? null,
  agentKeys,
  agentConnectionCount: agentConnections.length,
  knowledgeConnectionCount: knowledgeConnections.length,
  openerQuestions: opener?.questions ?? null,
  contributionStartPrompts,
  skillDependencies,
  builtYamlMatches,
  warnings,
  errors
}

console.log(JSON.stringify(summary, null, 2))
if (errors.length) process.exit(1)
