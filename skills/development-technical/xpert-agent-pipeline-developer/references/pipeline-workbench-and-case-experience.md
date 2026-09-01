# Pipeline Workbench and Case Experience

Use this reference as the cross-View contract for a Cases pipeline Workbench. It defines how the management dashboard, multi-Agent swimlane, node workspaces, ChatKit execution records, and server projections form one product. Read the two View-specific references before implementation:

- [Management Monitoring Dashboard View](management-monitoring-dashboard-view.md)
- [Multi-Agent Swimlane View](multi-agent-swimlane-view.md)

The default Workbench contains exactly one `operations_dashboard` View and exactly one `pipeline_overview` View. The dashboard is the management entry for portfolio monitoring; the swimlane is the operational entry for understanding and advancing a selected Case. Neither View may substitute for the other.

## Companion Skill Contracts

Load `xpert-agentic-app-developer` and read these skill-relative references before implementing Remote Views:

- `references/enterprise-shadcn-design-principles.md`
- `references/shadcn-ui.md`
- `references/human-decision-load-and-progressive-disclosure.md`
- `references/assistant-task-orchestration.md`, especially **Task Identity and Persistence** and **View Execution Records**
- `references/view-client-commands.md`, especially **Open Assistant Task Execution Records**
- `references/remote-view-icons.md`

Use the skill name plus its internal reference path in documentation. Do not create filesystem-relative links that traverse into a sibling skill.

## Shared Case Contract

Both Views must consume the same persisted, tenant-scoped Case model and immutable flow-template version. A Case selection has one stable identity across dashboard, swimlane, node workspaces, Assistant Tasks, audit evidence, and refreshes.

At minimum persist and project:

- Case identity, title, lifecycle status, revision, scope, and bound flow-template key/version;
- current stage, next authorized action, blockers, progress, and timestamps;
- server-projected lanes, stages, nodes, edges, routes, executability, and completion evidence;
- Assistant identity for each accountable lane;
- immutable Agent execution attempts bound to Case, node, lane/role, Assistant Task, conversation/thread, attempt, and status;
- human decisions, external confirmations, and resulting artifact revisions.

The UI may calculate display geometry, selection state, and temporary filters. It must not invent business route state, progress, execution records, or completion truth.

## Required Server Operations

The blueprint names application-service operations rather than transport routes. The default Workbench requires:

- `dashboardProject` for aggregate management metrics and chart-ready series;
- `caseList`, `caseCreate`, and `caseGet`;
- `flowProject` and `executableNodes`;
- `nodeStart`, `nextNodeProcess`, `humanTaskComplete`, and `blockerResolve`;
- `nodeWorkspaceGet` for node detail or operation Views;
- `executionRecordList` for immutable, authorized execution attempts.

Do not aggregate a paginated case list in the browser to fake dashboard statistics. Do not create a second UI-only workflow model to drive the swimlane.

## Cross-View Navigation

Use stable keys and public host commands:

1. A dashboard chart point, table row, or alert selects an exact Case and opens the `pipeline_overview` View.
2. The swimlane opens bounded node information in a shadcn `Dialog`, a full workflow `View`, or an approved embedded component according to the node's `openMode`.
3. An execution marker opens the exact authorized ChatKit conversation/thread/execution with `workbench.navigation.open` and an allowlisted `assistant.conversation` target.
4. Returning to the dashboard or swimlane preserves Case selection when still valid and refreshes server truth.

Navigation payloads carry stable identifiers, not full records or secrets. The server re-authorizes and resolves every target.

## Shared View Shell

Keep the shell shallow and operational:

- title and essential context;
- a small action group with one visually dominant next action;
- a divider before data content;
- loading, empty, stale, partial-error, and permission-denied states;
- host theme, density, locale, and responsive behavior;
- keyboard and assistive-technology support.

Use interactive primitives from the current repository's shadcn source resolved by the companion `shadcn-ui.md`: `@xpert-ai/plugin-shadcn-ui` when locally available, otherwise components installed into the current project with the shadcn CLI. Never reference another checkout to obtain the package. Do not use native `<select>`, `<button>`, `<dialog>`, ad hoc tooltips, emoji icons, or another component system. Semantic HTML, SVG paths, and ECharts canvas/SVG output remain appropriate for document and visualization structure.

## Delivery Sequence

Build one vertical slice before widening the graph:

1. persist one Case and bind it to a flow-template version;
2. project it into the dashboard and the swimlane from server truth;
3. show one independently installed/published accountable Assistant with its actual Avatar;
4. run one real Assistant Task and persist its immutable execution attempt;
5. display the same attempt in the Assistant-card lane summary and owning task card, show details on hover/focus, and open its exact ChatKit record on activation;
6. render one router or equivalent logic node as a labeled diamond;
7. open one task node through its declared `dialog`, `view`, or `component` interaction;
8. perform one authorized action and refresh both Views to the same Case revision.

## Non-Substitution Rules

The Workbench is incomplete if it contains only a dashboard, a single-Case cockpit, a stepper, Agent result cards, a static graph, or a chat launcher. It is also incomplete if the swimlane is decorative and cannot show persisted state, exact executions, blockers, or authorized node operations.

Placeholder data is acceptable only in an explicitly labeled development fixture. Never present timers, random transitions, synthetic conversations, or invented metrics as runtime evidence.

## Cross-View Acceptance

Accept the Workbench only when:

- exactly one management dashboard and one multi-Agent swimlane View are registered and reachable;
- both consume tenant-scoped server projections and agree on Case identity/revision;
- dashboard-to-Case, node-to-operation, and execution-to-ChatKit navigation work through allowlisted host commands;
- failures, blocked states, superseded attempts, and human decisions remain inspectable;
- Remote View assets load without CDN or undeclared host globals;
- all interactive controls use the resolved current-repository shadcn primitives;
- refresh, resizing, responsive layout, theme changes, and permission failures are exercised;
- the installed plugin, not a source-only preview, passes the relevant end-to-end checks.
