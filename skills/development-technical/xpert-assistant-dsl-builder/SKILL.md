---
name: xpert-assistant-dsl-builder
description: Build, update, review, and diagnose Xpert Assistant YAML DSL graphs. Use when designing single- or multi-Agent Assistants; deciding when to delegate to context-isolated subagents; wiring leaderKey and Agent, middleware, tool, workflow, or knowledge connections; assigning least-privilege capabilities by Agent role; validating templates; or installing, publishing, and runtime-validating an Assistant.
---

# Xpert Assistant DSL Builder

Build Xpert Assistant DSLs as explicit runtime graphs. Treat the source DSL, optional template contribution, installed Assistant draft, published graph, execution tree, and persisted outputs as separate artifacts that must agree.

## Required Reading

Read [references/assistant-dsl-contracts.md](references/assistant-dsl-contracts.md) before editing an Assistant DSL or template contribution.

Read [references/lifecycle-validation.md](references/lifecycle-validation.md) before importing, updating, publishing, or runtime-validating an Assistant.

Read [references/subagent-context-isolation.md](references/subagent-context-isolation.md) when deciding whether to add a child Agent, defining its task packet, or assigning a role-specific subset of middleware tools and knowledge.

## Workflow

1. Discover the owning repository and current platform contracts instead of assuming paths or schema versions.
2. Inspect the source DSL, nearby tests, host contract types, and one working Assistant graph from the same platform version.
3. Define each Agent's responsibility and task/result contract; use [references/subagent-context-isolation.md](references/subagent-context-isolation.md) to justify every child Agent.
4. Edit nodes, connections, prompts, dependencies, version markers, and structural tests together.
5. Run the bundled validator, focused repository tests, type checks, build, and `git diff --check`.
6. If a plugin contributes the template, refresh that plugin and verify the loaded contribution.
7. Import a new Assistant or explicitly update the intended draft. Preserve user-owned model, credential, and knowledge bindings unless replacement is requested.
8. Publish a new version and verify the published graph rather than only the draft.
9. Run one bounded task and inspect the execution tree plus persisted outputs before wider testing.

## Establish Responsibilities First

Prefer the smallest graph that gives every Agent one clear responsibility:

```text
Coordinator
  -> per-item Worker
       -> retrieval Specialist
       -> validation Specialist
```

Adapt the roles to the use case. Add dispatchers, iterators, reviewers, or other specialists only when the runtime contract requires them. A direct follower is sufficient when its parent can delegate a bounded task.

Assign authority explicitly:

- Coordinator: global planning, fan-out, reconciliation, and user communication.
- Worker: exactly one item or bounded unit of work, child delegation, and a compact result.
- Specialist: one capability or knowledge domain and only the tools required for it.
- Review Agent or human review surface: approval and other controlled actions when the workflow requires them.

Enforce authority through graph connections and tool exposure. Do not rely on prompts as the only permission boundary.

## Encode The Agent Graph

For every child Agent:

1. Add an `agent` node with a stable conceptual key.
2. Set `entity.leaderKey` to its direct parent Agent key.
3. Add exactly one incoming `type: agent` connection from that parent.
4. Set `required: true` when the child is required for the workflow.
5. Set `options.disableMessageHistory: true` only when the child should start each new invocation round without its own prior-round messages. This flag does not control parent-to-child context transfer.
6. Attach only the middleware, Skills, tools, and knowledge sources that the child itself must use.

Keep `team.agent.key` aligned with the primary Agent node. Use `team.agentConfig.mute` only when an internal Agent's streamed text should not appear in the user conversation; its compact result must still return through the Agent edge.

Do not confuse an Agent middleware workflow node with an Agent node. Middleware providers expose model-callable tools; Agent connections establish delegation.

## Isolate Capabilities And Knowledge

Assume that child Agents do not inherit a parent or sibling's tool or knowledge connection.

- Connect each knowledge base directly to the Agent that retrieves from it.
- Connect middleware directly to the Agent that calls its tools.
- Disable unrelated or privileged tools for specialist Agents.
- Keep organization-specific resource IDs out of reusable DSLs.
- Bind instance-owned models, credentials, and knowledge after creating or importing the Assistant when appropriate.
- Align `knowledgebaseIds` with knowledge nodes and connections when the current draft schema stores both.

When an Agent reports that a capability is unavailable, inspect graph ownership and runtime bindings before broadening its permissions.

## Declare Optional Template Dependencies

When a plugin contributes the Assistant template, keep required plugin names aligned across plugin metadata, `targetAppMeta.requiredPlugins`, DSL options, and the contribution.

Declare the owner of every cross-plugin Skill dependency explicitly:

```ts
const templateSkills = [{
  pluginName: SKILL_OWNER_PLUGIN_NAME,
  componentKey: SKILL_COMPONENT_KEY,
  targetAgentKey: 'Agent_Coordinator'
}]
```

Verify that `targetAgentKey` exists and that the target Agent has the middleware connection required by the current runtime. Skip plugin contribution work for Assistant DSLs that are not distributed through plugins.

## Write Contract Prompts

State the following in each Agent prompt:

- exact role and task boundary;
- required input identifiers and fields;
- which child Agent or tool to call and in what order;
- validity and freshness rules for temporary identifiers or retrieved evidence;
- required output or persistence action;
- compact result fields;
- prohibited actions and escalation conditions;
- behavior for no result, partial evidence, stale input, missing capability, and schema rejection.

Keep tenant, organization, Assistant, conversation, credential, and knowledge-base IDs out of reusable prompts. Return references or compact summaries instead of copying large tool responses through every parent layer.

Define parent-to-child context explicitly through the delegated task input, state variables, prompt templates, and graph connections. Do not use `disableMessageHistory` as a parent-history inheritance or filtering control.

## Validate Structure

Parse YAML and assert graph objects rather than string fragments. Verify:

- exact Agent keys and primary Agent;
- every child `leaderKey` and Agent connection;
- no cycles, duplicates, or dangling connection endpoints;
- each Agent's own cross-round message-history policy and mute paths;
- middleware, Skill, tool, and knowledge ownership;
- required template dependencies when present;
- absence of instance-owned IDs in reusable DSLs;
- source/build parity when the build copies the DSL;
- a deliberate `team.version` change for graph contract updates.

Run the bundled validator before repository tests:

```bash
node <skill-dir>/scripts/validate-assistant-dsl.mjs \
  path/to/assistant.yaml \
  --contribution-source path/to/template-contribution.ts \
  --built-yaml path/to/dist/assistant.yaml
```

Omit optional flags when they do not apply. Treat validator warnings as review items; current host contracts and repository tests remain authoritative.

## Validate The Installed Runtime

Verify in order:

1. Loaded source or template version.
2. Installed Assistant draft graph and instance-owned bindings.
3. Skill and middleware installation state.
4. Published graph, not only the draft.
5. One-task execution tree and expected child/tool calls.
6. Persisted outputs or artifacts.
7. Absence of calls that violate role boundaries.

Refreshing a template source does not automatically rewrite an existing Assistant. Updating a draft does not automatically update its published version. Use a fresh conversation when stale checkpoints or cached graph state could affect the result.

## Version Deliberately

Increment `team.version` for graph, role, prompt-contract, or dependency changes. Bump a package or manifest version only when the delivery mechanism's release policy requires it. Update node hashes only when the repository maintains them as explicit change markers.

## Completion Standard

Finish only when the applicable source DSL, built asset, loaded template, installed draft, published graph, execution tree, and persisted outputs tell the same story. Report any layer not exercised and preserve unrelated worktree changes.
