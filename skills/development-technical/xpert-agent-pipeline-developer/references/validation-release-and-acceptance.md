# Validation, Release, and Acceptance

Read this reference when planning tests, validating a vertical slice or full pipeline, deploying locally, provisioning Assistants, or reporting completion.

## Validation Layers

Validate each applicable layer separately:

### Blueprint and architecture

- semantic blueprint validator passes;
- the default blueprint declares a persisted Case model, ordered lanes/stages, exactly one management dashboard, exactly one pipeline overview, task node open modes, and the server projection contracts;
- the blueprint declares independent role Assistants and, for orchestrated delivery, External Xpert delegation with direct required connections;
- the blueprint declares Xpert shadcn UI, ECharts, actual platform Assistant Avatars, diamond logic nodes, Assistant/task-card execution-marker placement/limit, drag-to-pan, and lane-selection invariants;
- the blueprint declares immutable Case/node/lane-bound execution records on both presentation targets and the exact-execution client navigation capability;
- missing dashboard/swimlane Views have the user's explicit Workbench waiver and reason rather than an accidental empty `views` array;
- unresolved assumptions are documented;
- graph is a valid DAG and router exits cover declared values;
- cross-layer ownership matrix is complete;
- files above the 1,000-line review threshold have a recorded architecture decision.

### Domain and flow

- aggregate invariants and artifact revisions;
- completion predicates and blocked states;
- route fact normalization, decision recording, and invalidation;
- projection statuses and executable-node calculation;
- concurrency, stale revisions, idempotency, retry, and cancellation;
- tenant/organization isolation and cross-scope rejection;
- outbox and adapter failure/recovery.

### Agent and Assistant

- each tool has one middleware owner;
- tool schemas, compact outputs, evidence, revision, and failure behavior;
- role middleware modes and node tool allowlists;
- internal specialist isolation;
- Orchestrator has coordination authority but no accidental business writes;
- every lane-owning AI role is a separate installed/published Assistant rather than an Orchestrator child/sub-Agent;
- every orchestrated role Assistant has exactly one direct `required: true` External Xpert binding from the Orchestrator primary Agent, uniquely matched by template provenance/primary Agent and organization scope;
- plugin contribution, generated DSL, installed draft, published graph, and one execution agree.

Use `xpert-assistant-dsl-builder` for DSL and lifecycle validation. Plugin refresh does not update an installed Assistant automatically.

### Delivery surfaces

For explicitly waived Assistant-only delivery, test Case context, progress, blockers, task start, human gates, and recovery through real conversations/tools.

For explicitly waived backend delivery, test authentication, event idempotency, scheduling/queue behavior, retries, and human remediation.

For the default Cases Workbench, test:

- persisted Case list/create/select/refresh and exact template-version binding;
- one ECharts management dashboard plus one pipeline overview, with dashboard aggregate/row drill-down into the exact Case;
- server-owned dashboard metric definitions and chart-ready aggregation rather than client aggregation of paginated Cases;
- dashboard visual hierarchy, responsive 12-column layout, chart choice, units/time windows, resize, theme, reduced motion, loading, empty, insufficient-data, stale, partial-error, and permission states;
- task-card activation through the declared shadcn Dialog, authorized View, or allowlisted component mode;
- server-projected lanes/nodes/edges and access trimming;
- ordered stages, task placement, diamond router/control-node grammar, terminal semantics, labeled selected branches, blockers, summary counts, and executable nodes;
- actual Assistant Avatars with safe fallback and Assistant-card selection of the whole lane;
- at most ten recent real Agent attempts rendered as semantically colored, focusable dots at the Assistant-card and exact task-card bottom-right positions, with all immutable attempts retained and failed/superseded attempts preserved;
- shadcn HoverCard detail for each execution marker and exact record activation without accidentally toggling lane selection or opening the parent task card;
- execution marker updates from persisted/runtime state rather than timers, fabricated transcripts, or decorative Agent cards;
- exact ChatKit navigation using the matching conversation/thread/execution handles and the public allowlisted host command;
- SVG/card alignment after scroll, drag-to-pan, resize, blocked filtering, localization, lane selection, and every supported zoom level;
- `Process next` behavior with zero, one, and multiple executable nodes;
- projection reload after a View action, Agent tool, human decision, backend event, retry, cancellation, and external confirmation;
- action authorization and stale-state rejection;
- real built Remote Component assets in a View Host;
- host bridge, events, context handoff, files, pagination, i18n, theme, and accessibility as applicable;
- installed-platform browser paths for platform-dependent behavior;
- source/generated asset parity.
- all interactive View primitives come from `@xpert-ai/plugin-shadcn-ui`; scan for and reject native `<select>`, native `<button>`, native `<dialog>`, ad hoc hover panels, emoji icons, or a second component system.

