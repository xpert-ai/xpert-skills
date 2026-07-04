# Skill-only Plugins

Use this reference when creating or maintaining Xpert skill-only plugins, especially plugins converted from Codex primary-runtime skills such as documents, spreadsheets, and presentations.

## Core Shape

An Xpert skill-only plugin should keep the capability source, marketplace metadata, runtime manifest, and ChatKit trial behavior aligned.

Typical package shape:

```text
xpertai/skills/<skill-name>/
├── .xpertai-plugin/
│   └── plugin.json
├── assets/
│   ├── icon.png
│   ├── logo.png
│   └── <trial-card-backgrounds>
├── package.json
├── src/
│   └── index.ts
└── skills/
    └── <skill-name>/
        ├── SKILL.md
        └── agents/
            └── xpertai.yaml
```

Rules:

1. Keep `agents/xpertai.yaml` for Xpert-facing skill metadata.
2. Do not keep `agents/openai.yaml` in Xpert-only skill plugin packages.
3. Keep `package.json.name`, plugin `meta.name`, and bundle manifest name aligned.
4. Keep `package.json.version`, plugin `meta.version`, and bundle manifest version aligned unless the platform install flow intentionally overrides load version during local testing.
5. Sync `SKILL.md`, examples, prompts, and assets from the upstream Codex skill source, then adapt only Xpert-specific metadata and trial behavior.

## Image and Icon Metadata

Use plugin assets intentionally:

1. Plugin/logo surfaces use `assets/logo.png`.
2. Skill, composer chip, and shortcut surfaces use `assets/icon.png`.
3. Trial card backgrounds use explicit screenshot/background assets that match the plugin domain.
4. Do not reuse unrelated default logos or fallback backgrounds for official skill plugins.

Do not expose bundle-local file paths such as `./assets/logo.png` or `./assets/icon.png` as frontend/runtime `IconDefinition` values. Convert image files to data URLs before returning metadata to the platform UI or ChatKit runtime.

Preferred plugin-side helper:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function readPngAssetDataUrl(relativePath: string) {
  const bytes = readFileSync(join(__dirname, relativePath))
  return `data:image/png;base64,${bytes.toString('base64')}`
}
```

Use the helper in runtime plugin metadata:

```ts
const PLUGIN_LOGO = {
  type: 'image',
  value: readPngAssetDataUrl('../assets/logo.png')
} as const

