# Domain, Flow, and Runtime

Read this reference when designing the pipeline's domain model, flow DSL, state projection, routing, concurrency, or node execution.

## Separate Four Models

Keep these models related but distinct:

1. **Domain model**: Case, artifacts, policies, approvals, revisions, and authoritative external facts.
2. **Flow definition**: immutable nodes, edges, lanes, routers, completion contracts, and template version.
3. **Flow projection**: the derived status and executable nodes for one Case at one revision.
4. **Execution record**: Assistant Task or deterministic operation attempts, identifiers, status, cancellation, retry, and audit.

Do not let a generic node-instance status table replace domain truth. Persist execution history and explicit route decisions, but derive business completion from artifacts and policies whenever possible.

## Domain Boundaries

Partition by responsibility and invariants, not by UI tab. A typical pipeline may need:

- intake and evidence;
- core business production or engineering;
- commercial or decision preparation;
- approval/fulfillment;
- operations and SLA projection;
- integration adapters and outbox.

Each important artifact should declare:

- stable identity and Case relationship;
- owning bounded context and accountable role;
- tenant/organization scope;
- revision, state, and allowed transitions;
- evidence, confidence, provenance, and review state when AI contributes;
- idempotency and optimistic-concurrency policy;
- whether downstream contexts may reference only a locked/published revision.

## Flow Definition

Use stable keys for templates, nodes, lanes, route facts, workspaces, completion predicates, execution profiles, and actions. Keep localized labels outside identity.

A template version is immutable after Cases can bind to it. Publish a new version for changed graph topology, completion semantics, role accountability, or route meaning. Preserve historical definitions until no persisted Case or audit record needs them.

Validate at registration or startup:

- key uniqueness and valid references;
- exactly one declared start node;
- at least one terminal reachable from start;
- no dangling, orphaned, or unreachable nodes;
- no cycles in the supported DAG model;
- every task is lane-bound and has an accountable role;
- every router has at least two distinct, complete conditioned exits;
- every completion artifact, route fact, execution profile, Feature, and action exists.

## Projection

A useful status vocabulary is:

```text
not_started
ready
active
blocked
completed
not_applicable
satisfied_externally
```

Choose names that fit the implementation, but keep the semantics explicit. Projection should consume:

- Case template and version;
- domain artifact revisions and states;
- recorded route decisions and their fact revisions;
- active execution attempts;
- external confirmation and human approval records;
- access policy for the requesting role.

Return executable nodes as a server-owned decision. A UI button or Agent prompt must not infer executability independently.

For the Cases Workbench, return one coherent, access-trimmed flow projection containing Case identity and revision, ordered lanes and stages, actual independent accountable Assistant identities/Avatars, nodes, semantic edges, route decisions, summary counts, blockers, SLA data, authorized node open-mode/action metadata, executable node keys, and immutable Agent execution attempts bound to Case/node/lane for both lane-summary and exact-node presentation. Return management aggregates and chart-ready series through a separate tenant-scoped dashboard projection. The client owns selection, filters, and canvas geometry only; it must not persist a second route, node-status, metric, or execution-history truth.

Keep Case operations and projection operations explicit even when they share one service boundary:

```text
project dashboard metrics and chart-ready series
list/create/get Case
project flow and executable nodes
start a specified node or process the next server-selected node
complete a human task
resolve a blocker
resolve an authorized node workspace
list immutable execution-attempt records for a Case/node
```

Mutations accept expected Case/route revisions and an idempotent operation id. Reload the projection after any View action, Agent tool, human decision, external acknowledgement, retry, cancellation, or backend transition.

## Deterministic Routers

A route fact must have a persisted source, bounded values, and a revision or digest. A route decision should record at least:

```text
case id
template key/version
router node key
fact key and normalized value
source artifact id/revision or fact digest
decision revision and timestamp
```

Invalidate or recompute the decision when its authoritative source changes. Do not ask an LLM to choose a route from prose when the decision can be represented as a structured fact. An LLM may extract a candidate fact, but normal domain review must confirm it before routing when risk warrants.

## Node Execution

Before starting an execution:

1. reload the Case under tenant/organization scope;
2. verify expected Case revision and route revision;
3. project the flow and prove the node is currently executable;
4. enforce role, Feature, middleware, node-tool, and human-gate policy;
5. resolve the exact Assistant/Agent or deterministic executor;
6. derive a stable operation id/idempotency key;
7. persist an execution attempt before or atomically with dispatch;
8. send a compact context envelope rather than a complete Case dump.

A context envelope commonly contains:

```text
Case id and revision
flow template key/version
node key and route revision
operation id
relevant artifact ids/revisions
allowed Agent tool names
requester and execution role
```

Persist platform task, conversation, thread, and execution identifiers when available. Support bounded status refresh, cancellation, interruption, retry, and recovery without duplicating the business mutation.

Project each authorized execution attempt onto the exact task node and accountable Assistant lane where it actually ran. The Assistant card consumes a lane-filtered recent summary; the task card consumes a node-filtered recent summary. Preserve sequence, runtime status, timestamps, input/output revisions, safe summary, platform handles, and supersession link, and resolve both surfaces from the same immutable record. Keep platform execution status separate from node business completion. For the canonical persistence and exact ChatKit navigation implementation, use `xpert-agentic-app-developer` and its `assistant-task-orchestration.md` and `view-client-commands.md` execution-record sections.

## Completion Boundary

Separate:

- platform execution success;
- tool/application operation success;
- artifact reaching a valid business state;
- human approval or external confirmation;
- node completion;
- downstream node readiness.

An Assistant returning a confident message proves none of the later conditions by itself.

## Integrations and Operations

Use ports and anti-corruption adapters for external systems. Put retryable external publication behind an outbox when atomic business persistence and delivery cannot be guaranteed together.

Keep operational dashboards, SLA events, alert state, and queue state as projections over business and execution events. Operational tools may remediate execution state but must not silently rewrite source business facts.
