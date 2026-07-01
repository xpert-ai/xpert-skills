---
name: xpert-agentic-app-developer
description: Develop custom Agentic Apps on the Xpert platform as independent plugins, with a primary focus on extension views, Workbench views, remote components, Agent middleware tools, server modules, data models, Assistant templates, targetAppMeta capabilities, local plugin registration, and production plugin packaging.
---

# Xpert Agentic App Developer

## Overview

Use this skill to build an Xpert Agentic App as a production plugin, not as a loose prompt or a few attached tools. Treat the app as a closed loop: plugin metadata, server module, Agent middleware tools, persistence, Workbench or extension view UI, Assistant template, installation, and tests.

Do not confuse **Agent middleware tools** with workflow **Agent Tool** nodes. In this workflow, "tools" means callable tools returned by Agent middleware to the agent runtime.

The primary UI path for this skill is an Xpert extension view: a Workbench view manifest plus a remote component or platform-rendered view. If a task is primarily about plugin-managed MCP tools or MCP Apps, use the dedicated Xpert plugin development MCP guidance instead; this skill only mentions that path as an optional integration surface.

## Development Workflow

1. Inspect the target plugin repository and the host app conventions before editing.
2. Define the business loop: what the Agent automates, what humans review, and what the system persists.
3. Implement the plugin entry and target app metadata.
4. Register the server module, entities, services, middleware, and view provider.
5. Expose business actions as Agent middleware tools with strict schemas and call order.
6. Persist reviewable business data with evidence, confidence, status, and failure state.
7. Add a Workbench or extension view for human review and operational actions.
8. Provide an Assistant template so users can create the business assistant in one step.
9. Build and register the plugin from an independent plugin repository.
10. Validate with unit, integration, manifest, and end-to-end tests.

## Architecture Checklist

An Agentic App should usually include:

- **Business plugin**: `XpertPlugin` metadata, config schema, target apps, capabilities, templates, lifecycle.
- **Agent middleware tools**: zod schemas, tool descriptions, ordered tool calls, per-item persistence, failure reporting.
- **Services and data models**: domain entities, review state, source evidence, confidence, audit-friendly outputs.
- **Workbench or extension view**: view manifest, actions, data queries, host event subscriptions, optional remote component UI.
- **Assistant template**: DSL content, required plugins, capabilities, model options, starter prompts.
- **Optional MCP surface**: only when explicitly requested, expose standard MCP tools or MCP Apps through plugin-managed MCP servers; keep detailed MCP implementation guidance outside this skill.

## Type Boundary Hygiene

When TypeScript code shows `any` or `unknown` around plugin, SDK, React, remote bridge, or domain-library boundaries, inspect the real upstream types before editing. Avoid normalizing patterns such as `as any`, `as unknown as`, `: any`, `: unknown`, `Record<string, any>`, broad callback parameters, or untyped mocks. Prefer importing the concrete type, deriving callback/event types with `Parameters<>` / `ReturnType<>`, writing narrow type guards, or defining a small boundary DTO such as a JSON payload type. Keep unavoidable compatibility assertions local to the integration boundary through a named helper, and do not let the assertion flow into application logic.

## Debug Logging Standard

Every Agentic App with middleware tools, host events, or a remote component should include a switchable debug logger before deep debugging. Do not rely on ad hoc `console.info` statements. Detailed logs must be off by default in production and easy to enable during local development. For remote components, the host renderer should derive the default debug state from the Cloud `environment.production` value and pass it in the iframe `init` message, for example `{ debug: { enabled: !environment.production, production: environment.production } }`; the iframe should consume that value as its default and should not infer development mode from `localhost`, hostname, API URL, tenant, organization, or token-like values.

Use a small shared logger per plugin surface:

