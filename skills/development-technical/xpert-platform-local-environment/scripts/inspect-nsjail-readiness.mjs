import { statSync } from 'node:fs'
import { isAbsolute } from 'node:path'

// RPC health is a prerequisite; it does not prove command execution or agent readiness.
export async function inspectNsjailReadiness(env, { timeoutMs = 3000 } = {}) {
  const keys = ['NSJAIL_RUNNER_URL', 'NSJAIL_RUNNER_TOKEN', 'SANDBOX_VOLUME']
  const missingKeys = keys.filter((key) => !env?.get(key)?.trim())
  const result = {
    provider: 'nsjail', configured: missingKeys.length === 0, missingKeys,
    workspaceExists: false, rpcReady: false, protocolVersion: null,
    projectContentReadOnly: false, execution: 'not_checked', error: null
  }
  if (missingKeys.length) return { ...result, error: `Missing source configuration: ${missingKeys.join(', ')}.` }
  const volume = env.get('SANDBOX_VOLUME').trim()
  try {
    result.workspaceExists = isAbsolute(volume) && statSync(volume).isDirectory()
  } catch { /* Report the key, not arbitrary configuration content. */ }
  if (!result.workspaceExists) return { ...result, error: 'SANDBOX_VOLUME must be an existing absolute directory.' }
  let url
  try {
    url = new URL(env.get('NSJAIL_RUNNER_URL').trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('invalid URL')
    }
    url.pathname = `${url.pathname.replace(/\/$/, '')}/health`
  } catch {
    return { ...result, error: 'NSJAIL_RUNNER_URL must be an HTTP(S) base URL without credentials, query, or fragment.' }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.get('NSJAIL_RUNNER_TOKEN').trim()}` },
      redirect: 'manual', signal: controller.signal
    })
    if (!response.ok) {
      await response.body?.cancel()
      return { ...result, error: `NsJail authenticated health request returned HTTP ${response.status}.` }
    }
    const health = await response.json()
    result.rpcReady = health?.status === 'ok'
    result.protocolVersion = Number.isInteger(health?.protocolVersion) ? health.protocolVersion : null
    result.projectContentReadOnly = health?.capabilities?.projectContentReadOnly === true
    if (!result.rpcReady) result.error = 'NsJail health response did not report status ok.'
    return result
  } catch {
    return { ...result, error: 'NsJail health request failed, timed out, or returned invalid JSON.' }
  } finally {
    clearTimeout(timeout)
  }
}
