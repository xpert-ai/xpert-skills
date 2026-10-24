# Project Pipelines integration

Use for Project state, dispatch, execution links, historical rounds and business Workbench navigation. Inspect the selected host's `packages/contracts/src/ai/project-pipeline` and SDK runtime capabilities before implementing; published package versions may lag the checked-out host.

## Choose one execution authority

- For a new workflow that should use platform dispatch, use `executionAuthority: platform`. The platform owns the DAG, scheduler, attempts, cancellation, retries, human waiting and rounds. The plugin supplies domain operations, evidence and permission checks.
- Use `provider` when another system must remain the independent execution authority and the platform is observing it. Do not duplicate a native scheduler with plugin queues, polling supervisors, continuation workers or a projection outbox.
- Preserve business Case IDs, classified Project IDs, files and membership. Replacing execution architecture does not authorize deleting business data or changing approval rules.

## Platform-managed integration

1. Register a versioned `ProjectPipelineContributor` configuration and explicit subject, schema, evidence, operation and policy adapters. Validate through the public configuration schema and topology compiler. Roles, node kinds and executor bindings are machine-readable fields, never inferred from titles.
2. Provision the classified Project through `ProjectProvisioningRuntimeCapability`. Bind exact published Assistant IDs to role slots. On hosts exposing `ProjectEnsureResult.assistantBindings`, use the public `ProjectAssistantBinding` type, match the explicit plugin/template/agent tuple and verify membership against `xpertIds`. The bindings cover requested roles, not every Project member; an empty requirements list returns no bindings. Do not treat a resolved graph binding as membership; do not zip an unordered `xpertIds` array against roles. If this contract is unreleased, coordinate the SDK release and dependency update instead of adding a local compatibility cast.
3. Use `ProjectPipelineCommandsRuntimeCapability` for configure/start/decide/retry/cancel/nextRound. Configuration and start use stable idempotency identities; ordinary refresh and subject/evidence reads must have no side effects.
4. An Assistant adapter prepares a receipt bound to the platform work identity (instance/run/round/node/operation/inputDigest/generation) and exact executor/conversation/execution. The business finalizer verifies those identities, active round, permissions and business revision before committing. `collect` returns immutable evidence only after that finalizer succeeds. Runtime success alone is not business acceptance.
5. Register a native human gate. Its policy checks the current proposal and human Project authority without modifying domain data. Business UI submits the same native decision as the platform view. A downstream idempotent service operation consumes persisted decision evidence, checks actor and exact proposal revision, then records the business approval/rejection. The Agent cannot approve itself.
6. A service operation uses a durable keyed receipt; inspect must recover a lost acknowledgement without repeating external effects. Never replay an uncertain external effect just because a timeout occurred. Preserve the App's explicit simulation/real-system distinction.
7. Read execution state from `ProjectPipelinesRuntimeCapability.graph` using the receipt's exact instance and round. Keep domain acceptance separate from execution state; do not leave prepared receipts displayed as running after a platform failure/cancellation. Bound reads and group records by round rather than introducing another polling worker.

## Inputs and history

- Pin a stable source version/digest. Status changes, output artifacts and approvals are not new source inputs. Technical retries remain in the same round; genuinely changed input creates a new round according to native policy.
- Platform history owns attempt/round attribution. Do not recopy native history into plugin projection snapshots or synthesize execution IDs.
- If the business UI only offers immutable demo sources, say that a new source version is unavailable; do not mutate old data merely to demonstrate nextRound.
- Old Provider data need not be interpreted as native executions. Preserve local data while removing superseded runtime paths; a dedicated native business-acceptance ledger can separate the new contract cleanly.

## Provider integration, when selected

Register `ProjectPipelineProjectionProvider`; `snapshot(context, sourceKey)` stays a pure read. Preserve ordered, durable source epochs/sequences and immutable historical snapshots. Capture domain transitions transactionally and deliver after commit with idempotent recovery. Exact execution handles do not imply node/round ownership: verify the selected host's public attribution contract and never infer membership from shared tasks, timestamps or labels. Keep provider human approvals under their existing domain authority.

## Navigation

- For Assistant-contained workflows, expose `project.tasks` and open the existing `platform.project-tasks__timeline` Remote View with `parameters.initialTab: pipeline`. Use `workbench.navigation.open` with `target: assistant.project`, the real Project ID, View key and parameters to select the Project and View atomically; `workbench.view` suffices when already in the correct Project. This stays inside the Assistant. Platform dispatch does not require navigating to the platform Project management page.
- Use `project.pipelines` only when full platform Project management is explicitly required. Do not add a dedicated command or HTTP endpoint merely to bridge back from that page to an Assistant business View; do not widen execution-dialog allowlists.
- For native pipeline → business workspace, resolve the saved subject through its registered `resolveEntry`. The host checks Project read permission, exact scoped instance/round/node, accessible published Assistant and Project membership on every click. Forward identifiers across iframe boundaries; let the host resolve view/selection/parameters through the existing View action.
- Carry `pipelineInstanceId`, `pipelineRoundId` and optional `pipelineNodeId` in View parameters in both directions and across business subviews. Opening another Case replaces stale selection/query. Starting a pipeline uses the returned instance identity without inheriting a historical round. Omit absent fields; structured cloning preserves undefined properties and can fail strict validation. Historical navigation opens current business facts; it does not roll back approvals.

## Verification and release

Test native configuration/graph validity, actual finalizer acceptance, approve/reject, idempotent receipts, stale input, cancelled/superseded work, role/execution identity, cross-scope access and runtime failure presentation. Use isolated PostgreSQL schemas for persistence tests. Test host navigation against foreign payloads and user/project changes while resolution is pending.

Run type checks, builds, generated asset checks and the repository's dist-first lifecycle harness. Install on the selected local host, honor restartRequired and verify loaded plugin/SDK provenance. Update installed Assistant templates in place, preserving IDs and model bindings.

Record real model execution, human gates, retry/cancel, history and workspace/execution links separately from fixture tests. Simulation receipts are not real external-system confirmations. Coordinate unreleased host/SDK API changes before publishing plugins. Use the local-environment and plugin-development skills only for their applicable setup/deployment work and respect existing user authorization boundaries.
