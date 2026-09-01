# Case–Project–Assistant workspace binding

Use this reference when a plugin persists business Cases and each Case must use one isolated Xpert Project as the shared file workspace for its Orchestrator and role Assistants. This is a plugin-integration contract: persist the plugin's mapping, consume public Xpert capabilities, project safe View state, and verify the installed behavior. Do not patch Xpert internals, import host source code, write host-owned database tables, call private endpoints, or reproduce ChatKit/runtime logic inside the plugin.

## Persist the one-to-one identity before provisioning

Generate the Case UUID and Project UUID separately and assert that they differ. In the plugin's initial Case transaction, persist:

- non-null `createdById` from authenticated runtime context;
- non-null, uniquely indexed `workspaceProjectId`;
- `workspaceProjectSyncStatus` as `provisioning`;
- a synchronization timestamp and nullable safe error code/summary;
- the initial artifact and audit record.

Commit the Case before requesting Project provisioning. Use a creation operation ID and payload fingerprint so an identical retry returns the same Case and Project IDs. Never generate a replacement Project ID after provisioning fails.

On successful provisioning, set the Case to `ready`. On failure, retain the Case and mapping, set it to `failed`, and store only a bounded safe error code/summary. Only the original Case creator may retry. Block Assistant Task dispatch until the Case is `ready`.

Expose the boundary in the View DTO:

```ts
workspace: {
  projectId: string
  status: 'provisioning' | 'ready' | 'failed'
  canLaunchTasks: boolean
  errorCode: string | null
}
```

Store the Xpert Project ID as a scalar. Do not add a plugin TypeORM relation to a platform-owned entity.

## Request Project provisioning through the public capability

Resolve `ProjectProvisioningRuntimeCapability` (`platform.project.provisioning`) from the injected `XPERT_RUNTIME_CAPABILITIES_TOKEN` registry. Treat absence of the capability as a deployment-prerequisite failure, not as permission to link a different Xpert checkout or access Project repositories directly.

Call `ensure` with the plugin-generated Project ID, current Orchestrator identity, explicit requester Agent key, display name, status, and all role expectations in one request:

```ts
const projects = capabilities.require(ProjectProvisioningRuntimeCapability)

await projects.ensure({
  projectId: factoryCase.workspaceProjectId,
  xpertId: orchestratorId,
  requesterAgentKey: orchestratorAgentKey,
  externalAssistantExpectations: roles.map((role) => ({
    pluginName: role.pluginName,
    templateKey: role.templateKey,
    agentKey: role.agentKey
  })),
  name: `${factoryCase.caseKey} · ${factoryCase.eventTitle}`,
  status: 'active'
})
```

Use portable `pluginName + templateKey + agentKey` expectations. De-duplicate them and keep the list within the platform limit before calling the capability. Never save environment-specific Assistant/Xpert UUIDs in plugin configuration, templates, or Case records. The Case creator is the intended Project owner; other users must receive Project membership through normal Xpert administration.

The plugin must regard `ensure` as the platform-owned idempotent and all-or-nothing boundary. Do not attempt to repair Project/Assistant relations yourself. Map documented structured errors to safe plugin error codes; treat timeout, dependency, and unexpected errors as recoverable internal failures. Retry with the same Project ID and the same expectation set.

## Require Project-scoped Assistant workspaces

Set the Orchestrator and every Case-processing role Assistant template to:

```yaml
team:
  options:
    workspaceScope:
      mode: project-required
```

Exclude management or read-only Assistants that intentionally operate at organization scope. Request the Orchestrator and every lane-owning role in the same Project `ensure` call. This lets Xpert resolve conversations, files, FileAssets, tools, and sandbox operations to `catalog=projects` and `scopeId=workspaceProjectId`.

## Dispatch through Managed Queue and Assistant Task

Do not start a pipeline node by crafting a chat message. A Remote View action should call a plugin server application service such as:

```text
dispatch_assistant_task(caseId, nodeKey, baseRevision, operationId)
```

Before enqueueing, create an immutable execution attempt containing the Case, node, input revision, operation ID, requester, and Case Project. Inject `ManagedQueueService` with `MANAGED_QUEUE_SERVICE_TOKEN`, and enqueue a minimal payload containing only scope identifiers, user, Case ID, node key, expected revision, operation ID, and requester identity.

The plugin Queue processor must restore user context, reload the Case, and revalidate:

- tenant and organization scope;
- Case Project `ready` state and current user's Project access;
- node executability and expected revision;
- operation ID/idempotency and execution-attempt status;
- the node's portable role expectation.

Resolve `AssistantTaskRuntimeCapability` (`platform.assistant_task`) from `XPERT_RUNTIME_CAPABILITIES_TOKEN` and call `startTask`. Set the current Orchestrator as requester, the node role as an External Assistant target, and `projectId` strictly from the reloaded Case's `workspaceProjectId`. Put Case ID, node key, revision, operation ID, and Project ID in structured `humanInput` and correlation.

Persist the identifiers returned by Xpert, including Queue job, Project, task, conversation, thread, execution, and actual executor metadata. Do not use returned environment Assistant IDs as portable configuration.

The role Middleware finalizer must update the same immutable attempt by `operationId`. Assistant Task success without the matching business finalizer does not advance the Case; reconcile it to a recoverable/interrupted state. Unknown platform status remains recoverable. A retry creates a new attempt. Cancel queued work through `ManagedQueueService` and started work through `AssistantTaskRuntimeCapability.cancelTask`.

