# data-xpert Ontology Integration

Read this reference when a plugin consumes or authors data-xpert ontology content.

## Choose the integration surface

Use the smallest surface that matches the product:

- **Xpert-native Workbench plus Assistant:** call data-xpert Agent Tools REST from a server-side plugin client and expose narrow native Agent middleware tools backed by the same domain service.
- **Assistant template without plugin middleware, or cross-platform standard tools:** connect the Assistant HTTP MCP Toolset to data-xpert `/v1/mcp`.
- **Ontology authoring:** use the dedicated draft-authoring tools with revision, fingerprint, idempotency, validation, and deletion-preview controls. Do not simulate authoring through whole-document replacement.

Do not publish equivalent native and MCP tools to the same Agent unless the task explicitly needs both. Duplicate surfaces create ambiguous tool choice and inconsistent authorization or result contracts.

## Server-side client contract

A typical published-resource client uses the current Agent Tools endpoints for:

- listing ontology resources;
- querying a compact ontology schema;
- querying bounded entity results;
- retrieving a one-hop entity neighborhood with evidence, constraints, and affordances;
- reading a task audit trace.

Inspect the current platform contracts before fixing endpoint paths or response types. Keep transport DTOs private to the client and map them to compact plugin-domain DTOs.

For every request:

1. obtain a short-lived Actor Token from the runtime capability for the current actor;
2. require the trusted current organization scope;
3. send the Actor Token as bearer authorization and the organization through the platform organization header;
4. enforce a bounded timeout and result limit;
5. return stable error codes without including response bodies, tokens, or remote secrets.

Never accept tenant, organization, actor, token, or API base URL from a model tool argument. Never pass them into the Remote View iframe.

## Resource and schema selection

Expose a resource only when all applicable checks pass:

- resource status is active;
- health status is `ready`;
- it is inside the configured resource whitelist, when a whitelist exists;
- its Schema contains the configured root entity type by exact code;
- it belongs to the current trusted tenant and organization according to data-xpert authorization.

Do not match on display names, localized labels, aliases, or an attribute pattern. If the required machine discriminator is missing, improve the shared contract instead of adding a heuristic.

Keep these fields throughout the application DTOs when available:

```ts
interface OntologyObjectContextV1 {
  version: 1
  resourceId: string
  snapshotId: string
  graphVersion: string
  partitionKey?: string | null
  entityId: string
  entityTypeCode: string
  externalKey: string
  label: string
}
```

`snapshotId` and `graphVersion` make facts and decisions traceable. Treat a changed graph version as a reason to refresh or rerun preflight, not as cosmetic metadata.

## Object search and 360 views

Validate `entityTypeCode` against the selected Schema before querying. Bound search results at both configuration and API layers. For a 360 view, group relations by exact relation code and direction, and return only the selected entity, related objects, evidence, constraints, Action affordances, snapshot identity, and pagination/task metadata needed by the UI.

Do not return the complete ontology graph to the model or iframe. Use separate paged reads or explicit neighborhood expansion when more detail is required.

## Workbench and Agent context

Publish only the filtered object context through `assistant.context.set`; do not publish tokens, API details, full evidence blobs, or entire graph snapshots.

Resolve a context-aware tool target as follows:

1. compare explicit stable identity fields with the active Workbench object;
2. when they address the same object, use the Workbench-published canonical resource, type code, external key, and opaque partition rather than model-guessed variants;
3. when they address a different object, use the explicit target only after normal server-side resource and access validation;
4. when target fields are omitted, use the active context, then an explicitly configured default resource;
5. return `NO_ACTIVE_CONTEXT` when no safe target exists.

Never derive `partitionKey` from `resourceId`, `snapshotId`, graph naming, labels, or other incidental text. Preserve the exact value returned by data-xpert.

## Authoring boundary

Normal business plugins should consume published snapshots and leave Schema, binding, version publication, and draft state unchanged. If ontology authoring is explicitly required, isolate it as a separate capability and apply the authoring service rules:

- edit only the selected definition draft;
- read the current draft revision and item fingerprint before update;
- mutate one semantic item per command;
- make operations idempotent;
- validate after changes;
- preview deletion impact and require the current impact hash;
- never publish or configure bindings unless separately authorized.
