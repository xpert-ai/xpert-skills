#!/usr/bin/env node
// Read-only validation against a trusted Xpert checkout; never loads plugin-supplied code.
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

async function main() {
  const { values } = parseArgs({
    options: {
      'platform-root': { type: 'string' },
      'plugin-root': { type: 'string' },
      'allow-partial': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false }
    }
  })
  if (values.help) {
    console.log('Usage: node validate-agent-plugin.mjs --platform-root <trusted-xpert-checkout> --plugin-root <package> [--allow-partial]')
    return
  }
  if (!values['platform-root'] || !values['plugin-root']) {
    throw new Error('Both --platform-root and --plugin-root are required.')
  }

  const platformRoot = resolve(values['platform-root'])
  const pluginRoot = resolve(values['plugin-root'])
  const require = createRequire(join(platformRoot, 'package.json'))
  const { createJiti } = require('jiti')
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false })
  const { parseAgentPlugin } = await jiti.import(
    join(platformRoot, 'packages/server-ai/src/agent-plugin/agent-plugin-parser.ts')
  )
  const plugin = await parseAgentPlugin(pluginRoot)
  const servers = new Set(plugin.servers.map((server) => server.key))
  const connectors = Object.keys(plugin.extension?.connectors ?? {})
  const unresolvedConnectors = connectors.filter((key) => !servers.has(key))
  const diagnostics = [...plugin.diagnostics]
  for (const key of unresolvedConnectors) {
    diagnostics.push({
      component: key,
      code: 'unresolved_connector',
      message: 'Connector requires a valid, supported MCP server with the same key.'
    })
  }
  const accepted = unresolvedConnectors.length === 0 &&
    (values['allow-partial'] || diagnostics.length === 0)
  console.log(JSON.stringify({
    name: plugin.name,
    version: plugin.version,
    skills: plugin.skills.map((skill) => skill.key),
    mcpServers: [...servers],
    connectors,
    middlewares: plugin.extension?.middlewares?.map((item) => item.key) ?? [],
    experts: plugin.extension?.experts?.map((item) => item.reference) ?? [],
    diagnostics,
    accepted,
    verification: 'Local parsing only; publication, credentials and live tools are not verified.'
  }, null, 2))
  if (!accepted) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({
    accepted: false,
    error: error instanceof Error ? error.message : 'Validation failed'
  }))
  process.exitCode = 1
})
