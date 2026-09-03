# Decorator-Driven Host-Native MCP Capabilities

Use this reference when an Xpert plugin should define business Tools once and expose them as Agent Middleware Tools, host-native MCP Tools, or both. Xpert owns discovery, adaptation, Publication, Streamable HTTP, authentication, policy, audit, and enable/disable; the plugin does not create a stdio server.

## Choose the surface

| Surface                  | Choose it when                                                                                                      | Runtime and identity                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Agent middleware         | The operation belongs to an Agent turn, needs Agent/Workbench behavior, or is not intended for external MCP clients | Xpert Agent runtime supplies middleware context; `wrapToolCall` may add Agent progress events    |
| Host-native MCP          | Xpert should discover, authorize, publish, audit, and execute an existing plugin capability in-process              | Xpert supplies authenticated `ToolExecutionContext` for every call and owns the MCP endpoint     |
| Plugin-managed stdio MCP | The server must be portable across MCP hosts, own a separate process/runtime, or serve an MCP App bundle            | The plugin owns MCP server startup and transport; the host controls the installed process policy |

Do not create a stdio server merely to make an existing Xpert service MCP-callable. Do not choose host-native MCP when portability or a plugin-owned MCP runtime is the requirement.

## Preferred provider contract

Register one injectable business class in the plugin Nest module. The class decorator defines the independent server identity and its Agent Middleware groups; each method decorator defines a single Tool contract:

```ts
@XpertToolProvider({
  provider: "order_ops",
  componentKey: "order-operations",
  name: "Order Operations",
  description: "Inspect and update governed orders.",
  instructions: "Use reads before proposing a mutation.",
  defaultMiddleware: "OrderCoordinationMiddleware",
  middlewares: [
    { provider: "OrderCoordinationMiddleware", meta: coordinationMeta },
    { provider: "OrderMonitoringMiddleware", meta: monitoringMeta },
  ],
})
export class OrderOperationsTools {
  constructor(private readonly service: OrderService) {}

  @XpertTool({
    name: "orders_search",
    description: "Search governed orders in the active organization.",
    inputSchema: searchOrdersSchema,
    outputSchema: searchOrdersResultSchema,
    middleware: true,
    mcp: {
      behavior: { risk: "read", sideEffect: "none", idempotency: "safe" },
      requiredContext: ["tenant", "organization", "principal", "execution"],
      visibility: ["model"],
    },
  })
  async search(input: SearchOrdersInput, context: XpertBusinessToolContext) {
    return this.service.search(toOrderScope(context), input);
  }
}
```

`middleware: true` selects the class default, a provider string selects a declared group, and `false` disables Middleware exposure. `mcp` is explicit opt-in; omit it or set it to `false` for Middleware-only methods. Set `middleware: false` for MCP-only methods. Every MCP method must provide strict Zod input and output object schemas, behavior, required context, and deliberate visibility. Do not infer a protocol schema from TypeScript design metadata.

Business methods return ordinary allowlisted DTOs. The host validates the output schema, converts the DTO to compact JSON text for Agent Tools, and returns a short text fallback plus the identical DTO as MCP `structuredContent`. Throw the original typed business error so error codes, idempotency receipts, and revision conflicts retain their established semantics.

The class may implement `getMiddlewareExtensions(provider, options, context)` for Agent-only lifecycle hooks such as `wrapToolCall`. Do not put business correctness in those hooks.

The decorators are exported by `@xpert-ai/plugin-sdk` beginning with the native Provider-capable SDK line. Keep `@xpert-ai/plugin-sdk` and `@xpert-ai/contracts` on compatible versions; `3.17.5` is the minimum for this contract. `@XpertToolProvider()` makes the class injectable, but Nest still discovers only registered Providers. Add the class once to the plugin module rather than registering separate Middleware and Toolset classes:

```ts
@XpertServerPlugin({
  providers: [OrderService, OrderOperationsTools],
  exports: [OrderOperationsTools],
})
export class OrderOperationsPlugin {}
```

