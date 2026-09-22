# Validation and release

## Local package validation

When a trusted Xpert checkout is available, use this skill's `scripts/validate-agent-plugin.mjs` with explicit `--platform-root` and `--plugin-root` paths. It loads the production parser without executing package JavaScript, installation scripts, or remote requests. The checkout needs installed `jiti` and parser dependencies. Resolve missing dependencies using that checkout's declared package manager without automatically changing dependency versions.

Without a host checkout, validate the JSON, standard schemas, skill frontmatter, and package layout using available project tooling. Host-specific compatibility remains unverified until checked against the target host, through its supported validation or import flow when authorized. Do not clone or reorganize repositories merely to satisfy a fixed directory convention.

Results include discovered components, isolated diagnostics, and `accepted`. Any diagnostic produces a nonzero exit by default. Use `--allow-partial` only when intentionally accepting component failures. A Connector referring to a missing or unsupported MCP server always fails, preventing missing dependencies from being mistaken for publishable bindings.

This script validates parsing and dependency keys, not permissions, OAuth, live calls, or ZIP completeness. When introducing complex components, check invalid Skills, malformed MCP configurations, unknown schemas, path boundaries, and mixed valid/invalid components. Reuse existing tests rather than writing a second specification parser.

## Packaging and project checks

Inspect the current project's instructions and available packaging/test scripts before choosing commands. A standalone standard plugin needs no `package.json`, quickstart index, or specific package manager. Put Connector configuration in the manifest; do not build new personal authorization flows around a legacy `oauthServers` field found in an example repository.

For Git import, supply the repository URL, explicit ref, and the package subdirectory when the package is not at the repository root. For ZIP import, archive the contents of `PLUGIN_ROOT` with `plugin.json` at the archive root. Include the components and supporting files actually used by the package; omit credentials, unrelated workspace files, build caches, and unsafe links. Keep output archives outside the input tree or exclude them explicitly.

If the project provides a package manager or packer, follow its declared version and inspect its file allowlist. Some existing quickstart packers include only `plugin.json`, `mcp.json`, `README.md`, and `skills/<name>/SKILL.md`, omitting supporting skill assets/references/scripts. When those files are needed, use complete Git/ZIP import or explicitly extend and validate the packer within the task's scope. Inspect actual archive contents to catch files that exist locally but disappear after installation. Register a package in a quickstart/catalog index only when that project uses one and inclusion is intended.

Run available contract checks for parsing, extraction, digests, and mappings. Repository-specific scripts such as `agent-plugins.contract.mjs` are optional tools when present; locate them and inspect their arguments rather than assuming their paths. These checks do not verify provider OAuth.

For native Connectors, run the package's relevant tests, type/build checks, and packaging checks. Include `connector-runtime` tests when changing that library. A repository-specific Connector verification harness may be used when available, after checking its coverage and arguments. It does not replace real account authorization and business calls.

## Import and publish when deployment is in scope

Standard packages are managed at organization scope and then authorized for workspaces. Current administrator APIs:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/agent-plugins`, `GET /api/agent-plugins/options` | Query packages, bindings, and configuration options |
| `POST /api/agent-plugins/git` | Import specified Git content using `{ url, ref, subdirectory }` |
| `POST /api/agent-plugins/zip` | Upload a multipart `file` |
| `POST /api/agent-plugins/bindings` | Create a selectable resource binding for an installed version |
| `PUT /api/agent-plugins/bindings/:id` | Enable/disable a binding; follow the current DTO |

Illustrative publication payload; resolve actual IDs only in the deployment context:

```json
{
  "title": "Vendor Research",
  "workspaceIds": ["<authorized-workspace-id>"],
  "definition": {
    "kind": "agent_plugin",
    "packageId": "<imported-package-id>",
    "experts": {
      "com.example.review-expert": "<authorized-published-expert-id>"
    }
  }
}
```

Omit expert mappings when no experts are used. Default to manifest Connector declarations and let the host generate generic shared connections where appropriate. For replacement, inspect the current DTO's `replacesBindingId` and version semantics; do not silently rewrite resolved versions in existing sessions.

Prefer the target platform's supported UI or SDK and any applicable project deployment tooling. When the platform checkout provides `tools/scripts/local-plugin-cli.mjs`, reuse its `requireAuthentication` and `createRequestHeaders` helpers. Otherwise, use the target environment's supported authentication and request-context mechanism. Obtain credentials from configured environments or supported secure credential stores, never browser credentials, and do not print tokens.

For business requests, preserve organization, tenant, and workspace context. With the platform helper, use `createRequestHeaders({ scope: 'organization', orgId }, token, tenantId)`; alternative clients must provide the same required context. On 403, verify context first. When necessary, query the current account's organization list with minimal fields and pagination, then locate the accessible target workspace. If the correct scope is still denied, report the actual restriction; do not alter permissions or write directly to the database to bypass it.

Keep native provider installation separate from business access. System-level native plugins install at tenant scope in the Default tenant under host rules; workspace authorization still uses its organization scope. Do not add database migrations, service upgrades, or bulk disabling of old bindings unless the task requires them.

## Evidence required for live acceptance

Select scenarios relevant to the change and record results and any remaining administrator actions:

| Scenario | Observable evidence |
| --- | --- |
| Skills-only package | Import succeeds without package.json, and the entry Agent actually loads the skill |
| MCP OAuth | Workspace administrator authorizes successfully, the shared connection is ready, tools are discovered, and at least one real call succeeds |
| Existing provider | The correct shared connection is reused; incorrect resources/scopes/providers are rejected |
| Mixed package | Invalid/unsupported components have diagnostics while remaining components are callable |
| MCP Apps | Tools return results and render their UI correctly; subsequent resource reads still enforce permissions |
| Middleware/experts | A provider instance or published expert is invoked without changing the Assistant's published graph |
| Sessions | First send, refresh, switching, and removal preserve the intended persistence and revision semantics |
| Configuration updates/changes during execution | New runs use the new selection; active runs and resumptions use the original snapshot |
| Permission revocation/invalid credentials | Subsequent calls are blocked, including through cached clients or forged binding IDs |
| Authorization cancellation/failure | Drafts and existing selections remain intact with a recoverable state |

External authorization often requires an administrator to interact with the provider's page. Guide only the necessary steps and do not claim unverified success. Prefer a read-only tool for the first live-call check; keep writes within the user's authorization.

Report parsing/packaging, platform import/binding, shared authorization, and live tool calls as separate results. HTTP 200, a registered provider, or an authorization page opening is not sufficient evidence that the complete feature works.
