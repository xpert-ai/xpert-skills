# MCP Service Configuration

Use this reference when a native MCP plugin needs connection settings, execution options, a configuration tab, or additional service detail Views. Pair it with [host-native MCP capabilities](host-native-mcp-capabilities.md); keep business-specific schemas and complete examples in plugin/product docs.

## Verify the target contract

Inspect the selected host, SDK and contracts versions before implementing. The target must support Provider `configSchema`, decorated `validateConfig()` forwarding, and Publication configuration management. Additional Views require the `mcp-publication` view host. Local source support does not prove that published packages or the deployed host include these capabilities. Report missing prerequisites rather than silently adding a separate configuration store, endpoint or host UI patch.

## Choose the configuration owner

| Declaration | Purpose and value source |
| --- | --- |
| Plugin-level `config.schema` | Installation-wide plugin settings; not each connection's configuration |
| `@XpertToolProvider({ configSchema })` | MCP service configuration form; values belong to the Publication's bound toolset instance |
| Middleware `meta.configSchema` | Agent middleware options, supplied through `context.middlewareOptions` |
| `@XpertTool({ inputSchema })` | Per-call business arguments supplied by the caller/model |

- Reuse a schema definition where the fields are genuinely shared, but keep the values and lifecycles separate. MCP execution reads the current binding through `context.host.credentials`; it does not inherit an Agent's middleware options.
- A Publication binding identifies the configurable instance. Two Publications sharing a toolset share its values; use separate instances when configuration must differ. Do not duplicate connection values onto the Publication or use singleton/global credentials as a default.
- Resolve configuration and authenticated runtime capabilities per invocation. Revalidate stored values at execution boundaries; scope any connection cache to the instance and effective configuration, and release acquired resources on failure or cancellation.

## Declare the host-rendered form

- Use the Provider's typed `configSchema` and existing platform form metadata for localized titles, field constraints, conditional visibility and remote options. Reuse the supported `x-ui` controls such as `remoteSelect` and `secretInput`; inspect contracts and renderer tests for their payload shapes instead of inventing keywords.
- The host takes the tab title from the schema title, falling back to the Provider label. It loads the bound instance's saved values on opening; a configuration tab is not a new-connection wizard or another Provider picker.
- Model connection choices with an explicit discriminator, such as `platform` / `manual`. Hidden fields are not validation or authorization. Validate the selected branch on the server, and do not silently switch modes when configuration fails.
- For platform data sources, use the existing `DataSourceRuntimeCapability.list/open` path under the current principal. Filter explicit engine/type fields, keep credentials in the host, and recheck access when opening; a dropdown choice is not an authorization grant. Manual connections use the selected driver's public factory and their own configured credentials.
- Implement `validateConfig(config)` on the decorated Provider for branch-specific and business validation before persistence. The host validates submitted values against the schema and forwards to this hook with restored secrets. Reject invalid input without echoing secret values. Keep execution-time parsing as well; UI defaults and a validator returning `void` do not automatically persist normalized/defaulted values.

## Preserve the host save contract

Use the host's configuration-management flow for the exact Publication and bound `toolsetId`. It returns `{ values, revision }` and accepts the same shape on save. Do not bypass the binding or write configuration records directly.

- Keep the loaded revision with the edited values. On `409`, reload and reconcile the edit; blind retries can overwrite another administrator's change.
- Treat secret placeholders as opaque, including references inside arrays. Return unchanged placeholders intact; replacement values update secrets, while an explicit empty string clears a value if validation permits it. Never reconstruct placeholders or expose restored secrets in responses, logs, tool schemas or View context.
- Preserve explicit `false`, `0`, empty strings and permitted `null` values. Avoid truthiness filters that turn deliberate values into omission.
- Separate MCP invocation permission from configuration management. The current host requires `SUPER_ADMIN` for these management routes, the owning tenant/organization management scope for values, and workspace write access for workspace-bound toolsets. Do not weaken these checks to make a shared MCP endpoint configurable by its consumers.

## Configuration tabs and additional Views

The host collects configuration tabs from all bound plugin toolsets with non-empty schema properties. Each tab edits its corresponding instance; source names distinguish multiple instances. An empty schema contributes no configuration tab.

For status, diagnostics or other content beyond a form, contribute a View to host type `mcp-publication`, slot `detail.main_tabs`. Match typed `pluginName`, `provider` and `toolsetId` in `mcpPublication.sources`; do not infer ownership from labels. View context contains source identity, not connection secrets. Keep permissions and business operations in authorized backend services.

A plugin with no configuration fields and no explicit View adds no plugin-specific tabs. Do not add empty forms or replace the default service tabs merely to advertise the plugin.

## Focused acceptance

Exercise the applicable paths with isolated instances and authorized fixtures:

- Existing values reopen correctly, mode-dependent controls and remote options work, and saving does not create another connection.
- Invalid configuration is rejected before persistence through the decorated Provider hook; secret preservation, explicit empty/false values and stale revisions behave as declared.
- A saved execution option changes the next MCP call's behavior; model arguments cannot override an administrator-enforced limit. Different instances and Agent middleware options remain isolated, including when configuration changes while a connection cache exists.
- Multiple bound sources produce the expected tabs; empty schemas add none; an explicit View uses the correct source context. Unauthorized management and cross-scope data-source access are denied.

Report schema/unit tests, lifecycle loading, host configuration save/read, and real MCP execution separately. Run UI acceptance only within the user's authorization; a build or `tools/list` result does not establish configuration persistence or execution behavior.

## Source pointers

Resolve these paths in the selected platform checkout and read adjacent tests when checking compatibility:

- `packages/plugin-sdk/src/lib/tool-provider/types.ts` and `adapters.ts`: Provider schema, validator hook and execution context adaptation.
- `packages/contracts/src/`: `JsonSchemaObjectType` and MCP configuration/source DTOs.
- `packages/server-ai/src/mcp-publication/configuration/`: management routes, binding/permission checks, secret restoration, revision checks and the View host definition.
- `apps/cloud/src/app/features/operations/mcp-publications/mcp-publication-plugin-tabs.ts` and `.html`: configuration/View tab composition, existing-value loading and the shared form renderer.
- Product docs: `ai/plugin/host-native-mcp-tools` and `ai/plugin/plugin-sdk/view-extension` under the selected language tree.
