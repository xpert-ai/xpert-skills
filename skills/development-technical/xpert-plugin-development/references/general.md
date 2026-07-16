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
    \"sourceConfig\":{
      \"workspacePath\":\"$PLUGIN_PATH\"
    }
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

## Automated local deployment

Prefer the platform-owned deployment command when `<platform-root>/package.json` exposes `plugin:deploy:local`:

```bash
cd <platform-root>
corepack pnpm plugin:deploy:local \
  --plugin-dir <plugin-repo-root>/<plugin-relative-path> \
  --org-id "$XPERT_ORG_ID"
```

The command must:

1. read the plugin name from `package.json`
2. run the detected build and test scripts unless explicitly skipped
3. call `POST /api/plugin/refresh` for an existing local-code registration
4. fall back to `POST /api/plugin` with `source=code + sourceConfig.workspacePath` only when the plugin is not refreshable
5. call `POST /api/plugin/by-names` and fail when no descriptor is returned
6. redact authentication and avoid logging complete plugin configuration

Useful options:

```bash
# Validate the plan without mutation; credentials are optional in dry-run mode.
corepack pnpm plugin:deploy:local --plugin-dir <plugin-dir> --org-id <org-id> --dry-run

# Reuse prior validation when the build and tests already passed in the same task.
corepack pnpm plugin:deploy:local --plugin-dir <plugin-dir> --org-id <org-id> --skip-build --skip-test

# Replace a marketplace or stale registration with a local source-code registration.
corepack pnpm plugin:deploy:local --plugin-dir <plugin-dir> --org-id <org-id> --force-install
```

Use `--tenant-id <id> --scope tenant` for tenant scope. Do not guess tenant or organization identifiers; discover them from the local environment or ask the user for the non-secret identifier.

## Authentication and missing-token procedure

Resolve credentials in this order:

1. an explicitly supplied `--token` only when the user intentionally provided it outside chat
2. `XPERT_TOKEN` in the current process environment
3. the macOS Keychain item named `xpert-local-plugin-token` for the current OS user

If no token is available:

1. stop before build, installation, or refresh; do not repeatedly call the API
2. do not inspect browser Local Storage, cookies, network headers, shell history, or unrelated process environments
3. do not ask the user to paste a token into chat, a command argument, a tracked `.env` file, or a repository file
4. tell the user to run this command locally, which prompts for the secret without placing it in shell history:

```bash
security add-generic-password \
  -a "$USER" \
  -s xpert-local-plugin-token \
  -U \
  -w
```

5. explain that the final `-w` prompts for the token, then wait for the user to confirm setup before rerunning deployment

On non-macOS systems, ask the user to inject `XPERT_TOKEN` through their approved local secret manager or current process environment. Never create an untracked secret file on the user's behalf unless they explicitly request that storage method.

Treat HTTP `401` as missing, expired, or invalid authentication. Provide the same safe replacement instructions instead of printing the rejected token or attempting to recover a browser session credential.

## Update workflow

Use this order when `plugin:deploy:local` is unavailable:

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

## Prevent TypeScript tool-schema type explosions

LangChain's `tool()` helper supports Zod v3, Zod v4, and JSON Schema overloads. In a middleware that returns many heterogeneous structured tools, TypeScript can retain every complete schema generic and repeatedly compare the resulting recursive tool types against the plugin SDK array. The symptom is `tsc` exhausting several gigabytes of heap even though the runtime code and emitted JavaScript are small.

Do not treat a larger `NODE_OPTIONS=--max-old-space-size=...` value as the fix. Diagnose the boundary first:

1. run the package typecheck with `--extendedDiagnostics` and the default Node heap
2. use a minimal temporary `tsconfig` to compare individual middleware files when locating the hotspot
3. check that `@xpert-ai/plugin-sdk`, `@xpert-ai/contracts`, LangChain, and Zod resolve to intentional, compatible versions instead of duplicate structural type trees
4. inspect heterogeneous arrays of values returned directly by overloaded `tool()` calls

Keep the callback input and runtime schema fully typed, but erase the redundant schema-bearing return generic once at the SDK boundary. Use one named, documented helper rather than assertions in each middleware:

```ts
import { tool } from '@langchain/core/tools'
import type { AgentMiddleware } from '@xpert-ai/plugin-sdk'
import type { z } from 'zod/v3'

type PluginAgentTool = NonNullable<AgentMiddleware['tools']>[number]

type PluginAgentToolFactory = <TInput>(
  handler: (input: TInput) => Promise<unknown>,
  fields: {
    name: string
    description: string
    schema: z.ZodTypeAny
    verboseParsingErrors?: boolean
  }
) => PluginAgentTool

export const defineAgentTool = tool as unknown as PluginAgentToolFactory
```

At each call site, continue deriving or declaring the exact handler input and pass the real Zod schema, for example `defineAgentTool(async (input: z.infer<typeof schema>) => ..., { schema, ... })`. This preserves runtime validation and useful editor types while preventing the full schema type from contaminating the middleware return type.

Rules:

1. isolate the compatibility assertion in this single helper; do not scatter `as any`, `as unknown as`, untyped callbacks, or casts through business logic
2. type the helper's return as the actual plugin SDK tool element, not a locally copied approximation
3. keep `verboseParsingErrors: true` and precise schema descriptions
4. after the change, run the complete package typecheck without a custom heap and record `Memory used`, `Instantiations`, and total time from `--extendedDiagnostics`
5. if memory remains excessive, continue reducing or splitting the implicated boundary instead of normalizing a multi-gigabyte heap setting

## Common failures

1. `Cannot find ... dist/index.js`: build output is incomplete
2. `401 Unauthorized`: token is missing, expired, or invalid; follow the safe missing-token procedure instead of extracting browser credentials
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
