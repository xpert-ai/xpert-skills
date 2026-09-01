# Roles, Capabilities, and Assistant Topology

Read this reference when mapping human roles to lanes, designing independent role Assistants and their Orchestrator, or assigning middleware, tools, Features, and Views.

## Keep Identities Separate

Do not use one name for all of these concepts:

| Identity | Meaning |
|---|---|
| Human role | Organizational responsibility and authority |
| Lane | Visual/process accountability for task nodes |
| Assistant template | Installable and publishable Xpert Assistant definition |
| Assistant instance | Organization-owned installed/published Xpert with stable identity and conversations |
| Primary Agent | Runtime leader inside one Assistant graph |
| Internal specialist Agent | Bounded child Agent with isolated prompt/capabilities |
| External Xpert | Direct graph binding from the Orchestrator primary Agent to an independently installed role Assistant |
| Middleware | Owner of a coherent Agent tool capability |
| Execution profile | Runtime mapping from node/lane to Assistant, Agent, middleware modes, Features, and fallback |

Every AI-participating business role maps to one business lane and one independently installable/publishable role Assistant. A lane-owning participant must not be represented as a child/sub-Agent inside the Orchestrator or another role Assistant.

An internal specialist Agent may exist only as a private implementation detail inside one role Assistant. It is not a pipeline participant, does not own a lane or cross-role handoff, and must not replace the independent Assistant required for a business role.

## Supported Topologies

### Standalone role Assistants

Each business role can run its Assistant directly. Use this when users enter through their role, the process is coordinated by persisted Case state, or no organization-level Orchestrator is needed.

Requirements:

- one separate Assistant template, installed instance, published version, and primary Agent key per AI-participating role;
- only the role's Features, middleware bindings, knowledge, and Views;
- ability to find the current Case and executable nodes under server authorization;
- human fallback when an Agent action cannot run safely.

Do not collapse several lane roles into one Assistant graph with one child/sub-Agent per lane. Separate role identity, publication, permissions, conversations, execution history, and upgrade lifecycle are part of the product contract.

### Orchestrator Assistant plus External Xperts

The Orchestrator is its own independently installed/published Assistant. Its primary Agent coordinates the Case and invokes every role Assistant only through an External Xpert binding. Do not embed duplicate role Agents in the Orchestrator graph and do not dispatch role work through sub-Agent connections.

Require every external connection to be:

- an External Xpert node connected directly from the Orchestrator primary Agent;
- marked `required: true`; optional External Xperts are not loaded by default at runtime;
- within the intended organization and environment;
- bound to an installed, published Assistant from the expected template provenance;
- compatible with the expected primary Agent key;
- uniquely matched for its role.

Missing, ambiguous, unpublished, incompatible, or cross-scope bindings must block automated dispatch and expose a human fallback. Do not silently pick the first candidate.

Resolve runtime dispatch through the platform external-Assistant target contract using the requester Xpert/Agent identity plus portable `pluginName`, `templateKey`, and `agentKey` expectations. Do not persist organization-specific Assistant instance identifiers in reusable plugin or blueprint contracts.

The Orchestrator may read coordination state and start eligible role work. It must not inherit every business write middleware. Business writes remain with accountable role Assistants or deterministic services.

### Internal specialist Agents are not role participants

Use a child Agent only when work needs an isolated prompt, bounded context, different tools/knowledge, or reusable expertise inside one role Assistant and does not constitute a separate organizational handoff.

- connect it only to its direct parent;
- attach only directly used middleware, tools, Skills, and knowledge;
- define structured task inputs and compact result contracts;
- handle missing, stale, partial, rejected, and conflicting evidence;
- keep final business authority with the parent role and domain policy.

If the work appears in a swimlane, owns a business artifact or handoff, needs its own Avatar/conversations/history, or is invoked by the total-control Orchestrator, it is an independent role Assistant and External Xpert—not an internal specialist/sub-Agent.

Use `xpert-assistant-dsl-builder` for current graph and Agent contracts. For a multi-Assistant suite, read that skill's `references/lifecycle-validation.md` sections **Versioned Suite Provisioning** and **Runtime Acceptance**. Also use `xpert-agentic-app-developer` and its `references/assistant-template-lifecycle.md` for installation, update, publication, and External Xpert verification.

## Capability Matrix

Build and test a positive ownership matrix:

| Surface | Required mapping |
|---|---|
| Agent tool | Exactly one owning middleware |
| Middleware | One coherent domain capability and declared Feature set |
| Role Assistant | Explicit middleware bindings and modes |
| Orchestrator External Xpert | One direct required binding to the expected published role Assistant |
| Flow node | Accountable role, execution profile, exact tool allowlist |
| View | Owning Feature and explicit actions/client commands |
| Human action | Server-side role and state policy |

Do not infer permission from prompts, UI visibility, a broad plugin capability, or the fact that a tool exists in the process.

## Agent Tools Versus View Actions

An Agent middleware tool is a model-callable operation with a strict schema. A View action is a human/UI command. They may call the same application service but are different contracts and authorities.

For Agent tools:

- one middleware owner;
- strict structured input and compact DTO output;
- exact role and node-level allowlists;
- evidence, revision, idempotency, and failure information;
- no full document or unbounded history in mutation results.

For View actions:

- declare the action in the View manifest;
- authorize again on the server using current Case state and role;
- do not trust hidden or disabled UI state;
- use file actions for file transport and JSON actions for normal commands;
- keep consequential confirmation separate from an ordinary information dialog.

## Access Projection

Define at least these access outcomes, using implementation-specific names if needed:

- manage: inspect and perform permitted actions;
- overview/read: inspect permitted process and artifacts without mutation;
- system-only or denied: return a deliberately reduced projection.

For unauthorized or overview-only users, strip sensitive descriptions, workspaces, blocker details, execution links, and actions rather than returning a full graph with disabled buttons.

## Cross-Layer Consistency

Whenever a Feature, middleware, tool, role, Assistant template, node, or View changes, verify all affected declarations together:

```text
plugin target-app metadata
runtime middleware provider list
server module registration
middleware strategy metadata
Assistant template required Features/providers
role execution catalog
flow execution profile
node tool allowlist
View Feature/action gates
tests and generated artifacts
```

The blueprint validator catches structural omissions. Repository tests must prove the actual TypeScript contributions and runtime registrations.
