# Plugin-Managed MCP Tools And MCP Apps

Use a plugin-managed MCP server when a plugin should expose standard MCP tools, stay portable across MCP hosts, or return interactive MCP Apps inside ChatKit.

Keep this path separate from other Xpert extension paths:

1. Use normal tool plugins or Agent middleware for Xpert-native runtime workflows.
2. Use plugin-managed MCP tools when the callable surface should be standard MCP and installed as an MCP Toolset.
3. Use MCP Apps when a model-visible MCP tool should return an interactive inline app in ChatKit.
4. Use remote component or view extension plugins for persistent Workbench or integration pages, not inline tool-call results.

## Package Layout

A lightweight MCP App plugin usually looks like this. Product-ready tool plugins normally live under `tools/`; tutorial or reference implementations live under `examples/`.

```text
xpertai/tools/my-mcp-app/
├── .xpertai-plugin/
│   └── plugin.json
├── package.json
├── README.md
├── src/
│   ├── index.ts
│   ├── mcp-server.ts
│   └── lib/
│       ├── mcp-tools.ts
│       ├── app-html.ts
│       └── data.ts
└── tsconfig.lib.json
```

The normal plugin entry should still export `XpertPlugin` metadata so the platform can list, install, and initialize the plugin. For MCP-focused plugins, use `category: 'tools'`, include `targetApps: ['xpert']`, and add target app metadata such as `types: ['mcp-server', 'tool']` and capabilities such as `mcp-apps`.

## package.json Rules

1. Include built outputs, `.xpertai-plugin`, and any runtime assets in `files`.
2. Export the normal plugin entry and, when useful, the MCP server entry.
3. Provide a `bin` pointing to `dist/mcp-server.js` when the MCP server should be directly runnable.
4. Keep `@xpert-ai/plugin-sdk` in `peerDependencies`.
5. Put `@modelcontextprotocol/sdk` in `dependencies` when the stdio server imports it directly.
6. Put `@modelcontextprotocol/ext-apps` in `dependencies` for MCP Apps and prefer its `registerAppTool`, `registerAppResource`, and `RESOURCE_MIME_TYPE` helpers.
7. Use ESM consistently with `"type": "module"` when importing MCP SDK ESM entrypoints or `@modelcontextprotocol/ext-apps`.
8. Confirm the installed runtime copy includes `dist/mcp-server.js`, `.xpertai-plugin/plugin.json`, package metadata, and every file read by MCP resource handlers.

Example:

```json
{
  "name": "@xpert-ai/plugin-sales-mcp-app",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "xpert-sales-mcp-app": "./dist/mcp-server.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./mcp-server": {
      "types": "./dist/mcp-server.d.ts",
      "import": "./dist/mcp-server.js"
    }
  },
  "files": [
    "dist",
    ".xpertai-plugin",
    "README.md"
  ],
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.7.4",
    "@modelcontextprotocol/sdk": "^1.29.0"
  },
  "peerDependencies": {
    "@xpert-ai/plugin-sdk": "^3.9.1",
    "zod": "^3.25.0"
  }
}
```

## Plugin Manifest

Declare plugin-managed MCP servers in `.xpertai-plugin/plugin.json`:

```json
{
  "targetApps": ["xpert"],
  "targetAppMeta": {
    "xpert": {
      "types": ["mcp-server", "tool"],
      "capabilities": ["mcp-apps", "drilldown-analysis"]
    }
  },
  "mcpServers": {
    "sales-drilldown": {
      "type": "stdio",
      "command": "node",
      "args": ["${PLUGIN_ROOT}/dist/mcp-server.js"],
      "policy": {
        "enabled": true,
        "defaultToolsApprovalMode": "approve",
        "enabledTools": [
          "sales_overview",
          "sales_drilldown"
        ]
      }
    }
  }
}
```

Always use `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` placeholders instead of installed absolute runtime paths. Xpert should persist placeholders in generated Toolset schemas and resolve them at runtime. This prevents stale `@runtime__...` paths after reinstalling or reloading a plugin.

## Runtime Security Rules

