# Host-Native MCP Tools and Apps

Use native Providers for business methods executed and governed by Xpert. Use stdio only for a portable, separate MCP runtime; an App alone does not require it.

## Key decisions

- Prefer `@XpertToolProvider()` + `@XpertTool()`. Register the business class once in the plugin Nest module; one class is one independently managed MCP service, not one service per Middleware group.
- MCP is opt-in per method. Keep strict input/output schemas, behavior, context, and visibility explicit; return ordinary DTOs. Restore `XpertBusinessToolContext` per call, never from a singleton or discovery placeholder.
- `wrapToolCall` and `getMiddlewareExtensions()` are Agent-only hooks, not MCP execution guarantees. Shared services own authorization, persistence, CAS, idempotency, and business audit.
- Runtime descriptors are authoritative; manifest `toolsets` are not required. Align Provider/component keys and optional marketplace contributions. Keep identities client-neutral and let the host derive endpoint slugs.
- Use a hand-written `ToolsetStrategy` only for capabilities/lifecycle the decorators cannot express. Preserve provenance and remove derived registrations on unload; invalid replacements must not evict valid registrations.

## MCP Apps

- Declare `defineMcpApp()` in Provider `apps`; bind an existing Tool with `mcp.app.resourceKey`. The referenced App must belong to that Provider. Use `['model', 'app']` for shared entry Tools.
- Apps are Resource-backed capabilities, not extra Tools: **5 Tools + 2 Apps = 7 capabilities**, while `tools/list` can remain 5. Check `capabilityType`, not name suffixes.
- Build and package the relative HTML `entry`; prefer self-contained HTML. Do not hardcode `ui://` URIs or add a resource HTTP route. Verify current SDK support and bundle-reader limits in source.
- Shared bridge, metadata, and iframe safety rules: [mcp-tools-and-apps.md](mcp-tools-and-apps.md).

## Publication and access

- `system`/`tenant` Providers own tenant Publications with independent organization grants and organization-bound keys; `organization` Providers own organization Publications. Shared endpoints never imply shared authorization.
- Plugin loading, Toolset installation, catalog discovery, Publication binding, and credentials are distinct. The enable action orchestrates them; native Publications appear under MCP services, not child-process Runtime instances.
- Plugin details and application details manage the same Provider/Publication. Keep a single initialization entry, client-neutral configuration, and independent Provider controls; compose sections without nested cards.
- Provider mutations and credential reveal require super-admin authorization. Managed credentials can be revealed for the current administrator/organization; ordinary hash-only keys cannot. Never include secrets in discovery, logs, docs, or iframe content.
- Apps need `resources:list/read` in addition to `tools:list/call`. Old tools-only keys are not silently expanded; obtain a suitable credential through the authorized workflow.

## Updating and checking

- Build/package, deploy/refresh, and restart if required before expecting new runtime definitions. Enabled auto-managed Publications reconcile on Provider registration/bootstrap: preserve same-type/key names, enabled states, and policy overrides; add/remove/update capabilities in place and retain valid state on failure.
- Manual Publications require **Refresh available capabilities → select → Save**. Catalog refresh alone does not publish a new binding. Refresh/reconnect the client afterward; do not recreate the endpoint or alter unrelated organization grants.
- Verify `initialize`, `tools/list`, and a read-only `tools/call`. For Apps, match Tool `_meta.ui.resourceUri` to `resources/list/read`, check HTML MIME and DTO, and test rendering separately in an Apps-capable client. Cover cross-organization denial, invalid declarations, and synchronization preserving policy.

## Standalone client execution

- Inspect dependencies previously supplied by the Agent or Workbench: principal, file binding, Project/Assistant, model configuration and runtime capabilities. Reuse working domain services; MCP exposure alone does not require a new model-selection API, queue or storage system. An existing Sandbox transcription engine may already satisfy the workflow.
- Keep plugin business project IDs distinct from platform Project/Assistant IDs and file owners. External clients do not inherit an Agent workspace. Use authenticated host file transport and portable references; see [workspace-files.md](workspace-files.md).
- Tools perform actions or parameterized operations; Resources expose addressable state/results; Prompts guide workflows. Do not duplicate every Resource as a Tool or merge unrelated operations merely to reduce a count.
- For SDK versions exporting `ResourceReadContext`, use it for Resource/Template read callbacks. Return the supplied `resourceUri` for the requested resource, preserving optional query parameters and encoding. Keep resource-specific fields out of ordinary execution contexts. Verify target SDK support and test omitted parameters, pagination and encoded values.
- Server instructions, tool descriptions, Prompts and installed Skills are different delivery mechanisms. A bundled Skill is not automatically loaded by every MCP client. Put essential defaults in discoverable contracts/instructions so users need not specify internal mode flags; respect explicit choices and report missing prerequisites instead of silently changing engines.

## Confirmation and long tasks

- Distinguish approval of the business plan, client tool approval and host publication policy. Reuse valid user authorization for the same scope, but do not bypass an enforced gate or make all writes directly executable as a general workaround.
- Diagnose rejected confirmation using protocol results and invocation records before assigning blame to a client. The host owns session continuity, principal binding and audit correlation. Shared Redis data does not itself restore a live SDK transport or pending confirmation after restart; do not automatically replay a possibly completed mutation.
- MCP Tasks separate request waiting from completion only when host/client support is negotiated. They do not extend Sandbox or business deadlines. See [sandbox-jobs.md](sandbox-jobs.md) for layered budgets and [managed-queue.md](managed-queue.md) for queued identity and policy checks. The Agent wait pattern in [agent-long-running-tasks.md](agent-long-running-tasks.md) addresses a different connector delivery gap.

## Artifact-producing acceptance

For plugins producing files, go beyond discovery and a read-only call: verify an external client can supply an input, invoke work, observe terminal status, read the result and retrieve the output. Inspect meaningful artifact content; a saved project, job ID or progress percentage is not completed delivery. Keep status reads lightweight.

Report unit tests, published-dependency builds, plugin lifecycle, real-client execution and artifact checks separately. A local SDK substitution proves paired-source compatibility only; follow [general.md](general.md) before release. Preserve existing developer processes during isolated validation. Keep fixture findings, model names and runtime limits in plugin-specific docs rather than making them universal Skill rules.

## Source and documentation pointers

Resolve these paths within the selected checkout; inspect types and adjacent tests instead of copying implementation here.

- SDK: `packages/plugin-sdk/src/lib/tool-provider/`, `lib/mcp/app.ts`, and `lib/toolset/define-tool.ts` beneath the same `src` root.
- Host: `packages/server-ai/src/plugin-resource/plugin-mcp-server.service.ts` and `packages/server-ai/src/mcp-publication/` (catalog, runtime, App bundles, keys).
- Product docs: `ai/plugin/host-native-mcp-tools` and `ai/middleware/mcp-server/index` in the documentation repository's language tree.
