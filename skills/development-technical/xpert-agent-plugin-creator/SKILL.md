---
name: xpert-agent-plugin-creator
description: Build, adapt, and validate Xpert Agent Plugins with Skills, remote MCP servers, and workspace Connector dependencies. Use for Agent Plugins 1.0.0 packages, cn.xpertai extensions, MCP OAuth, or a vendor Connector required by a package. Distinguish these resource packages from native Xpert code plugins and Codex-only plugins.
---

# Xpert Agent Plugin Creator

Build distributable Agent Plugins and reuse or implement workspace Connectors as needed. An Agent Plugin declares capabilities to assemble at runtime; a Connector manages provider identity and credentials. Put server-side code in a separate native Xpert code plugin when required.

## Choose the smallest integration path

Use the user's requested output location and read its applicable project instructions. Otherwise, follow the current project's package conventions; if none exist, create a clearly named package directory within the current workspace. A plugin may live in a standalone repository, a monorepo, or another user-chosen directory. No particular repository name or parent directory is required.

Treat `PLUGIN_ROOT` as the directory containing the package's root `plugin.json`. Keep any native Connector in a separate installable package, following the project's conventions. `XPERT_PLATFORM_ROOT` is an optional, explicitly located trusted host checkout used for source-based validation; it need not be adjacent to the plugin and is not required to author a package.

| Required capability | Implementation |
| --- | --- |
| Skills only | Standard `plugin.json` and `skills/<name>/SKILL.md` |
| Remote MCP without authentication | Add `mcp.json`; no Connector needed |
| Standard MCP OAuth | Declare `cn.xpertai.connectors[serverKey].type = "mcp_oauth"`; usually no provider-specific code |
| Existing Connector supplying credentials for the target MCP | Declare `type = "existing"`; verify provider, resource, scopes, and the shared connection |
| Custom OAuth, API Key, PAT, mail, or QR authentication | Separate native Connector, preferably using `@xpert-ai/connector-runtime` drivers |
| Middleware or digital experts | Reference installed providers or logical expert references; administrators configure and map them |

Distinguish MCP Apps, OpenAI Apps/Connectors, standard plugin packages, and native Xpert code plugins. A provider icon or catalog listing does not establish that its MCP endpoint or OAuth client is available to Xpert.

## Build workflow

1. **Verify integration evidence.** Consult official provider MCP/API documentation for endpoints, transports, authentication, scopes, client registration, and account restrictions. Distinguish official packages, independently authored presets, and adapted packages; record sources and actual differences.
2. **Build the standard package.** Read [Package format and extensions](references/package-format.md) and include only necessary components. Keep the standard manifest and fixed discovery directories; do not add NestJS entry points or installation scripts to resource-only packages.
3. **Connect authentication when needed.** Read [Connector selection and implementation](references/connectors.md). Check whether generic MCP OAuth or an existing provider meets the requirements before writing a vendor adapter.
4. **Validate against the target host.** When a trusted platform checkout is available, use the script below to invoke its production parser and review every diagnostic. Otherwise, validate the package structure and schemas and report host compatibility as unverified until an authorized target-host check succeeds. Follow [Validation and release](references/validation-and-release.md) for relevant packaging, permission, authorization, and live-call checks.
5. **Deliver verifiable results.** Report package paths, sources and modifications, Connector dependencies, administrator configuration, check results, and external steps not yet verified. Mark authorization and tool calls as passed only after they actually succeed.

When a trusted Xpert checkout is available, set these variables to the actual paths of this skill, that checkout, and the user-selected plugin package:

```bash
node "$SKILL_ROOT/scripts/validate-agent-plugin.mjs" \
  --platform-root "$XPERT_PLATFORM_ROOT" \
  --plugin-root "$PLUGIN_ROOT"
```

The script uses the platform's installed `jiti` and parser dependencies. It neither installs dependencies nor loads executable code from the inspected plugin. Component diagnostics fail validation by default. Use `--allow-partial` only when deliberately accepting a partially usable package, and document the skipped components.

## Product and runtime boundaries

- **Use shared workspace connections throughout.** Workspace administrators configure, authorize, and reconnect them. Users access permitted workspace resources through Assistant permissions. Do not introduce personal connection ownership, personal authorization steps, or automatic copying of legacy personal credentials.
- Never store tokens, client secrets, or actual tenant/organization/workspace/expert IDs in distributable packages. Use logical expert references; the host manages deployment mappings and credentials.
- Extensions reference registered capabilities and do not dynamically load server code from the package. The host implements the generic `mcp_oauth` provider.
- The backend validates Assistant, workspace, project, and resource permissions. UI availability is not authorization. Connector declarations must not expand scopes or bypass MCP resource checks.
- Session resources use separate `runtimeResources` data and resolved versions. They augment the entry Agent without changing Assistant drafts or published graphs. Package updates must not silently replace existing session bindings.
- For ChatKit integration, use the SDK and `composer.resources`; `composer.connectors` is deprecated. Keep the existing localized "Connect plugins" entry. Delegate shared connection configuration to the host's permission flow.
- Deploy, authorize, or replace only when included in the user's task. Package creation does not imply platform upgrades or legacy credential migration. Do not reconfirm authorization already granted.

## Optional implementation references

These implementation entry points were checked when this skill was written. They identify reference source, not required output directories. Inspect them only when the corresponding source or dependency is available. For version differences, follow the target version's source, SDK, and contract tests; do not invent fields from examples or require users to adopt the reference repository's layout.

| Codebase | Reference location and purpose |
| --- | --- |
| xpert | `packages/server-ai/src/agent-plugin/agent-plugin-parser.ts` and its sibling `schemas/`: fixed discovery, schemas, and isolated diagnostics |
| xpert | `packages/server-ai/src/agent-plugin/agent-plugin-connector.schema.ts`: Connector extension fields |
| xpert | `packages/server-ai/src/agent-plugin/agent-plugin.service.ts`: resource bindings, expert mappings, and Connector creation |
| xpert | `packages/server-ai/src/connector/`: shared authorization, credential resolution, and MCP resource checks |
| xpert | `packages/plugin-sdk/src/lib/connector/strategy.interface.ts`: native Connector contracts |
| `@xpert-ai/connector-runtime` | Package exports and available source: reusable drivers and their contracts |
| Current project, when present | Existing plugin examples, packaging scripts, and lifecycle/Connector tests; discover their actual locations |

Specification: [Agent Plugins 1.0.0](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md). Do not assume draft revisions or other clients' private formats are supported by the current Xpert host.