```ts
type DebugLevel = 'debug' | 'info' | 'warn' | 'error'

export function createPluginDebugLogger(namespace: string) {
  const key = `xpert.debug.${namespace}`
  const enabled = () =>
    globalThis.localStorage?.getItem(key) === '1' ||
    new URLSearchParams(globalThis.location?.search || '').get('xpertDebug') === namespace

  return {
    debug(event: string, data?: object) {
      if (enabled()) console.debug(`[${namespace}] ${event}`, redactDebugData(data))
    },
    info(event: string, data?: object) {
      if (enabled()) console.info(`[${namespace}] ${event}`, redactDebugData(data))
    },
    warn(event: string, data?: object) {
      console.warn(`[${namespace}] ${event}`, redactDebugData(data))
    },
    error(event: string, data?: object) {
      console.error(`[${namespace}] ${event}`, redactDebugData(data))
    }
  }
}
```

Keep this logger tiny and typed. Implement `redactDebugData` beside the logger to remove secrets and summarize large values before printing. Enable logging explicitly with `localStorage.setItem('xpert.debug.<entry>', '1')` or `?xpertDebug=<entry>`; support a `localStorage` value of `0` as a force-off override even when the host default enables debug. If server-side debug is needed, gate it through plugin config or an explicit environment flag, never through user-provided request data.

Log only useful checkpoints:

- Middleware: tool name, tool call id, compact input summary, target business id, success/failure, duration.
- Host event bus: event id, event type, source, tool name, target business id, subscription key.
- Remote bridge: init, host event received, event normalization result, requestData/action request id, response summary.
- Remote component state: selected business id, dirty state, refresh decision, diff counts, applied/skipped reason.

Never log tokens, credentials, raw file buffers, base64/data URLs, tenant ids, organization ids, full snapshots, full tool outputs, or personally sensitive content. Redact or summarize large payloads before printing. Production builds may keep `warn` and `error`, but debug/info must stay gated.

## Independent Plugin Repository

Develop production business plugins in an independent plugin repository, commonly with a workspace layout similar to `xpert-plugins`. The host Xpert app should load, validate, and run the plugin; avoid developing production plugin code directly inside the host application repository.

Each plugin package should declare its package metadata and SDK peer dependency:

```json
{
  "name": "@acme/plugin-contract-review",
  "version": "0.1.0",
  "main": "dist/index.cjs.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@xpert-ai/plugin-sdk": "^3.8.0"
  }
}
```

Keep `@xpert-ai/plugin-sdk` in `peerDependencies`, not `dependencies`, so the plugin does not bundle its own SDK copy.

When updating `@xpert-ai/contracts` or `@xpert-ai/plugin-sdk`, verify the versions are actually published or available from the active workspace before committing lockfile changes. If a requested peer range is not published yet, do not force a broad `pnpm-lock.yaml` rewrite or disable peer installation for the whole workspace; record the peer range only when the host is expected to provide it, and keep development-only type packages in `devDependencies` only when they are needed for local compilation.

## Plugin Entry Pattern

Define `XpertPlugin` metadata as the app-facing capability contract. For data-xpert integration, prefer `targetApps` and `targetAppMeta` over ad hoc top-level business metadata.

```ts
const plugin: XpertPlugin<z.infer<typeof ConfigSchema>> = {
  meta: {
    name: '@acme/plugin-contract-review',
    version: '0.1.0',
    level: 'system',
    category: 'middleware',
    targetApps: ['data-xpert'],
    targetAppMeta: {
      'data-xpert': {
        types: ['workbench-view', 'assistant-tool', 'business-app'],
        capabilities: ['contract-review', 'review-workbench']
      }
    },
    displayName: 'Contract Review',
    description: 'Parse contracts and expose a review workbench.',
    author: 'Acme'
  },
  config: { schema: ConfigSchema },
  templates,
  register() {
    return { module: ContractReviewPlugin, global: true }
  }
}
```

Use config only for values that administrators or deployments should change: default resource IDs, retrieval modes, external endpoints, feature flags, or credentials handled by the platform config system.

## Server Module Pattern

Register entities, services, Agent middleware, and view providers in the plugin server module.

```ts
@XpertServerPlugin({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  entities: ENTITIES,
  providers: [
    ContractReviewService,
    ContractReviewMiddleware,
    ContractReviewViewProvider
  ],
  exports: [ContractReviewService]
})
export class ContractReviewPlugin {}
```

Model for review and recovery, not only for successful tool calls. Persist source document identity, page or location, evidence text, confidence, Agent rationale, human review status, comments, retry jobs, and failure reasons when relevant.

