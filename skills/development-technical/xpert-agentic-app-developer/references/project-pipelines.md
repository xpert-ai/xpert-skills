# Project Pipelines

Use Xpert's public Project Pipelines as the execution and presentation foundation. This reference identifies the important design points; research exact APIs, schemas, lifecycle behavior, and tests in the selected platform source before implementation. Do not treat example Apps or remembered DTOs as the current contract.

## Ownership and Defaults

- **Platform:** pipeline definitions/bindings, instances, runs, rounds, dispatch, retries, cancellation, human waiting, execution history, and the built-in Project Tasks pipeline View.
- **Plugin:** business Cases, artifacts, domain transitions, authorization, approval rules, immutable evidence, and business workspaces. Runtime success is not business acceptance.
- Default to `executionAuthority: platform`. Do not add a plugin scheduler, continuation worker, execution-history store, or custom pipeline swimlane for capabilities already provided by the platform. Business acceptance receipts and external-effect outboxes may still be needed.
- Use `provider` only when an existing external system must remain the execution authority. Do not choose it merely to preserve an obsolete plugin implementation.
- A management dashboard, Orchestrator Assistant, or custom business View is optional and driven by product needs. An Orchestrator must not become a second scheduler. External Xpert connections are relevant to actual delegation/provisioning contracts, not a universal prerequisite for platform dispatch.

## Key Integration Points

1. **Process and configuration.** Identify the business subject, versioned inputs, roles, artifacts, completion facts, branches, and human gates. Register a `ProjectPipelineContributor` with immutable template versions, explicit Project types, bindings, and descriptors. Use the public configuration schema and checker; do not invent a parallel flow DSL or blueprint validator.
2. **Project and role identity.** Preserve the Case–Project mapping and provision through `ProjectProvisioningRuntimeCapability` when needed. Match explicit `assistantBindings` to portable role expectations and verify Project membership; never infer roles from names or array order. Bind authorized published Assistants to executor slots. Separate role Assistants where authority requires it; internal sub-Agents are implementation details.
3. **Domain adapters.** Implement only the required subject, schema, evidence, operation, policy, and completion adapters. Assistant operations use `prepare/collect`; the platform dispatches the execution. Service operations use durable idempotency and `execute/inspect`. Keep reads and policy evaluation free of business side effects; inspect uncertain external outcomes before replay.
4. **Acceptance and evidence.** Bind business finalization to the exact platform work identity, executor, input digest, generation, and business revision. Reject stale, cancelled, superseded, or mismatched work. Return immutable, authorized evidence after business acceptance; keep platform runtime status separate from domain completion.
5. **Human authority.** Preserve existing approval rules using native human gates and the current decision contract. Revalidate the actor and exact proposal version. Where approval must update business records, consume persisted decision evidence through an idempotent domain operation. Agents cannot approve themselves.
6. **Commands and rounds.** Use `ProjectPipelineCommandsRuntimeCapability` for configure/start/decide/retry/cancel/nextRound and `ProjectPipelinesRuntimeCapability` for reads. Technical retries stay within the round; genuinely changed source input drives a new round. Status/output/approval changes are not new source versions. Preserve historical ownership instead of reassigning old attempts to current nodes.
7. **Navigation and Views.** Reuse `platform.project-tasks__timeline` with `initialTab: pipeline` through `workbench.navigation.open`. Use `assistant.project` to select the correct Project and View together. Resolve business entry through the subject adapter's `resolveEntry`; preserve instance/round/node context across business Views and clear stale context on Case changes. Use public execution navigation with exact handles. Do not add a bridge to the platform Project management page for this flow.
8. **Business UI.** Keep Case/evidence/approval workspaces and useful domain dashboards. Use current shared or official shadcn components, theme variables, and host i18n; avoid custom overrides of component defaults. Pipeline graphs, execution dialogs, and round controls remain platform-owned.

## Contract Lookup

Search the selected platform/SDK source by symbol, then follow implementations, callers, and tests. Do not couple this guidance to repository file locations. Check installed versions before relying on a source contract.

| Topic | Search symbols |
| --- | --- |
| Configuration and registration | `ProjectPipelineContributor`, `projectPipelineConfigurationSchema`, `ProjectPipelineConfigurationRuntimeCapability` |
| Runtime adapters | `ProjectPipelineRuntimeAdapterProvider`, `ProjectPipelineAssistantOperation`, `ProjectPipelineNodeHandler`, `ProjectPipelinePolicyEvaluator` |
| Subjects, evidence, completion | `ProjectPipelineSubjectResolver`, `ProjectPipelineEvidenceResolver`, `ProjectPipelineCompletionEvaluator`, `ProjectPipelineWorkContext` |
| Project identity and commands | `ProjectProvisioningRuntimeCapability`, `ProjectEnsureResult`, `ProjectAssistantBinding`, `ProjectPipelineCommandsRuntimeCapability`, `ProjectPipelinesRuntimeCapability` |
| Navigation | `WorkbenchNavigationOpenPayload`, `resolveEntry`, `workbench.navigation.open`, `platform.project-tasks__timeline` |
| Existing App examples, when available | `FactoryPipelineContribution`, `MaterialPipelineContribution` |

Use released public SDK/contracts in plugins. A source-only API does not prove the installed host supports it; align dependencies and report missing capability support instead of adding speculative compatibility casts or importing another checkout's internals.

## Migration and Verification

When replacing a plugin-owned pipeline, remove superseded scheduling and pipeline View registrations, actions, assets, navigation, and documentation together. Preserve business services, approval semantics, Case/Project identities, and persisted history. Do not turn code cleanup into a data reset.

Validate the affected contracts and end-to-end path: configuration, actual business finalization, approval/rejection, duplicate requests, stale input, retry/cancel, cross-scope access, historical rounds, and exact business/execution navigation. Use existing platform and App tests rather than reimplementing platform behavior. Distinguish fixture tests from real installed-host execution, and simulation from external-system confirmation.

Update the App's existing product documentation. Report what changed, validation performed, and unverified layers; build, plugin loading, Assistant publication, and end-to-end acceptance are separate results.