Plugin installation does not start a plugin-managed MCP stdio server. The server starts when Xpert initializes the MCP Toolset for tool discovery, normally during agent graph compile/invoke. v1 intentionally keeps this `on-toolset-init` timing.

Assume stdio servers run through the Xpert controlled runtime:

1. The platform resolves `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` for the current runtime copy.
2. The platform validates tenant, organization, workspace, Toolset, server name, and plugin-managed scope.
3. The raw stdio command is rewritten to a platform runner; the runner launches the real child process.
4. The runner uses `shell: false`, sanitized env, controlled cwd, stderr tail capture, startup/idle/lifetime timeouts, and process-group cleanup.
5. `MCPToolset.close()` and graph normal/error/abort cleanup must close registered runtimes.

Production is fail-closed unless `XPERT_MCP_STDIO_RUNTIME_ENABLED=true` is set. Custom non-plugin-managed stdio commands must match `XPERT_MCP_STDIO_ALLOWED_COMMANDS`. Plugin-managed servers should launch Node.js entrypoints inside `${PLUGIN_ROOT}`; stale absolute `@runtime__...` paths, path traversal, and symlink escapes are rejected. Write mutable state under `${PLUGIN_DATA}`, not the plugin code directory.

Useful runtime env knobs:

```bash
XPERT_MCP_STDIO_RUNTIME_ENABLED=true
XPERT_MCP_STDIO_ALLOWED_COMMANDS=node
XPERT_MCP_STDIO_MAX_CONCURRENT_PER_TENANT=10
XPERT_MCP_STDIO_STARTUP_TIMEOUT_MS=15000
XPERT_MCP_STDIO_IDLE_TIMEOUT_MS=1800000
XPERT_MCP_STDIO_MAX_LIFETIME_MS=7200000
```

Plugins may request tighter limits in `policy.runtime`, but platform and tenant policy remain authoritative:

```json
{
  "policy": {
    "runtime": {
      "provider": "local-process",
      "startupTimeoutMs": 15000,
      "idleTimeoutMs": 1800000,
      "maxLifetimeMs": 7200000,
      "allowedCommands": ["node"]
    }
  }
}
```

Never enable production `initScripts` casually. If an admin explicitly allows them, they still run under the controlled runtime policy.

MCP Apps must include the backend-issued `appInstanceToken` in ChatKit resource/RPC requests. Production hosts reject missing, expired, or mismatched tokens. Set `XPERT_MCP_APP_TOKEN_SECRET` for production.

## MCP Server Entry

The stdio entry creates the MCP server, registers resources and tools, then connects to `StdioServerTransport`.

```ts
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { pathToFileURL } from 'node:url'
import { registerSalesMcpApp } from './lib/mcp-tools.js'

export async function createSalesMcpServer() {
  const server = new McpServer({
    name: 'xpert-sales-mcp-app',
    version: '0.1.0'
  })

  await registerSalesMcpApp(server)
  return server
}

export async function main() {
  const server = await createSalesMcpServer()
  await server.connect(new StdioServerTransport())
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  })
}
```

Do not write normal logs to stdout from a stdio MCP server. stdout is reserved for MCP protocol messages. Write diagnostics to stderr.

## MCP App Resource Rules

1. The initial app resource URI must use the `ui://` scheme.
2. The app resource must return `text/html;profile=mcp-app`; use `RESOURCE_MIME_TYPE` from `@modelcontextprotocol/ext-apps/server`.
3. Resource `_meta.ui`, not tool `_meta.ui`, owns CSP, permissions, `domain`, and `prefersBorder`.
4. Content item metadata from `resources/read` is authoritative. `resources/list` metadata from `registerAppResource` is a fallback.
5. Do not store raw app HTML in chat history.
6. For small demos, returning HTML from a TypeScript function is acceptable.
7. For production apps, keep app source as normal frontend files and bundle to static HTML/JS during build; the MCP resource handler can read the built artifact from `dist`.

## Centralized MCP App Frontend Source

Do not maintain production MCP App HTML as a large TypeScript template string. Use a centralized Vanilla TS frontend source layout inside the plugin package:

