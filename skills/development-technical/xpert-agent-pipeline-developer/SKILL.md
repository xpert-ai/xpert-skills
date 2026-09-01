---
name: xpert-agent-pipeline-developer
description: Design and build Xpert multi-Agent pipeline applications from standardized multi-role business processes, including independent role Assistants, External Xpert orchestration, versioned DAG flows, governed execution, an ECharts management dashboard, an interactive Cases swimlane, inspectable execution records, validation, and release. Use for a new end-to-end pipeline or a substantial pipeline redesign; use narrower Xpert skills for isolated plugin or Assistant DSL changes.
---

# Xpert Agent Pipeline Developer

Turn a repeatable multi-role business process into a production Xpert pipeline. Unless the user explicitly requests otherwise, deliver one application with a Cases pipeline Workbench containing both a management monitoring dashboard and a multi-Agent swimlane, independently installed/published role Assistants, and an independent Orchestrator Assistant that controls those roles through direct required External Xperts. Keep the business process, Agent authority, human decisions, persisted facts, product design documentation, and release state explicit.

This skill targets Xpert and a versioned directed acyclic graph (DAG) with deterministic routers and human gates. Do not invent a runtime-generated production process, unbounded loop, or general BPMN engine unless the user expands the scope.

## Route to Companion Skills

Use this skill as the solution-level conductor. Load the narrower skill before implementing its surface:

- Use `xpert-platform-local-environment` for Xpert checkout discovery/download, source-hybrid or Docker setup, process/Compose ownership, health, repair, and plugin-test readiness. Read its `references/setup-and-lifecycle.md` and use its `scripts/inspect-xpert-local-environment.mjs` / `scripts/setup-xpert-local-environment.mjs` rather than maintaining pipeline-specific environment automation.
- Use `xpert-plugin-development` for plugin package contracts, repository conventions, local registration, versioning, and plugin-specific infrastructure.
- Use `xpert-agentic-app-developer` for server modules, middleware tools, capability boundaries, Workbench/Remote View implementation, Assistant Task orchestration, and secure deployment. For persisted Case/node/lane-bound Agent execution history and Assistant-card presentation, load that skill and read its `references/assistant-task-orchestration.md` sections **Task Identity and Persistence** and **View Execution Records**, plus `references/view-client-commands.md` section **Open Assistant Task Execution Records**.
- Use `xpert-assistant-dsl-builder` before creating, changing, installing, or publishing Assistant DSLs. For an Orchestrator suite, read its `references/lifecycle-validation.md` sections **Versioned Suite Provisioning** and **Runtime Acceptance** so role Assistants remain independent and are connected as direct required External Xperts.
- Use `xpert-llm-token-usage` only when usage accounting or streaming usage is in scope.

Do not duplicate those skills' detailed contracts here. Inspect the checked-out Xpert and SDK sources whenever the host contract may have changed.

## Default Product Contract

Default to `hybrid`: `workbench + assistant + backend`. A new pipeline application is incomplete until users can monitor portfolio health through a server-projected ECharts dashboard, create or select a persisted Case, see its server-projected multi-role DAG as an interactive swimlane, recognize each accountable Assistant by its actual Avatar, inspect real execution attempts from both the Assistant card and owning task card, recognize route/control nodes by their diamond shape, identify blockers and executable nodes, open a node through its declared Dialog/View/component interaction or an exact ChatKit execution, and advance an authorized next action.

Every lane-owning AI participant is an independent Assistant, not a child/sub-Agent. In orchestrated topologies, the total-control Orchestrator is also an independent Assistant and delegates role work only through direct `required: true` External Xpert connections to the published role Assistants. Internal child Agents may remain private helpers within one role Assistant but never represent a lane, business handoff, or role participant.

Pure `assistant` or `backend` delivery remains supported only when the user explicitly requests it. Record that choice as `delivery.pipelineWorkbench.mode: waived` with a specific `waiverReason`; do not infer a waiver from schedule, implementation difficulty, or the presence of an operations dashboard.

Treat these as delivery surfaces, not separate business implementations. Agent tools, View actions, and backend handlers must call the same application/domain services.

A pipeline Workbench is not satisfied by any combination of only:

- a KPI or operations dashboard;
- a single-Case cockpit or approval page;
- a linear stepper or progress bar;
- an Agent result-card grid;
- a static workflow diagram;
- a chat entry point.

Those may be supporting views. The required Workbench contains exactly one `operations_dashboard` management View and exactly one `pipeline_overview` swimlane View. The dashboard links management signals to the selected Case; the swimlane is the operational Case entry. A single-Case cockpit belongs behind a task card as a Case detail or node workspace.

## Workflow

### 1. Inspect Before Editing

- Read repository-level instructions and preserve unrelated or uncommitted work.
- Discover actual platform, plugin, and optional `xpert-plugins` paths; do not assume machine-specific absolute paths.
- When the Xpert checkout is missing, unhealthy, ambiguous, or not yet proven plugin-test-ready, load `xpert-platform-local-environment` and complete its preflight/setup receipt before implementation. A listener or health response from another checkout is not acceptable environment evidence.

