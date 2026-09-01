# Delivery Surfaces and Human Control

Read this reference when implementing the default hybrid delivery, explicitly waiving the pipeline Workbench, or locating human decisions and external confirmations.

## One Application, Multiple Surfaces

All surfaces operate over the same Case, flow projection, policies, and application services:

```text
Assistant tools ----\
View actions --------> application/domain services -> artifacts/events
backend handlers ---/
```

Do not implement separate business rules for chat, UI, and scheduled execution.

## Default and Waiver

For a new multi-Agent pipeline, default to all three surfaces:

- a Cases pipeline Workbench as the application entry and coordination control plane;
- independent role Assistants for conversational analysis and bounded execution, plus an independent Orchestrator using direct required External Xperts when orchestration is enabled;
- backend handlers for events, integrations, scheduling, and durable orchestration.

Set `delivery.pipelineWorkbench.mode` to `required`. The user may explicitly choose pure Assistant or backend delivery; then set it to `waived` and record a concrete `waiverReason`. Time pressure, implementation difficulty, or an existing KPI/single-Case page is not a waiver.

When the Workbench is required, read [pipeline-workbench-and-case-experience.md](pipeline-workbench-and-case-experience.md) and implement its minimum shell, projection contract, drawing semantics, node workspaces, and acceptance path.

## Explicit Pure Assistant Mode

Use only when the user explicitly chooses to complete the process through conversations and generated artifacts without a dedicated process UI.

Still provide:

- Case selection or creation;
- server-computed executable nodes;
- bounded tools and role authority;
- concise progress and blocker queries;
- explicit human approval tools/surfaces for consequential transitions;
- persisted artifacts and audit evidence;
- deterministic retry and recovery.

Do not rely on chat history as the durable Case record. Do not claim the model can see runtime context unless the context is deliberately injected or resolved through tested tools.

## Explicit Backend Mode

Use without a Cases Workbench only when the user explicitly chooses APIs, events, adapters, scheduled work, or external systems as the primary driver.

- authenticate and scope every trigger;
- derive an idempotency key from the source event or operation;
- verify Case and route revisions before mutation;
- store attempts and external acknowledgements;
- expose operational status and human remediation even when there is no custom Workbench;
- keep long-running work off request threads using platform-supported runtime/queue facilities when needed.

Backend mode does not authorize silent high-risk automation. Human gates may be implemented through existing platform task/approval surfaces.

## Cases Pipeline Workbench

Use by default. It is required when users need to understand process position, inspect artifacts, correct data, handle blockers, or coordinate across roles.

The server should project:

- lanes and columns;
- task, router, and terminal nodes;
- edges and selected branch decisions;
- statuses, blockers, SLA, and executable nodes;
- immutable Agent execution attempts attached to the Case/node/role where they ran;
- authorized workspaces, actions, and execution links.

The Remote View renders the projection; it does not own the process definition. Avoid fixed frontend stage arrays and duplicated route logic.

The default Workbench registers exactly one `operations_dashboard` management View and one `pipeline_overview` multi-Agent swimlane View. Dashboard signals drill into the exact selected Case; they do not replace the flow. Every visible business task declares whether it opens bounded information in a shadcn Dialog, an authorized `node_workspace`/`case_detail` View, or an allowlisted embedded component.

Use `xpert-agentic-app-developer` before implementing the View manifest, iframe bridge, Remote Component, host events, client commands, context handoff, theme, i18n, pagination, files, E2E, or installed-platform verification.

For a dynamic swimlane, distinguish:

- business tasks: cards located in accountable role lanes;
- routers and equivalent control-flow logic nodes: compact labeled diamonds, never human/Assistant task cards;
- terminals: explicit end-state symbols;
- branches: semantic edges generated from the server projection;
- "next action": server-provided executable nodes, never a client guess.
- Assistant cards: actual platform Avatar and identity, selectable as the whole lane.
- Agent execution records: at most ten recent real attempt markers at both the Assistant-card and exact task-card bottom-right positions, with semantic status, HoverCard detail, and exact ChatKit navigation; never a detached gallery or fake activity indicator.
- Canvas navigation: scroll/zoom plus drag-to-pan that keeps DOM cards and SVG edges aligned without hijacking controls.

Use `xpert-agentic-app-developer` for the detailed execution-record implementation. After loading that skill, read its `references/assistant-task-orchestration.md` sections **Task Identity and Persistence** and **View Execution Records** for immutable attempt persistence, status recovery, retry, cancellation, and View records. Then read its `references/view-client-commands.md` section **Open Assistant Task Execution Records** to open the exact ChatKit conversation/thread/execution through the public allowlisted host command.

Do not accept a KPI dashboard, single-Case cockpit, linear stepper, Agent-card grid, approval form, static diagram, or chat page as the pipeline overview. These surfaces may support a node or Case, but they do not expose multi-role ownership, DAG dependencies, route selection, blockers, and executability together.

## Human Decision Policy

Require a human decision only when it changes authority or consequence. Common gates:

- evidence review where extraction uncertainty affects downstream work;
- approval of a commercial, legal, compliance, safety, or production commitment;
- selection among materially different business alternatives;
- override of a policy or blocked condition;
- confirmation before an irreversible or destructive operation.

Showing information is not a decision. Keep diagnostics, provenance, and secondary detail progressively disclosed without forcing unnecessary confirmations.

A gate record should include:

```text
Case and artifact revision
gate type and governing policy
actor and organizational scope
decision, reason, timestamp
evidence presented
superseded/rejected state when applicable
```

Revalidate the artifact revision at decision time. A stale approval must not finalize a newer artifact.

## Model Boundary

Agents may:

- extract candidate facts with evidence;
- reconcile sources and explain conflicts;
- draft artifacts or remediation plans;
- estimate, classify, or recommend under an explicit policy;
- call authorized application operations.

Agents may not independently assert:

- contract signature or legal acceptance;
- receipt by ERP/MES or another authoritative system;
- final approval or policy override;
- payment, production release, safety acceptance, or another irreversible commitment.

Those facts come from a human gate or trusted adapter.

## External Integration

Define for every integration:

- authority and data ownership;
- authentication and token scope;
- tenant/organization propagation;
- timeout, retry, idempotency, and error taxonomy;
- configured, optional, degraded, and unavailable behavior;
- external confirmation mapping;
- outbox or reconciliation strategy.

Never turn an unconfigured adapter into a simulated production success. Fixtures belong only in explicit preview/test adapters with neutral data.
