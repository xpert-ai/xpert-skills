---
name: xpert-plugin-development
description: Guidance for developing, installing, testing, versioning, and submitting Xpert plugins. Use this skill when working in xpert-plugins on general plugins, model plugins, integrations, or middlewares.
---

# Xpert Plugin Development

Use this skill when the task involves plugin work in the Xpert plugin repository:

1. creating a new plugin
2. updating an existing plugin
3. installing a local plugin into the platform
4. validating plugin config, runtime behavior, or packaging
5. preparing commits, version updates, or PRs

Repository:

1. Official upstream: `https://github.com/xpert-ai/xpert-plugins.git`
2. Local workspace: `/Users/ysz/Desktop/project/xpert-plugins`
3. Local platform backend: `/Users/ysz/Desktop/project/xpert-pro`

## Workflow

1. Identify the plugin type first: general tool plugin, model plugin, integration plugin, or middleware plugin.
2. Read `references/general.md` for repository layout, install flow, test flow, versioning, and PR rules.
3. If the task is about model providers, yaml, assets, or packaging, also read `references/model-plugins.md`.
4. If the task is about callbacks, bindings, notifications, or third-party platform connectivity, also read `references/integration-middleware.md`.
5. Prefer local installation via `source=code + workspacePath` during development.
6. Before finishing, verify build output, installation, runtime behavior, and submit only relevant files.

## Rules

1. Keep package metadata, exported entrypoints, schema, and runtime behavior aligned.
2. Do not commit secrets, tokens, passwords, temporary callback URLs, or local-only debug values.
3. Do not expose platform capabilities as tools unless the upstream platform APIs are confirmed to exist and are stable enough for users.
4. Treat `createTools()` and runtime tool execution as separate contracts and verify both.
5. When the platform backend code changes, restart the backend before concluding installation or loading is broken.

## Output expectations

When using this skill, prefer this order:

1. identify plugin type and affected directories
2. make the minimum safe code changes
3. build and validate locally
4. install or reinstall into the local platform
5. verify runtime behavior
6. summarize risks, versioning impact, and PR readiness
