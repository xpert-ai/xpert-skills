---
name: xpert-plugin-development
description: Develop, test, package, and securely deploy Xpert plugins, including Agent middleware, host-native MCP Tools/Apps, plugin-managed MCP servers, and platform runtime integrations.
---

# Xpert Plugin Development

Keep this skill to decisions, pitfalls, and lookup pointers. Inspect current SDK types, implementations, tests, and product docs for API details; do not duplicate tutorials or field inventories here.

## Working principles

- Discover the plugin, platform, and documentation roots; never hardcode machine paths. Upstream plugins: `https://github.com/xpert-ai/xpert-plugins.git`.
- Read only the references relevant to the task. Locate source contracts by class, type, capability, and function names rather than fixed file paths. Local SDK/tarball success does not establish npm availability or public lockfile reproducibility.
- Reuse typed domain services and canonical SDK/contracts imports. Keep authorization, validation, idempotency, and revision checks out of surface-only hooks. Use strict schemas and allowlisted DTOs.
- Use scoped ORM repositories and verified platform data capabilities for persistence. Do not introduce plugin-managed transactions (`DataSource.transaction`, `EntityManager.transaction`, `repository.manager.transaction`, or manual `QueryRunner` transactions), raw SQL escape hatches, or external calls inside transactions. Before persistence changes, read [Database Access and Transaction Boundaries](references/database-access-and-transactions.md), including atomicity and legacy migration rules.
- For Agent-led work, minimize injected procedural instructions. Provide consistent scope, clear tool contracts and live, actionable feedback; let the Agent choose its approach. Read [Agent, Prompt, and Tool-Owned State](references/agent-prompt-tool-orchestration.md) when designing delegation or recovery.
- Keep metadata, package contents, and runtime registrations aligned. Process-global entities/controllers require `system` or `tenant` level and a stable `artifactNamespace`: `system` installs in the Default tenant, `tenant` in its owning tenant; `organization` is for organization-isolated plugins without global infrastructure.
- Localize user-facing UI; keep business DTOs language-neutral. Isolate unavoidable compatibility shims and mark them `@deprecated` with the canonical replacement.
- Treat files over 1,000 lines as a refactoring signal. Investigate oversized TypeScript generics rather than normalizing multi-gigabyte compiler heaps.
- Preserve existing Mintlify docs; scaffold `docs/` for a new plugin. Keep implementation walkthroughs in product/plugin docs, not in this skill.

## Deployment and verification

- For end-to-end Agent delivery, use `cloud-project-delivery` when available. The initial feature request covers the authorized development-instance implementation, deployment and live verification; the coordinator must delegate these outcomes to cloud Coding CLI tasks without waiting for phase prompts. Review-only requests retain their narrower scope.
- For local deployment, prove the selected platform is ready; use `xpert-platform-local-environment` if identity or health is uncertain. Prefer `plugin:deploy:local` at the plugin-declared scope.
- From the platform checkout, run `corepack pnpm plugin:deploy:archive publish "$ARCHIVE"`, then `corepack pnpm plugin:deploy:archive verify "$ARCHIVE"` after rollout. See `corepack pnpm plugin:deploy:archive --help` for environment inputs and the optional smoke check.
- Inside a prepared process-mode Computer environment, run finite build/test/package commands through that environment's `cli.py ... exec -- <command>`. This applies its selected Node and compatibility settings as well as its paths; changing only `PATH` is insufficient on an emulated host. Read the environment skill when compilation reports runtime/native crashes.
- Build generated assets before browser acceptance; check freshness with `verify:dist` and inspect the actual package. Run relevant contract tests and dist-first lifecycle loading.
- Reuse compatible plugin/build scaffolds and already built SDK dependencies. Keep caches enabled unless a concrete stale-artifact problem requires bypassing them. Save the complete build/test output on the first run; do not rerun a successful unchanged pipeline solely to produce a longer report. Documentation-only changes require fresh packaged assets, not automatically recompiling unrelated SDK packages.
- Verify the packed plugin in a clean installation directory: every runtime import must resolve through a declared plugin dependency or an explicitly supported host peer. Discover the target loader's actual host-peer allowlist; a package being installed in the platform does not make it a supplied peer. Never create extra host links or set `NODE_PATH` in an archive acceptance check. Match host SDK peers to the target's actual version. Read the dependency-resolution section of [general.md](references/general.md) before using a harness fallback.
- Staged is not running: honor `restartRequired` and descriptor `pending_restart`, then verify a live capability. Plugin deployment does not initialize/publish Assistant templates; that is a separate lifecycle.
- For suite updates, prefer `assistant:suite:init --refresh` with the prior installation receipt; use `--resume` for interrupted releases. Read [the release workflow](references/local-release-and-assistant-suite.md) for all-role dependency ordering, binding preservation, and activation recovery.
- Use configured login/secret-store credentials. Never recover browser credentials, log secrets, or place them in repository files. If credentials are missing, stop before deployment and follow `references/general.md`.
- Match actions to the request: documentation/review work does not require deployment. Report actual verification and remaining limits; do not imply authorization for publishing or unrelated runtime changes.

