---
name: xpert-agentic-app-developer
description: Develop custom Agentic Apps on the Xpert platform as independent plugins, with a primary focus on extension views, Workbench views, remote components, Agent middleware tools, server modules, data models, Assistant templates, targetAppMeta capabilities, secure local plugin deployment, and production plugin packaging.
---

# Xpert Agentic App Developer

## Overview

Use this skill to build an Xpert Agentic App as a production plugin, not as a loose prompt or a few attached tools. Treat the app as a closed loop: plugin metadata, server module, Agent middleware tools, persistence, Workbench or extension view UI, Assistant template, installation, and tests.

Do not confuse **Agent middleware tools** with workflow **Agent Tool** nodes. In this workflow, "tools" means callable tools returned by Agent middleware to the agent runtime.

The primary UI path for this skill is an Xpert extension view: a Workbench view manifest plus a remote component or platform-rendered view. If a task is primarily about plugin-managed MCP tools or MCP Apps, use the dedicated Xpert plugin development MCP guidance instead; this skill only mentions that path as an optional integration surface.

## Golden Principle: Review Files Over 1,000 Lines

Treat 1,000 lines as an architecture-review threshold for maintained source files. When a code file exceeds 1,000 lines, pause before adding more behavior and assess whether it combines multiple responsibilities. Split coherent responsibilities into focused files when clear boundaries exist, while preserving explicit ownership, stable public contracts, and test coverage. Do not mechanically fragment a cohesive file merely to satisfy the line count.

## Development Workflow

1. Inspect the target plugin repository and the host app conventions before editing.
2. Define the business loop: what the Agent automates, what humans review, and what the system persists.
3. Determine whether the plugin provides host server capabilities; if it registers entities, controllers, routes, or equivalent process-global infrastructure, declare it as system level and define its stable artifact namespace before implementing artifact identifiers.
4. Register the server module, entities, services, middleware, and view provider.
5. Expose business actions as Agent middleware tools with strict schemas and call order.
6. When durable background work must keep the current Agent conversation turn alive because proactive completion delivery is unavailable, read [references/agent-long-running-tasks.md](references/agent-long-running-tasks.md) and implement the bounded long-polling bridge.
7. Persist reviewable business data with evidence, confidence, status, and failure state.
8. Add a Workbench or extension view for human review and operational actions.
9. When the app publishes previews or share links, read [references/artifact-share-links.md](references/artifact-share-links.md) and use the platform Artifacts and Workspace Files capabilities.
10. Provide an Assistant template so users can create the business assistant in one step.
11. Build and register the plugin from an independent plugin repository.
12. Validate with unit, integration, manifest, and end-to-end tests.

## Architecture Checklist

An Agentic App should usually include:

- **Business plugin**: `XpertPlugin` metadata, system level and artifact namespace when server capabilities are present, config schema, target apps, capabilities, templates, lifecycle.
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
  "artifactNamespace": "contract_review",
  "main": "dist/index.cjs.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@xpert-ai/plugin-sdk": "^3.8.0"
  }
}
```

Keep `@xpert-ai/plugin-sdk` in `peerDependencies`, not `dependencies`, so the plugin does not bundle its own SDK copy.

When updating `@xpert-ai/contracts` or `@xpert-ai/plugin-sdk`, verify the versions are actually published or available from the active workspace before committing lockfile changes. If a requested peer range is not published yet, do not force a broad `pnpm-lock.yaml` rewrite or disable peer installation for the whole workspace; record the peer range only when the host is expected to provide it, and keep development-only type packages in `devDependencies` only when they are needed for local compilation.

## System-Level Plugin and Artifact Namespace

An Agentic App that registers TypeORM entities, controllers, server modules, routes, or equivalent host-process capabilities is a system-level plugin. Declare `meta.level: 'system'` and an explicit, stable `meta.artifactNamespace`; never rely on the package-name fallback. The namespace may contain only lowercase letters, numbers, and underscores.

Treat `artifactNamespace` as the root of plugin artifact identity, not as passive metadata:

- Define it once as an exported constant.
- Use `pluginArtifactTableName(namespace, tableKey)` for every entity table so the physical name is `plugin_<artifactNamespace>_<tableKey>`.
- Derive controller route prefixes, provider/view/registry keys, Managed Queue identifiers, cache namespaces, persisted artifact keys, and other process-global unique strings from the same constant through small typed helpers.
- Keep runtime meta, top-level package marketplace metadata, and bundle manifest metadata aligned when those surfaces exist.
- Do not double-prefix contracts the platform already namespaces automatically; document and test the final resolved value.
- Never rename a published namespace without an explicit migration for stored tables, references, and registered identifiers.

```ts
import { pluginArtifactTableName } from '@xpert-ai/plugin-sdk'

