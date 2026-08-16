# Large Data Mutation Workflows For Agent Tools

Use this reference when an Agent must create, extract, import, or update enough domain records that one oversized tool call is fragile but one call per lifecycle transition is wasteful.

In this reference, `target`, `work unit`, `item`, and `draft` describe generic workflow roles rather than platform entity names. Map them to the plugin's own domain model and omit any role that the workflow does not need.

## Contents

1. [Separate semantic units from transport batches](#separate-semantic-units-from-transport-batches)
2. [Use a restartable workflow](#use-a-restartable-workflow)
3. [Choose JSON and YAML deliberately](#choose-json-and-yaml-deliberately)
4. [Compress lifecycle calls safely](#compress-lifecycle-calls-safely)
5. [Define mutation parameters](#define-mutation-parameters)
6. [Set transaction boundaries](#set-transaction-boundaries)
7. [Handle concurrency and retries](#handle-concurrency-and-retries)
8. [Return compact receipts](#return-compact-receipts)
9. [Use jobs for true bulk work](#use-jobs-for-true-bulk-work)
10. [Test failure and recovery](#test-failure-and-recovery)

## Separate semantic units from transport batches

Choose tool granularity by the smallest independently valid business fact, not by the number of tool calls. Let one mutation write one independently valid domain item or relationship.

Per-item writes are preferable for model-generated data because they:

- isolate schema or domain-validation failures;
- preserve successful work when a later item fails;
- make retries and conflict recovery precise;
- keep prompts, arguments, logs, and receipts bounded;
- give each item an independent identity and audit trace.

Do not interpret “reduce tool calls” as “submit an array of unrelated model-generated records.” A large batch forces the model to reconstruct and resend good items after one bad element, increases partial-failure ambiguity, and makes idempotency harder.

Permit a bounded batch only when the operation is deterministic and homogeneous, validation is independent or supports per-item receipts, the maximum is small, and the service can state atomic versus partial-success semantics exactly. Use background import jobs for large files or thousands of rows.

## Use a restartable workflow

Prefer this shape:

```text
get_context / list_work_units
  -> create_or_get_draft
  -> repeated single-item upserts
  -> validate
  -> explicit publish/commit after confirmation
```

Keep draft construction separate from publication. Let validation report unresolved dependencies, required completeness checks, conflicts, and blocking diagnostics without returning the full draft.

Make every step safe to resume after model, network, validation, or process failure. Persist progress in domain state; do not make the conversation history the only record of completed items.

## Choose JSON and YAML deliberately

Use strict JSON objects as the canonical daily mutation format. Give each tool one typed object with bounded fields and exact identifiers.

Use YAML only as an optional bulk-initialization adapter when humans or Agents benefit from a readable manifest. Keep the outer tool input JSON and carry a bounded `manifestYaml` string. Require a versioned schema, reject aliases, merge keys, and custom tags, parse YAML into the canonical JSON model, then run the same Zod and domain validation as normal JSON tools.

Restrict YAML application to draft creation or replacement. Never let a manifest bypass domain rules, scope checks, revision checks, validation, confirmation, or publication. Return line and column diagnostics when parsing fails.

## Compress lifecycle calls safely

Remove lifecycle-only calls when their transition can be performed idempotently by the first or last meaningful operation.

- Let the first exact scoped read call an internal `ensureStarted` before retrieval.
- Let the final single-item write accept `finalizeWorkUnit: true` and atomically persist that item plus the work unit's completed state.
- Retain an explicit finalize tool only for zero-result, no-op, or other cases with no final write.

This reduces tool-call overhead without weakening per-item validation. Do not hide surprising business mutations inside generic reads: auto-start is appropriate only for an internal, reversible, idempotent preparation state that the read necessarily requires. Publication, deletion, approval, charging, external messages, or irreversible completion still require explicit tools and confirmation where applicable.

Do not require the model to predict a “last discovery step.” Discovery may reveal more work. Attach completion to the last successful write, where the Agent has an actual durable result. If later controlled supplementation is permitted, define that state transition explicitly.

## Define mutation parameters

Put these fields on iterative mutations when relevant:

```ts
{
  targetId: string
  expectedRevision: number
  idempotencyKey: string
  changeSummary: string
  item: StrictSingleDomainItem
  finalizeWorkUnit?: boolean
}
```

Apply these rules:

- Resolve tenant, organization, user, and credentials from trusted runtime context.
- Require an exact target/draft/version identifier.
- Bound and describe every string, enum, list, numeric unit, and related-record identifier.
- Keep one semantic item in `item`; reject arrays on single-item tools.
- Use `expectedRevision` or `baseRevision` for optimistic concurrency.
- Make `idempotencyKey` stable for the intended mutation, not regenerated on retry.
- Keep `changeSummary` concise and user-visible for progress/audit events.
- Use explicit optional transition flags only when the transition is coupled to the same transaction.

Separate tool schemas from persistence entities. Map the validated input into a domain command; never accept ORM rows or arbitrary JSON patches as the normal path.

## Set transaction boundaries

Keep one database transaction aligned with one model-visible semantic operation:

1. lock or compare the current target revision;
2. resolve and validate related records inside tenant/organization scope;
3. detect an existing idempotency receipt;
4. apply one item mutation;
5. update derived counts, completeness metrics, and audit state;
6. apply an optional coupled lifecycle transition;
7. increment the revision and persist the receipt;
8. commit before emitting success events.

When `finalizeWorkUnit: true`, save the final item and work-unit completion atomically. Never persist the item, emit success, and then separately attempt completion. Never mark a work unit complete before the item write is durable.

Keep cross-resource publication or external side effects outside an unbounded database transaction. Use an outbox/job pattern where atomic local state and eventual external delivery are required.

## Handle concurrency and retries

Serialize mutations per target when concurrent tool calls can edit the same draft. Use compare-and-swap at persistence even when an in-process queue exists.

On duplicate `idempotencyKey`, return the stored compact receipt without incrementing counts or repeating the lifecycle transition. On a stale revision, return a stable conflict code and the current revision; instruct the Agent to re-read context and retry only the failed item. Do not silently overwrite or loop indefinitely.

Define state-specific idempotency:

- repeated `ensureStarted` creates one collecting state;
- repeated item upsert does not duplicate the item or its related records;
- repeated final item write keeps the work unit completed;
- repeated finalize on an already completed work unit returns success without changing counts;
- writes to immutable or published versions fail with a stable code.

## Return compact receipts

Return only what the Agent needs to continue:

```json
{
  "targetId": "...",
  "itemId": "...",
  "revision": 12,
  "status": "completed",
  "created": true,
  "workUnitFinalized": true,
  "counts": { "items": 18, "blocking": 0 },
  "nextAction": "validate_draft"
}
```

Do not return the full aggregate, complete input document, all related records, complete history, large derived data, or raw upstream payloads from mutation tools. Provide paged list and exact item or detail reads separately.

Emit progress events after commit. Use the stable tool name and bounded `changeSummary`; event-delivery failure must not roll back the business transaction.

## Use jobs for true bulk work

Use Managed Queue or the platform job abstraction when processing large spreadsheets, files, imports, exports, transformations, or provider operations exceeds a normal bounded tool call.

The start tool should validate and freeze inputs, enqueue work, and return `jobId`, input revision or snapshot identifier, and status. Provide bounded status, cancellation, failure, and result-reference tools. Let the worker reuse the same per-item domain commands and idempotency rules rather than implementing a second unvalidated bulk write path.

Keep file parsing configuration supplied by the owning application or request when business context determines it. Do not hardcode product-specific parsing strategies inside a generic infrastructure layer.

## Test failure and recovery

Cover at least:

1. minimum and maximum single-item inputs and rejection of arrays;
2. duplicate idempotency keys without duplicate rows or counters;
3. stale revisions and one-item retry after re-read;
4. related-record, domain-validation, tenant, and organization failures;
5. transaction rollback when item validation or finalization fails;
6. atomic final item plus completion and idempotent retry;
7. zero-result fallback finalize and incomplete-work-unit gate behavior;
8. concurrent first reads producing one started state;
9. immutable/published target rejection;
10. YAML size, version, tag, alias, merge-key, schema, and line/column diagnostics;
11. compact receipt allowlisting and response-size bounds;
12. job retry/cancellation when the workload is truly bulk;
13. successful mutation event delivery only after commit;
14. no deprecated whole-object or duplicate compatibility tool remains.
