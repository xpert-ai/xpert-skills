# Primary Agent Middleware Defaults

## Scope

Apply this construction policy to the Agent identified by `team.agent.key` in every new Assistant DSL, including independent role Assistants and the Orchestrator. Apply it when upgrading template middleware composition, preserving compatible existing choices. Do not inject it into unrelated installed-Assistant edits or publish existing Assistants merely because this skill changed. Internal child Agents are not automatically covered; add capabilities through their own direct connections when needed.

## Baseline: Planning And Context Management

| Provider | Default | Purpose and configuration |
| --- | --- | --- |
| `todoListMiddleware` | Include once on each primary Agent. | Exposes `write_todos` and planning instructions. Use `options: {}` to retain the host prompt and tool description. The tool is available for multi-step work; simple questions do not require a plan or tool call. |
| `ContextCompressionMiddleware` | Include once unless an explicit, working context-management choice already covers this Agent. | Prunes old tool output and summarizes history when necessary. Initial options: `threshold: 0.7`, `preserveFraction: 0.3`, `enableTwoPhaseCompression: true`, `protectedUserTurns: 2`. These are the inspected host defaults, not accuracy guarantees or fixed budgets for every model. |

Context compression uses the runtime Agent model and its context metadata. Verify the actual model binding, usable context window, output budget, and summarization behavior. Do not invent a model context size. Recent-turn protection and summaries do not guarantee retention of every identifier or engineering fact: retrieve authoritative state before deciding or writing.

Keep one effective history-management strategy per Agent. An existing `SummarizationMiddleware` can satisfy the context default when its configuration and runtime behavior are verified. It requires an explicit `options.model`; configure and verify `trigger`/`keep` rather than assuming it inherits the primary model. Do not add both summarizers, or combine enabled legacy `team.summarize` with the baseline, without an intentional tested division of responsibility. New templates use `ContextCompressionMiddleware`; an upgrade must not silently replace a user's explicit summarization model.

These defaults help planning and context pressure. They do not provide business correctness, durable workflow completion, mutation authorization, or automatic recovery from stale revisions. A completed todo is not proof that a business artifact was saved or approved.

## Conditional Capabilities

| Capability | When to add it | Boundary |
| --- | --- | --- |
| `skillsMiddleware` | The Agent uses installed or contributed Skills. | Connect exactly one Skills middleware per consuming Agent. Bind template Skill dependencies to that Agent; verify the sandbox/file-reading capability needed to read the actual Skill. Keep `autoDiscovery.enabled` false unless automatic discovery/installation is part of the requested design. Do not populate reusable YAML with installed Skill IDs. |
| `XpertFileMemoryMiddleware` | Cross-session preferences or durable project knowledge are part of the product. | Requires the sandbox feature and verified user/project/Assistant scope. Do not treat recalled memory as current business state or introduce cross-session writeback without deciding the memory policy. |
| File understanding | The role needs document or image parsing. | Inspect `entity.options.fileUnderstanding` and host injection. The current host injects builtin `FileUnderstandingMiddleware` when structured output is off and `enabled` is not explicitly false. Do not manually duplicate a hidden node or assume setting `enabled: true` overrides the structured-output gate. |
| Sandbox file, shell, browser, connector, knowledge tools | Required by the role's actual workflow. | Use registered providers and scoped bindings. A planning default is not a reason to grant file writes, shell, browser, or external-system access. |
| `HumanInTheLoopMiddleware` | Specific tool calls require an interaction gate that the business workflow does not already provide. | Configure named tools and resume behavior. Do not add a blanket confirmation layer on top of existing domain approval gates. |
| `LLMToolSelector` | A measured large tool catalog needs selection. | Test that required context, recovery, finalize, and delegation tools remain reachable. Small fixed business toolsets should remain directly available. |
| `ralph-loop` | Explicitly designed conversation goals and bounded automatic continuations. | The inspected host describes this provider as a legacy goal alias. Recheck the current provider before use; define iteration/cost limits, cancellation, idempotency, and stop conditions. It is not a universal default or a repair for missing finalize calls. |

Retry and loop limits are separate runtime options, not middleware names to invent. Use the actual `copilotModel.options.maxRetries`, Agent retry options, and `team.agentConfig` contracts when needed. Model transport retry cannot repair an invalid business revision; replay of a mutation requires an idempotent service contract and refreshed authoritative context.

