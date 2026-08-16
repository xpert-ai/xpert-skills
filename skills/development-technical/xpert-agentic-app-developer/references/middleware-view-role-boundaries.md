# Middleware, View, And Role Boundaries

Use this reference when dividing an Agentic App into middleware providers, binding Views to capabilities, or deciding how Agent roles relate to real users.

## Contents

1. [Start from domain capabilities](#start-from-domain-capabilities)
2. [Give every tool one owner](#give-every-tool-one-owner)
3. [Bind Views through Features](#bind-views-through-features)
4. [Compose Assistants from capabilities](#compose-assistants-from-capabilities)
5. [Separate Agent roles from human roles](#separate-agent-roles-from-human-roles)
6. [Use provider modes for least privilege](#use-provider-modes-for-least-privilege)
7. [Validate the boundary](#validate-the-boundary)

## Start from domain capabilities

Define middleware around cohesive business capabilities, not around pages, prompts, or an ever-growing “all lifecycle” toolbox. A capability should have one vocabulary, one authorization model, one state machine, and one reason to change. Examples include requirement evidence review, product-model maintenance, pricing, or order fulfillment.

Split a capability into a dedicated middleware when at least one of these is true:

- its tools are useful to a distinct Agent or human responsibility;
- its View must disappear when the capability is absent;
- its writes have a different approval, evidence, or publication policy;
- it has a distinct state machine or failure/retry lifecycle;
- keeping it in an aggregate middleware creates duplicate tools or excessive model context.

Do not split only because a View has several panels. Keep shared persistence and domain services below middleware boundaries; middleware is the model-callable adapter and capability declaration, not the domain model itself.

## Give every tool one owner

Assign every model-visible tool to exactly one domain middleware. Keep tool names stable and domain-prefixed. An aggregate middleware must not re-export another middleware's tools for convenience.

For a new app, reject these compatibility patterns:

- `excludeDomainTools` or similar negative filters on an aggregate provider;
- constructing a large provider and removing tools after `createTools()`;
- publishing the same tool name from multiple providers;
- keeping a deprecated whole-object mutation beside its narrow replacements;
- relying on Assistant prompts to avoid duplicate or privileged tools.

Physically move the schemas, handlers, progress-tool names, event filters, tests, and constants with the owning capability. Preserve shared behavior as injected domain services, not by wrapping or instantiating another middleware.

Maintain exported tool-name sets per middleware and test that their intersection is empty. Test the exact list rather than only checking a few expected names.

## Bind Views through Features

Treat a Feature as a capability token:

```text
Middleware owns domain tools
    -> declares one domain Feature
    -> Assistant connects the middleware
    -> View Host receives the Feature
    -> matching View becomes available
```

Make each View depend on the Feature of the middleware that owns its data and actions. Do not grant a View through an unrelated aggregate middleware merely because older Assistants used it.

Keep the View and middleware related but decoupled:

- the middleware exposes model-callable reads and mutations;
- the View provider exposes paged UI queries and explicit UI actions;
- both call the same application/domain services;
- the View subscribes only to successful mutation tool names that affect its visible state;
- read tools do not emit mutation refresh events;
- binary uploads and interactive file selection can remain View actions while Agent tools maintain structured data.

When a capability is removed from an Assistant, both its tools and its gated View should disappear. Test this as a paired capability contract.

## Compose Assistants from capabilities

Build an Assistant by connecting only the middleware needed by each Agent. Do not use one universal middleware and ask the prompt to ignore most of its tools.

Use the following mapping:

| Layer | Owns | Does not own |
| --- | --- | --- |
| Domain service | invariants, transactions, authorization, persistence | model prompts or View layout |
| Middleware provider | model-visible tool contracts and Feature declaration | human job title or business approval itself |
| View provider | human review/query/action surface | Agent delegation policy |
| Assistant graph | Agent roles, connections, knowledge, task/result contracts | domain invariants |
| Human role/policy | authority, accountability, confirmation, escalation | low-level tool sequencing |

Keep provider constants and Feature constants stable and public when templates or other plugins must compose them. Update plugin runtime registration, capabilities, Marketplace metadata, View manifests, Assistant template dependencies, and structural tests together.

## Separate Agent roles from human roles

Do not assume a one-to-one mapping between an Agent node and a real user job title.

- A human role defines accountability and decision authority: who may approve, publish, delete, override, or accept risk.
- An Agent role defines a bounded execution responsibility: coordinate, retrieve evidence, normalize one item, validate, or prepare a draft.
- One human may use several Agent roles through one Assistant.
- One Agent may assist several human roles if its authority and outputs are unchanged.

Encode the human boundary in domain policy and explicit confirmation, not merely in the Agent name. Require confirmation for publication, deletion, externally visible changes, financial commitments, destructive operations, and controlled overrides. Persist the confirming user and audit context where the action matters.

Let the main Agent own user communication and reconciliation. Let specialist Agents return compact receipts or findings; they should not silently acquire approval authority from their parent.

## Use provider modes for least privilege

Use one provider with explicit modes when Agents operate in the same domain but require different subsets of the same stable tool family. For example:

```text
RequirementEvidenceProvider
  mode: coordinator     -> scope, diagnostics, review, lock
  mode: deep_retrieval  -> exact search, visual preparation, Observation writes
  mode: full            -> complete domain workflow for a dedicated Assistant
```

Define modes as positive allowlists. Do not build a full list and subtract exclusions. Test each exact mode list and the invariant that every mode is a subset of the provider's canonical tool set.

Create separate providers instead when the tools have different domain language, authorization policy, persistence lifecycle, Feature/View ownership, or release cadence.

Different tool lists on two Agent nodes do not imply different middleware implementations when both use the same provider with explicit modes. Conversely, identical display labels do not prove that two nodes share a provider; validate provider keys and configurations in the DSL.

## Validate the boundary

Verify all of the following:

1. Every tool name has one provider owner and no deprecated alias remains.
2. Aggregate middleware contains no copied schemas, handlers, event filters, or progress names from extracted domains.
3. Each provider declares only its own Features.
4. Each View requires the correct Feature and refreshes only for its owning mutations.
5. Each Agent connects directly to every middleware and knowledge source it calls.
6. Provider modes are positive, exact allowlists with unit tests.
7. Human confirmations and authorization are enforced in services, not prompts alone.
8. Removing one middleware from a template removes both its tools and View without breaking unrelated capabilities.
9. Source template, installed draft, published graph, and a fresh execution expose the same provider keys and tool sets.

Remember that refreshing plugin template code does not rewrite existing Assistant instances. Upgrade or recreate the intended Assistant explicitly before judging a boundary change from an old graph.
