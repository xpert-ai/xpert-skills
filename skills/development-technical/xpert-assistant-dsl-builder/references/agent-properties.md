# Agent, Node, And Connection Properties

## Agent Node

An Agent node has `type`, `key`, `position`, optional `size/hash/parentId/readonly`, and `entity`. Its reusable public Agent entity surface is:

| `entity` property | Type / use |
|---|---|
| `key` | Stable Agent key; must equal the node key. |
| `name` | Stable Agent name. |
| `title`, `description`, `avatar` | Human-facing role identity. |
| `prompt` | System/role contract. |
| `promptTemplates` | Ordered AI/human prompt templates (`id`, `role`, `text`). |
| `parameters` | Structured task inputs. |
| `outputVariables` | Structured output-to-state assignments. |
| `options` | Runtime behavior described below. |
| `copilotModel` | Agent-specific model override; null inherits the team model. |
| `leaderKey` | Direct parent Agent key for a child. |
| `collaboratorNames` | External collaborator names when explicitly used. |
| `toolsetIds` | Toolset IDs mirrored by toolset connections where required. |
| `knowledgebaseIds` | Knowledge IDs mirrored by knowledge connections where required. |

## Agent Parameters

Each parameter uses `type`, `name`, and optional `title`, `description`, `optional`, `default`, `maximum`, `options`, and nested `item` fields. Supported types are `string`, `number`, `object`, `select`, `file`, `array[string]`, `array[number]`, `array[object]`, `array[file]`, `array[document]`, `boolean`, and `secret`; `text` and `paragraph` are deprecated aliases.

Use parameters for authoritative IDs, revisions, operation IDs, bounded lists, and other fields whose omission changes correctness. Refer to them in the prompt with the runtime's variable syntax. Keep the free-text task input concise.

## `entity.options`

- `hidden`: hide the Agent node from the visual graph.
- `disableMessageHistory`: omit this Agent's earlier-round history on a new invocation.
- `historyVariable`: state variable used for message history.
- `memories`: output/state assignments.
- `parallelToolCalls`: enable or disable parallel tool calls.
- `retry`: `enabled` and `stopAfterAttempt`.
- `fallback`: `enabled` and fallback `copilotModel`.
- `errorHandling`: platform error strategy.
- `recall`: knowledge recall defaults.
- `availableTools`: provider/tool allowlist.
- `tools`: per-tool timeout.
- `structuredOutputMethod`: `functionCalling`, `jsonMode`, `jsonSchema`, or a supported provider value.
- `attachment`: Agent file/image attachment settings (`enabled`, `variable`, `resolution`, `maxNum`).
- `fileUnderstanding`: built-in file-understanding enablement.
- `middlewares.order`: deterministic middleware order.

The deprecated `vision` property should not be introduced in new templates.

## Other Node Types

The current graph node types are `agent`, `knowledge`, `toolset`, `xpert`, and `workflow`. The node's `entity` shape comes from its provider contract. A middleware is normally a `workflow` node whose entity declares `type: middleware`, a stable key, provider, options, and optional tool enablement map.

Do not copy an organization-bound knowledge or toolset entity into a reusable source. Bind instance-owned resources after installation.

## Connections

Every connection declares `key`, `from`, `to`, `type`, and optional `required` and `readonly`.

- `type: agent`: parent-to-child delegation; align child `leaderKey` with `from`.
- `type: workflow`: Agent-to-middleware/workflow capability.
- `type: knowledge`: Agent-to-knowledge binding.
- `type: toolset`: Agent-to-toolset binding when used by the host.
- `type: xpert`: Agent/team collaboration when explicitly supported.
- `type: edge`: horizontal workflow edge.

Every endpoint must exist. Child Agents should normally have exactly one incoming Agent edge. Keep connections acyclic unless a current runtime contract explicitly supports a loop.