```text
src/app/
├── index.html
├── main.ts
└── styles.css
scripts/
└── build-app.mjs
dist/
└── app/
    └── index.html
```

Use this split:

1. `src/app/index.html` owns the static shell and external script tags such as ECharts CDN.
2. `src/app/main.ts` owns MCP Apps bridge calls, `ui/initialize`, `ui/notifications/tool-input`, `ui/notifications/tool-result`, `tools/call`, `resources/read`, `ui/open-link`, resize notifications, and UI state.
3. `src/app/styles.css` owns styles.
4. `scripts/build-app.mjs` uses Vite or esbuild to bundle the browser TypeScript and CSS into `dist/app/index.html`.
5. `src/lib/app-html.ts` or the equivalent server helper only reads the built artifact and returns it from the MCP resource.

For esbuild, a minimal build script should:

1. read `src/app/index.html`
2. bundle `src/app/main.ts` with `platform: 'browser'`
3. inline `src/app/styles.css`
4. write `dist/app/index.html`

Add a package script such as:

```json
{
  "scripts": {
    "build:app": "node scripts/build-app.mjs"
  }
}
```

If the plugin uses Nx, make sure `nx build <plugin>` also runs the App build before or after compiling the MCP server code. The published package must include `dist/app/index.html`; include `src/app` and `scripts` in `files` only when the runtime or local source workflow needs them.

Example resource registration:

```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import {
  RESOURCE_MIME_TYPE,
  registerAppResource
} from '@modelcontextprotocol/ext-apps/server'
import { getDashboardHtml } from './app-html.js'

const SALES_APP_URI = 'ui://sales-dashboard'
const SALES_APP_CSP = {
  resourceDomains: ['https://cdn.jsdelivr.net'],
  connectDomains: [],
  frameDomains: [],
  baseUriDomains: []
}

function buildDashboardResource(): ReadResourceResult {
  return {
    contents: [
      {
        uri: SALES_APP_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: getDashboardHtml(),
        _meta: {
          ui: {
            csp: SALES_APP_CSP,
            prefersBorder: true
          }
        }
      }
    ]
  }
}

export async function registerSalesMcpApp(server: McpServer) {
  registerAppResource(
    server,
    'sales-dashboard',
    SALES_APP_URI,
    {
      title: 'Sales Dashboard',
      description: 'Interactive sales dashboard rendered in ChatKit.',
      _meta: {
        ui: {
          csp: SALES_APP_CSP,
          prefersBorder: true
        }
      }
    },
    () => buildDashboardResource()
  )
}
```

## MCP Tool Metadata Rules

1. A model-visible tool that opens an app should set `_meta.ui.resourceUri`.
2. Use `_meta.ui.visibility = ['model', 'app']` for tools callable by both the model and the iframe.
3. Use `_meta.ui.visibility = ['app']` for app-only tools. These must not be exposed to the LLM but may be called by the iframe through `tools/call`.
4. Do not put CSP or permissions on tool `_meta.ui` except as a temporary legacy fallback for older hosts.
5. Return plain text fallback content and stable `structuredContent` for the app initial state.
6. Optionally include `_meta['openai/outputTemplate']` for ChatGPT compatibility, but implement the standard MCP Apps bridge first.

Example tool registration:

```ts
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server'
import { z } from 'zod'

const overviewMeta = {
  ui: {
    resourceUri: SALES_APP_URI,
    visibility: ['model', 'app']
  },
  'openai/outputTemplate': SALES_APP_URI
}

registerAppTool(
  server,
  'sales_overview',
  {
    title: 'Sales Overview',
    description: 'Show an interactive sales dashboard with drilldown analysis.',
    inputSchema: {
      metric: z.enum(['revenue', 'margin', 'orders']).default('revenue'),
      groupBy: z.enum(['region', 'product', 'month']).default('region'),
      year: z.number().int().default(2026)
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    _meta: overviewMeta
  },
  (args) => ({
    content: [{ type: 'text', text: 'Revenue by region for 2026.' }],
    structuredContent: {
      chart: {
        labels: ['West', 'East', 'South', 'North'],
        values: [7600000, 6500000, 5600000, 4800000]
      }
    },
    _meta: overviewMeta
  })
)
```