Export the Provider class from the plugin package only when tests or another plugin-owned module need it. Runtime discovery depends on Nest registration and decorator metadata, not on a package export.

## Authoring workflow

1. Define stable constants for the Provider key, component key, Middleware group keys, and Tool names. The host owns the public Publication slug.
2. Put persistence, authorization, idempotency, revision checks, and DTO mapping in a typed domain service.
3. Define strict Zod v3 input and output object schemas. MCP methods require both; the root and interpreted nested objects must reject unknown keys.
4. Decorate one injectable business class with `@XpertToolProvider()`. Treat one class as one independently managed MCP Server. A plugin may register multiple classes when it needs multiple independently managed servers; Middleware groups inside one class do not create additional servers.
5. Decorate each bounded business method with `@XpertTool()`. Select `middleware: true`, a declared Middleware key, or `false`; opt into MCP explicitly with `mcp`.
6. Add the class once to the plugin Nest module `providers` and build the plugin. Do not create a stdio entrypoint, a second Toolset aggregate, or discovery-time placeholder identity.
7. If Marketplace presentation is needed, advertise an `mcp` contribution whose `name` matches `componentKey` and whose metadata identifies `protocol: 'native'` plus the same Provider key. Do not add a manifest `toolsets` execution definition for a decorator-driven Provider.
8. Verify descriptor discovery, Middleware grouping, MCP definitions, call-time context isolation, DTO output, package contents, and an installed protocol call.

An optional static Marketplace contribution looks like this:

```ts
{
  type: 'mcp',
  name: 'order-operations',
  displayName: { en_US: 'Order Operations MCP', zh_Hans: '订单运营 MCP' },
  description: {
    en_US: 'Governed order tools published by Xpert.',
    zh_Hans: '由 Xpert 发布的受控订单工具。'
  },
  metadata: { protocol: 'native', provider: 'order_ops' }
}
```

This contribution is descriptive. The runtime Provider descriptor remains authoritative for schemas, handlers, behavior, context, and Tool count.

Register one contribution per Provider when a plugin exposes multiple MCP Servers. Each contribution must align with that Provider's `componentKey` and `provider`; do not aggregate multiple Provider identities into one marketplace contribution.

## Runtime registration chain

The plugin loader registers the business class once. The host provider coordinator validates it and atomically expands it into:

1. one native Toolset strategy under the class `provider` key;
2. one Agent Middleware strategy for every used declared group;
3. native Tool definitions returned by `getMcpCapabilityDefinitions()`;
4. one runtime-discovered virtual `TOOLSET` component under `componentKey`.

Registration must track plugin provenance so uninstall removes every derived strategy. Validate provider/component/Middleware/Tool key conflicts before replacing any existing registration; an invalid new Provider must not evict the last valid one. The runtime decorator descriptor is authoritative for execution. A same-key manifest `toolsets` entry may provide static marketplace presentation, but it is optional and must never override runtime schemas or handlers.

Use one stable constant per provider, component, group, and Tool when practical. A class corresponds to one independently managed MCP Server. Split unrelated security/lifecycle domains into separate Provider classes instead of one oversized server. The host derives the stable Publication slug from plugin `artifactNamespace`, Provider key, and owning scope. Treat the decorator's legacy `slug` field as deprecated display compatibility only; never put a client brand in it or depend on it as the endpoint.

Use a hand-written `ToolsetStrategy` and `BuiltinToolset.getMcpCapabilityDefinitions()` only when exposing Resources, Resource Templates, Prompts, Tasks, Apps, or custom lifecycle behavior that the Tool decorators cannot represent. In that advanced path, keep `BuiltinToolset.tools` empty for MCP-only definitions and explicitly align manifest/marketplace metadata if static discovery is required.

The installed `@xpert-ai/plugin-sdk` and `@xpert-ai/contracts` must expose the native definition and execution-context contracts used by the implementation. Raise both peer minimums and development versions together, refresh the owning workspace lockfile, and verify compatibility with the selected host checkout. Do not raise the plugin business version unless the release decision requires it.

## Share behavior without weakening boundaries