## DSL Wiring

The complete baseline is in [minimal-agent.yaml](../examples/minimal-agent.yaml). Represent each capability as a `type: workflow` node with `entity.type: middleware`, the exact case-sensitive provider, stable keys, and a direct `type: workflow` edge from the primary Agent.

- Set baseline middleware **`entity.required: true`** so runtime capability selection does not silently omit it. A connection's `required: true` is not a substitute: the runtime filter reads the middleware entity.
- Keep the connection required as well, and put middleware **node keys**, not provider names, in `entity.options.middlewares.order` on the Agent. The examples order compression before todo, then role-specific middleware; audit hook ordering if a custom middleware changes messages or tools.
- Preserve unrelated options, node identities, tool preferences, instance-owned model bindings, and domain middleware. Merge by normalized provider and inspect the Agent's existing direct connections; do not append duplicates on every regeneration.
- Inspect `meta.builtin` and runtime injection before adding any other provider. Being implemented in the host does not mean it is automatically injected; the two baseline providers currently require graph connections.
- Keep `write_todos` enabled when todo is part of the baseline. Required middleware loading does not undo per-tool disablement. Honor an explicit user choice to disable it and record that exception.
- Required flags do not grant organization or business permissions. The current middleware loader can warn and skip an unregistered provider, so a well-formed YAML file alone is insufficient evidence that the default ran.

For a generated suite, use one typed builder/helper for baseline nodes, edges, and order, then compose each role's own capabilities. Do not maintain separate baseline literals across contribution code and generated YAML. An equivalent configured summarizer or an unsupported host is a documented exception; a missing node with no explanation is not.

## Prompt And Completion Contract

Keep these rules in the role's own prompt/tool contracts; do not replace the platform todo prompt with a large application prompt:

- Track independent items separately. Preserve partial results and blockers while continuing work that does not depend on them.
- After a revision/context error, read current authoritative context, resolve the cause, and retry only the affected authorized step within a bounded recovery policy.
- Run the domain's required finish/validate/compile tools, then re-read persisted results before marking work complete. Do not infer completion from a successful sub-Agent call, a todo flag, or a narrative summary.
- Summarize at the authoritative business entity granularity. For multi-item work, read each item's current result; an empty legacy aggregate field is not evidence that item-level artifacts are missing.

## Verification

For a skill/documentation change, validate the example YAMLs and reference links without modifying installed Assistants. For a template implementation or authorized deployment, additionally verify:

1. Every independent Assistant has the baseline, or a stated equivalent/exception. Each connection and order entry resolves to the correct Agent/node; children have no accidental capability expansion.
2. Current host provider names, registration, option schemas, model prerequisites, required-node filtering, and builtin injection agree with the DSL. The generic DSL validator does not check these provider-specific conditions.
3. Generated source, packaged YAML, installed draft, and published graph agree. Preserve operational bindings and increment the template graph version when composition changes.
4. A short task can answer without unnecessary todos; a multi-step task can call `write_todos` and retain partial progress. Runtime selection does not hide required defaults, and no duplicate tool names appear.
5. A controlled long-context case triggers the chosen compression strategy, preserves valid tool-call/result pairing, and can re-read authoritative state and continue. A short successful run does not test compression.
6. An error/retry case refreshes revisions before mutation and reports actual persisted results after delegation. State exactly which runtime paths were exercised.

## Host Sources To Recheck

Paths are relative to the selected Xpert checkout. Provider details above were inspected on 2026-09-18; current source/installed versions take precedence.

- `packages/server-ai/src/xpert-middleware/todo-list.middleware.ts`
- `packages/server-ai/src/xpert-middleware/context-compression.middleware.ts`
- `packages/server-ai/src/xpert-middleware/summarization.middleware.ts`
- `packages/contracts/src/ai/middleware.model.ts` and `xpert-agent.model.ts`
- `packages/server-ai/src/shared/agent/middleware.ts`
- `packages/server-ai/src/xpert-agent/commands/handlers/subgraph.handler.ts`
- `packages/server-ai/src/skill-package/plugins/skills-middleware/index.ts`
- `packages/server-ai/src/file-memory/file-memory.middleware.ts`
- `packages/server-ai/src/xpert-middleware/ralph-loop.middleware.ts`
