# MCP Apps and Plugin-Managed MCP

MCP Apps work with native Providers and portable stdio servers. Use [host-native-mcp-capabilities.md](host-native-mcp-capabilities.md) for native declarations and Publication synchronization; use stdio only when a separate portable runtime is needed.

## App essentials

- An App is a `ui://` HTML Resource with MIME `text/html;profile=mcp-app`, not another Tool. Tool `_meta.ui` owns `resourceUri`/visibility; Resource `_meta.ui` owns display metadata, CSP, and permissions.
- Keep Tool results as compact `structuredContent` DTOs plus text fallback. Use `['model', 'app']` for shared Tools and `['app']` for iframe-only Tools; policy still applies.
- Keep HTML/TS/CSS as frontend source and bundle during the plugin build. Verify assets in the actual package; do not maintain large HTML strings in business handlers or persist raw HTML in chat history.
- Use the standard MCP Apps bridge, not `window.openai`: initialize, receive Tool input/result, and invoke permitted tools/resources through the host. `ui/notifications/tool-result` params are the `CallToolResult` itself, not `params.result`.
- The iframe receives business DTOs, not API keys, host paths, scope credentials, or private API endpoints. CSP is deny-by-default. ChatKit's `appInstanceToken` belongs in host-side requests, not App code; native external clients use Publication authentication.
- Localize from host language context and style with public `--mcp-app-*` variables. Do not depend on ChatKit-private CSS. Use business-semantic chart colors when UI theme colors are insufficient.
- Tolerate missing/truncated historical results with a rerun or bounded read. Verify initialization, result delivery, permitted interaction, resizing, locale/theme, and non-App text fallback; protocol success alone does not prove rendering.

## Stdio-specific essentials

- Declare the server in manifest `mcpServers`; use `${PLUGIN_ROOT}` for executable assets and `${PLUGIN_DATA}` for writable state. Include the server entry, App assets, and direct runtime dependencies in the package.
- Prefer the installed MCP SDK and `@modelcontextprotocol/ext-apps` helpers (`registerAppTool`, `registerAppResource`, `RESOURCE_MIME_TYPE`); check version/module compatibility in their types. Do not copy a pinned tutorial dependency set blindly.
- stdout is protocol-only; diagnostics go to stderr. Installation is not process startup: Xpert starts managed stdio at Toolset initialization and owns policy, isolation, timeouts, and cleanup.
- Production runtime is fail-closed. Respect `XPERT_MCP_STDIO_RUNTIME_ENABLED`, command policy, and host cleanup; do not bypass them or enable init scripts without authorization.
- Validate built-server startup, Tool discovery/calls, App resource reads, policy denial, and cleanup in the installed runtime. Source rebuilds alone do not refresh the installed copy.

## Lookup and diagnosis

- Host source: `packages/server-ai/src/xpert-toolset/provider/mcp/`, `xpert-toolset/mcp-apps.service.ts`, and `mcp-app-runtime/` beneath the same server `src` root.
- Product docs: `ai/plugin/mcp-tools-and-apps`, `ai/chatkit/chatkit-mcp-apps`, and `ai/tutorial/echarts-mcp-app` in the documentation repository's language tree.
- Missing App: distinguish Tool count from App count, then check URI/binding, deployed HTML, and Resource scopes. App calls denied: check app visibility and policy. Stale paths: fix manifest placeholders and refresh the runtime copy, not arbitrary filesystem aliases.
