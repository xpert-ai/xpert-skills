# Team Properties

`team` is the Assistant-level record serialized by `XpertDslDTO`. Unknown fields may be dropped during export/import, so do not invent sibling properties.

## Public Team Surface

| YAML path | Type | Purpose / destination |
|---|---|---|
| `team.name` | string | Stable Assistant name; plugin templates normally align it with the template key. |
| `team.type` | `agent` | Assistant graph type for Agent Assistants. |
| `team.title` | string | Display title copied to the installed/published Assistant. |
| `team.description` | string | Assistant description. |
| `team.avatar` | avatar object | Assistant avatar; align with the contribution and primary Agent when intended. |
| `team.options` | object | Template source, workspace, Workbench, canvas, and extension metadata. |
| `team.agentConfig` | object | LangGraph execution and state configuration. |
| `team.memory` | object or null | Long-term profile/Q&A memory configuration. |
| `team.summarize` | object or null | Conversation summarization configuration. |
| `team.features` | object | Studio 功能 configuration; see `features-and-ui-mapping.md`. |
| `team.version` | string | Source graph contract version. Increment deliberately. |
| `team.agent.key` | string | Primary Agent node key. |
| `team.copilotModel` | model or null | Default model binding or reusable model descriptor. |
| `team.knowledgebases` | array | Serialized knowledge definitions; normally empty in reusable templates. |
| `team.toolsets` | array | Serialized toolsets. |
| `team.tags` | array | Assistant tags. |

The document root also contains `nodes`, `connections`, and optional `memories`.

## `team.options`

Current canonical properties include:

- `workspaceScope.mode`: `project-required` or `project-preferred`.
- `templateKey`: legacy plugin template key.
- `dataXpert`: legacy/open application metadata; `requiredPlugin` and `requiredPlugins` are recognized, other keys are application-defined.
- `templateSource`: canonical source used by Studio update-from-template.
- `bootstrap`: canonical template bootstrap (`source`, `templateKey`, `workspaceKind`). Older application installers may still consume a legacy shape; verify the target app before changing it.
- `workbench`: Workbench configuration owned by the current contracts.
- `knowledge`, `toolset`, `agent`, `xpert`: canvas positions/sizes by node key.
- `position`, `scale`: graph canvas viewport.

Treat application-specific keys under `dataXpert` as an integration contract and cover them with application tests.

## `team.agentConfig`

| Property | Purpose |
|---|---|
| `recursionLimit` | Maximum graph recursion count; defaults to the platform value. |
| `maxConcurrency` | Parallel call limit. |
| `timeout` | Execution timeout in milliseconds. |
| `interruptBefore` | Sensitive tools/Agents requiring interruption. |
| `endNodes` | Explicit graph end nodes. |
| `stateVariables` | Custom graph state variables. |
| `parameters` | Graph input parameters; align with the start/primary Agent contract. |
| `mute` | Agent path arrays whose streamed messages are hidden. |
| `recalls` / `retrievals` | Per-knowledge recall and retrieval settings. |
| `tools` | Per-tool memory assignment, timeout, description, and parameter overrides. |

`toolsMemory` and `disableOutputs` are deprecated. Do not introduce them in new templates.

## Model, Memory, And Summarization

`team.copilotModel` may contain `copilot`, `copilotId`, `referencedId`, `modelType`, `model`, and provider-specific `options`. Reusable templates should avoid organization-owned IDs unless the delivery contract explicitly owns that binding.

`team.memory` supports `enabled`, an optional `copilotModel`, `profile` (`enabled`, `prompt`, `afterSeconds`), and `qa` (`enabled`, `prompt`).

`team.summarize` supports `enabled`, `prompt`, `maxMessages`, and `retainMessages`. Keep `retainMessages < maxMessages` when both are set.

## Cross-Layer Identity Test

Generated plugin templates should parse their own `dslContent` and assert equality for key, title, description, avatar, enabled opener questions, primary Agent key, dependencies, and version. Test parsed objects, not YAML string fragments.