const SKILL_ICON = {
  type: 'image',
  value: readPngAssetDataUrl('../assets/icon.png')
} as const
```

The platform marketplace service should also inline bundle-local images while hydrating npm bundle manifests. When inlining, resolve paths against the plugin bundle root, reject paths outside that root, support known image MIME types, and return `data:<mime>;base64,<payload>`.

## Skill Colors

Skill plugins may declare their own color for composer/runtime capability chips.

Rules:

1. Store the color with the skill/contribution metadata, not as an unrelated app theme override.
2. Keep colors synchronized with the source Codex plugin examples when converting official skill plugins.
3. Do not tint skill items in the ChatKit runtime capabilities list menu.
4. Do not tint skill chips in already-sent user messages unless product design explicitly asks for it.
5. Composer insertion chips may show the configured skill color when the current design requires it.

## Marketplace Metadata

The bundle manifest is the source of capability facts. Registry entries are distribution and curation records.

In `.xpertai-plugin/plugin.json` and plugin `meta`, provide:

1. `targetApps`
2. `targetAppMeta`
3. skill contributions
4. `interface.defaultPrompt` when backward compatibility is needed
5. structured `trialShortcuts`
6. explicit screenshots/backgrounds for the trial card
7. plugin display fields such as display name, description, category, author, icon, and version

Registry entries may omit `targetAppMeta`. The marketplace service should hydrate missing marketplace capability metadata from the npm bundle manifest by downloading the package tarball, reading `.xpertai-plugin/plugin.json` or `plugin.json`, normalizing the bundle manifest, and merging it into the registry item.

Merge policy:

1. Merge `targetApps` from registry and bundle with de-duplication.
2. Merge `targetAppMeta` with bundle manifest capability metadata treated as authoritative facts.
3. Keep registry top-level display and curation fields as overrides when present.
4. Use bundle `interface`, `defaultPrompt`, screenshots, and shortcuts as fallback when registry fields are absent.
5. Cache successful bundle manifest hydration and failed hydration results by `packageName@versionOrLatest`.
6. Do not block marketplace listing when tarball download or manifest parsing fails; keep registry metadata and log a warning.

## Trial Card

Plugin detail dialogs should show a trial card between the header and the contents list.

Background priority:

1. `targetAppMeta.xpert.marketplace.screenshots[0]`
2. other marketplace screenshots in `targetAppMeta`
3. plugin-level marketplace/interface screenshots
4. generated local fallback background selected by plugin name hash

Official skill plugins should provide explicit backgrounds so the UI does not fall through to a generic hash-based image. Use the fallback only for incomplete third-party metadata.

Shortcut rules:

1. Prefer structured `trialShortcuts` over `interface.defaultPrompt`.
2. Return at most three executable shortcuts.
3. Each shortcut should include a stable `id`, a user-facing `prompt`, and a `skillKey`.
4. Include an icon only when it can be resolved to a valid data URL or safe icon definition.
5. If a shortcut omits `skillKey`, bind it only when the plugin has exactly one skill resource.
6. Do not render fake shortcut buttons for unresolved or non-executable shortcuts.
7. When there are no executable shortcuts, the visual card may still render with the background only.

Shortcut click behavior:

1. Ensure the skill is available in the ClawXpert xpert workspace.
2. Navigate to `/chat/clawxpert/c`.
3. Open a new conversation.
4. Insert the selected skill chip first, then a space, then the shortcut prompt.
5. Focus the composer.
6. Do not auto-send.

## Skill Detail Dialog

Clicking a skill item in the plugin detail dialog should open a skill detail dialog. The skill item's explicit action button should remain an install action.

Skill detail dialog behavior:

1. Load `SKILL.md` through a backend endpoint that only reads registered skill components.
2. Render `SKILL.md` with the shared markdown component and existing markdown styles.
3. Replace generic enable toggles with an install-to-workspace action.
4. Put the primary CTA in the footer as "Try in ClawXpert" or the localized equivalent.
5. The trial CTA should reuse the same skill trial launcher as plugin detail shortcuts.

Backend document read rules:

1. Implement the document read as a CQRS query handler.
2. Allow only installed or loaded plugin bundles.
3. Resolve the component through registered bundle components, not arbitrary request paths.
4. Only allow `skill` components.
5. Resolve `sourcePath` and verify it is under the plugin bundle root.
6. Read only the component's `SKILL.md`.

## Resource Installation and Trial

ClawXpert trial must use the workspace that owns the ClawXpert xpert, not an arbitrary or previously selected workspace.

Trial flow:

1. Resolve the ClawXpert xpert binding.
2. Determine the ClawXpert xpert workspace.
3. Query skill resource state for that workspace.
4. If the skill is already installed in that workspace, reuse the existing runtime/package id.
5. If the skill is not installed, open the resource installation dialog in workspace mode and preselect the skill.
6. After install success, use the returned workspace id and runtime id to create a one-time trial intent.
7. Navigate to ClawXpert and consume the intent once.

Reinstall rules:

1. Installed-state checks must reflect actual workspace resources.
2. If a user manually deleted the workspace skill resource, the state should allow installation again.
3. The trial path must not get stuck just because the plugin was installed before at plugin/package level.

Architecture rules:

1. Move resource state list logic into a CQRS query handler such as `ListPluginResourceComponentStatesHandler`.
2. Move install-template or install-resource mutation logic into CQRS command handlers.
3. Keep controllers and facade services thin; they should dispatch queries/commands instead of owning long business workflows.
4. Cover each query/command handler with focused tests.

## ChatKit Composer Integration

Be conservative with ChatKit public APIs. Prefer extending existing methods with options before adding new interface methods, unless there are multiple confirmed scenarios that need a separate method.

Composer rules:

1. Use `setComposerValue` with options for text, runtime capabilities, and capability insertion when available.
2. Insert runtime capability chips before prompt text for trial shortcuts.
3. Add one normal space after the inserted skill chip.
4. Keep focus in the composer.
5. Do not call any send API during a trial setup.
6. Extract runtime capability rendering and selection logic into a dedicated child component/file instead of growing the root chat component.

Visual rules:

1. Runtime capability list menu skill items should not apply skill brand colors.
2. Sent-message skill chips should not apply skill brand colors unless product design changes.
3. The composer token may display configured color only where the current composer design supports it.

## Validation Checklist

Before finishing a skill-only plugin change, verify:

1. `SKILL.md` content matches the converted source skill and current Xpert behavior.
2. Only `agents/xpertai.yaml` remains for Xpert-only skill plugin packages.
3. `plugin.json` is valid JSON.
4. Runtime plugin metadata and bundle manifest agree on name, version, target app metadata, contributions, shortcuts, and assets.
5. Icons and backgrounds render from data URLs, not bundle-relative paths.
6. Official skill plugins have explicit trial card backgrounds.
7. Trial shortcuts bind to the intended skill and show at most three executable prompts.
8. Local package build and typecheck pass.
9. Marketplace API response includes hydrated `targetApps`, `targetAppMeta`, contributions, trial shortcuts, and inlined assets when registry metadata is sparse.
10. Skill detail dialog loads markdown, install action, and trial CTA correctly.
11. Resource state checks use the ClawXpert xpert workspace.
12. Already-installed skills can be reused for trial, and manually deleted workspace skills can be installed again.
13. ClawXpert opens a new conversation, inserts skill chip before prompt with a trailing space, focuses composer, and does not auto-send.
14. ChatKit list menu and sent-message chips do not show unintended skill colors.

Common commands:

```bash
npm run build
npm run typecheck
jq empty .xpertai-plugin/plugin.json
```

When testing against a running local platform, rebuild the plugin package and reinstall or reload the plugin runtime before concluding marketplace, resource, or ChatKit behavior is stale.
