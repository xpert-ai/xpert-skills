# Assistant Task Specialist Subagent Orchestration

Use this reference when a deterministic Agentic App workflow must start a specialist subagent inside an installed Assistant. A **specialist subagent** is a child Agent with one bounded domain responsibility, an explicit parent, and a least-privilege capability set. It is not the primary coordinator Agent and not a generic background Agent.

Typical specialist subagent roles include document interpretation, outline planning, chapter authoring, evidence supplementation, and bounded validation.

## Contents

- [Responsibility Boundaries](#responsibility-boundaries)
- [Assistant DSL Contract](#assistant-dsl-contract)
- [Start a Specialist Subagent](#start-a-specialist-subagent)
- [Task Identity and Persistence](#task-identity-and-persistence)
- [Managed Queue Orchestration](#managed-queue-orchestration)
- [Completion, Recovery, and Cancellation](#completion-recovery-and-cancellation)
- [View Execution Records](#view-execution-records)
- [Validation Checklist](#validation-checklist)

## Responsibility Boundaries

Keep three responsibilities separate:

1. Let the domain orchestrator decide stages, dependencies, concurrency, retry policy, and the next transition.
2. Let Managed Queue own durable scheduling, scope restoration, retries, and processor concurrency.
3. Let each specialist subagent complete one bounded domain task through only its directly connected middleware tools.

Do not let a model decide workflow transitions. Do not expose `startTask` as a generic tool that a specialist subagent can call recursively. Start specialist subagents from the server-side domain orchestrator, and restrict each specialist subagent to the domain capabilities required by its role.

Define one stable runtime entrypoint for every launchable specialist subagent:

```ts
export const SPECIALIST_SUBAGENT_KEYS = {
  interpretation: 'Agent_Interpretation',
  outline: 'Agent_Outline',
  authoring: 'Agent_Authoring'
} as const
```

Treat this registry as a shared contract across application code, Assistant DSL, template contributions, tests, persisted tasks, and the published Assistant graph. When a key changes, increment the Assistant graph version and migrate or reject persisted tasks that still reference the old key.

## Assistant DSL Contract

Require every specialist subagent to:

- exist as a real child Agent node in the published Assistant graph;
- declare a stable `agentKey`, a valid `leaderKey`, and exactly one intended incoming Agent connection from its parent;
- connect directly only to the middleware, tools, Skills, and knowledge sources required by its role;
- use structured `entity.parameters` for correctness-critical identifiers, expected revisions, and bounded collections;
- define the read, begin-draft, batch-write, finalize, and failure-reporting order in its prompt;
- return compact results or persisted references instead of copying full documents through the parent layer;
- use an appropriate mute path for internal work while preserving the execution tree and compact result.

Programmatic launch does not turn the child Agent into an independent root Agent. Keep the parent relationship and normal graph validation even when `AssistantTaskRuntimeCapability` addresses the specialist subagent directly by `agentKey`.

Cross-check the runtime entrypoint registry against the parsed DSL in template tests. Require every entrypoint key to exist, every target node to have the expected parent and middleware ownership, and every Skill dependency `targetAgentKey` to reference that same child Agent.

## Start a Specialist Subagent

Resolve `AssistantTaskRuntimeCapability` from the platform Runtime Capability Registry. Do not call internal Chat, Conversation, or Execution services directly:

```ts
import {
  AssistantTaskRuntimeCapability,
  XPERT_RUNTIME_CAPABILITIES_TOKEN,
  type AgentMiddlewareAssistantTaskApi,
  type RuntimeCapabilityRegistry
} from '@xpert-ai/plugin-sdk'

const assistantTasks = runtimeCapabilities.require(
  AssistantTaskRuntimeCapability
)

const result = await assistantTasks.startTask({
  xpertId: assistantId,
  agentKey: SPECIALIST_SUBAGENT_KEYS.outline,
  projectId: workspaceProjectId,
  prompt: 'Generate three outline candidates for the active interpretation revision and finalize their scoring-point mappings.',
  humanInput: {
    domainTaskId,
    expectedRevision,
    variantCount: 3
  },
  context: {
    projectId: domainProjectId,
    workflowRunId,
    stage: 'outline'
  },
  files: sourceFiles
})
```

Use each input field according to its platform meaning:

| Field | Usage |
| --- | --- |
| `xpertId` | Pass the installed Assistant ID, not a template key or plugin name. |
| `agentKey` | Pass the stable published key of the specialist subagent. Do not omit it and rely on the primary Agent to infer routing. |
| `projectId` | Pass the platform Workspace or Assistant Project ID when the task uses Workspace Files. |
| `prompt` | State a bounded objective, completion condition, and failure condition. Do not include secrets or large objects. |
| `humanInput` | Pass structured, JSON-safe business fields that must enter Assistant input state. |
| `context` | Pass bounded runtime context that middleware and tools use to reload authoritative objects. Do not assume it is automatically model-visible. |
| `files` | Pass Workspace Files portable references. Never pass bytes, base64, temporary URLs, or server paths. |
| `clientMessageId` | Use only when the caller can guarantee stable idempotency semantics. |
| `taskId` | Pass only a real platform Task aggregate ID owned by the caller. Never substitute a plugin domain task ID. |

Reload and validate all objects, scope, and revisions referenced by `humanInput` and `context` on the server. Treat View or model state as a locator, not as authorization or authoritative business state.

## Task Identity and Persistence

Keep the plugin domain task and the platform Assistant Task as separate aggregates with separate identifiers:

```ts
type SpecialistSubagentExecutionLink = {
  domainTaskId: string
  assistantTaskId: string | null
  conversationId: string | null
  threadId: string | null
  executionId: string | null
  agentKey: string
}
```

Persist every handle returned by `startTask` immediately. For later status checks, prefer `executionId` and include the known `conversationId`, `threadId`, `assistantTaskId`, and `xpertId` as recovery identifiers.

Create an immutable execution-attempt record for every launch instead of overwriting only the latest values on the domain task. Record at least the sequence, specialist subagent key, start and finish times, status, attempt number, input revision, output revision, conversation/thread/execution handles, and a safe failure summary.

## Managed Queue Orchestration

Use Managed Queue to launch specialist subagents without making an HTTP handler or View action wait for the complete model execution:

1. Create the domain task, operation ID, and execution-attempt record.
2. Enqueue tenant, organization, installation scope, user, domain task ID, and expected revision.
3. Atomically claim the current `queued` domain revision in the processor.
4. Call `AssistantTaskRuntimeCapability.startTask` with the stable specialist subagent key.
5. Persist the returned platform execution handles and finish the short processor invocation.
6. Advance the workflow through a later supervision job, a domain finalize event, or bounded status reconciliation.

Keep Queue payloads bounded and replayable. Store IDs, revisions, operation IDs, and policy parameters only. Reload current domain state from persistence in every processor invocation; do not enqueue complete snapshots, file bytes, temporary access URLs, or server paths.

Apply concurrency control at two layers. Use Managed Queue processor concurrency to limit launch rate within a process, and use a unique constraint, atomic claim, or scoped lock to ensure one logical domain task revision starts only one specialist subagent execution.

## Completion, Recovery, and Cancellation

Recover platform execution state with `getTaskStatus`:

```ts
const status = await assistantTasks.getTaskStatus?.({
  taskId: execution.assistantTaskId ?? undefined,
  executionId: execution.executionId ?? undefined,
  conversationId: execution.conversationId ?? undefined,
  threadId: execution.threadId ?? undefined,
  xpertId: assistantId
})
```

Interpret status conservatively:

- Keep `queued` and `running` as nonterminal and continue bounded supervision.
- Treat `succeeded` as platform execution completion only; require the expected domain finalizer and active revision before declaring business success.
- Persist a safe failure summary for `failed` or `interrupted`, then apply the domain retry budget.
- Keep `unknown` or `null` recoverable. Never infer success or produce an official downstream artifact.

Use the domain finalizer as the authoritative success signal. Require the specialist subagent to submit output through a controlled finalize tool that validates scope, revision, evidence, and completeness. If the Assistant execution ends without producing a valid domain version, fail or recover the domain task instead of advancing the workflow.

Cancel Queue work and Assistant execution separately:

1. Call `ManagedQueueService.cancel` for a job that has not started or remains queued.
2. Call `AssistantTaskRuntimeCapability.cancelTask` with the persisted conversation/thread/execution handles for a started specialist subagent execution.

Require both the processor and the specialist subagent's mutation tools to check current domain cancellation state before activating a new version.

## View Execution Records

Display execution-attempt records beside the relevant workflow stage, outline candidate, chapter, or other domain result. Show status, sequence, specialist subagent role, time, and safe failure summary. Keep `conversationId`, `threadId`, and `executionId` as internal navigation fields.

Render a status dot or marker as a focusable Button. On click, invoke `workbench.navigation.open` with the `assistant.conversation` target instead of constructing a ChatKit URL or manipulating the top-level router. Enable navigation only when the record has a valid `conversationId`; include `threadId` and `executionId` so the host can select the exact execution.

Treat execution records as an audit trail, not as decorative loading indicators. Preserve failed attempts after a successful retry and record which later attempt superseded them.

## Validation Checklist

- Verify every programmatic `agentKey` in the source DSL, built asset, installed draft, and published graph.
- Verify every specialist subagent has the intended parent, `leaderKey`, incoming Agent connection, and least-privilege capability set.
- Keep domain task IDs separate from platform Assistant Task IDs.
- Persist every conversation/thread/execution handle returned by `startTask`.
- Keep Queue payloads bounded, replayable, and scoped by tenant, organization, installation, user, and revision.
- Prevent duplicate Queue delivery from launching the same domain task revision twice.
- Refuse to treat Assistant execution completion as business success when domain finalization is missing.
- Recover nonterminal tasks from persisted handles after restart and apply bounded retry and cancellation rules.
- Open the exact ChatKit execution from each authorized View execution record through the public Client Command.
- Cover start, status, cancellation, and finalizer behavior in unit tests; cover one real specialist subagent execution and execution-record navigation in the installed platform.
