---
name: data-xpert-plugin-developer
description: Develop Xpert plugins and Agentic Apps that consume data-xpert ontology resources, entity graphs, evidence, constraints, and ontology Action definitions, then connect them to governed plugin-side execution. Use for data-xpert REST or MCP integration, Workbench context, Action proposals, approval, execution adapters, and audit.
---

# Data Xpert Plugin Developer

Use this skill for the data-xpert-specific layer of an Xpert plugin. Also use the general `xpert-plugin-development` guidance for packaging and deployment, and `xpert-agentic-app-developer` when the plugin provides a Workbench, Agent middleware, persistence, or an Assistant template.

## Default Architecture

Keep one typed domain path behind both human and Agent surfaces:

```text
Workbench Remote View -> View Provider ----\
                                         Domain Service -> typed data-xpert client -> published ontology resource
Assistant -> native Agent middleware -----/       |
                                                  +-> plugin-owned proposal and audit persistence
```

The iframe never calls data-xpert directly. It communicates through the Xpert View bridge. The server-side client obtains the current user's short-lived Actor Token from the runtime capability and sends the current organization scope to data-xpert.

## Workflow

1. Classify the feature as published-ontology consumption, ontology authoring, Action execution, or a combination. Do not mix draft authoring with normal business-app reads implicitly.
2. Inspect the current data-xpert contracts and use exact machine codes. Never infer resource, entity, relation, Action, or partition identity from localized labels or sample attributes.
3. Define bounded plugin configuration: API base URL, exact root entity type code, optional resource whitelist, timeout, and result limit. Identity and authorization do not belong in model parameters or iframe configuration.
4. Build one server-side typed client and one domain service. Return compact application DTOs carrying `resourceId`, `snapshotId`, `graphVersion`, canonical object identity, evidence, constraints, and Action affordances when relevant.
5. Accept only active, `ready` published resources and verify the configured root entity type by exact code before presenting the resource to users or tools.
6. Publish a versioned, filtered Workbench selection through `assistant.context.set`. Resolve model tool targets against this canonical context and revalidate the target on the server.
7. Connect ontology Actions to plugin executors through the Action code and a governed pipeline: discovery, preflight, proposal, human approval, execution, and audit. The ontology definition is not executable code.
8. Validate the data-xpert integration contract, then follow `xpert-plugin-development` for packaging, installation scope, runtime restart, and Assistant lifecycle handling.

## Non-Negotiable Boundaries

- Treat `resourceId`, `snapshotId`, `graphVersion`, entity codes and IDs, external keys, Action codes, and `partitionKey` as contract fields. `partitionKey` is opaque; never derive it from a resource or snapshot name.
- Keep Actor Tokens, API URLs, tenant IDs, and organization IDs out of the iframe and model-visible schemas. Obtain trusted scope server-side and enforce tenant/organization isolation on plugin-owned persistence.
- Default business applications to read-only use of published ontology snapshots. Modify Schema or drafts only when the request explicitly selects ontology authoring and the data-xpert authoring contract is available.
- Do not duplicate the same tool surface through native middleware and MCP without an explicit interoperability reason. Prefer native middleware plus Agent Tools REST for Xpert-native Workbenches; prefer data-xpert MCP for Assistant-only or standard MCP integrations.
- Distinguish ontology facts, plugin/Assistant judgments, proposed actions, approved actions, and completed external effects. Never report a proposal or Demo simulation as a real external-system write.
- Persist mutations with an idempotent `operationId`, explicit state transitions, evidence, actor identity, and an append-only audit trail.

## Reference Routing

- Read [references/ontology-integration.md](references/ontology-integration.md) when implementing resource discovery, schema/entity/neighborhood reads, Workbench context, Actor Token transport, or ontology authoring boundaries.
- Read [references/action-execution.md](references/action-execution.md) when connecting data-xpert Action definitions to plugin adapters, proposals, approval, execution, Demo behavior, or audit.

## Completion Check

Before finishing the data-xpert-specific work, verify the exact resource and root type, Actor Token and organization headers, canonical context resolution, snapshot/version propagation, resource isolation, Action preflight and state transitions, Demo labeling, and audit completeness.
