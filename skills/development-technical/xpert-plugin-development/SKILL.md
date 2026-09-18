---
name: xpert-plugin-development
description: Develop, test, package, and securely deploy Xpert plugins, including Agent middleware, host-native MCP Tools/Apps, plugin-managed MCP servers, and platform runtime integrations.
---

# Xpert Plugin Development

Keep this skill to decisions, pitfalls, and lookup pointers. Inspect current SDK types, implementations, tests, and product docs for API details; do not duplicate tutorials or field inventories here.

## Working principles

- Discover the plugin, platform, and documentation roots; never hardcode machine paths. Upstream plugins: `https://github.com/xpert-ai/xpert-plugins.git`.
- Read only the references relevant to the task. Source contracts are authoritative; local SDK/tarball success does not establish npm availability or public lockfile reproducibility.
- Reuse typed domain services and canonical SDK/contracts imports. Keep authorization, validation, idempotency, and revision checks out of surface-only hooks. Use strict schemas and allowlisted DTOs.
- Keep metadata, package contents, and runtime registrations aligned. Process-global entities/controllers require `system` or `tenant` level and a stable `artifactNamespace`: `system` installs in the Default tenant, `tenant` in its owning tenant; `organization` is for organization-isolated plugins without global infrastructure.
- Localize user-facing UI; keep business DTOs language-neutral. Isolate unavoidable compatibility shims and mark them `@deprecated` with the canonical replacement.
- Treat files over 1,000 lines as a refactoring signal. Investigate oversized TypeScript generics rather than normalizing multi-gigabyte compiler heaps.
- Preserve existing Mintlify docs; scaffold `docs/` for a new plugin. Keep implementation walkthroughs in product/plugin docs, not in this skill.

## Deployment and verification

- For local deployment, prove the selected platform is ready; use `xpert-platform-local-environment` if identity or health is uncertain. Prefer `plugin:deploy:local` at the plugin-declared scope.
- Build generated assets before browser acceptance; check freshness with `verify:dist` and inspect the actual package. Run relevant contract tests and dist-first lifecycle loading.
- Staged is not running: honor `restartRequired` and verify a live capability. Plugin deployment does not initialize/publish Assistant templates; that is a separate lifecycle.
- Use configured login/secret-store credentials. Never recover browser credentials, log secrets, or place them in repository files. If credentials are missing, stop before deployment and follow `references/general.md`.
- Match actions to the request: documentation/review work does not require deployment. Report actual verification and remaining limits; do not imply authorization for publishing or unrelated runtime changes.

## Read on demand

| Task | Reference |
| --- | --- |
| Scaffolding, metadata, packaging, local deployment, credentials | [general.md](references/general.md) |
| Tool schemas, DTOs, pagination, revisioned mutations, Agent titles/icons | [tool-contract-design.md](references/tool-contract-design.md) |
| Decorated Providers, native MCP Tools/Apps, Publication scope and synchronization | [host-native-mcp-capabilities.md](references/host-native-mcp-capabilities.md) |
| MCP App bridge/theme/security or portable stdio servers | [mcp-tools-and-apps.md](references/mcp-tools-and-apps.md) |
| Large or iterative data mutations | [large-data-mutation-workflows.md](references/large-data-mutation-workflows.md) |
| Model providers | [model-plugins.md](references/model-plugins.md) |
| Integrations, callbacks, notifications | [integration-middleware.md](references/integration-middleware.md) |
| Managed background jobs | [managed-queue.md](references/managed-queue.md) |
| Keeping an Agent turn alive during queued work | [agent-long-running-tasks.md](references/agent-long-running-tasks.md) |
| Workspace files and portable references | [workspace-files.md](references/workspace-files.md) |
| Sandbox Jobs, Browser Runtime, Runtime Providers | [sandbox-jobs.md](references/sandbox-jobs.md) |
| Managed Artifacts | [artifacts.md](references/artifacts.md) |
| Yjs/CRDT collaboration | [collaboration.md](references/collaboration.md) |
| Skill-only plugins | [skill-only-plugins.md](references/skill-only-plugins.md) |
| Assistant suite initialization and publication | [local-release-and-assistant-suite.md](references/local-release-and-assistant-suite.md) |
| Building Assistant template DSLs and default middleware composition | [Primary Agent Middleware Defaults](../xpert-assistant-dsl-builder/references/primary-agent-middleware-defaults.md), using `xpert-assistant-dsl-builder` |

## Assistant Profile integration

For contextual case tabs and governed actions inside an Assistant Profile card, read [Assistant Profile Views](../xpert-agentic-app-developer/references/assistant-profile-views.md). Keep business authorization in the plugin and continuation in durable backend services.