Example app-only tool:

```ts
registerAppTool(
  server,
  'sales_drilldown',
  {
    title: 'Sales Drilldown',
    description: 'App-only tool used by the dashboard after a chart click.',
    inputSchema: {
      metric: z.enum(['revenue', 'margin', 'orders']).default('revenue'),
      groupBy: z.enum(['region', 'product', 'month']).default('product'),
      year: z.number().int().default(2026),
      filters: z.object({
        region: z.string().optional(),
        product: z.string().optional(),
        month: z.string().optional()
      }).default({})
    },
    _meta: {
      ui: {
        visibility: ['app']
      }
    }
  },
  (args) => ({
    content: [{ type: 'text', text: 'Drilldown data loaded.' }],
    structuredContent: {
      filters: args.filters
    }
  })
)
```

Xpert enforces both sides of visibility:

1. Tools without `model` visibility are not exposed to the LLM.
2. iframe calls are rejected unless the target tool has `app` visibility and is enabled by Toolset policy.

## ChatKit MCP App Authoring Rules

The app runs in a sandboxed iframe and communicates with ChatKit through the standard MCP Apps JSON-RPC `postMessage` bridge.

At minimum, app HTML should:

1. Initialize with `ui/initialize` using `protocolVersion`, `appInfo`, and `appCapabilities`.
2. Handle `ui/notifications/tool-input` for the original tool arguments.
3. Handle standard `ui/notifications/tool-result` params as MCP `CallToolResult` shape. Read `params.content` and `params.structuredContent`; only use legacy `params.result` as a temporary fallback.
4. Call app-visible tools with `tools/call`.
5. Read same-server MCP resources with `resources/read` when needed.
6. Open external links through `ui/open-link` with `params.url`.
7. Send `ui/notifications/size-changed` after layout changes.
8. Avoid direct API calls to the Xpert backend.

## ChatKit Theme Variables

The host injects theme variables into the MCP App iframe before app JavaScript runs. Use the public `--mcp-app-*` variables in `src/app/styles.css` and read them from `getComputedStyle(document.documentElement)` when a chart or editor library needs JavaScript colors. The prefix is intentionally host-neutral so ChatKit and other MCP Apps clients can share the same contract.

Core variables:

1. `--mcp-app-color-background` and `--mcp-app-color-foreground`
2. `--mcp-app-color-card` and `--mcp-app-color-card-foreground`
3. `--mcp-app-color-primary` and `--mcp-app-color-primary-foreground`
4. `--mcp-app-color-secondary` and `--mcp-app-color-secondary-foreground`
5. `--mcp-app-color-muted` and `--mcp-app-color-muted-foreground`
6. `--mcp-app-color-accent` and `--mcp-app-color-accent-foreground`
7. `--mcp-app-color-destructive` and `--mcp-app-color-destructive-foreground`
8. `--mcp-app-color-border`, `--mcp-app-color-input`, and `--mcp-app-color-ring`
9. `--mcp-app-color-chart-1` through `--mcp-app-color-chart-5` as host-provided chart color hints
10. `--mcp-app-radius`, `--mcp-app-font-sans`, `--mcp-app-font-mono`, and `--mcp-app-color-scheme`

Recommended CSS:

```css
body {
  margin: 0;
  font-family: var(--mcp-app-font-sans, system-ui, sans-serif);
  color: var(--mcp-app-color-foreground, #0f172a);
  background: var(--mcp-app-color-background, #fff);
}

.panel {
  background: var(--mcp-app-color-card, #fff);
  border: 1px solid var(--mcp-app-color-border, #e2e8f0);
  border-radius: var(--mcp-app-radius, 8px);
}
```

Recommended JavaScript:

```ts
const styles = getComputedStyle(document.documentElement)
const primaryColor = styles.getPropertyValue('--mcp-app-color-primary').trim()
const mutedTextColor = styles.getPropertyValue('--mcp-app-color-muted-foreground').trim()
```

