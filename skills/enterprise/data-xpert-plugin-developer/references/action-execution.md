# Ontology Actions and Plugin Execution

Read this reference when a data-xpert ontology Action must drive real or demonstrable application behavior.

## Connection model

data-xpert owns the semantic definition: Action code, name, target entity type, risk, approval requirement, preconditions, expected effects, and any declared input contract. The plugin owns operational behavior: typed input normalization, mapping to an external system, preflight, approval state, adapter execution, retries, receipts, and audit.

Connect them by exact Action code:

```text
data-xpert neighborhood.affordances[].code
  -> plugin Action registry[actionTypeCode]
  -> typed preflight
  -> pending proposal
  -> human approval
  -> execution adapter
  -> receipt and audit events
```

Do not dispatch by Action display name, translated label, prompt text, or attribute similarity. Reject unknown codes or expose them as unavailable with a stable reason such as `NO_EXECUTION_ADAPTER`.

## Governed pipeline

### 1. Discovery

Refresh the selected object's neighborhood and merge its ontology affordances with plugin execution metadata. Return source, risk, approval requirement, target system, execution mode, required inputs, preconditions, predicted effects, availability, and blocking reasons.

If a Demo catalog supplements missing ontology Actions, mark each item with `source: 'demo'`. Never label a fallback Action as ontology-defined.

### 2. Preflight

Before creating a proposal or executing an approved item:

- refresh the canonical object and compare the expected graph version;
- verify the Action still applies to the target type;
- validate and normalize typed input;
- evaluate ontology constraints and Action preconditions;
- verify external mappings and adapter availability;
- calculate warnings, blocking reasons, and predicted effects.

Preflight is read-only. It must not create a work order, isolate equipment, schedule service, or write to another business system.

### 3. Proposal

The Assistant may create a reviewable proposal only after a successful preflight. Require a bounded `operationId` and make retries idempotent within tenant and organization scope. Store the canonical object identity, Action code, snapshot and graph version, normalized input, evidence, expected effects, creator, and preflight summary.

Use a state machine with explicit allowed transitions, for example:

```text
pending_review -> approved -> completed | failed
               -> rejected
```

### 4. Human authority

Agent middleware may discover, preflight, list, and create proposals. Approval, rejection, and execution belong to explicit human Workbench actions unless the product has a separately authorized automation policy. Do not give the Assistant an approval or execution tool merely because the backend method exists.

### 5. Execution adapter

On execution, lock and re-read the proposal, require `approved`, rerun any stale or safety-critical checks, invoke the adapter with a typed request, and persist a compact receipt. Separate adapters by target system or Action family; do not embed external API details in prompts.

The adapter result should distinguish accepted/queued, completed, failed, and partially completed outcomes. Keep external references, timestamps, safe error codes, and recovery guidance. Never claim success from an HTTP request alone when the external contract is asynchronous.

### 6. Audit

Append events for material transitions and execution phases, including actor, timestamp, from/to status, comment, safe payload summary, and external reference. A useful execution timeline is:

```text
execution_queued -> execution_started -> execution_completed | execution_failed
```

Keep audit events append-only and scoped by tenant and organization. Combine plugin decision audit with data-xpert task audit only through explicit DTOs that retain each event's source.

## Demo execution

Demo adapters are useful for customer demonstrations but require an explicit boundary:

- label the execution mode as mock or simulation;
- generate synthetic external references only;
- never call ERP, EAM, QMS, procurement, DCS, SIS, or another real system;
- allow deterministic success and failure scenarios;
- preserve the same proposal, approval, receipt, and audit structure intended for production adapters;
- display a persistent notice that no external write occurred.

This keeps the governance story realistic without misrepresenting operational effects.

## Workbench refresh

Subscribe the View only to mutation tools that change proposal state. After a matching `assistant.tool.completed` event, refresh the affected proposal list and audit data while preserving the active object and local UI state. Do not refetch the entire ontology graph after every read tool.