Prefer a decorated business method backed by a typed domain service. Do not copy persistence logic, authorization checks, idempotency, revision handling, or DTO mapping into surface-specific handlers.

Accept `XpertBusinessToolContext` as the second method parameter. It identifies the invocation surface and carries tenant, organization, principal, workspace/project, conversation/thread, Xpert/Agent, execution/request/trace, abort signal, and the bounded host API. The adapter constructs it for every call. Never capture discovery-time identity, store a context on the Provider singleton, or authorize from a cached value.

Keep tenant, organization, user, credentials, and other security fields out of model input. Require the corresponding MCP context capabilities and let the host reject calls that cannot provide them. Scope and authorize again in the shared service.

## Tool definitions

For every model-visible Tool:

1. expose the real strict Zod input schema and actionable validation errors;
2. opt in deliberately with `mcp`; the decorator adapter emits MCP eligibility, while hand-written definitions must set `exposure.mcp.eligible` themselves;
3. declare required context and visibility explicitly;
4. annotate behavior accurately as read/write/dangerous, none/reversible/irreversible, and safe/idempotent/non-idempotent;
5. preserve service error codes, optimistic-concurrency conflicts, and idempotency semantics;
6. map an allowlisted DTO to `structuredContent` and keep text `content` to a concise fallback summary.

Do not expose a Resource, Prompt, Task, or App just because the SDK supports it. Add each only when its MCP semantics improve the external contract. Never turn approval, publication, payment, destructive execution, or another human-governed transition into a Tool unless that exposure and its confirmation policy are explicitly authorized.

## `wrapToolCall` is not an execution guarantee

Calling the extracted structured Tool directly does not automatically run the middleware object's `wrapToolCall`. Therefore:

- business-critical validation, authorization, revision checks, persistence, idempotency, and audit must live in the shared Tool handler or domain service;
- Agent-specific progress events emitted by `wrapToolCall` are observational and are not a guarantee of native MCP execution;
- if MCP requires its own progress/event behavior, implement it explicitly with the host MCP event API without coupling correctness to event delivery.

Test this boundary rather than assuming middleware assembly behavior applies to direct Tool invocation.

## Enable, synchronize, and disable

The underlying lifecycle stages remain independent and observable:

1. **Plugin deployed and running:** the host discovers the decorated Provider; a staged descriptor alone is not runtime evidence.
2. **Scope-owned Toolset installed:** the host materializes the Provider in the ownership scope determined by plugin level.
3. **Capability catalog current:** the host refreshes and validates descriptors plus provenance.
4. **MCP Publication active:** a stable-slug Publication binds the Provider's MCP Tools and serves Streamable HTTP under Publication policy.
5. **API key usable:** a least-privilege key grants `tools:list` and `tools:call`; its secret is returned only when newly created.

The plugin resource enable action may orchestrate all five stages idempotently. Persist the Toolset ID, Publication ID, definition hash, ownership scope, and desired state in the plugin resource installation record; never persist the API-key secret there. Display the endpoint and a generic MCP client configuration immediately, and display a secret only in the one response that creates it. Re-enable may reuse an active, unrevoked key without revealing its secret again.

Access is always controlled for the requesting organization, while Publication ownership follows plugin level:

| Plugin level         | Managed ownership                                            | Required isolation                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `system` or `tenant` | One tenant-scoped Toolset and Publication per Provider       | Maintain an independent organization access grant and organization-bound API key. Disabling one organization removes only that grant; the shared Publication may remain active for others. |
| `organization`       | One organization-scoped Toolset and Publication per Provider | Enable and disable the organization's Publication directly.                                                                                                                                |

Enabling a Provider in organization A must never admit organization B. If A and B both enable a tenant/system Provider, they may share the same tenant-owned endpoint, catalog, bindings, and capability policies, but every request must resolve an organization-bound credential and principal before execution. Key scopes may further restrict each credential. Test admission state, key lookup, shared policy enforcement, audit ownership, and business queries across two organizations; do not mistake shared Publication ownership for shared authorization.