### 2. Produce a Pipeline Blueprint

Read [process-discovery-and-blueprint.md](references/process-discovery-and-blueprint.md). Capture the Case, roles, lanes, artifacts, task nodes, deterministic route facts, completion predicates, Agent tools, human gates, delivery surfaces, and external systems before broad implementation.

Use [pipeline-blueprint.example.json](references/pipeline-blueprint.example.json) as a neutral shape and [pipeline-blueprint.schema.json](references/pipeline-blueprint.schema.json) for editor support. Adapt the model to the business; do not copy its sample domain. The blueprint must state the Case contract, ordered lanes and stages, independent-Assistant/External-Xpert topology, management dashboard, pipeline overview, diamond control-node grammar, node open modes, Assistant-card and task-card execution presentation, exact-execution navigation capability, View experience invariants, and server projection operations. A Workbench waiver is an explicit exception, not an omitted View.

Validate the blueprint before using it as an implementation contract:

```bash
node <skill-dir>/scripts/validate-pipeline-blueprint.mjs \
  path/to/pipeline-blueprint.json
```

If unresolved choices change role authority, business truth, irreversible actions, or the process graph, stop and ask the user. Record lesser assumptions in the blueprint.

### 3. Design the Closed Loop

Read the references that match the work:

- [domain-flow-and-runtime.md](references/domain-flow-and-runtime.md) for domain boundaries, immutable templates, projections, routing, concurrency, and Assistant Task execution.
- [roles-capabilities-and-assistant-topology.md](references/roles-capabilities-and-assistant-topology.md) for independent role Assistants, an Orchestrator using direct required External Xperts, optional private internal specialists that never own lanes, middleware ownership, and least privilege.
- [delivery-surfaces-and-human-control.md](references/delivery-surfaces-and-human-control.md) for the default hybrid surface, explicit Workbench waivers, human gates, and external integration.
- [pipeline-workbench-and-case-experience.md](references/pipeline-workbench-and-case-experience.md) for the shared Case contract, cross-View navigation, and composition of the default Workbench.
- [management-monitoring-dashboard-view.md](references/management-monitoring-dashboard-view.md) before implementing or reviewing the `operations_dashboard` View, ECharts projections, chart selection, dashboard layout, or dashboard-to-Case navigation.
- [multi-agent-swimlane-view.md](references/multi-agent-swimlane-view.md) before implementing or reviewing the `pipeline_overview` View, Assistant cards and Avatars, execution markers, node opening, SVG routing, lane selection, or drag-to-pan behavior.

All three Workbench references are mandatory unless the Workbench is explicitly waived.

Keep this chain traceable:

```text
node -> lane -> accountable role -> independent role Assistant -> primary Agent
     -> permitted Agent tools -> owning middleware -> Feature
     -> source-of-truth artifact -> completion predicate
     -> optional View actions -> human gate

Orchestrator Assistant -> direct required External Xpert -> role Assistant
```

### 4. Implement a Vertical Slice First

Implement one real end-to-end path before expanding the graph. The slice should include:

- one versioned Case and business artifact;
- one independently installed/published role Assistant or deterministic backend executor;
- one task completion predicate;
- one router or blocking condition when the process needs either;
- one human review/approval boundary when the domain needs it;
- persistence, tenant/organization scoping, idempotency, audit evidence, and a failure path;
- a real server dashboard projection rendered with ECharts, dashboard-to-Case navigation, Case creation or selection, a real server flow projection, the pipeline overview, one actual Assistant Avatar, one diamond router, one task-card `dialog`/`view`/`component` interaction, and one persisted Agent execution rendered in both its Assistant-card summary and owning task card that opens the exact authorized ChatKit execution unless the Workbench is explicitly waived;
- the selected Assistant and backend surfaces using the same production application services.

Do not create a disposable frontend or a second preview-only business implementation. Do not provide a large reusable code scaffold in this skill; derive the implementation from the current host contracts and the approved blueprint.

### 5. Expand Without Breaking Ownership

- Add bounded contexts and nodes by business responsibility, not screen layout.
- Give every Agent-callable tool exactly one middleware owner.
- Use positive allowlists for role middleware bindings and node-level tools.
- Keep View actions separate from Agent tools.
- Project node state from authoritative business artifacts; do not create a competing workflow-state truth.
- Version flow templates immutably and bind each Case to an exact template version.
- Keep deterministic operations, model assistance, human decisions, and external confirmations distinct.
- Keep lane, stage, node, edge, route, status, blocker, and executability data server-projected. Do not hardcode a frontend step array or make canvas geometry business truth.
- Attach immutable Agent execution attempts to their actual Case/node/lane/role in the projection. Show up to ten semantically colored markers in both the accountable Assistant card and exact owning task card, with HoverCard details and exact ChatKit navigation. Never replace them with decorative dots, synthetic activity, or a locally invented transcript.
- Render routers and equivalent control-flow logic nodes as compact diamonds with labeled outgoing outcomes; never style them as task cards.
- Keep each lane-owning business role in its own Assistant. Never model role Assistants as sub-Agents of the Orchestrator; use direct required External Xperts and portable template/primary-Agent expectations.
- Use ECharts by default for management statistical charts. For View interactions, follow `xpert-agentic-app-developer/references/shadcn-ui.md`: use `@xpert-ai/plugin-shadcn-ui` only when it resolves inside the current repository/workspace; otherwise install official components into the current project with the shadcn CLI. Never reference another checkout for the package, and do not ship native selects/buttons/dialogs, a CDN chart runtime, or a second component system.
- Treat 1,000 lines as an architecture-review threshold for maintained source files.