export const PLUGIN_ARTIFACT_NAMESPACE = 'contract_review' as const
export const pluginArtifactKey = (localKey: string) =>
  `${PLUGIN_ARTIFACT_NAMESPACE}.${localKey}`

export const CONTRACT_TABLE = pluginArtifactTableName(
  PLUGIN_ARTIFACT_NAMESPACE,
  'contract'
)
export const REVIEW_VIEW_KEY = pluginArtifactKey('review-view')
export const CONTROLLER_ROUTE = `${PLUGIN_ARTIFACT_NAMESPACE}/contracts`
```

## Plugin Entry Pattern

Define `XpertPlugin` metadata as the app-facing capability contract. For data-xpert integration, prefer `targetApps` and `targetAppMeta` over ad hoc top-level business metadata.

```ts
const plugin: XpertPlugin<z.infer<typeof ConfigSchema>> = {
  meta: {
    name: '@acme/plugin-contract-review',
    version: '0.1.0',
    level: 'system',
    artifactNamespace: PLUGIN_ARTIFACT_NAMESPACE,
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

Declare entity names and controller routes from the namespace helpers instead of hardcoded global strings:

```ts
@Entity(CONTRACT_TABLE)
export class ContractEntity {}

@Controller(CONTROLLER_ROUTE)
export class ContractController {}
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
- Set `verboseParsingErrors: true` on every LangChain structured tool configuration so schema failures include actionable Zod or JSON Schema details that the Agent can use to correct its next call instead of receiving only `Received tool input did not match expected schema`.
- State call order in tool descriptions.
- Save long lists one item at a time.
- Include required `technicalAttributes` / `differences` arrays, or domain equivalents, even when empty.
- Require source evidence for important extracted values.
- Provide a failure-reporting tool for unreadable files or incomplete parsing.
- Return compact operation DTOs by default: business id, revision/status, a human message, changed ids/counts, blocking diagnostics, and the next recovery action. Never return a full document, scene, IR, binary payload, or complete history from a mutation or validation tool. Expose full content only through an explicit paged/item-level read tool.
- Give every user-visible mutation schema a bounded `changeSummary`. When it is present, middleware `wrapToolCall` must publish `ON_TOOL_MESSAGE` events for `running`, `success`, and `fail`; use the exact summary as both the step `title` and `message`, and keep the stable tool name in the event `tool` field. Event publication failure must not fail the business operation.
- Await every asynchronous service call before serializing the tool result. Never pass a live Promise to `JSON.stringify` or detach a rejecting Promise from the tool invocation.

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
    schema: contractHeaderSchema,
    verboseParsingErrors: true
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

### Workbench E2E and Visual Validation

For substantive Workbench or remote-component changes, treat end-to-end browser tests as executable acceptance specifications rather than optional smoke tests. Read [references/workbench-e2e-visual-validation.md](references/workbench-e2e-visual-validation.md) before implementing or validating multi-step UI workflows, host-bridge actions, persistence/reload behavior, timeline or canvas interactions, screenshot-driven designs, or visual regressions.

Test the real generated remote-component assets inside a representative Xpert View Host harness, assert both visible behavior and persisted/host-side state, and capture deterministic screenshots at important interaction states. Never make a failing interaction pass with forced clicks or arbitrary sleeps; diagnose layout, state, or event-ordering defects. Follow simulated-host E2E with an installed-platform browser pass whenever the change depends on authentication, permissions, Workspace Files, cookies/CORS, Managed Queue, Sandbox Runtime, or real plugin registration.

### Confirmation Dialog Standard

Treat confirmation as a dedicated interaction pattern for consequential, destructive, security-sensitive, or irreversible actions. Do not use browser-native dialogs or a generic content modal as a confirmation substitute. Reserve ordinary dialogs for forms, details, previews, and other non-confirmation content.

Provide an explicit title, consequence-focused description, Cancel action, and confirmation action. Visually distinguish destructive actions. Resolve dismiss, Escape, overlay close, and Cancel as cancellation. Execute the protected operation only after explicit confirmation. For asynchronous mutations, prevent duplicate submission, expose pending state, and keep failures recoverable. Keep confirmation copy localized and state-driven.

Audit existing confirmation flows when touching this interaction pattern. Verify that maintained UI source contains no browser-native confirmation calls, rebuild generated remote assets, and exercise both cancel and confirm paths in tests or browser verification. For React implementations using shadcn UI, read [references/shadcn-ui.md](references/shadcn-ui.md) before editing.

For React project and remote component development, especially when React is supplied by the host iframe runtime or when TypeScript hover/types appear as `any`, read `references/react-project-development.md` before editing.

### Plugin i18n Standard

Before adding, reviewing, or migrating user-visible copy or locale support, read [references/i18n.md](references/i18n.md). Use one plugin-owned, typed i18n facade per UI surface; components call semantic translation keys and shared `Intl` formatters instead of importing an engine directly.

Never branch on locale to choose user-visible text inside JSX or ordinary component helpers. This includes labels, tooltips, placeholders, empty states, validation errors, confirmations, toast messages, table actions, filenames, and accessibility text. Organize catalogs by view/domain namespace, use the default catalog as the typed key schema, and enforce catalog parity in CI. Keep domain data raw unless its contract explicitly provides localized variants.

Normalize the host iframe locale once at the remote entrypoint with explicit BCP 47 aliases and fallback. Keep `zh-Hans` and `zh-Hant` distinct; do not map every `zh*` locale to Simplified Chinese. Centralize platform key conversion (`en_US` / `zh_Hans`) and third-party editor locale mapping at narrow adapter boundaries.

Backend services and Agent middleware should return stable language-neutral status/error codes plus structured parameters. Localize display labels at the UI boundary and never return localized prose as the only state representation. Pass a normalized locale only when producing inherently user-facing artifacts such as Excel, PDF, Word, email, toast-style action messages, localized manifest metadata, or export filenames.

Agent middleware tool schemas and descriptions should generally remain stable English unless the platform explicitly supports localized tool metadata. For Workbench manifests and platform metadata, use platform localized objects such as `{ en_US, zh_Hans }` and keep their conversion out of business components.

For remote component data loading, route iframe requests through the platform bridge (`requestData` / `executeAction`) and the view provider. Keep initial `getViewData` responses light enough for first paint, then use tab-specific remote pagination for large tables. A stable pattern is:

- Frontend sends `requestData` with `query.page`, `query.pageSize`, `query.search`, and `query.parameters.table`.
- Use one table key per dataset, such as `accounts`, `conversations`, `messages`, or `logs`.
- Return `{ tableKey, table: { key, items, total, page, pageSize } }` from the view provider.
- Keep each tab's filters, page, and page size independent in component state.
- Reset the page to `1` whenever filters change.

`XpertViewQuery.parameters` only supports scalar values or scalar arrays. Do not send nested filter objects directly from a remote component. Serialize complex filters as a JSON string parameter such as `filtersJson`, parse it in the view provider, and tolerate malformed JSON by falling back to `{}`.

Before adding or changing icons for a Workbench, extension view, or remote component, read and follow [references/remote-view-icons.md](references/remote-view-icons.md).

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
cd <plugin-repo-root>
corepack pnpm install

cd <platform-root>
corepack pnpm plugin:deploy:local \
  --plugin-dir <plugin-repo-root>/acme/contract-review \
  --org-id "$XPERT_ORG_ID"
```

Use `plugin:deploy:local` as the default local lifecycle command when the platform exposes it. It detects the package name, builds and tests the plugin, refreshes an existing local `source=code` registration, falls back to first-time installation with `sourceConfig.workspacePath`, and verifies the loaded descriptor. Use `--skip-build` or `--skip-test` only when those exact validations already passed in the same task.

Prefer username/password login for local deployment. Configure the current OS user's Xpert username and that Xpert account's password as separate macOS Keychain items:

```bash
security add-generic-password \
  -a "$USER" \
  -s xpert-local-plugin-username \
  -U \
  -w "<xpert-username>"

security add-generic-password \
  -a "<xpert-username>" \
  -s xpert-local-plugin-password \
  -U \
  -w
```

The second command securely prompts for the password. `plugin:deploy:local` reads these credentials, calls `/api/auth/login`, keeps the returned JWT in memory only, and may infer the tenant from the login response. `XPERT_USERNAME` plus `XPERT_PASSWORD` is the non-macOS/current-process alternative. An explicit `--token` remains an intentional override; `XPERT_TOKEN` and the legacy `xpert-local-plugin-token` Keychain item are compatibility fallbacks used only when login credentials are absent.

If credentials are missing or incomplete, stop before mutation, show the Keychain commands above, and wait for confirmation before retrying. Never inspect browser Local Storage, cookies, network headers, or shell history for credentials, and never ask the user to paste a password or token into chat or a repository file. Treat a login `401` as invalid credentials; treat an install or refresh `401` as an expired JWT and retry the normal login path without printing any secret.

Do not manually copy or edit the host plugin staging directory. If runtime behavior remains stale after a successful deployment, restart the local API and rerun `plugin:deploy:local`. For production, either publish the plugin as an npm/internal artifact and install it through the platform plugin flow, or include it as a platform-owned built-in system plugin when that is truly intended.

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

- Plugins that register entities, controllers, routes, or equivalent system capabilities declare `meta.level: 'system'` and an explicit stable `meta.artifactNamespace`.
- Runtime, package, and bundle namespace metadata agree; emitted build output preserves the declaration.
- Every entity table name uses `plugin_<artifactNamespace>_<tableKey>`, and all process-global or persisted routes, providers, views, queues, registries, caches, and artifact keys derive from the shared namespace constant unless the platform contract already namespaces them.
- Plugin metadata declares `targetApps`, `targetAppMeta`, business types, and capabilities.
- SDK dependency is a peer dependency.
- Server module registers entities, services, middleware, and view providers.
- All plugin entities include `tenantId` and `organizationId`, write paths populate them, and all data reads/mutations are scoped by tenant/organization whenever context is available.
- Middleware tools have schemas, descriptions, ordered workflow, per-item persistence, failure reporting, and `verboseParsingErrors: true` on every structured tool configuration.
- Long-running Agent workflows without proactive delivery follow the bounded wait-tool contract, preserve durable recovery, propagate cancellation, and prevent duplicate completion replies.
- Data model preserves source evidence, confidence, review status, and failure reasons.
- Workbench manifest declares data source, actions, file actions, host events, and remote component entry when used.
- Every confirmation uses the designated accessible confirmation primitive; maintained UI source contains no browser-native confirmation calls or generic content-dialog substitutes.
- Remote component table views use scalar query parameters, remote pagination, per-tab filters, and total/page/pageSize metadata instead of fetching all rows into the iframe.
- Source and test code do not use broad type escape hatches (`as any`, `as unknown as`, `: any`, `: unknown`) except for a deliberately isolated compatibility helper; concrete library, SDK, bridge, and mock types are used instead.
- User-visible text uses the shared typed i18n facade; maintained components contain no inline locale-to-text branches, catalogs pass key/parameter completeness checks, and locale/platform/third-party mappings stay in explicit adapter boundaries.
- Assistant template includes required plugins/capabilities and practical starter prompts.
- Tests cover service behavior, middleware tool calls, manifest/view actions, remote component bridge behavior, and end-to-end user flow.
- Substantive Workbench UI changes follow the E2E and visual-validation reference: real built assets, semantic UI and host-state assertions, deterministic screenshot evidence when visual behavior matters, and installed-platform validation for platform-dependent integrations.
- Local deployment uses `plugin:deploy:local`, preserves credentials outside logs and repositories, and verifies the loaded plugin descriptor.
- Optional MCP surfaces, when explicitly requested, are validated separately with the dedicated plugin development MCP checklist.
