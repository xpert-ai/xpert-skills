# Package format, extensions, and adaptation

## Minimal standard package

The following tree starts at `PLUGIN_ROOT`, the user-selected package directory. Its parent location and repository name are unrestricted; only the package's internal discovery paths are fixed.

```text
vendor-research/
  plugin.json
  mcp.json                     # Only when MCP is needed
  skills/
    vendor-research/
      SKILL.md                 # Only when a skill is needed
```

`plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "vendor-research",
  "version": "1.0.0",
  "description": "Research approved workspace content using the vendor service.",
  "extensions": {
    "cn.xpertai": {
      "version": 1,
      "interface": {
        "displayName": "Vendor Research",
        "description": "Search and summarize authorized workspace content."
      },
      "connectors": {
        "vendor": { "type": "mcp_oauth", "scopes": ["content:read"] }
      }
    }
  }
}
```

`mcp.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "vendor": {
      "type": "streamable-http",
      "url": "https://mcp.vendor.example/mcp"
    }
  }
}
```

The domain and scope are illustrative; replace them with values confirmed in provider documentation. Omit `connectors` for anonymous services. For Skills-only packages, omit the MCP file and Connector declarations entirely.

`skills/vendor-research/SKILL.md`:

```markdown
---
name: vendor-research
description: Search authorized vendor content and summarize results with source references when the user needs workspace research.
---

# Vendor Research

Use the available vendor search tools to locate relevant workspace content.
Preserve source references in the answer and identify gaps in accessible evidence.
If the shared connection is unavailable, surface the workspace connection action.
```

Write actual workflow constraints and tool guidance instead of copying the illustrative text unchanged. The skill name must match its immediate parent directory and use lowercase letters, digits, and single hyphens. Its description must be a nonempty string of at most 1,024 characters. Skill instructions do not establish mandatory execution, grant permissions, or authorize arbitrary remote requests.

## Current host constraints

- The root manifest requires `$schema` and `name`. Plugin names allow at most 64 lowercase letters, digits, dots, and hyphens, without consecutive `--`, consecutive `..`, or leading/trailing punctuation. `version` is optional but recommended for release auditing.
- Discovery uses fixed `plugin.json`, `skills/`, and `mcp.json` locations. Standard packages require no `package.json` and execute no npm installation scripts, Hooks, NestJS, or other entry points.
- `cn.xpertai.version` must be the number `1`; extension fields are strictly validated. Current `interface.displayName/description/icon` fields are strings. Resource UI support for I18nObject does not make objects valid in these manifest fields.
- If an icon is provided, use an accessible, trusted image URL. Do not assume the host publishes relative manifest paths as static assets. Missing icons may use host defaults.
- Only `streamable-http` MCP is supported. Generated host-internal configuration may use `http`; do not write that internal value into a standard manifest.
- Use HTTPS; HTTP is allowed only on loopback. URLs must not contain usernames, passwords, or fragments. Keep secrets out of package query parameters and headers, and do not assume safe `${ENV_VAR}` substitution.
- `Authorization`, `Proxy-Authorization`, `Cookie`, and `X-API-Key` headers are forbidden; the Connector supplies credentials. Other headers cannot contain case-insensitive duplicate names, invalid names, newlines, or null characters.
- `stdio`, legacy SSE, and invalid Skills/servers produce isolated diagnostics while valid components continue parsing. An unknown root manifest schema rejects the package; an invalid MCP file becomes a component failure; an invalid Xpert extension is ignored as a whole.
- Content must stay within the package's real path. Do not use symlinks to escape that boundary; ZIP import additionally rejects symlinks and path traversal. Keep `plugin.json` at the archive root.

## Installed middleware and digital experts

Add these fields to `cn.xpertai` only when the corresponding capabilities are needed:

```json
{
  "version": 1,
  "middlewares": [
    { "key": "audit", "provider": "installed-audit-provider", "options": {} }
  ],
  "experts": [
    { "key": "reviewer", "reference": "com.example.review-expert" }
  ]
}
```

The `provider` must already be registered by a native plugin, and `options` must satisfy its configuration schema. Middleware and expert keys must be unique across both collections, using 1–64 letters, digits, underscores, or hyphens.

An expert `reference` is a portable logical name. Administrators map it to an authorized, published digital expert through `definition.experts[reference]` in the resource binding. Do not put machine-specific UUIDs or arbitrary remote Agent URLs in distributable packages. Dynamic resources augment only the session's entry Agent; experts retain their own published configuration.

## Reusing OpenAI or other sources

1. Inspect actual repository files and licensing. Establish whether the source is a standard root `plugin.json` package, a `.codex-plugin/plugin.json` package, a marketplace index, or a client-integrated service.
2. Assess standard Skills and public remote MCP endpoints for direct reuse. Xpert does not execute private `com.openai` Apps, tools, or authorization logic. Other extension namespaces remain opaque.
3. Add `cn.xpertai.connectors` when workspace credentials are needed. Do not copy Codex login state or OpenAI-hosted Connector credentials, or invent publicly usable provider MCP URLs.
4. Explicitly mark integrations as incomplete when public endpoints, client registration, or authorization prerequisites are missing. Migrating a catalog entry does not establish a working service.
5. List each changed file and field: manifest location/schema, MCP URL/transport, Connector declarations, skill tool names and host commands, and icon provenance. Label the result as unchanged reuse, adaptation, or an independently authored preset.

Record sources, verification dates, and differences in the project's existing provenance documentation or appropriate package notes. Do not require a particular documentation path. Some older examples still describe personal authorization; correct that wording to the shared workspace connection model when adapting them.
