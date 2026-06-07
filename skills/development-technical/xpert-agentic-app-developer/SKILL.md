---
name: xpert-agentic-app-developer
description: Develop custom Agentic Apps on the Xpert platform as independent plugins. Use when Codex needs to design, implement, review, or document an Xpert business plugin that exposes Agent middleware tools, server modules, data models, Workbench views, remote components, Assistant templates, targetAppMeta capabilities, local plugin registration, or production plugin packaging.
---

# Xpert Agentic App Developer

## Overview

Use this skill to build an Xpert Agentic App as a production plugin, not as a loose prompt or a few attached tools. Treat the app as a closed loop: plugin metadata, server module, Agent middleware tools, persistence, Workbench review UI, Assistant template, installation, and tests.

Do not confuse **Agent middleware tools** with workflow **Agent Tool** nodes. In this workflow, "tools" means callable tools returned by Agent middleware to the agent runtime.

## Development Workflow

1. Inspect the target plugin repository and the host app conventions before editing.
2. Define the business loop: what the Agent automates, what humans review, and what the system persists.
3. Implement the plugin entry and target app metadata.
4. Register the server module, entities, services, middleware, and view provider.
5. Expose business actions as Agent middleware tools with strict schemas and call order.
6. Persist reviewable business data with evidence, confidence, status, and failure state.
7. Add a Workbench view for human review and operational actions.
8. Provide an Assistant template so users can create the business assistant in one step.
9. Build and register the plugin from an independent plugin repository.
10. Validate with unit, integration, manifest, and end-to-end tests.

## Architecture Checklist

An Agentic App should usually include:

- **Business plugin**: `XpertPlugin` metadata, config schema, target apps, capabilities, templates, lifecycle.
- **Agent middleware tools**: zod schemas, tool descriptions, ordered tool calls, per-item persistence, failure reporting.
- **Services and data models**: domain entities, review state, source evidence, confidence, audit-friendly outputs.
- **Workbench view**: view manifest, actions, data queries, host event subscriptions, optional remote component UI.
- **Assistant template**: DSL content, required plugins, capabilities, model options, starter prompts.

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

## Workbench View

Add a Workbench view when users must review, correct, approve, reject, upload files, or submit results. Use a remote component iframe when the UI needs custom interaction beyond declarative tables and forms.

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
- Remote component iframes are sandboxed and may not include `allow-modals`; do not rely on `window.confirm`, `window.alert`, or `window.prompt`. Implement destructive-action confirmation with inline UI state, a small confirmation panel, or a host/view action flow instead.

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

## Documentation Guidance

When writing user-facing docs for this workflow:

- Prefer conceptual names and code examples over internal source paths.
- Link platform features such as plugin development, custom middleware, Workbench, ChatKit, remote components, Assistant configuration, and plugin installation.
- Say "Agent middleware tools" when referring to tools exposed by middleware.
- Avoid linking these middleware tools to workflow Agent Tool node documentation unless the text is actually about workflow nodes.
- Keep docs bilingual only when requested; otherwise follow the target documentation locale.

## Validation Checklist

Before finishing, verify:

- Plugin metadata declares `targetApps`, `targetAppMeta`, business types, and capabilities.
- SDK dependency is a peer dependency.
- Server module registers entities, services, middleware, and view providers.
- Middleware tools have schemas, descriptions, ordered workflow, per-item persistence, and failure reporting.
- Data model preserves source evidence, confidence, review status, and failure reasons.
- Workbench manifest declares data source, actions, file actions, host events, and remote component entry when used.
- Remote component UI avoids browser modal APIs such as `window.confirm`, `window.alert`, and `window.prompt`; sandbox-safe confirmations are implemented inline.
- Assistant template includes required plugins/capabilities and practical starter prompts.
- Tests cover service behavior, middleware tool calls, manifest/view actions, remote component bridge behavior, and end-to-end user flow.