Do not accept a KPI/table-only page without meaningful charts as the management dashboard. Do not accept a management dashboard, single-Case cockpit, linear stepper, detached Agent-card grid, approval page, static diagram, or chat surface as the pipeline overview. Do not accept initials when an actual Assistant Avatar is available, client-side aggregate guesses, hardcoded frontend stages/edges, fake Agent activity/progress timers, reconstructed transcripts, or static fixtures as installed pipeline evidence.

### Plugin and runtime

- package build, typecheck, tests, and `verify:dist` when generated/copied assets exist;
- plugin metadata, target-app capabilities, runtime providers, module registration, and artifact namespace agree;
- local deployment reports registration state;
- restart is performed when required;
- an observable provider, View, route, or middleware call proves runtime loading.

### Product functional documentation

- the target repository's existing `docs` conventions are followed, or the default categorized `docs/product-design/` structure is used;
- every completed product-visible feature has a discoverable feature design document and category/index entry;
- affected process, View, role/permission, and material decision documents are updated in the same change;
- documented roles, authority, triggers, flows, branches, blockers, state/completion rules, artifacts, interactions, permissions, acceptance examples, and limitations agree with the approved blueprint and observed behavior;
- removed or superseded behavior is removed, redirected, or archived according to repository policy;
- internal document links resolve and no secret, customer data, private-source dependency, machine-specific path, or unverified completion claim is present.

Use [product-design-documentation.md](product-design-documentation.md) for the classification and per-feature quality gate. A code/test pass does not complete a product-visible feature while this layer is missing or stale.

## Acceptance Scenarios

Exercise at least:

1. project management metrics, render a meaningful ECharts trend/comparison, and drill an actionable chart point or row into the exact Case swimlane;
2. create and select a Case, render its projected Assistants/lanes/stages/nodes/edges, and open one task in each implemented `dialog`, `view`, or `component` mode;
3. resolve an actual Assistant Avatar, select the whole lane from its card, and clear the selection by repeat activation/Escape;
4. process one server-selected Agent node, observe the same persisted execution on the correct Assistant card and exact task card, inspect both HoverCards, and open the exact authorized ChatKit execution;
5. show no more than ten recent dots per presentation, expose overflow/history, and preserve a failed execution after a successful retry with supersession visible;
6. render a router/decision as a compact diamond with edge-adjacent branch labels, then verify selected and pending routes remain distinguishable;
7. drag the canvas from its background while cards/controls remain clickable and SVG edges remain aligned;
8. observe node status, dashboard metrics, and summary counters change from refreshed server projections rather than execution success alone;
9. happy path through one terminal;
10. every deterministic router value, including selected and not-applicable branch rendering;
11. blocked state, visible blocker ownership/SLA, and successful authorized remediation;
12. stale Case or route revision;
13. zero, one, and multiple executable-node behavior for `Process next`;
14. duplicate start/mutation with the same operation id;
15. Agent execution failure, cancellation, and retry;
16. human rejection or rework through a node workspace;
17. external dependency unavailable and later recovery;
18. unauthorized role and cross-tenant/organization access, including metric/action/workspace/execution-record trimming;
19. reject an embedded/sub-Agent substitute for a lane role; verify the Orchestrator dispatched to the independently installed role Assistant through its direct required External Xpert;
20. missing, optional, ambiguous, incompatible, cross-organization, or unpublished External Xpert binding and broken/missing Avatar fallback;
21. plugin/Assistant upgrade with an existing Case bound to an older flow version.

Add domain-specific risk cases instead of treating this list as exhaustive.

## Release States

Never collapse these states into "deployed":

1. **source verified**: code, tests, generated assets, package contract, and synchronized product functional design documents pass;
2. **plugin registered**: local or target environment records the plugin descriptor;
3. **plugin running**: required restart completed and runtime behavior observed;
4. **Assistants ready**: role Assistants and optional Orchestrator are installed or updated, saved, published, and correctly connected;
5. **acceptance passed**: bounded end-to-end scenarios pass in the selected delivery surfaces.

For a default hybrid pipeline, acceptance is not passed until the Cases Workbench, Assistant execution, backend transition, and their shared persisted projection have been exercised together. If the user waived the Workbench, record the waiver in the receipt.

For a multi-Assistant suite, provision independent role Assistants before the independent Orchestrator Assistant. Use a versioned suite profile, exactly one direct `required: true` External Xpert per orchestrated role, stable template/Agent identities, and a secret-free receipt. Preserve user-owned models, environments, credentials, knowledge, and scope unless replacement is explicitly authorized.

## Receipts

Produce separate receipts containing only non-secret data:

- environment/platform commit and mode;
- plugin package/version/namespace and registration/running state;
- flow template keys and versions;
- Assistant template/instance/published versions and role bindings;
- validation commands and results;
- categorized product functional design paths created or updated for each completed feature;
- end-to-end scenarios and evidence;
- migrations, rollback path, known limitations, and unexercised layers.

Report a layer as unverified when it was not exercised. Do not infer publication from a saved draft or runtime loading from a staged descriptor.