Every plugin entity must support tenant and organization isolation. Add nullable `tenantId` and `organizationId` columns plus a composite index to each persisted entity, populate them from the Integration record or current `RequestContext` on every write, and scope reads, updates, deletes, list endpoints, duplicate checks, cache keys, and xpert/integration reverse lookups by these fields whenever they are available. Do not query plugin-owned data by only business IDs such as `integrationId`, `xpertId`, or external account IDs when tenant or organization context is known.

## Agent Middleware Tools

Expose business actions through middleware tools. Keep each tool narrow and explicit. Prefer ordered, restartable workflows over one giant tool.

Good document-intake pattern:

```text
contract_upsert_header
  -> contract_upsert_line
  -> contract_finalize_parse
```

Tool design rules:

- Use zod schemas and precise field descriptions.
- State call order in tool descriptions.
- Save long lists one item at a time.
- Include required `technicalAttributes` / `differences` arrays, or domain equivalents, even when empty.
- Require source evidence for important extracted values.
- Provide a failure-reporting tool for unreadable files or incomplete parsing.

Example:

```ts
const saveContractHeaderTool = tool(
  async (input) => {
    const contract = await service.upsertContractHeader(input)
    return JSON.stringify({
      message: 'Contract header was saved. Next save one line at a time.',
      contractId: contract.id,
      status: contract.status
    })
  },
  {
    name: 'contract_upsert_header',
    description:
      'Create or reset the parsed contract header. Call this before saving line items.',
    schema: contractHeaderSchema
  }
)
```

## Optional MCP Tools and MCP Apps

This skill is not the primary guide for plugin-managed MCP tools or MCP Apps. When the user explicitly asks for MCP tools, MCP Apps, `.xpertai-plugin/plugin.json` `mcpServers`, `ui://` resources, or ChatKit inline MCP App rendering, switch to the dedicated plugin development guidance for that surface.

Keep the boundary clear:

- Use this skill for Xpert-native Agentic Apps built around server modules, Agent middleware tools, Workbench extension views, remote components, Assistant templates, and persisted business state.
- Use plugin-managed MCP tools when the callable surface must be standard MCP and installed as a Toolset resource.
- Use MCP Apps only for inline interactive HTML returned by MCP tool calls; do not substitute MCP Apps for persistent Workbench or integration pages.
- If an Agentic App also exposes MCP tools, keep the MCP server packaging and bridge details isolated from the extension view implementation.

## Workbench View

Add a Workbench view when users must review, correct, approve, reject, upload files, or submit results. Use a remote component iframe when the UI needs custom interaction beyond declarative tables and forms.

For React remote component views, prefer TSX as the default development mode. Implement the view as maintainable React TypeScript source, preferably `remote-components/<entry>/src/main.tsx` plus supporting `*.ts`/`*.tsx` files, and generate the iframe entry `app.js` through a repeatable build step such as esbuild. Do not hand-maintain a large `React.createElement` `app.js` as the source of truth unless the user explicitly asks for a no-build static script or the existing plugin already has a deliberate no-build convention. Keep the generated `app.js` only as the runtime artifact read by `renderRemoteReactIframeHtml`, and wire `build`, `typecheck` or an equivalent check so stale generated output is caught.

For React project and remote component development, especially when React is supplied by the host iframe runtime or when TypeScript hover/types appear as `any`, read `references/react-project-development.md` before editing.

For React view components, keep user-facing static text in a small i18n dictionary or the host platform i18n mechanism instead of hardcoding strings directly in JSX. Resolve text from the remote component host locale when available, provide at least the product's primary locale and English for reusable plugins, and leave backend audit/status values raw unless there is an explicit display mapping.

For remote component data loading, route iframe requests through the platform bridge (`requestData` / `executeAction`) and the view provider. Keep initial `getViewData` responses light enough for first paint, then use tab-specific remote pagination for large tables. A stable pattern is:

- Frontend sends `requestData` with `query.page`, `query.pageSize`, `query.search`, and `query.parameters.table`.
- Use one table key per dataset, such as `accounts`, `conversations`, `messages`, or `logs`.
- Return `{ tableKey, table: { key, items, total, page, pageSize } }` from the view provider.
- Keep each tab's filters, page, and page size independent in component state.
- Reset the page to `1` whenever filters change.

