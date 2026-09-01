# Process Discovery and Pipeline Blueprint

Read this reference when starting a pipeline, changing its business graph, or deciding whether a process is suitable for multi-Agent automation.

## Suitability Test

A strong pipeline candidate has most of these properties:

- a stable Case or business transaction that persists across multiple steps;
- several roles with distinct accountability;
- repeatable inputs, outputs, policies, and handoffs;
- reviewable artifacts rather than chat text as the lasting result;
- objective prerequisites or completion predicates;
- bounded decisions that can be expressed as structured route facts;
- expensive manual coordination, extraction, reconciliation, or drafting;
- explicit exceptions, human approvals, or external-system acknowledgements.

Do not force a pipeline onto an exploratory conversation, a one-off analysis, or a process whose authority and outcomes cannot yet be stated. First clarify or prototype the business contract.

## Discovery Questions

Answer these from SOPs, forms, systems, interviews, or an existing implementation:

1. What identifies one Case, who owns it, and when is it closed?
2. What information or document begins the Case?
3. Which roles are accountable, consulted, approving, or informed?
4. What durable artifact does each task create or change?
5. What proves each task is complete?
6. Which facts select a branch, and which system owns those facts?
7. Which steps may be automatic, Agent-assisted, human-only, or externally confirmed?
8. Which actions create contractual, financial, safety, compliance, or production commitments?
9. What makes work blocked, stale, superseded, or safe to retry?
10. Which SLA, alert, escalation, and audit obligations exist?
11. Which integrations are authoritative, optional, or unavailable in local development?
12. Which business context must appear in the Case selector and header?
13. Which management questions require dashboard KPIs, trends, comparisons, bottlenecks, and Case drill-downs?
14. What must a user see and do in the multi-Agent swimlane versus a Dialog, embedded component, or individual node workspace?
15. Which independent role Assistant owns each AI lane, and which published template/primary Agent identity must the Orchestrator resolve through a direct required External Xpert?
16. Which execution records must appear in the lane's Assistant card and in each exact task card, and who may open their ChatKit records?
17. Has the user explicitly waived the default Cases pipeline Workbench in favor of pure Assistant or backend delivery? If so, why?
18. Where does this repository keep current product functional design, how is it categorized and indexed, and which existing process, View, or role documents will this feature change?

## Normalize the Process

Build a process inventory before choosing classes or screens:

| Concept | Required decision |
|---|---|
| Case | Stable key, owner, scope, lifecycle, closure condition |
| Role | Accountability and allowed authority |
| Lane | One primary accountable role; not every internal Agent needs a lane |
| Artifact | Source of truth, owner, revision policy, evidence |
| Task | Inputs, outputs, completion predicate, execution mode |
| Router | Structured fact, values, source artifact, invalidation policy |
| Human gate | Reviewer/approver, consequence, rejection/rework path |
| Integration | Authority, authentication boundary, idempotency, failure state |
| SLA | Start/stop conditions, breach policy, escalation owner |
| Stage | Stable column, order, title, and included graph nodes |
| View | One management dashboard, one multi-Agent swimlane, plus task Dialogs/components/workspaces as required |
| Projection | Server operations for management aggregates, Cases, flow state, executability, actions, and blockers |
| Execution record | Immutable Agent attempt identity, runtime handles, status, revision, safe summary, and supersession |
| Product documentation | Stable feature key, documentation home, category/index placement, and affected canonical process/View/role documents |

Use verbs for tasks and nouns for artifacts. Avoid stages such as "AI processing" that do not describe business responsibility.

## Fixed DAG Boundary

The initial implementation supports a versioned DAG:

- task nodes perform or coordinate bounded work;
- router nodes choose among complete, mutually distinct fact values;
- terminal nodes finish a path;
- branches may rejoin, but the graph has no cycles;
- remediation is represented as an explicit action, new attempt, or new Case/revision rather than an unbounded graph loop.

If a real process needs repeated review, model the review attempt and artifact revision explicitly. Do not hide a loop inside an Agent prompt.

## Execution Classification

Classify every task independently:

- `assistant_task`: an independent role Assistant's primary Agent can analyze, retrieve, draft, reconcile, or propose changes through allowed tools.
- `human`: a person performs the task or makes the decision.
- `system`: deterministic code or an adapter performs the task.

Then classify the completion authority:

- `none`: ordinary reversible work with objective completion facts;
- `review`: a person reviews an Agent/system result;
- `approval`: a person authorizes a consequential business transition;
- `external_confirmation`: an authoritative external system confirms the event.

Execution and completion authority are separate. An Agent can prepare a high-risk artifact while a human gate controls finalization.

## Blueprint as Cross-Layer Contract

Use `pipeline-blueprint.example.json` as the starting shape. The blueprint is not a generated application or a substitute for domain design. It provides stable identifiers and catches missing mappings before implementation.

Maintain these relationships in one place:

```text
task node
  -> lane and accountable role
  -> independent role Assistant identity, published template/primary Agent, and Avatar
  -> direct required External Xpert from the Orchestrator when orchestrated
  -> immutable Agent execution attempts bound to Case/node/lane and shown on both Assistant and task cards
  -> execution mode and node-level tool allowlist
  -> middleware binding and required Features
  -> source-of-truth artifact and completion predicate
  -> optional View action
  -> risk and human gate
```

Keep keys language-neutral, stable, lowercase, and safe for persisted references. Localize titles at presentation boundaries.

For the default hybrid product, the blueprint must include:

- a persisted `caseModel` and exact template-version binding;
- `assistantParticipants.roleMode: independent_assistants`; when orchestrated, `orchestratorDelegation: external_xperts` and `externalXpertConnections: direct_required`;
- ordered role lanes and ordered stages;
- exactly one `operations_dashboard` View using ECharts and exactly one `pipeline_overview` multi-Agent swimlane View;
- a declared `dialog`, `view`, or `component` open mode for every visible business task;
- actual platform Assistant Avatars, lane selection, drag-to-pan, and no more than ten recent execution markers at both the Assistant-card and exact task-card bottom-right positions;
- diamond presentation for routers and equivalent control-flow logic nodes, with labeled outgoing outcomes;
- immutable execution-attempt presentation with HoverCard details plus exact ChatKit execution navigation;
- a `viewExperience` contract fixing Xpert shadcn UI, ECharts, Assistant Avatar source, execution-marker placement, pan, and lane-selection invariants;
- a `projectionContract` for dashboard aggregation, Case creation/selection, server flow projection, executability, node start, next-node processing, human completion, blocker remediation, workspace resolution, and paged execution-record reads.

A Workbench omission is valid only when `delivery.pipelineWorkbench.mode` is `waived` with the user's reason. Do not silently translate a multi-role process into a dashboard, stepper, or chat-only application.

## Approval Gate

Before broad implementation, obtain agreement on choices that materially affect:

- Case identity or business truth;
- role authority or organizational ownership;
- irreversible actions;
- graph branches and completion rules;
- required integrations;
- whether the product is standalone-role-only or orchestrated; when orchestrated, External Xperts are mandatory and child/sub-Agents cannot represent role participants;
- a request to waive the default Cases pipeline Workbench or other required delivery surfaces.

Record smaller assumptions and continue. Do not make code structure the accidental source of an unresolved business decision.
