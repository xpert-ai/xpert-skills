# Workspace Connectors

## Ownership and responsibilities

The workspace owns connection configuration and credentials, and workspace administrators authorize connections. Users with Assistant access consume authorized resources through that Assistant. Do not introduce separate user ownership of Connectors. A provider token representing a personal account does not require a personal Xpert connection: the administrator still configures that identity within the workspace.

Connectors handle authorization, renewal, revocation, and credential resolution. Agent Plugins declare capabilities and dependencies. Credential-only Connectors use `runtimeUsage: 'credential'` and should not also appear as middleware capabilities. A package may depend on multiple MCP servers/Connectors, and multiple resources may reuse a suitable shared connection.

## Path A: Generic MCP OAuth without provider-specific code

Place declarations in `extensions["cn.xpertai"].connectors`, with keys exactly matching the corresponding `mcpServers` keys:

```json
{
  "vendor": {
    "type": "mcp_oauth",
    "scopes": ["content:read"],
    "clientRegistration": "dynamic"
  }
}
```

- Omitting `clientRegistration` defaults to dynamic registration. Choose it only when the provider supports the corresponding MCP OAuth discovery and registration flow.
- Use `preregistered` for applications requiring fixed registration. Administrators supply client configuration through the host; do not add clientId/clientSecret/authorizationEndpoint fields to the manifest.
- The host creates or reuses a generic provider and shared workspace connection based on organization scope, MCP endpoint, scopes, and registration method, using common callback, credential storage, and refresh logic.
- A remote 401 does not prove that dynamic client registration is supported. Check discovery metadata, the protected resource, scopes, and provider registration requirements.

Existing Notion, Linear, Sentry, and Supabase presets provide useful starting patterns. Follow actual provider documentation and current package definitions; do not assume identical support across tenants or regions.

## Path B: Reuse a native Connector

```json
{
  "vendor": {
    "type": "existing",
    "provider": "installed-vendor-provider",
    "resource": "https://mcp.vendor.example/mcp",
    "scopes": ["content:read"]
  }
}
```

An administrator must first create and authorize a shared workspace connection for the provider; `existing` does not create missing connections automatically. The current MCP bridge does not accept arbitrary REST tokens. Verify that:

- The resolved provider matches the declared provider.
- `credentials.accessToken` and `credentials.resource` are nonempty; optional `credentials.serverUrl` matches the target server URL.
- The declared resource matches the credential resource and passes the host's `checkResourceAllowed` check. Do not relabel a REST API audience as an MCP resource.
- Granted scopes cover required scopes, and the target MCP actually accepts the credential.

If an existing Connector returns only a token, add a correct MCP credential projection or a separate supported authentication method instead of weakening host validation. OAuth clients, audiences, and endpoints may differ between regions or products; Canva REST and regional MCP configurations are one case requiring explicit separation.

## Path C: Separate native Connector using reusable drivers

Write provider-specific code only when the first two paths cannot satisfy the actual protocol. Create a separate installable native Connector package in the user-selected location or the current project's native-package directory. Reuse `@xpert-ai/connector-runtime` through an available compatible dependency or its source rather than reimplementing the OAuth lifecycle for each provider. No particular monorepo layout is required.

| Protocol | Reusable entry point | Provider-specific implementation |
| --- | --- | --- |
| Standard OAuth2 | `createStandardOAuth2Driver` | Endpoints, scopes, client resolution, optional profile |
| Custom OAuth2 | `createOAuth2Driver` | Token request/response handling, pending-state and credential codecs |
| API Key / PAT | `createCredentialDriver`, kind `api_key` | Input parsing, real verification, profile, runtime projection |
| Mail passwords/app passwords | `createCredentialDriver`, kind `mail_protocol` | Controlled server configuration and protocol verification |
| QR authentication/polling | `createPollingDriver` | Pending-state parsing, expiry, provider polling |
| Legacy multistage polling | `pollBeforeDeadline` | Required protocol stages and explicit legacy deadline handling |

Standard OAuth2 driver shape; choose actual endpoints, scopes, encoding, and client authentication according to the provider's protocol:

```ts
import { createStandardOAuth2Driver } from '@xpert-ai/connector-runtime'

const driver = createStandardOAuth2Driver({
  kind: 'oauth2',
  authMethodId: 'oauth2',
  authorizationEndpoint: 'https://vendor.example/oauth/authorize',
  tokenEndpoint: 'https://vendor.example/oauth/token',
  encoding: 'form',
  clientAuthentication: 'client_secret_basic',
  pkce: true,
  scopes: ['content:read']
}, { resolveApp: authorizedClientResolver })
```

This is not a complete plugin. Connect the driver to a strategy following the target SDK's `ConnectorMultiAuthStrategy` contract, register it with `@ConnectorStrategyKey(provider)`, and export the native plugin module. Inspect a similar existing provider and the runtime README for current signatures rather than inferring SDK APIs from this snippet.

Implementation requirements:

- Reusable drivers accept trusted TypeScript descriptors, not arbitrary user-supplied URLs or executable code. Fix or validate provider targets and retain SSRF/endpoint restrictions.
- `resolveApp` reads configuration through authorized host services such as `IntegrationPermissionService`, preserving application identity across connect/exchange/refresh. Do not trust arbitrary integration IDs or secrets from a request.
- Choose the provider-required `form/json/query` encoding and `none/client_secret_basic/client_secret_post` authentication. Use query encoding only when the protocol requires it. Preserve PKCE, redirect URI, and client identity binding.
- SDK metadata names and descriptions may use I18nText, such as `en_US`/`zh_Hans`. Supply actual icons, permissions, and authMethods. Native configuration schemas and standard package interface string fields are separate contracts.
- Explicitly declare `authorizationModes: ['shared']`. Legacy personal types in the SDK do not mean the product should offer personal authorization.
- The library does not persist accounts or tokens; the host owns the vault, grants, callbacks, and refresh locking. Never expose refreshToken/clientSecret to browsers, Agent tool arguments, or logs.
- Retain the previous refresh token when a refresh response omits a replacement. Check expiry, revocation, and concurrent refresh. Activate API Key/mail connections only after successful verification.
- For MCP, also satisfy the resource/scope projection requirements in Path B. An ordinary REST Connector does not automatically become an MCP tool.

## Migrating existing Connectors

Preserve provider keys, authMethodId values, credential formats, and existing tool contracts while delegating protocol flows to reusable drivers. If persisted formats must change, version them explicitly and test legacy records. Do not automatically copy personal credentials into shared connections; direct workspace administrators to reconfigure them.

If the current project maintains a Connector migration inventory, update that inventory for applicable migrations and run its relevant checks. Standalone packages do not need to create a repository-specific inventory or harness. Publish dependencies before dependent plugins. Inspect packaged dependencies for unresolved `workspace:` protocols and do not assume unpublished versions are downloadable.

Native plugin installation scope still follows `package.json`'s `xpert.plugin.level`. A workspace-owned business connection does not change the plugin's installation scope.

## ChatKit and host authorization interaction

When a resource needs authorization, users with the relevant workspace configuration permission see the localized "Connect account" action. The resource connection callback passes `{ assistantId, bindingId }` to the host. The host verifies workspace permissions and opens the Connector configuration/authorization flow directly. Users without permission see a prompt to contact a workspace administrator.

The current host callback returns `connected` or `cancelled`. The client then rereads resource connection status; closing a window does not prove success. Preserve the message draft and existing selection, then continue adding the resource after configuration succeeds. Route all Xpert requests through `@xpert-ai/xpert-sdk` and do not restore the deprecated standalone `composer.connectors` entry.