`ui/initialize` also returns `hostContext.theme` as `light` or `dark` and `hostContext.themeCssVariables` as the same variable map. CSS variables are the source of truth for visual styling; the initialize payload is useful for libraries that need object-based theme initialization.

For business charts, do not blindly use host UI colors or neutral `--mcp-app-color-chart-*` hints as data series colors. Define app-owned semantic palette variables such as `--sales-chart-revenue`, `--sales-chart-margin`, or `--risk-chart-high` when the chart needs stronger visual distinction. Continue using `--mcp-app-*` for the app shell, typography, borders, inputs, and panel surfaces.

Do not read ChatKit private variables such as `--background` directly from the iframe, do not depend on ChatKit DOM classes, and do not hardcode tenant-specific palettes inside plugin assets.

Do not pass tokens, API URLs, tenant IDs, organization IDs, assistant IDs, or permission data into the iframe. Treat CSP as deny-by-default and explicitly declare required resource or connection domains on resource `_meta.ui.csp`.

ChatKit implements the standard MCP Apps bridge. It does not implement the ChatGPT-specific `window.openai` API.

## Build, Install, And Runtime Validation

Recommended validation order:

1. Build the plugin package.
2. Confirm `dist/mcp-server.js`, `.xpertai-plugin/plugin.json`, built app assets, and runtime dependencies exist in the package output.
3. Smoke test the MCP server with `node dist/mcp-server.js` or a create-server import smoke test. Ensure normal logs are not written to stdout.
4. Install or reload the plugin through the local platform.
5. Initialize plugin resources so Xpert creates the plugin-managed MCP Toolset.
6. Attach the Toolset to an agent.
7. Ask ChatKit for the interactive result.
8. Verify the inline app renders, receives the original tool input/result, calls app-only tools, and resizes.

When developing locally, rebuilding the source package may not update the installed runtime copy. Reinstall or reload the plugin after changes so the runtime copy receives the latest `dist`, manifest, package metadata, and built app assets.

## Test Checklist

Cover:

1. stdio server startup and stderr-only diagnostics
2. App build output `dist/app/index.html` exists and contains the MCP Apps bridge script
3. `tools/list` returns model-visible tools and excludes app-only tools
4. model-visible tool result includes `_meta.ui.resourceUri`
5. MCP App resource returns `text/html;profile=mcp-app`
6. resource metadata includes needed `_meta.ui.csp`, `_meta.ui.permissions`, and `prefersBorder`
7. `structuredContent` shape matches iframe expectations
8. app-only tools contain `_meta.ui.visibility = ['app']`
9. Toolset policy enables every tool the app needs
10. iframe initializes, receives tool input/result, calls app-only tools, and resizes
11. iframe styles use `--mcp-app-*` variables and chart/editor themes read those variables instead of hardcoded colors
12. external scripts and browser connections are covered by resource CSP metadata
13. plugin reinstall does not persist stale absolute `@runtime__...` paths

## Common Failures

1. `Cannot find module ... @runtime__...`: persisted MCP schema contains an old installed runtime path. Use `${PLUGIN_ROOT}` in `plugin.json`, rebuild, and reinstall or reinitialize old plugin resources.
2. MCP server exits immediately: missing `dist/mcp-server.js`, bad ESM/CJS config, missing dependency, or exception during server setup. Run locally and inspect stderr.
3. `server.registerResource is not a function`: the runtime MCP SDK version is too old for direct `registerResource`; use `@modelcontextprotocol/ext-apps` helpers with a compatible SDK in the plugin package.
4. app-only tool appears in model tools: missing `_meta.ui.visibility = ['app']` or host did not preserve `_meta`.
5. App loads but `tools/call` fails: target tool is not app-visible or is disabled by Toolset policy.
6. CDN script is blocked: resource CSP metadata does not include the CDN domain. Add it to resource `_meta.ui.csp.resourceDomains`.
7. Refresh returns MCP App resource 404: app instance expired and revive metadata/toolset resolution failed. Verify ChatKit message metadata includes `toolsetId`, `resourceUri`, `toolName`, and `serverName`, then reload after rebuilding current frontend/backend.
