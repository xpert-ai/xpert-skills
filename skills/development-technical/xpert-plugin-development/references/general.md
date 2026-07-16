# General Plugin Workflow

## Repository layout

Core directories in `xpert-plugins`:

1. `plugin-dev-harness/`
2. `xpertai/tools/`
3. `xpertai/examples/`
4. `xpertai/models/`
5. `xpertai/integrations/`
6. `xpertai/middlewares/`
7. `xpertai/.verdaccio/`

Meaning:

1. `tools` contains agent-callable tools.
2. `examples` contains tutorial and reference plugins that should stay buildable but are not primary product plugin categories.
3. `models` contains model provider plugins.
4. `integrations` contains third-party integrations and callback-driven plugins.
5. `middlewares` contains runtime extension plugins.
6. `plugin-dev-harness` is for fast smoke testing.
7. `.verdaccio` supports local private npm registry workflows.

## Standard plugin shape

Typical plugin structure:

```text
<plugin-dir>/
├── package.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
├── jest.config.ts
├── README.md
└── src/
    ├── index.ts
    └── lib/
```

## Metadata and package requirements

1. Package name should follow `@xpert-ai/plugin-<name>`.
2. `src/index.ts` should export the plugin as default.
3. `meta.name` and `package.json.name` must match.
4. `meta.version` and `package.json.version` must match.
5. `config.schema` must be valid for both UI rendering and server validation.

Required build outputs:

1. `dist/index.js`
2. any runtime assets required by the plugin

Important package fields:

1. `main`
2. `module`
3. `exports`

Important TypeScript setting:

1. `emitDeclarationOnly` must be `false`

## Installation during local development

Preferred path:

1. build locally
2. install into the running local platform through `POST /api/plugin`
3. use `source=code + workspacePath`

Before running commands, discover these values from the local environment:

1. `<plugin-repo-root>`
2. `<plugin-relative-path>`
3. `<platform-api-base-url>`
4. `<tenant-id>`
5. `<organization-id>`

Template:

```bash
PLUGIN_NAME="@xpert-ai/plugin-<name>"
PLUGIN_PATH="<plugin-repo-root>/<plugin-relative-path>"
PLUGIN_LOAD_VERSION="$(date +%Y%m%d%H%M%S)"

curl -sS -X POST <platform-api-base-url>/api/plugin \
  -H "Authorization: Bearer $TOKEN" \
  -H "tenant-id: $TENANT_ID" \
  -H "organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  --data "{
    \"pluginName\":\"$PLUGIN_NAME\",
    \"version\":\"$PLUGIN_LOAD_VERSION\",
    \"source\":\"code\",
    \"workspacePath\":\"$PLUGIN_PATH\"
  }"
```

Verify:

```bash
curl -sS -X POST <platform-api-base-url>/api/plugin/by-names \
  -H "Authorization: Bearer $TOKEN" \
  -H "tenant-id: $TENANT_ID" \
  -H "organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  --data "{\"names\":[\"$PLUGIN_NAME\"]}"
```

## Update workflow

Use this order:

1. modify code
2. rebuild
3. reinstall through `POST /api/plugin`
4. verify through `by-names`, provider endpoints, and runtime tests
5. if behavior is still stale, restart the local backend and reinstall

Notes:

1. A new `version` value in the install request helps avoid stale module loading.
2. Backend code changes require a backend restart.

## Testing checklist

Always try to cover:

1. build success
2. unit tests
3. install success
4. provider/schema/tools visibility
5. one happy path runtime test
6. one error path runtime test

Useful runtime test endpoint:

1. `POST /api/xpert-tool/test`

Useful config validation endpoint:

1. `POST /api/xpert-toolset/builtin-provider/:name/instance`

## i18n boundary

Use a deliberate i18n boundary instead of scattering strings:

1. Normalize platform/host locale values into the plugin's supported locale union, for example `zh-Hans | en-US`.
2. Keep frontend iframe text in a typed dictionary or the host platform i18n mechanism; include action labels, tooltips, confirmation copy, validation messages, empty states, status display labels, and table headers.
3. Keep backend DTOs language-neutral by default. Return codes such as `status`, `errorCode`, `reason`, and `target`; map them to display text in the frontend.
4. Localize backend-generated artifacts such as Excel/PDF/Word exports, emails, and explicit toast/view action messages with a normalized locale.
5. Use platform metadata keys such as `en_US` and `zh_Hans` in manifests, and keep conversion to runtime keys such as `en-US` and `zh-Hans` in one helper.
6. Do not make Agent tool call correctness depend on localized prose. Tool schemas and tool descriptions should stay stable unless the platform explicitly supports localized tool metadata.

## Common failures

1. `Cannot find ... dist/index.js`: build output is incomplete
2. `401 Unauthorized`: token or tenant/org headers are invalid
3. config save returns `Method not implemented.`: `_validateCredentials()` is missing
4. provider visible but runtime empty: `createTools()` and runtime tool initialization are inconsistent
5. code changed but platform behavior is old: stale loading path or backend was not restarted

## Versioning

Two modes:

1. Local `source=code` iteration: package version may stay stable, but install request should use a fresh `version` value
2. npm-based validation or release: bump `package.json.version`

Before PR:

1. remove temporary package names
2. remove personal npm scope changes unless intentionally publishing from that scope
3. do not keep meaningless version drift from temporary local tests

## Git and PR flow

Preferred remote layout:

1. `origin` -> your fork
2. `upstream` -> `https://github.com/xpert-ai/xpert-plugins.git`

Typical flow:

```bash
git fetch upstream
git checkout <base-branch>
git pull --ff-only upstream <base-branch>
git checkout -b feat/<plugin-name>-update
git push -u origin feat/<plugin-name>-update
```

Commit and PR rules:

1. submit only files relevant to the current plugin change
2. exclude cache, tarballs, lockfile drift, and local-only debug artifacts
3. summarize testing in the PR
