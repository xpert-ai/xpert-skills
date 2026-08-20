# Xpert Assistant DSL Contracts

## Contents

- Artifact layers
- Core document contract
- Node and connection contract
- Agent hierarchy
- Programmatic specialist entrypoints
- Middleware and tool ownership
- Knowledge bindings
- Optional template contributions
- Prompt data contracts
- Structural tests
- Common failures

## Artifact Layers

Keep the applicable layers distinct:

1. Assistant source YAML.
2. Optional delivery metadata or template contribution.
3. Built or packaged YAML asset.
4. Loaded platform template descriptor.
5. Installed Assistant draft.
6. Published Assistant graph.
7. Runtime execution tree and persisted outputs.

A change in an earlier layer does not imply that later layers changed. Verify each boundary that exists in the target delivery path.

## Core Document Contract

An Agent-based Assistant normally declares a primary Agent plus graph nodes and connections:

```yaml
team:
  type: agent
  version: 1
  agent:
    key: Agent_Coordinator

nodes:
  - type: agent
    key: Agent_Coordinator
    entity:
      key: Agent_Coordinator

connections: []
```

Rules:

- Set `team.type` to the graph type expected by the current host schema.
- Point `team.agent.key` at an existing primary Agent node.
- Give every node a unique stable key.
- Use supported node and connection types from the current platform contracts.
- Increment `team.version` when the runtime graph contract changes.
- Keep reusable DSLs free of instance-owned resource identifiers.

Treat exported organization-bound YAML as an instance snapshot, not as reusable source, unless the repository explicitly owns that snapshot.

## Node And Connection Contract

Every connection must reference existing `from` and `to` node keys. Match the connection type to the nodes it joins.

Common relationships include:

- `agent`: parent-to-child delegation.
- `workflow`: Agent-to-middleware or other workflow capability.
- `knowledge`: Agent-to-knowledge-source binding.

Inspect the current host types before introducing an unfamiliar node or connection shape. Do not copy endpoint fields from a different platform version without validation.

## Agent Hierarchy

Minimal follower structure:

```yaml
team:
  type: agent
  version: 1
  agent:
    key: Agent_Coordinator
  agentConfig:
    mute:
      - - Agent_Retriever

nodes:
  - type: agent
    key: Agent_Coordinator
    entity:
      key: Agent_Coordinator

  - type: agent
    key: Agent_Worker
    entity:
      key: Agent_Worker
      leaderKey: Agent_Coordinator
      options:
        disableMessageHistory: true

  - type: agent
    key: Agent_Retriever
    entity:
      key: Agent_Retriever
      leaderKey: Agent_Worker
      options:
        disableMessageHistory: true

connections:
  - type: agent
    key: Agent_Coordinator/Agent_Worker
    from: Agent_Coordinator
    to: Agent_Worker
    required: true

  - type: agent
    key: Agent_Worker/Agent_Retriever
    from: Agent_Worker
    to: Agent_Retriever
    required: true
```

The parent edge and `leaderKey` are complementary. Omitting either can produce missing followers, invalid delegation targets, or an execution tree that differs from the visual graph.

Use stable conceptual Agent keys. Do not use a middleware tool name as an Agent node name. Avoid cycles and multiple incoming Agent edges unless the current runtime explicitly supports them.

Set `disableMessageHistory` according to the Agent's own cross-round memory contract. Prefer it for stateless Workers and specialists whose current invocation input is complete: on a new invocation round, the runtime omits that Agent's prior-round message list while retaining the messages needed for model/tool steps within the current round. The flag does not select, inherit, or suppress the parent Agent's message history; define parent-to-child context separately through task inputs, state variables, prompt templates, and graph connections.

Use mute paths for internal Agents whose streamed narration should be hidden. Muting does not remove the requirement for the child to return a compact result.

## Programmatic Specialist Entrypoints

An Agentic App may start a professional Agent directly through the platform `AssistantTaskRuntimeCapability`. Treat every such `agentKey` as a public runtime entrypoint, not an implementation detail.

Define entrypoints once in plugin code:

