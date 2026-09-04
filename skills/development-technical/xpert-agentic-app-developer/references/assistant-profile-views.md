# Assistant Profile Views

Use this reference when adding contextual plugin tabs, case summaries, or governed human decisions to an Assistant's Profile hover card. Reuse `IXpertViewExtensionProvider`; do not introduce a separate plugin HTTP data API or put authentication inside an iframe.

## Contract and Feature binding

Import `AGENT_PROFILE_TABS_SLOT` from `@xpert-ai/contracts`. It equals `agent.profile.tabs`; use `hostType: 'agent'`. Declare a domain Feature in middleware metadata and require it in each manifest's `activation.requiredFeatures`. A shared Profile Feature can be included in several role middlewares, while their Agent tool sets remain separate.

```ts
import { AGENT_PROFILE_TABS_SLOT, type XpertExtensionViewManifest } from '@xpert-ai/contracts'

const tab: XpertExtensionViewManifest = {
  key: 'recent-cases', title: { en_US: 'Recent cases', zh_Hans: '最近案件' },
  hostType: 'agent',
  slot: AGENT_PROFILE_TABS_SLOT,
  activation: { requiredFeatures: ['case-profile'] },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    dataSource: { mode: 'platform' },
    component: { isolation: 'iframe', entry: 'case-profile' }
  },
  dataSource: { mode: 'platform', cache: { enabled: false } },
  actions: [{ key: 'approve_and_continue', label: 'Approve and continue',
    actionType: 'invoke', placement: 'row', requiredHostAccess: 'read' }],
  clientCommands: [{ key: 'assistant.profile.interaction' }, { key: 'assistant.profile.close' }]
}
```

Implement `getViewManifests`, `getViewData(context, viewKey, query)`, `executeViewAction(context, viewKey, actionKey, request)`, and the remote entry in the same provider. Declarative views are also supported. Do not expose undeclared actions; host enforcement supplements plugin authorization.

## Trusted context and permission ownership

Backend `XpertResolvedViewHostContext.assistant` is a typed `XpertViewAssistantIdentity`:

- `instanceId`: resolved published Assistant for this host.
- `currentId`: unique current editable instance in the same family, or the resolved instance as fallback.
- `versionIds`: same-Assistant version identities, scoped by tenant, organization, Workspace, type, and slug.

Use `context.tenantId`, `organizationId`, `userId`, and `assistant`; never trust equivalent IDs submitted in iframe queries or action parameters. Missing identity must fail closed. Do not match by display name, role label, or common template. This context stays on the backend; the iframe sends business filters, case IDs, revisions, and decisions only.

The host authorizes published Assistant access and Feature activation. **The plugin decides which business resources an Assistant may access.** Explicit role assignments, Case Project bindings, and requester/executor participation are plugin policy, not a new universal host binding rule. Apply tenant, organization, human readable-Project permissions, and instance membership before sorting, counting, and pagination. Recheck selection and action targets; do not authorize a detail merely because its ID appeared in a query.

Server plugins may require `ProjectAccessRuntimeCapability` (`platform.project.access`) from `@xpert-ai/plugin-sdk`. `listReadable({ actor, projectIds? })` returns human roles, `canManage`, and explicit `assistantIds` bindings; `assertManage({ actor, projectId })` enforces owner/manager and rejects archived Projects. Obtain `actor` from trusted context or a persisted, authenticated decision. Never expose this as human approval power to an Agent tool. `requiredHostAccess: 'read'` does not mean all readers may approve: the business service must enforce the stronger rule.

## Lifecycle and compact UI

Opening the card loads a display whitelist from `GET /xpert/:id/profile` and tab manifests. The host owns the fixed header and its Skills, Tools, direct sub-agents, and rolling 30-day conversation indicators; plugin views should not duplicate or override them. The Skills value counts installed packages in the Assistant's Workspace that pass runtime Workspace access and are not disabled for that Assistant binding. It describes accessible Workspace inventory independently of whether the primary Agent mounts Skills Middleware; per-run exposure still follows runtime capability selection. Basic information is the default. An extension mounts on first selection, then remains cached while the Profile stays open. The host sends `viewActive: false` when hidden and `viewActive: true` when selected again. Pause polling while inactive, retain current UI/data state, and resume from the next interval without an immediate duplicate query. Switching Assistant or closing destroys all cached iframes and view sessions. Keep layout suitable for a 480 px card, constrained on narrow screens, with an independently scrolling content region.

Bind requests and responses to the active Assistant/view/instance; discard stale responses. Clear scheduled polling on `viewActive: false`; clear polling, event listeners, timers, pending bridge requests, and subscriptions on unmount. Isolate loading errors to the tab and offer retry. Never access `localStorage` or `sessionStorage`: Profile uses an opaque-origin sandbox. Receive locale, theme, and initial active state from `init`; keep ephemeral selection in component state.

While a confirmation dialog is open or submission is pending, invoke declared `assistant.profile.interaction` with `{ busy: true }`, and release it with `{ busy: false }`. The host holds the card open and disables tab changes. Dialog Escape takes priority; when no dialog or pending action exists, invoke `assistant.profile.close` to dismiss and restore focus. Do not let iframe Escape close a dialog and the parent simultaneously.

## Durable actions: Factory Operations

The factory plugin contributes `factory-assistant-recent-cases` and `factory-assistant-needs-attention`, gated by `factory-assistant-profile`. It intersects explicit Case Project assignments and requester/executor participation with readable Projects, uses normalized version IDs, and returns 10 cases per page plus server-computed `allowedActions`.

`approve_and_continue` accepts `caseId`, `baseRevision`, `operationId`, `reason`, and `changeSummary`. Show the current proposal, Case revision, plan revision, execution scope, and simulation/external mode before confirmation. Rejection requires a reason. Cancellation sends nothing. Retries of an uncertain request must keep exactly the same operation ID and payload.

Use one transaction for human approval, audit, and durable continuation intent. Managed Queue processing uses stable step IDs, revision checks, leases, checkpoints, delayed verification, bounded infrastructure retries, and outbox compensation. Closing the browser is irrelevant to continuation. Each step rechecks the original approver's Project access, plan approval/version, Case state, and saved coordinator binding.

Dispatch verification through the Case's saved coordinator, not the specialist whose Profile is being inspected. A platform Task success alone is insufficient: require the matching business finalizer, revision, evidence, and execution record. Stop at changed plans, new human gates, revoked permissions, missing bindings, business failures, or missing external adapters. Simulation confirmations must remain explicitly marked as simulation.

Keep query/access policy, approval policy, continuation service/processor, migration, and UI separate. Additive migrations preserve existing records; only backfill a coordinator from explicit, unique requester history. Leave ambiguous cases visibly unbound.

## Validation

Cover hover delays and gap crossing, focus in iframe, Escape ordering, busy actions, click/keyboard/touch, viewport edges, narrow/dark/localized layouts, tab re-entry and cancellation, Feature removal, undeclared actions, and stale responses. Exercise same-role different instances, version-family participation, tenant/organization/Project isolation, member/editor rejection, and idempotency.

Use a real isolated PostgreSQL schema for transaction/outbox/restart/permission tests. Label mocked Assistant Task boundaries as integration tests. Live acceptance must separately prove installation in the selected checkout, a real verification Assistant Task, matching business finalizer and audit, and completion after the card closes. Run `plugin-dev-harness`, typecheck, unit/integration/E2E, generated-resource consistency, and docs/skill validation. Never claim a preview fixture is a live execution.