### 6. Document Every Completed Feature

Before reporting any product-visible feature complete, read [product-design-documentation.md](references/product-design-documentation.md) and write or update the product functional design in the target application's `docs` tree as part of the same change.

- Follow the repository's established documentation structure when one exists. Otherwise use the reference's default `docs/product-design/` taxonomy and maintain its category index.
- Document shipped product behavior rather than an implementation diary: purpose, roles and authority, trigger and preconditions, main/branch/error flows, state and completion rules, artifacts, View interactions, permissions, acceptance examples, and known limitations.
- Update the feature document plus every affected process, View, role/permission, and index document. Keep each fact in one canonical document and cross-link related material.
- Use stable feature/process/View keys for filenames and grouping. Do not create a chronological pile of completion notes or one catch-all document.
- Do not mark a feature complete when its product design documentation is missing, stale, inconsistent with observed behavior, or claims unverified behavior.
- In the completion handoff, list the product documentation paths changed alongside implementation and validation evidence.

Pure refactors or mechanical maintenance that provably do not change product behavior need no new feature document, but must update existing documentation if they invalidate it.

### 7. Validate and Release

Read [validation-release-and-acceptance.md](references/validation-release-and-acceptance.md). Verify source contracts, graph semantics, plugin metadata, Assistant templates, task execution, persistence, permissions, selected delivery surfaces, installation, and publication as separate layers.

Use an existing implementation as architectural evidence only when the user is authorized to access it in the current environment. Extract domain-independent principles into the approved blueprint; never make this skill or its generated application depend on private reference source, machine-specific paths, customer data, or undocumented implementation details.

## Non-Negotiable Invariants

- The domain model is the source of business truth; the flow is a versioned coordination projection.
- A router decides from persisted structured facts, not unrecorded model prose.
- Model output is a candidate or draft until the domain's evidence and approval policy says otherwise.
- An Assistant Task completing does not automatically complete a business node.
- Irreversible commitments require an explicit human gate or a trusted external confirmation.
- The Orchestrator coordinates but does not silently accumulate every business write capability.
- Every lane-owning AI role is an independent installed/published Assistant; child/sub-Agents cannot substitute for role Assistants.
- The Orchestrator is an independent Assistant and reaches every role Assistant through exactly one direct, `required: true`, organization-scoped External Xpert binding with matching template provenance and primary Agent key; missing or ambiguous bindings block dispatch and expose human fallback.
- Every persisted read and mutation is tenant/organization scoped when context is available.
- Plugin deployment, runtime loading, Assistant installation, Assistant publication, and end-to-end acceptance are separate states.
- Product-visible feature completion includes synchronized, categorized, indexed product functional design documentation in the target repository's `docs` tree.
- Without an explicit waiver, exactly one management dashboard View and one pipeline overview View are reachable; dashboard signals drill into the selected Case swimlane.
- Every business task declares an `openMode`: bounded information uses a shadcn Dialog, full workflow work opens an authorized View, and embedded work opens an allowlisted component.
- A Workbench renders persisted Cases and a server-owned flow projection; a static mock, fake progress timer, or UI-owned route state is not acceptance evidence.
- The swimlane shows actual Assistant Avatars and real queued/running/terminal Agent attempts in both Assistant and task cards, uses diamonds for logic nodes, preserves failed and superseded attempts, supports lane selection and drag-to-pan, and opens the selected conversation/thread/execution through the public host command. Do not expose chain-of-thought, secrets, raw prompts, or internal runtime routes.
- Never read secrets from browser storage or logs, request them in chat, commit them, or expose them to a Remote View iframe.

## Expected Outputs

Report applicable artifacts rather than claiming the entire lifecycle passed:

1. discovery assumptions and approved pipeline blueprint;
2. environment and repository preflight receipt;
3. architecture decisions and the cross-layer ownership matrix;
4. vertical-slice evidence;
5. graph, domain, permission, Assistant, and UI/backend validation results;
6. plugin deployment and runtime verification state;
7. Assistant provisioning/publication state;
8. categorized product functional design documents created or updated for each completed feature;
9. installed end-to-end acceptance evidence, unexercised layers, and known limitations.