```ts
export const SPECIALIST_AGENT_KEYS = {
  interpretation: 'Agent_Interpretation',
  outline: 'Agent_Outline',
  authoring: 'Agent_Authoring'
} as const
```

For every entrypoint:

- Declare an Agent node with the exact key in the source DSL.
- Keep the node present in the built asset, installed draft, and published graph.
- Connect only the middleware, Skills, tools, and knowledge required by that role.
- Define structured parameters for authoritative IDs, expected revisions, and bounded collections.
- Make the prompt require controlled begin/append/finalize tools when the role creates revisioned data.
- Use a compact objective in the runtime prompt; do not encode identity or authority only in prose.
- Keep internal task narration muted when appropriate while preserving the execution tree and compact result.

A programmatic launch does not relax graph rules. If the specialist is also a follower, retain its `leaderKey` and incoming Agent connection. Do not create a second duplicate Agent node for background use, and do not give the coordinator the specialist's mutation tools merely to simplify routing.

Do not expose a generic Assistant Task launcher to the specialist itself. The deterministic application orchestrator owns stage transitions and starts bounded tasks; the specialist owns only its current domain mutation contract.

Changing an entrypoint key is a graph contract change. Increment `team.version`, update plugin launch registries and template Skill dependencies, publish a new graph, and migrate or reject queued tasks that still reference the old key.

Add a structural test that loads the same launch registry used by the application and asserts:

- every registered `agentKey` resolves to exactly one Agent node;
- each entrypoint owns the expected workflow connections and no privileged extras;
- every required Skill contribution targets an existing entrypoint;
- the built YAML contains the same entrypoint set as source;
- no queued mode/stage registry references an unknown Agent key.

## Middleware And Tool Ownership

Attach a middleware workflow node to the Agent that calls its tools:

```yaml
nodes:
  - type: workflow
    key: Middleware_Retrieval
    entity:
      type: middleware
      key: Middleware_Retrieval
      provider: CapabilityMiddleware
      tools:
        search_records: true
        publish_result: false

connections:
  - type: workflow
    key: Agent_Retriever/Middleware_Retrieval
    from: Agent_Retriever
    to: Middleware_Retrieval
    required: true
```

Restrict each Agent to the smallest tool set needed for its role:

| Role | Typical capabilities | Avoid |
|---|---|---|
| Coordinator | planning, delegation, reconciliation | repeated low-level retrieval |
| Worker | one-item processing, specialist delegation | unrelated domains or privileged actions |
| Retriever | one retrieval domain | mutations and unrelated searches |
| Validator or reviewer | checks defined by its contract | capabilities outside that contract |

Prompts should repeat these boundaries, but middleware exposure enforces them.

## Knowledge Bindings

Assume runtime knowledge scope comes from the Agent's direct knowledge connection. Parent and sibling connections are not inherited.

Reusable template:

```yaml
entity:
  knowledgebaseIds: []
```

Installed Assistant instance:

```yaml
nodes:
  - type: knowledge
    key: <knowledge-id>
    entity:
      id: <knowledge-id>
      name: <knowledge-name>

connections:
  - type: knowledge
    key: Agent_Retriever/<knowledge-id>
    from: Agent_Retriever
    to: <knowledge-id>
```

Bind instance-owned knowledge after import when the DSL is reusable. Keep the Agent entity's `knowledgebaseIds` aligned with its knowledge connections when the draft schema stores both.

## Optional Template Contributions

When a plugin or package distributes the Assistant, its contribution may declare target apps and dependencies:

```ts
const requiredPlugins = [
  RUNTIME_PLUGIN_NAME,
  CAPABILITY_PLUGIN_NAME
]

export const templates: XpertTemplateContribution[] = [{
  key: ASSISTANT_TEMPLATE_KEY,
  type: XpertTypeEnum.Agent,
  targetApps: ['xpert'],
  targetAppMeta: {
    xpert: {
      types: ['assistant-template'],
      capabilities: [ASSISTANT_CAPABILITY],
      requiredPlugins
    }
  },
  dependencies: {
    plugins: requiredPlugins,
    skills: [{
      pluginName: SKILL_OWNER_PLUGIN_NAME,
      componentKey: SKILL_COMPONENT_KEY,
      targetAgentKey: 'Agent_Coordinator'
    }]
  },
  dslContent: readDsl()
}]
```