In the product UI, keep the installed plugin card's single initialization entry and open the plugin marketplace detail dialog. Render every runtime Provider as a separate MCP card with its own status, Tool count, enable/disable action, endpoint, one-time secret notice, and generic client configuration. Do not add a sibling “Manage MCP” button or send runtime-native Providers through the generic workspace/Xpert resource installer. The corresponding Publication appears as a separate card under MCP services after materialization; it must not appear under Runtime instances because no child process exists. An advanced-settings action, when available for the current ownership scope, may deep-link to Publication management. Only super administrators may enable or disable a Provider.

Keep application contributions separate: an application's detail action navigates to its application catalog page, while Provider enablement remains inside the plugin detail MCP section.

Keep the generated configuration client-neutral. Use the stable Provider key as the local server name and an environment-variable placeholder for the secret; never couple plugin code, Publication slugs, UI labels, or documentation to a particular MCP client:

```json
{
  "mcpServers": {
    "order_ops": {
      "type": "streamableHttp",
      "url": "https://<xpert-host>/api/mcp/p/order-operations-mcp",
      "headers": {
        "Authorization": "Bearer ${XPERT_MCP_API_KEY}"
      }
    }
  }
}
```

After a plugin refresh, synchronize every enabled auto-managed Publication atomically: retain same-key public names, enabled states, and administrator policy overrides; add new Tools enabled; remove deleted Tools; refresh changed descriptors/schemas. Defaults are read=`allow`, write=`confirm`, dangerous=`deny`. If synchronization fails, keep the last valid catalog/bindings and report the failure in resource state rather than committing half a configuration. For a tenant-owned Publication, reconcile the shared catalog without collapsing organization admission state.

Explicit plugin disable or uninstall disables the associated Publication but retains installation history, keys, and audit. A normal version refresh retains desired enabled state and synchronizes in place. Disabling a Publication makes its keys unusable for that endpoint without silently revoking them. Advanced policy, key rotation, and audit remain owned by MCP Publication management.

Keep deployment receipts and connection examples secret-free. Use an environment placeholder such as `${XPERT_MCP_API_KEY}` in checked-in MCP client JSON.

## Verification checklist

### Unit and contract

- Every intended capability is declared exactly once; names equal the canonical business Tool constants. Multiple Providers from one plugin have distinct provider/component identities and remain independently manageable.
- Read/write behavior, idempotency, side effects, required context, and model/app visibility are correct.
- Schemas reject unknown fields, model-supplied scope, invalid identifiers, oversized collections, and invalid revisions.
- Execution uses the call-time principal and organization, never discovery placeholders.
- JSON results produce stable `structuredContent`; text fallback stays compact and DTOs omit scope, internal paths, raw entities, secrets, and provider payloads.
- Governed operations intentionally excluded from MCP stay absent.

### Build and package

- Unit tests, typecheck, integration/E2E tests, build, `verify:dist`, and package dry-run pass.
- `verify:dist` checks emitted decorated Provider/adapters and runtime metadata. If a manifest also advertises the Provider, verify its provider/component identity aligns with runtime authority.
- The plugin lifecycle harness loads the built entrypoint and completes register/start/stop without host-private imports.

### Installed runtime and MCP protocol

- Reinspect platform provenance and health before deployment; preserve unrelated host changes.
- Deploy or refresh at the plugin-declared scope. If restart is required, restart only the proven API process and recheck health/provenance.
- Enable the intended runtime Provider from plugin details and confirm the resulting scope-owned Toolset descriptor count, names, annotations, plugin provenance, Publication ownership, and current-organization admission state.
- For tenant/system Providers, verify that organization A enable/disable does not change organization B access and that an A-bound key cannot authenticate as B. For organization Providers, verify separate Publication ownership.
- Complete `initialize`, `tools/list`, and one read-only `tools/call` through the managed endpoint using an in-memory least-privilege API key.
- Verify `structuredContent`, expected business behavior, Publication state, and protocol audit. For a temporary acceptance Provider, disable it and rotate/revoke the temporary key through management APIs; for a user-requested live Provider, leave it enabled and return only a secret-free client configuration.