## Keep Case selection and Project scope synchronized

Declare the public navigation commands needed by the Remote View in its manifest allowlist. When a user opens or changes a Case:

1. invoke `workbench.navigation.open` with target `workbench.view`, passing the Case ID as `selectionId` and, when the View query schema declares it, as `parameters.caseId`;
2. compare the View's `runtimeScope.projectId` with the selected Case's `workspaceProjectId`;
3. if they differ, invoke `workbench.navigation.open` with target `assistant.project` and the Case Project ID;
4. after Xpert refreshes the route/runtime scope, reload data while preserving the Case selection.

Treat `initialQuery` and `runtimeScope` from the View initialization message as authoritative. On refresh, resolve the Case from `selectionId` first and from the matching `runtimeScope.projectId` second; only use the first Case when neither scope identifies a Case. Guard repeated navigation so a normal data refresh does not reopen the same Project or send the default Case back to ChatKit.

Treat `{ success: false }` as a recoverable navigation failure and keep the selected Case visible. Do not mutate router internals, browser storage, parent DOM, or ChatKit state directly.

## Open persisted execution records through Workbench navigation

Use the conversation/thread/execution identifiers returned by `AssistantTaskRuntimeCapability.startTask` and persisted on the execution attempt. To open one exact role execution, invoke `workbench.navigation.open` with target `assistant.conversation`; pass the required `conversationId` and the optional persisted `threadId` and `executionId`. Pass `projectId: workspaceProjectId` only as an optional navigation hint when the installed public contract supports it; Xpert authorizes and resolves the canonical scope.

Treat the command result as authoritative. The plugin must not call ChatKit session endpoints, mint or read client secrets, construct private chat routes, mount another Assistant runtime, or fabricate a transcript. Executor/Assistant identifiers returned by the platform may be retained as immutable execution metadata for display or correlation, but they are not template configuration and must not replace the portable role expectation.

If Xpert reports that the execution is unavailable, inactive, or unauthorized, show a bounded recoverable message and retain the plugin's read-only execution summary. Do not bypass platform access checks or attempt a private fallback.

## Treat non-compatible plugin data reset as an explicit release boundary

If old plugin data lacks the mandatory mapping and the product decision is not to support it, do not add `legacy_unbound`, fallback reads, or a hidden backfill. Make the reset an explicit plugin release operation:

1. stop plugin work intake and its Queue consumers through the deployment runbook;
2. enumerate exact `plugin_<namespace>_*` table names and row counts read-only;
3. review and freeze the explicit table list;
4. reset only plugin-owned Case, execution, audit, artifact, and projection tables;
5. never modify or delete Xpert-owned Assistant, conversation, user, membership, or Project tables;
6. verify the required public capability versions are present before deploying the plugin;
7. update existing Assistants through Xpert's official Update from Template flow and publish them while preserving IDs, slugs, and conversations;
8. create new Cases for acceptance.

Document that the reset is irreversible without the pre-deployment database backup. A plugin migration or release script must fail closed if its explicit table preflight does not match expectations.

## Keep temporary SDK adapters isolated

When the published SDK does not yet declare a required platform capability, keep exactly one local, structurally typed adapter marked `@deprecated`. It may name the capability ID and DTO shape, but must not link or import an Xpert source checkout. Delete it when the released SDK contains the contract. Do not scatter capability strings, duplicate DTOs, or casts across services and Views.

## Install shadcn in the current plugin repository

If `@xpert-ai/plugin-shadcn-ui` or `@xpert-ai/shadcn-ui` does not resolve inside the current plugin repository/workspace, do not link either package from another checkout. Initialize shadcn for the current project and use the shadcn CLI to add only required components locally. Install `lucide-react` locally for icons. Keep any alias, Tailwind, JSX-runtime, or React-version adapters inside the plugin and verify the built iframe assets with E2E tests.

## Plugin acceptance evidence

Create at least two new Cases and prove:

- distinct Project IDs, correct creator ownership, and the expected Orchestrator plus role bindings;
- Case switching changes the Workbench/ChatKit Project without losing Case selection or snapping back to the first Case;
- single-role and parallel role tasks all receive the selected Case Project;
- runtime file scope is `catalog=projects`, `scopeId=workspaceProjectId`;
- files created in one Case Project are not visible in the other;
- duplicate operations, revision conflicts, Queue recovery, both cancellation paths, missing finalizer, and creator-only retry behave as specified;
- execution markers open the exact authorized conversation/thread/execution through `workbench.navigation.open`.

Add plugin contract tests that prove:

- Project `ensure` is called with the persisted Project ID and the complete portable expectation set;
- rejected provisioning leaves the Case `failed`, blocks task dispatch, and retry reuses the same Project ID;
- documented capability errors are mapped safely while unexpected errors remain generic and recoverable;
- Queue payloads are minimal and the processor reloads the Case before forcing its `workspaceProjectId` into `startTask`;
- returned task/conversation/thread/execution identifiers are persisted on the correct immutable attempt;
- navigation uses only the public Workbench command and handles both accepted and rejected results;
- plugin builds contain no Xpert source-checkout links, private platform HTTP calls, ChatKit secrets, router mutation, or parent-DOM control.

Validate Project provisioning and navigation as consumed platform contracts, then validate plugin domain/Queue behavior, templates, typecheck, unit tests, Remote View E2E, distribution contents, local deployment, runtime capability availability, Assistant template update/publication, and signed-in browser acceptance.