Rules:

- Keep package names, runtime plugin names, constants, and `requiredPlugins` aligned.
- Declare `pluginName` for a Skill owned by another plugin.
- Point `targetAgentKey` at an Agent that exists in the DSL.
- Keep organization resource IDs out of the contribution.
- Copy the YAML into the build output when required and test source/build parity.

Skip this layer for Assistant DSLs that are imported or managed without a template contribution.

## Prompt Data Contracts

For a sub-Agent, distinguish the runtime tool's structured parameters from its free-text `input`. Correctness-critical fields belong in `entity.parameters`; the host converts them to the parent-visible tool schema and child state channels. The child prompt must reference those state values with the current template syntax.

```yaml
entity:
  prompt: |-
    Process Case {{caseId}} at revision {{expectedRevision}} for fields {{fieldKeys}}.
    Do not replace these values with IDs mentioned only in the free-text input.
  parameters:
    - type: string
      name: caseId
      description: Authoritative Case UUID.
      optional: false
      maximum: 36
    - type: number
      name: expectedRevision
      description: Revision returned by the latest Case read.
      optional: false
    - type: array[string]
      name: fieldKeys
      description: Bounded field keys assigned to this child.
      optional: false
```

The parent must still send the runtime-added `input` string, but it should contain only the objective and completion condition. Required parameter fields catch omissions and primitive type errors before child execution; server-side domain validation remains responsible for UUID ownership, freshness, writability, non-empty arrays, uniqueness, and cross-field constraints.

Use a compact task object:

```ts
type ItemTask = {
  itemId: string
  kind?: string
  attributes?: Record<string, unknown>
}
```

Use a compact result object:

```ts
type ItemResult = {
  itemId: string
  status: 'completed' | 'no_result' | 'blocked' | 'failed'
  artifactIds: string[]
  blockingReasons: string[]
  nextAction?: string
}
```

Adapt fields and statuses to the workflow, but keep the boundary explicit and bounded. Return artifact or evidence references instead of large raw payloads when persisted data can be addressed by ID.

Bind temporary candidate IDs to the item and retrieval snapshot that produced them. Do not reuse them after a new search or across unrelated items.

## Structural Tests

Parse YAML and assert objects. At minimum verify:

- exact Agent set and primary Agent;
- every programmatic specialist entrypoint and its expected least-privilege capability set;
- every child `leaderKey` and incoming Agent connection;
- no duplicate node keys, cycles, or dangling endpoints;
- required flags for mandatory followers;
- middleware connection ownership and enabled tool maps;
- history flags and mute paths;
- knowledge isolation and `knowledgebaseIds` consistency;
- template dependency ownership when contributions are present;
- absence of instance-owned IDs in reusable DSLs;
- deliberate `team.version` changes;
- source/build YAML parity when applicable.

Repository tests and current host contracts remain authoritative when they are stricter than the bundled validator.

## Common Failures

`Invalid node name ... in Send packet`:

- Confirm that the model addressed a connected follower Agent rather than a tool or middleware name.
- Check the direct Agent edge and the child's `leaderKey`.
- Update the parent prompt to name the child Agent role explicitly.

Child Agent does not execute:

- Check the Agent connection, `leaderKey`, parent prompt, follower availability, and `required` setting.

Child executes but a tool is absent:

- Check middleware node ownership, workflow connection, provider load state, and enabled tool map.

Child reports no knowledge access:

- Check the direct knowledge connection and runtime organization scope.
- Do not broaden another Agent's knowledge access merely to conceal a delegation error.

Skill dependency is missing during template installation:

- Declare the owner `pluginName`.
- Verify the component key and target Agent.
- Inspect Skill installation state separately from the Assistant graph.

Source changed but runtime behavior is old:

- Rebuild copied assets when applicable.
- Refresh the delivery source.
- Import or update the intended Assistant draft.
- Publish a new version.
- Start a fresh conversation to avoid stale checkpoints.
