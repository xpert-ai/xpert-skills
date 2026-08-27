# Contract Sources And Versioning

## Authority

The reusable Assistant YAML surface is the serialized intersection of the host DTO and contract types:

| Concern | Authoritative source |
|---|---|
| Exported team, Agent, model, toolset fields | `xpert/packages/server-ai/src/xpert/dto/xpert-dsl.dto.ts` |
| Team features, options, Agent config, memory, parameters, graph | `xpert/packages/contracts/src/ai/xpert.model.ts` |
| Agent options, attachment, tools, middleware order | `xpert/packages/contracts/src/ai/xpert-agent.model.ts` |
| Plugin template contribution | `xpert/packages/plugin-sdk/src/lib/types.ts` |

The owning repository's installed package version still controls what it can compile and import. If the source checkout and installed package differ, use the installed version for implementation and record the difference.

## Bundled Snapshot

`schemas/assistant-dsl.schema.json` is a strict snapshot of core reusable fields, not a replacement for platform types. `schemas/contract-manifest.json` records source paths and hashes. Run:

```bash
node scripts/inspect-dsl-contract.mjs
node scripts/inspect-dsl-contract.mjs --explain team.features.opener.questions
```

The inspector searches for the open-source `xpert` repository, verifies source hashes, and explains known field mappings. A hash mismatch means the platform contract may have changed even if an old example still imports.

## Updating The Snapshot

When drift is intentional:

1. Read the changed host DTO and contract types completely.
2. Update `assistant-dsl.schema.json` for the reusable serialized surface.
3. Update `field-catalog.json` and the relevant property reference.
4. Update examples and validator behavior.
5. Refresh the manifest hashes and `contractVersion`.
6. Run the inspector, validator against both examples, and the skill quick validator.

Do not add organization IDs, Assistant IDs, credentials, environments, or knowledge-base IDs to reusable examples merely because an exported installed graph contains them.

## Artifact Layers

Keep these layers distinct:

1. code-level Assistant definition;
2. plugin `XpertTemplateContribution`;
3. source or generated YAML DSL;
4. packaged or loaded template descriptor;
5. installed Assistant draft;
6. published Assistant entity and graph;
7. runtime execution and persisted outputs.

Cross-layer properties require explicit projection. There is no general rule that arbitrary contribution metadata is merged into `team` during installation.