`XpertViewQuery.parameters` only supports scalar values or scalar arrays. Do not send nested filter objects directly from a remote component. Serialize complex filters as a JSON string parameter such as `filtersJson`, parse it in the view provider, and tolerate malformed JSON by falling back to `{}`.

For view icons, prefer the object form supported by recent contracts:

```ts
const VIEW_ICON = {
  type: 'svg',
  value: '<svg ...>',
  alt: 'Contract Review'
} satisfies IconDefinition
```

Use this `IconDefinition` for manifest `icon` and fixed workbench menu icons. If the currently resolved `plugin-sdk` still types those fields as `string`, keep the runtime object icon and use a narrow compatibility cast at the icon assignment rather than weakening the whole manifest type.

Manifest essentials:

```ts
{
  key: 'contract_review',
  title: { en_US: 'Contract Review', zh_Hans: '合同审核' },
  hostType: 'agent',
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: {
      isolation: 'iframe',
      entry: 'contract-review'
    },
    dataSource: { mode: 'platform' }
  },
  actions: [
    {
      key: 'approve_line',
      label: { en_US: 'Approve', zh_Hans: '确认' },
      actionType: 'invoke',
      placement: 'row'
    }
  ]
}
```

Security and integration rules:

- Do not send tokens, API URLs, assistant IDs, tenant IDs, or organization IDs into the iframe.
- Route iframe data and actions through the platform bridge and view-host.
- Declare every backend interaction in the manifest before the remote component uses it.
- Use file actions for uploads and JSON actions for normal commands.
- For table views, declare pagination/search support in `querySchema`, and keep backend list endpoints tenant/organization scoped before filtering and paginating.

## Tool Completion Events

Use host event subscriptions so existing Workbench views update when Assistant middleware tools finish.

```ts
hostEvents: {
  subscriptions: [
    {
      key: 'contract-review-tool-completed',
      event: 'assistant.tool.completed',
      filter: {
        sources: ['chatkit'],
        toolNames: ['contract_upsert_header', 'contract_upsert_line']
      },
      action: {
        type: 'forward',
        debounceMs: 1000
      }
    }
  ]
}
```

Use `refresh` for simple declarative views. Use `forward` for remote components so the iframe can switch tabs, update query parameters, or refresh only affected panels.

For remote components, implement the event path as a closed protocol, not a best-effort side effect:

1. Middleware mutation tools must return a compact result that includes the mutated business id whenever possible, such as `documentId`, `drawingId`, `recordId`, `versionId`, and a human `message`.
2. The host event publisher must preserve a compact `data.input` and `data.output` summary when forwarding ChatKit tool logs. It may redact host ids before iframe delivery, but it should not drop the target business id.
3. The view manifest must declare `hostEvents.subscriptions` with stable `key`, exact `event`, `sources`, and `toolNames`. Use `action.type: 'forward'` for remote components and a small debounce only for duplicate bursts.
4. The remote bridge must forward the normalized event to the iframe and tolerate common envelope shapes: `event`, `payload`, `data`, `result`, and the whole message as fallback.
5. The remote component must normalize tool events in one tested helper. Read tool name from top-level fields, `payload/data`, `toolCall/tool_call`, `function`, `content`, and JSON string previews. Read target ids from top-level fields, `input`, `args`, `target`, `output/result`, `document/item`, and truncated `argsPreview` when possible.
6. The remote component must keep current selection, current business id, editor instance, dirty flag, and `loadData`/refresh callbacks in refs used by the host event handler. Do not let a `useEffect([])` event listener call a stale render closure.
7. The event handler must log, when debug is enabled, `received -> normalized -> target resolved -> request started -> response received -> state applied/skipped`.
8. Refresh behavior must match the mutation: update lists and metadata, then apply only the affected remote state. For canvas-like editors, use the domain library's remote-change API such as `store.mergeRemoteChanges`; avoid remounting the whole editor for autosave or tool insertions unless the document id changed.
9. Protect local edits deliberately. If the current scene is dirty and the event targets the same document, either merge safely, defer with a visible warning, or force an autosave first. Do not silently discard local changes.

