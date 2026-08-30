---
name: xpert-assistant-dsl-builder
description: Build, update, review, and diagnose Xpert Assistant YAML DSL graphs. Use when designing single- or multi-Agent Assistants; mapping Studio properties such as opener questions, memory, files, models, middleware, tools, knowledge, and runtime options; wiring leaderKey and graph connections; validating plugin template contributions; or installing, publishing, and runtime-validating an Assistant.
---

# Xpert Assistant DSL Builder

Build Assistant DSLs from the current Xpert platform contract, not from memory or a copied example. Treat source definitions, plugin contributions, generated YAML, installed drafts, published graphs, and runtime executions as separate layers that must agree.

## Start Here

1. Run `node scripts/inspect-dsl-contract.mjs` from this skill before editing a DSL. Resolve contract drift before relying on the bundled schema.
2. Read [contract-sources.md](references/contract-sources.md) and [assistant-dsl-contracts.md](references/assistant-dsl-contracts.md).
3. Route to the references needed by the task:

| Task | Required reference |
|---|---|
| Team identity, model, memory, runtime, canvas | [team-properties.md](references/team-properties.md) |
| Agent prompt, parameters, tools, attachment, delegation | [agent-properties.md](references/agent-properties.md) |
| Studio 功能, opener questions, suggestion, speech, upload | [features-and-ui-mapping.md](references/features-and-ui-mapping.md) |
| Plugin template metadata and cross-layer generation | [template-contribution.md](references/template-contribution.md) |
| Child Agent isolation and task/result contracts | [subagent-context-isolation.md](references/subagent-context-isolation.md) |
| Import, multi-Assistant suite provisioning, publish, and runtime verification | [lifecycle-validation.md](references/lifecycle-validation.md) |

Use [examples/minimal-agent.yaml](examples/minimal-agent.yaml) for the smallest graph and [examples/full-featured-assistant.yaml](examples/full-featured-assistant.yaml) for property placement. Examples demonstrate shape; current host contracts remain authoritative.

## Contract Authority

Use this order of authority:

1. Current host DTOs and TypeScript contracts listed in `schemas/contract-manifest.json`.
2. The installed `@xpert-ai/contracts` and `@xpert-ai/plugin-sdk` versions of the owning repository.
3. `schemas/assistant-dsl.schema.json` and the reference files in this skill.
4. A working graph from the same platform version.

The schema is a versioned, strict snapshot of core reusable fields. `inspect-dsl-contract.mjs` hashes authoritative sources and reports drift. Do not silently extend the schema when the host changed; inspect the host, update the manifest, schema, field references, examples, and validator together.

## Build From One Definition

For generated plugin templates, define identity and feature data once and render every delivery layer from it:

```ts
const definition = {
  key: 'operations-analyst',
  title: '流程运营分析助手',
  description: '解释组织级运营指标。',
  avatar: ANALYST_AVATAR,
  startPrompts: ['最近 30 天运营情况如何？']
}

return {
  ...definition,
  startPrompts: definition.startPrompts,
  dslContent: buildDsl({
    ...definition,
    features: {
      opener: { enabled: true, message: '', questions: definition.startPrompts }
    }
  })
}
```

Do not maintain the same title, avatar, or question list as unrelated literals. At minimum keep these equal:

- contribution `key/title/description/avatar/startPrompts`;
- DSL `team.name/title/description/avatar`;
- Studio opener `team.features.opener.questions` when opener is enabled;
- primary Agent identity when the product intentionally presents it as the Assistant identity.

`startPrompts` is catalog/application metadata, while `team.features.opener.questions` is the Studio “功能 → 对话开场白 → 开场白问题” configuration. Generate both from one source because installation paths do not implicitly synchronize them.

## Design Responsibilities Before Graphs

Give every Agent one bounded responsibility. Add a child Agent only when it needs an isolated prompt, context, capability boundary, lifecycle, or reusable runtime entrypoint. Enforce authority with direct graph connections and tool exposure rather than prompts alone.

For each child Agent:

1. Add a stable `agent` node.
2. Set `entity.leaderKey` to its direct parent.
3. Add exactly one incoming `type: agent` connection from that parent.
4. Attach only the middleware, tools, Skills, and knowledge it directly uses.
5. Define structured `entity.parameters` for correctness-critical identifiers.
6. Return a compact result contract and cover missing, stale, partial, or rejected inputs.

Child Agents do not inherit a parent or sibling's connections. `disableMessageHistory` controls that Agent's own cross-round history; it is not a parent-context switch. Use `team.agentConfig.mute` only to hide internal streamed narration, not to suppress its result.

## Validate Before Delivery

Run:

```bash
node <skill-dir>/scripts/inspect-dsl-contract.mjs
node <skill-dir>/scripts/validate-assistant-dsl.mjs \
  path/to/assistant.yaml \
  --contribution-source path/to/template-contribution.ts \
  --built-yaml path/to/dist/assistant.yaml
```

The validator checks public field names, identity, opener alignment, graph endpoints, Agent hierarchy, parameters, capability ownership, reusable-resource safety, contribution Skill targets, and source/build parity. Add repository tests for generated DSL because a TypeScript contribution cannot always be reconstructed safely by static text parsing.

Then run focused tests, type checks, build, and `git diff --check`. Increment `team.version` for graph, prompt contract, features, memory, model, dependency, or runtime option changes.

## Validate Every Runtime Layer

Verify in order:

1. source definition and generated YAML;
2. loaded plugin contribution;
3. installed draft, including instance-owned bindings;
4. published graph and published Assistant properties;
5. one bounded execution tree and persisted outputs.

Refreshing a plugin does not rewrite an installed Assistant. Saving a draft does not publish it. Preserve user-owned models, credentials, environments, knowledge bases, and organization scope unless the user explicitly authorizes replacement.

Finish only when every applicable layer tells the same story. Report layers that were not exercised.