## Read on demand

| Task | Reference |
| --- | --- |
| Platform Project Pipelines: domain adapters, approvals, rounds, execution history, and business navigation | [Project Pipelines](../xpert-agentic-app-developer/references/project-pipelines.md), using `xpert-agentic-app-developer`; reuse platform dispatch and the Project Tasks View |
| Scaffolding, metadata, packaging, local deployment, credentials | [general.md](references/general.md) |
| New decorated tool plugin with a prepared local platform | [Tool plugin starter](references/tool-plugin-starter.md): generator, typed registration and isolated archive checks; business logic stays unimplemented |
| Archive installation and real native-tool cases in a process-mode Computer | [Native plugin acceptance](references/native-plugin-acceptance.md): authenticated upload, restart boundary, MCP transport helper and caller-owned business expectations |
| Single-request delivery through Project tasks and cloud Coding CLI execution | [Cloud Project Delivery](../cloud-project-delivery/SKILL.md) |
| Tool schemas, DTOs, pagination, revisioned mutations, Agent titles/icons | [tool-contract-design.md](references/tool-contract-design.md) |
| Decorated Providers, native MCP Tools/Apps, standalone clients, Publication scope and synchronization | [host-native-mcp-capabilities.md](references/host-native-mcp-capabilities.md) |
| MCP App bridge/theme/security or portable stdio servers | [mcp-tools-and-apps.md](references/mcp-tools-and-apps.md) |
| Large or iterative data mutations | [large-data-mutation-workflows.md](references/large-data-mutation-workflows.md) |
| Persistence, atomic writes, quota/task claims, or transaction migration | [database-access-and-transactions.md](references/database-access-and-transactions.md) |
| Model providers | [model-plugins.md](references/model-plugins.md) |
| Integrations, callbacks, notifications | [integration-middleware.md](references/integration-middleware.md) |
| Agent-led tool sequencing, reused external graphs, hook/state isolation and task recovery | [agent-prompt-tool-orchestration.md](references/agent-prompt-tool-orchestration.md) |
| Managed background jobs | [managed-queue.md](references/managed-queue.md) |
| Keeping an Agent turn alive during queued work | [agent-long-running-tasks.md](references/agent-long-running-tasks.md) |
| Workspace files and portable references | [workspace-files.md](references/workspace-files.md) |
| Sandbox Jobs, Browser Runtime, Runtime Providers | [sandbox-jobs.md](references/sandbox-jobs.md) |
| Managed Artifacts | [artifacts.md](references/artifacts.md) |
| Yjs/CRDT collaboration | [collaboration.md](references/collaboration.md) |
| Skill-only plugins | [skill-only-plugins.md](references/skill-only-plugins.md) |
| Assistant suite creation, batch update, publication, and failure recovery | [local-release-and-assistant-suite.md](references/local-release-and-assistant-suite.md) |
| Building Assistant template DSLs and default middleware composition | [Primary Agent Middleware Defaults](../xpert-assistant-dsl-builder/references/primary-agent-middleware-defaults.md), using `xpert-assistant-dsl-builder` |

## Assistant Profile integration

For contextual case tabs and governed actions inside an Assistant Profile card, read [Assistant Profile Views](../xpert-agentic-app-developer/references/assistant-profile-views.md). Keep business authorization in the plugin and continuation in durable backend services.
