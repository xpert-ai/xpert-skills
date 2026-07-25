# Remote View Preview Host

Use this reference to run a React, module, or Vue Remote View without starting the full Cloud host.

## Architecture

Use the repository-level `tools/remote-view-preview` harness. It must:

- load the same generated `app.js` and `app.css` shipped by the View Provider;
- render the iframe through `@xpert-ai/plugin-sdk`;
- send the real `xpertai.remote_component` version 1 initialization envelope;
- forward `requestData`, `requestParameterOptions`, `executeAction`, and `executeFileAction`;
- keep inspectable in-memory state in a plugin-owned fixture;
- bind to `127.0.0.1` by default and expose no credentials or production data.

Keep responsibilities separate:
```text
tools/remote-view-preview/
  cli.mjs
  preview-host.mjs

remote-components/<entry>/
  app.js
  app.css
  preview.config.mjs
```

Do not put business sample data in the shared host. Do not copy the host implementation into each Remote View.
## Fixture contract

Create `preview.config.mjs` beside the generated assets:

```js
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const componentRoot = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(componentRoot, '<relative-path-to-workspace-root>')

export default {
  title: 'Orders · Remote View Preview',
  workspaceRoot,
  instanceId: 'orders-preview',
  component: {
    root: componentRoot,
    runtime: 'react'
  },
  hostContext: {
    manifest: { key: 'orders' },
    payload: {},
    initialQuery: { page: 1, pageSize: 50, parameters: {} },
    locale: 'en-US',
    theme: { mode: 'light', tokens: {} },
    debug: { enabled: false, production: true }
  },
  state: {
    items: []
  },
  async handleRequest(message, { state }) {
    if (message.type === 'requestData') {
      return { data: { items: state.items, total: state.items.length } }
    }
    if (message.type === 'executeAction') {
      state.items.push(message.input)
      return { result: { success: true, revision: state.items.length } }
    }
    throw new Error(`Unsupported preview request '${message.type}'.`)
  }
}
```
Return the same compact DTO shape as the real View Provider. Mutate `state` when an action should be authoritative, so browser tests can verify host state rather than only a toast.

Use `handleEvent(message, context)` for one-way `notify` or `resize` observation. Use `window.XpertRemoteViewPreview.emitHostEvent(event)` from browser tests to simulate forwarded Assistant tool events.
On loopback hosts, inspect `/__xpert/remote-view-preview/state` to assert fixture state after mutations. The endpoint is disabled by default when binding to a non-loopback host.
## Run

Build the Remote View first, then start the shared host:

```bash
corepack pnpm nx run <project>:generate-remote-components

corepack pnpm remote-view:preview \
  --config path/to/remote-components/<entry>/preview.config.mjs \
  --port 4417
```

Use `--port 0` in automated tests. Override `pluginSdkModule` only when the SDK is neither installed nor built at `packages/plugin-sdk/dist/index.cjs.js`.

## Validate

Run the shared harness tests and the Remote View freshness check:

```bash
corepack pnpm test:remote-view-preview
corepack pnpm nx run <project>:check-remote-components
```

In browser validation, assert initialization, visible state, at least one data request, one mutation, authoritative fixture state, and reload behavior. Capture screenshots when layout matters.

Treat this harness as simulated-host evidence only. Still run an installed-platform pass for authentication, authorization, tenant isolation, cookies/CORS, Workspace Files, Managed Queue, Sandbox Runtime, or plugin registration.
