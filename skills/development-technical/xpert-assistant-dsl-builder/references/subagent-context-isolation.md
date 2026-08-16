# Subagent Responsibility And Context Isolation

Use this reference to decide whether a complex Xpert Assistant task should be delegated and to define a child Agent that can complete a bounded transaction with limited, explicit context.

## Contents

1. [Delegate for a real boundary](#delegate-for-a-real-boundary)
2. [Keep work in the parent when appropriate](#keep-work-in-the-parent-when-appropriate)
3. [Divide responsibility](#divide-responsibility)
4. [Design the task packet and history policy](#design-the-task-packet-and-history-policy)
5. [Connect capabilities directly](#connect-capabilities-directly)
6. [Use middleware modes](#use-middleware-modes)
7. [Return a compact result](#return-a-compact-result)
8. [Control lifecycle and failure](#control-lifecycle-and-failure)
9. [Validate the runtime](#validate-the-runtime)

## Delegate for a real boundary

Add a child Agent when most of these conditions hold:

- the objective is bounded and can be expressed with explicit input and output fields;
- it uses a distinct tool subset or knowledge domain;
- it benefits from a clean context without the parent conversation's unrelated plans and outputs;
- it performs repeated retrieval, per-item processing, validation, or another context-heavy loop;
- it can retry or fail independently without corrupting the parent's transaction;
- its result can be summarized as IDs, counts, evidence references, diagnostics, and status;
- the parent remains responsible for planning, reconciliation, user communication, and approval.

Typical specialists include exact evidence retrieval for missing fields, one-document extraction, one-item normalization, independent validation, or a bounded domain lookup.

Context isolation is a correctness mechanism, not merely a token optimization. A specialist with only the relevant field contract, source identifiers, and retrieval tools is less likely to use stale or unrelated evidence.

## Keep work in the parent when appropriate

Do not add a child Agent when:

- the task is one or two cheap tool calls;
- the parent must continuously reason over the complete conversation to act correctly;
- delegation would require copying most of the parent context;
- parent and child would mutate the same target concurrently without a serialization contract;
- the child has no independently testable result;
- the only motivation is to hide an oversized universal tool list;
- orchestration overhead, model calls, or result reconciliation exceeds the isolated work.

Fix middleware and tool boundaries before adding Agents to compensate for duplicate or unrelated tools.

## Divide responsibility

Keep authority explicit:

| Role | Responsibility |
| --- | --- |
| Coordinator | understand the user goal, plan, dispatch bounded work, reconcile results, request confirmation, communicate outcome |
| Worker | own one item, source, case, or draft unit and persist its allowed changes |
| Specialist | execute one capability such as deep retrieval or validation with least-privilege tools |
| Human | approve controlled decisions and remain accountable for publication, deletion, override, or accepted risk |

A child Agent must not publish, delete, approve, or broaden scope unless its explicit role and the human policy allow it. Prompts describe responsibility; middleware connections and domain authorization enforce it.

## Design the task packet and history policy

Design the delegated task packet independently from the child Agent's message-history policy. Parent-to-child context is supplied through the Agent call input, state variables, prompt templates, and graph connections; `disableMessageHistory` does not select, inherit, or suppress the parent Agent's messages.

Set `disableMessageHistory: true` only when the child should start each new invocation round without its own prior-round message list. The runtime still retains messages needed for model and tool steps within the current round, and system prompts, summaries, memories, state variables, or a configured history variable may still provide context. Keep the flag disabled when the child must reason over its own earlier invocation rounds.

Pass references in the task packet instead of copied histories or full tool outputs.

Include:

- `taskId` or correlation ID;
- target business ID and expected revision;
- exact objective and completion condition;
- bounded field/item/source IDs;
- missing, invalid, low-confidence, or conflicting states to resolve;
- approved knowledge/document IDs and retrieval scope;
- allowed mutations and confirmation limits;
- idempotency key or operation ID when the child writes;
- compact output schema;
- deadline, search/page/call budget, and escalation conditions when needed.

Example:

```json
{
  "taskId": "gap-17",
  "caseId": "...",
  "expectedRevision": 12,
  "fieldKeys": ["frame_size"],
  "sourceIds": ["doc-4", "doc-7"],
  "objective": "Find exact source evidence and save at most one Observation per fact.",
  "completion": "Return saved Observation IDs or a zero-hit diagnostic.",
  "limits": { "maxSearchCalls": 8, "maxEvidenceItems": 10 }
}
```

Do not pass tenant IDs, credentials, tokens, raw binaries, complete documents, or organization-specific resource IDs in reusable template prompts. Resolve identity and installed knowledge bindings from runtime context.

## Connect capabilities directly

Assume a child Agent inherits neither middleware tools nor knowledge from its parent. Connect every required middleware and knowledge node directly to the child.

Give the child:

- exact scoped reads and searches;
- the narrow item mutation it owns;
- diagnostics or fallback completion tools needed for its task;
- only the knowledge bases it is allowed to retrieve.

Withhold unrelated lifecycle, pricing, publication, deletion, approval, and administration tools. Do not rely on the child prompt to ignore connected authority.

## Use middleware modes

Use one domain middleware Provider with positive tool modes when the coordinator and specialist work in the same domain but need different subsets:

```text
same provider key
  coordinator mode     -> scope, diagnostics, review, lock
  deep_retrieval mode  -> exact search, visual review, per-item evidence writes
```

Different lists are correct when the mode is deliberate and tested. Define one canonical domain tool set, express every mode as an allowlisted subset, and assert exact mode lists. Never instantiate an aggregate provider and subtract tools with `exclude*` flags.

Use separate providers when responsibilities belong to different domains, Views, authorization policies, or state machines.

## Return a compact result

Require the child to return a structured result such as:

```json
{
  "taskId": "gap-17",
  "status": "completed",
  "targetId": "...",
  "revision": 13,
  "changedIds": ["observation-21"],
  "evidenceIds": ["evidence-8"],
  "unresolved": [],
  "diagnostics": [],
  "nextAction": "review_requirement"
}
```

Do not copy source text, complete search results, full model objects, or internal reasoning back to the parent unless the parent explicitly needs a bounded excerpt. Persist durable evidence and return its ID.

## Control lifecycle and failure

- Make child writes idempotent and revision-aware.
- Serialize parent and child mutations to the same target or give them non-overlapping ownership.
- Bound search depth, pagination, retries, and recursive delegation.
- Define zero-result and partial-result behavior; a clean “not found in approved sources” result is valid.
- Return stable failure codes for stale revision, missing capability, authorization failure, schema rejection, and exhausted search budget.
- Let the parent decide whether to retry, dispatch another specialist, ask the user, or stop.
- Prevent a child failure from erasing previously committed per-item work.
- Avoid recursive Agent fan-out unless the graph and budget explicitly require it.

For evidence extraction, the first exact source search may idempotently prepare source state, and the last successful per-item write may atomically finalize it. Keep a fallback finalize tool for zero-hit or no-eligible-evidence cases; do not batch multiple Observations to reduce calls.

## Validate the runtime

Verify:

1. one stable child key, direct `leaderKey`, and exactly one incoming Agent connection;
2. `disableMessageHistory` matches the Agent's intended cross-round memory policy, and parent-to-child task context is validated separately;
3. direct middleware and knowledge connections exist for every required capability;
4. the child lacks unrelated and privileged tools;
5. task and result contracts are present in both parent and child prompts;
6. provider keys and modes match the intended exact tool lists;
7. one bounded execution produces the expected parent-to-child call tree;
8. persisted outputs match the compact child receipt;
9. retries do not duplicate writes and stale revisions are recoverable;
10. no child tool call violates human approval or role boundaries;
11. source template, installed draft, published graph, and fresh conversation agree.

Refreshing a template does not rewrite an existing Assistant. Explicitly upgrade or recreate the intended instance and publish the new graph before using an old execution tree to judge the design.
