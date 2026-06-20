---
name: xpert-plugin-development
description: Guidance for developing, installing, testing, versioning, and submitting Xpert plugins. Use this skill when working in xpert-plugins on general plugins, model plugins, integrations, middlewares, plugin-managed MCP tools, or MCP Apps.
---

# Xpert Plugin Development

Use this skill when the task involves plugin work in the Xpert plugin repository:

1. creating a new plugin
2. updating an existing plugin
3. installing a local plugin into the platform
4. validating plugin config, runtime behavior, or packaging
5. developing plugin-managed MCP tools or MCP Apps
6. preparing commits, version updates, or PRs

Repository:

1. Official upstream: `https://github.com/xpert-ai/xpert-plugins.git`
2. Local plugin repository root: discover from the current workspace instead of assuming a fixed absolute path
3. Local platform backend root: discover from the current workspace instead of assuming a fixed absolute path

## Workflow

1. Identify the plugin type first: general tool plugin, model plugin, integration plugin, middleware plugin, plugin-managed MCP server, or MCP App plugin.
2. Discover the actual local paths for the plugin repository, the target plugin directory, and the platform backend before running commands.
3. Read `references/general.md` for repository layout, install flow, test flow, versioning, and PR rules.
4. If the task is about model providers, yaml, assets, or packaging, also read `references/model-plugins.md`.
5. If the task is about callbacks, bindings, notifications, or third-party platform connectivity, also read `references/integration-middleware.md`.
6. If the task is about `.xpertai-plugin/plugin.json`, plugin-managed MCP servers, MCP tool metadata, `ui://` resources, MCP Apps, or ChatKit inline app rendering, also read `references/mcp-tools-and-apps.md`.
7. Prefer local installation via `source=code + workspacePath` during development.
8. Before finishing, verify build output, installation, runtime behavior, and submit only relevant files.

## Rules

1. Keep package metadata, exported entrypoints, schema, and runtime behavior aligned.
2. Do not commit secrets, tokens, passwords, temporary callback URLs, or local-only debug values.
3. Do not expose platform capabilities as tools unless the upstream platform APIs are confirmed to exist and are stable enough for users.
4. Treat `createTools()` and runtime tool execution as separate contracts and verify both.
5. When the platform backend code changes, restart the backend before concluding installation or loading is broken.
6. Do not hardcode machine-specific absolute paths in docs, scripts, or instructions. Use discovered paths or placeholders such as `<plugin-repo-root>` and `<platform-root>`.
7. For plugin-managed MCP servers, use stable manifest placeholders such as `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` instead of installed runtime paths.
8. For MCP Apps, keep tool metadata and resource metadata separate: tool `_meta.ui` carries `resourceUri` / `visibility`; resource `_meta.ui` carries CSP, permissions, `domain`, and `prefersBorder`.
9. Treat plugin-managed stdio MCP servers as platform-controlled runtimes: production must be explicitly enabled, commands must be policy-checked, mutable state belongs in `${PLUGIN_DATA}`, and MCP App resource/RPC requests must carry the host-issued `appInstanceToken`.
10. Style MCP Apps with host-injected CSS variables using the public `--mcp-app-*` contract. Do not hardcode ChatKit internals, private theme tokens, or tenant-specific colors in iframe HTML.

## Output expectations

When using this skill, prefer this order:

1. identify plugin type and affected directories
2. make the minimum safe code changes
3. build and validate locally
4. install or reinstall into the local platform
5. verify runtime behavior
6. summarize risks, versioning impact, and PR readiness
