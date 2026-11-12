import { XpertServerPlugin, type XpertPlugin } from '@xpert-ai/plugin-sdk'
import { z } from 'zod/v3'
import manifest from '../package.json'
import { ToolProvider } from './lib/provider'
import { identity, installLevel } from './lib/identity'

@XpertServerPlugin({ providers: [ToolProvider], exports: [ToolProvider] })
export class ToolPlugin {}

const plugin: XpertPlugin = {
  meta: {
    name: manifest.name,
    version: manifest.version,
    level: installLevel,
    artifactNamespace: identity.namespace,
    category: 'tools',
    author: manifest.author,
    displayName: { en_US: identity.title, zh_Hans: identity.title },
    description: { en_US: manifest.description, zh_Hans: manifest.description }
  },
  config: { schema: z.object({}).strict() },
  register() { return { module: ToolPlugin, global: true } }
}

export default plugin
export { ToolProvider }
