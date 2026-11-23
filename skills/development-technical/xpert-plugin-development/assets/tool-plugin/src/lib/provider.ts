import { XpertTool, XpertToolProvider, type XpertToolResult } from '@xpert-ai/plugin-sdk'
import { z } from 'zod/v3'
import { executeFeature, FeatureError } from './feature'
import { identity } from './identity'
import { inputSchema, outputSchema, type Output } from './schemas'

@XpertToolProvider({
  provider: identity.provider,
  componentKey: identity.provider.replace(/_/g, '-'),
  name: identity.title,
  label: { en_US: identity.title, zh_Hans: identity.title },
  configSchema: { type: 'object', properties: {}, required: [] },
  defaultMiddleware: identity.middleware,
  middlewares: [{ provider: identity.middleware, meta: {
    name: identity.middleware,
    label: { en_US: identity.title, zh_Hans: identity.title }
  } }]
})
export class ToolProvider {
  @XpertTool({
    name: identity.tool,
    description: 'Replace with the requested tool behavior and input limits.',
    inputSchema,
    outputSchema,
    resultFormat: 'tool_result',
    middleware: identity.middleware,
    mcp: { behavior: { risk: 'read', sideEffect: 'none', idempotency: 'safe' }, requiredContext: ['tenant'] }
  })
  run(input: z.infer<typeof inputSchema>): XpertToolResult<Output> {
    try {
      return { structuredContent: { ok: true, value: executeFeature(input) } }
    } catch (error) {
      if (!(error instanceof FeatureError)) throw error
      return { isError: true, structuredContent: { ok: false, error: { code: error.code, message: error.message } } }
    }
  }
}
