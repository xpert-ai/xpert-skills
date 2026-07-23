# Agent Long-Running Tasks With Bounded Long Polling

Use this pattern when a plugin starts durable background work but the active chat connector can only deliver the final Agent turn and cannot yet send a later proactive message. Keep the original Agent execution alive through a bounded wait tool until the durable request reaches a terminal state.

Treat this as a bridge, not the preferred architecture for every long task. Prefer a background completion callback or proactive connector message when the platform supports durable delivery. Do not use Agent polling for unbounded work, multi-hour jobs, or flows whose execution/connector timeout is shorter than one bounded wait.

## Contents

1. [Architecture](#architecture)
2. [Bounded wait contract](#bounded-wait-contract)
3. [Opaque state cursor](#opaque-state-cursor)
4. [Compact output](#compact-output)
5. [Assistant execution rule](#assistant-execution-rule)
6. [Avoid duplicate completion delivery](#avoid-duplicate-completion-delivery)
7. [Failure and recovery](#failure-and-recovery)
8. [Validation](#validation)

## Architecture

Separate three identities:

- `requestId`: one user submission, possibly containing several items.
- `itemId`: one durable request item.
- `runId` or `jobId`: one background execution for an item.

Never let an Agent substitute `requestId` for `runId`. Use request-level tools for aggregate progress and item/run-level tools only after a run identifier has been returned explicitly.

Provide these model-visible operations:

```text
<domain>_submit
<domain>_wait_request
<domain>_get_request
```

- `submit` validates and freezes input, creates the durable request/items, enqueues jobs once, and returns the initial `requestId` and opaque `cursor`.
- `wait_request` keeps the current Agent turn alive. Its input should normally be exactly `{ requestId, cursor }`.
- `get_request` is for a later user message or manual recovery, not for the automatic wait loop.

Keep business work in existing domain services and Managed Queue processors. The wait service only observes persisted business state and performs bounded reconciliation; it must not duplicate extraction, import, rendering, or validation logic.

## Bounded wait contract

Choose fixed server-side timing below the active execution and connector idle timeouts. A proven starting point is:

- maximum wait per tool call: 45 seconds
- persisted-state check interval: 2 seconds
- no open database transaction, checked-out connection, Redis blocking command, or queue worker held between checks

Do not expose wait duration or polling interval as model parameters. Pass the Agent cancellation signal into the service and clear the pending timer immediately when cancelled.

```ts
const waitRequestSchema = z.object({
  requestId: z.string().trim().min(1).max(200),
  cursor: z.string().trim().min(1).max(200)
}).strict()

const waitRequestTool = tool(
  async (input, config: RunnableConfig) =>
    JSON.stringify(
      await requestService.waitForChange(
        input.requestId,
        input.cursor,
        scope,
        config.signal
      )
    ),
  {
    name: '<domain>_wait_request',
    description:
      'Wait for request progress to change. Reuse the returned cursor while terminal=false.',
    schema: waitRequestSchema,
    verboseParsingErrors: true
  }
)
```

The service should:

1. Check cancellation.
2. Read one aggregate request snapshot.
3. Reconcile Managed Queue state on the first check.
4. Return immediately when the cursor changed or the request is terminal.
5. Otherwise wait without holding infrastructure resources, then batch-read persisted state again.
6. Repeat until the fixed deadline.
7. At the deadline, reconcile once more and return the final snapshot.

Query all item runs in one scoped read, with a hard batch limit matching the submit limit. Do not issue one database query per item and do not call Managed Queue on every two-second check.

## Opaque state cursor

Generate the cursor server-side from stable, allowlisted state:

- request status and completed/total counts
- each item ordinal, status, run identifier, result counts, and stable failure code
- each run status/stage and observation/result/problem counts

Sort item/run tuples deterministically, hash the canonical serialized value, and return a short opaque digest. Do not encode full entities, timestamps that change on ordinary reads, tenant data, paths, or logs.

Any meaningful stage or result change must produce a different cursor. The Agent must pass the returned cursor unchanged to the next wait call.

## Compact output

Keep the result small and stable:

```json
{
  "code": "request_changed",
  "requestId": "opaque-id",
  "cursor": "opaque-cursor",
  "changed": true,
  "terminal": false,
  "progress": "1/3",
  "stages": {
    "queued": 0,
    "processing": 2,
    "finalizing": 0
  },
  "results": {
    "succeeded": 1,
    "needsReview": 0,
    "failed": 0
  },
  "nextAction": "wait_again"
}
```

When terminal, return `nextAction: "reply_summary"` plus aggregate counts and at most five bounded review/failure summaries. Do not return full entities, histories, workspace paths, provider payloads, or execution logs.

Return `changed=false`, `terminal=false`, and `wait_again` after an unchanged timeout. A timeout is not a job failure.

## Assistant execution rule

Put the loop instruction in the dedicated Assistant template:

1. Call `submit` once per user message.
2. Do not end the turn after a successful non-terminal submit.
3. Call `wait_request` immediately with the exact returned `requestId` and `cursor`.
4. When `terminal=false`, pass the new cursor to the next `wait_request`.
5. Continue when `changed=false`; never replace the loop with tight `get_request` calls.
6. Stop only when `terminal=true`.
7. Reply with one or two user-facing sentences; do not expose identifiers, cursors, JSON, paths, or logs.

Keep `get_request` available for later manual status questions and recovery after an interrupted Agent execution.

## Avoid duplicate completion delivery

Persist an internal completion mode such as:

```text
agent_poll
background_callback
```

Requests created by this flow use `agent_poll`. When such a request completes, do not enqueue a separate summary Assistant task or proactive callback; the original Agent execution owns the final reply.

Keep the existing background mode as the default for historical rows and other entry points. Gate only completion delivery, not the background business job itself.

## Failure and recovery

- Persist terminal business state before returning it to the Agent.
- Convert final queue dispatch/monitor failures and stale jobs into durable item failures during reconciliation.
- Make submission and terminal updates idempotent so retries do not create duplicate runs or duplicate replies.
- On Agent cancellation, remove timers/listeners promptly; do not cancel durable business work unless cancellation is an explicit user operation.
- Accept that process restart, model interruption, or connector loss can end the polling turn. The durable job must continue, and a later `get_request` call must recover its status.
- Record enough stable failure information for a compact user summary, but keep detailed diagnostics in server observability.

## Validation

Test at least:

1. already-terminal requests return immediately
2. stage/result changes wake before the deadline and return a new cursor
3. 45 seconds without change returns `changed=false`
4. multiple items are batch-read and accurately split across stages/results
5. reconciliation-induced failures become terminal
6. Agent cancellation clears the timer and rejects with a cancellation/abort error
7. queue reconciliation runs only at entry and timeout, not every check
8. `agent_poll` suppresses background summary delivery while the default mode remains compatible
9. submit returns the initial cursor and the tool schema stays strict and small
10. the Assistant loops until terminal and produces only one concise final response

Before choosing concrete values, verify the host Agent recursion limit, total execution timeout, connector idle timeout, and expected worst-case job duration. Keep enough margin for database queries and the final model response.
