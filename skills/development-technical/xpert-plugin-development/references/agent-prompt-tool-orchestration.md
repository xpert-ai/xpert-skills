# Agent, Prompt, and Tool-Owned State

Read this when implementing Agent-led orchestration, repeated External Assistant delegation, task recovery, or middleware hooks that inspect business status. Confirm the orchestration mode with the existing requirements: a deterministic backend pipeline and an Agent-led workflow are different contracts. Do not silently turn the latter into a hidden state machine.

## Ownership

| Layer | Responsibility |
| --- | --- |
| Agent + Prompt/workflow | Interpret the goal and receipts; choose tools, delegate bounded tasks, decide whether to repair, retry, report a blocker, or finish. |
| Business tools + domain services | Validate identity, authorization, task/execution ownership, versions and inputs; persist explicit transitions; validate and accept artifacts; return actionable receipts. |
| Middleware hooks | Fixed role capability selection and generic runtime/protocol adaptation. No business progression or per-task completion policy. |
| Views | Project persisted business status and execution history. Do not infer acceptance from an Agent turn ending. |

Do not put business routing, automatic claiming/submission, retry counters, budget extensions, or task-ending instructions in `wrapModelCall`, `wrapToolCall`, `beforeModel`, or `beforeAgent`. Moving the same state machine between hooks is not a fix. For Agent-led workflows, let the LLM decide retries from specific errors unless an explicit product requirement imposes a limit; transport timeouts and platform resource ceilings remain separate concerns.

## Prefer clear contracts and live feedback over injected instructions

Keep the stable prompt small: the role's purpose, authority, required output and real business constraints. Let the Agent choose its approach from current tool results. Before adding another prompt paragraph to correct a failure, inspect the task scope, schema, evidence and returned diagnostics; repair the contract that caused the ambiguity.

- Return the persisted objective, authorized scope, artifact type and current state explicitly. Select capabilities and validate submissions against that same scope. A human-readable task title must not override a contradictory machine contract.
- Disclose conditional rules with their actual applicability. Do not claim that another task is complete or an artifact is frozen because a generic workflow assumes it. Resolve such facts from durable state when the tool is called.
- Explain a tool's meaning, effects, prerequisites and acceptance criteria. Avoid prescribing every next call, repeating long workflows in each receipt, or injecting dynamic retry/finish commands. Required dependencies belong in the domain service; optional strategies remain the Agent's choice.
- For a rejected submission, return a stable code, the affected item/field, observed value or state, expected rule, relevant source location and available corrective actions. Report whether anything was saved and whether the task is still editable. Aggregate independent validation failures when safe so the Agent can repair them together.
- Expose conditional required fields in the schema or precise field-level validation. Recover server-owned context from trusted data. Do not force the Agent to reconstruct IDs, boundaries or versions the service already knows.
- Keep the Agent's substantive judgment intact: do not silently reclassify evidence, delete rejected findings, fabricate missing facts or advance work to make validation pass. Offer evidence-backed alternatives and let the Agent decide what to submit.
- Normalize reference syntax at the tool boundary, retaining source and execution authorization. Index locations should be readable directly; do not require a semantic-search round solely to exchange identifiers. Show parsed boundary text and locations so the Agent can assess the actual selection.
- For repeated validation failures, expose input/diagnostic change indicators derived from the actual submitted files or payload. These are observations, not retry limits. A shared role Assistant needs one explicit blocker action valid for each of its responsibilities; preserve its drafts and report the real gap without accepting incomplete work.

Validate these principles with observable behavior: scope-mismatched tasks cannot be dispatched or accepted; context matches current persisted state; failures identify actionable fields without accepting invalid evidence; corrected submissions preserve independent requirements. More prompt text is not acceptance evidence.

## Reused graphs are not invocation-local storage

A middleware instance or compiled external graph can serve multiple sequential or interleaved invocations. Mutable closure variables such as `currentTask`, `terminal`, `contextReady`, output-path sets, or a task instruction can leak between them. A previous submission may then leave the next task with an empty tool list and an unrelated completion receipt.

`disableMessageHistory` does not reset middleware closures. Resetting a shared variable in `beforeAgent` still races with concurrent invocations. Do not use a process-local map as the only truth for state that must survive checkpoint recovery or worker restart.

Pass the delegated business task ID as an explicit tool argument. Resolve execution identity from trusted runtime configuration, not a model argument. Reload and validate durable state at the business-tool boundary. Store necessary server-issued workspace/source access descriptors against the task and execution, or derive them from authoritative immutable inputs. Fence persistence against stale executions and retain immutable accepted versions.

## Explicit tools and receipts

Use a small, stable contract such as `get_task_context`, scoped file/source operations, and `submit_task`:

1. The context/claim tool returns the current objective, authorized scope, artifact contract, fixed input references, exact output paths and prior diagnostics; claiming is explicit and idempotent for the owning execution. Include only the applicable business rules, not a repeated imperative workflow.
2. Resource tools validate the current assignment before access. When generic tools lack a domain scope, wrap their implementations in explicit domain tools with strict schemas and task parameters. Prevent direct generic-tool bypass; do not broaden workspace access merely to remove a hook.
3. Writing persists a draft. Submission explicitly validates, archives and accepts it. Return a receipt with task ID, status, accepted flag, artifact references and concrete diagnostics. A failed validation may keep the task editable; the Agent chooses its next action.
4. The worker reports the receipt to the delegator. The main Agent decides the next delegation. A completed runtime invocation or a plain-text tool expression is not proof of a tool call or accepted business result.

Keep tool schemas, Prompt workflows, skill examples and published role templates consistent. If domain tool names differ from generic examples, declare the mapping and argument shape explicitly. Preserve platform execution/tool-call identifiers and file activity events when adapting existing tool implementations.

## Regression and release evidence

- Reuse one middleware/graph for task A then task B after successful, failed and recoverable A receipts. B must receive its own context and usable tools.
- Interleave executions; reject another task's writable path and an obsolete execution without affecting the valid task.
- Reconstruct the middleware and resume from persisted state; verify repeat submission is idempotent.
- Verify source allowlists, read-only inputs and immutable accepted outputs at the actual tool/service entry point.
- Confirm business tools return specific failures without hooks clearing tools or injecting stale task instructions.
- Test the published role schema and actual tool calls as well as source units. Report source-only verification separately from installed-plugin and Assistant-template upgrades.