Add tests for the whole event contract:

- Host event conversion from ChatKit logs includes tool name and target id.
- Renderer forwards the event to the iframe and preserves `data.input` / `data.output` summaries.
- Remote event parser handles direct, nested, `toolCall`, `content`, and truncated `argsPreview` shapes.
- Remote host event handler uses the latest refs, resolves the correct target id, calls `requestData`, and applies or skips state with an explicit reason.
- Generated remote component output is checked so the runtime `app.js` cannot drift from TSX source.

## Assistant Template

Contribute an Assistant template so users do not manually assemble middleware, prompts, model settings, state variables, and starter prompts.

Template contribution should include:

- `type: XpertTypeEnum.Agent`
- `targetApps`
- `targetAppMeta` with `types`, `capabilities`, and `requiredPlugins`
- DSL content
- starter prompts that describe real business tasks
- a prompt that tells the Assistant what to extract, when to preserve evidence, and how to report failure

## Build and Registration

Typical development loop:

```bash
pnpm install
pnpm nx build plugin-contract-review
export PLUGIN_WORKSPACE_ROOTS="/abs/path/to/xpert-plugins"
pnpm plugin:install:local \
  --workspace-path /abs/path/to/xpert-plugins/acme/contract-review \
  --org-id <your-org-id> \
  --token <your-token>
```

After changes, rebuild the independent plugin package and reinstall or reload it. For production, either publish the plugin as an npm/internal artifact and install it through the platform plugin flow, or include it as a platform-owned built-in system plugin when that is truly intended.

When developing against a local Xpert runtime, rebuilding the source package may not update the already installed runtime copy. Locate the installed plugin under the host plugin directory and sync or reinstall the built `dist`, remote component assets, scripts, package metadata, and docs before testing the UI. Re-run the plugin build after TSX changes so generated `app.js` matches source.

If the plugin also has an explicitly requested MCP surface, validate that surface with the dedicated Xpert plugin development MCP guidance; keep that validation separate from the Workbench extension view flow.

## Documentation Guidance

When writing user-facing docs for this workflow:

- Prefer conceptual names and code examples over internal source paths.
- Link platform features such as plugin development, custom middleware, Workbench, ChatKit, remote components, Assistant configuration, and plugin installation.
- Say "Agent middleware tools" when referring to tools exposed by middleware.
- Avoid linking these middleware tools to workflow Agent Tool node documentation unless the text is actually about workflow nodes.
- If MCP tools or MCP Apps are explicitly part of the request, link to the dedicated plugin development MCP guidance instead of expanding that protocol detail in this skill.
- Keep docs bilingual only when requested; otherwise follow the target documentation locale.

## Validation Checklist

Before finishing, verify:

- Plugin metadata declares `targetApps`, `targetAppMeta`, business types, and capabilities.
- SDK dependency is a peer dependency.
- Server module registers entities, services, middleware, and view providers.
- All plugin entities include `tenantId` and `organizationId`, write paths populate them, and all data reads/mutations are scoped by tenant/organization whenever context is available.
- Middleware tools have schemas, descriptions, ordered workflow, per-item persistence, and failure reporting.
- Data model preserves source evidence, confidence, review status, and failure reasons.
- Workbench manifest declares data source, actions, file actions, host events, and remote component entry when used.
- Remote component table views use scalar query parameters, remote pagination, per-tab filters, and total/page/pageSize metadata instead of fetching all rows into the iframe.
- View icons use `IconDefinition` object form where supported, with any SDK compatibility cast scoped to the icon field only.
- Source and test code do not use broad type escape hatches (`as any`, `as unknown as`, `: any`, `: unknown`) except for a deliberately isolated compatibility helper; concrete library, SDK, bridge, and mock types are used instead.
- Assistant template includes required plugins/capabilities and practical starter prompts.
- Tests cover service behavior, middleware tool calls, manifest/view actions, remote component bridge behavior, and end-to-end user flow.
- Optional MCP surfaces, when explicitly requested, are validated separately with the dedicated plugin development MCP checklist.
