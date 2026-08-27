#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(fs.readFileSync(path.join(skillDir, 'schemas/contract-manifest.json'), 'utf8'))
const fieldCatalog = JSON.parse(fs.readFileSync(path.join(skillDir, 'schemas/field-catalog.json'), 'utf8'))

function fail(message) {
  console.error(`[xpert-assistant-dsl-contract] ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { xpertRoot: null, explain: null, json: false, allowDrift: false }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--xpert-root') {
      if (!argv[index + 1]) fail('--xpert-root requires a path')
      args.xpertRoot = path.resolve(argv[index + 1])
      index += 1
    } else if (token === '--explain') {
      if (!argv[index + 1]) fail('--explain requires a YAML path')
      args.explain = argv[index + 1]
      index += 1
    } else if (token === '--json') {
      args.json = true
    } else if (token === '--allow-drift') {
      args.allowDrift = true
    } else {
      fail(`Unexpected argument: ${token}`)
    }
  }
  return args
}

function isXpertRoot(candidate) {
  return manifest.sources.every((source) => fs.existsSync(path.join(candidate, source.path)))
}

function findXpertRoot(explicitRoot) {
  if (explicitRoot) return isXpertRoot(explicitRoot) ? explicitRoot : null
  let current = process.cwd()
  while (true) {
    for (const candidate of [current, path.join(current, 'xpert')]) {
      if (isXpertRoot(candidate)) return candidate
    }
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function sha256(target) {
  return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
}

const args = parseArgs(process.argv.slice(2))
const xpertRoot = findXpertRoot(args.xpertRoot)
if (!xpertRoot) fail('Could not locate the xpert repository. Pass --xpert-root <path>.')

const sources = manifest.sources.map((source) => {
  const target = path.join(xpertRoot, source.path)
  const actualSha256 = sha256(target)
  return {
    ...source,
    actualSha256,
    matches: actualSha256 === source.sha256
  }
})
const drift = sources.filter((source) => !source.matches)
const explanations = args.explain
  ? fieldCatalog.filter((field) => field.path === args.explain || field.path.startsWith(args.explain) || args.explain.startsWith(field.path))
  : []

const result = {
  contractVersion: manifest.contractVersion,
  platformFamily: manifest.platformFamily,
  xpertRoot,
  schema: path.join(skillDir, 'schemas', manifest.schema),
  sources,
  drift: drift.map((source) => source.path),
  explanations
}

if (args.json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`Xpert Assistant DSL contract ${manifest.contractVersion}`)
  console.log(`Host root: ${xpertRoot}`)
  for (const source of sources) {
    console.log(`${source.matches ? 'OK' : 'DRIFT'}  ${source.path}`)
  }
  if (args.explain) {
    if (!explanations.length) console.log(`No catalog entry for ${args.explain}; inspect current host types.`)
    for (const field of explanations) {
      console.log(`\n${field.path}\n  type: ${field.type}\n  layer: ${field.layer}\n  UI: ${field.ui}\n  published: ${field.published}\n  source: ${field.source}`)
      if (field.notes) console.log(`  notes: ${field.notes}`)
    }
  }
}

if (drift.length && !args.allowDrift) {
  console.error('Contract drift detected. Review host types and update the schema, references, examples, validator, and manifest together.')
  process.exit(1)
}
