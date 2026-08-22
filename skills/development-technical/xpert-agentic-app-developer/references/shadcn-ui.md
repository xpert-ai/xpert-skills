# Shadcn UI Notes

Read this reference when implementing React Workbench or remote component UI with the shared Xpert shadcn package. Keep it as a concise, extensible list of project-specific rules.

## Key Rules

- **Imports**: Import components from `@xpert-ai/plugin-shadcn-ui` and load `@xpert-ai/plugin-shadcn-ui/style.css` once in the remote entry. Do not use private component subpaths.
- **Source ownership**: Keep official component source in the shared package. Add or update components through the shadcn CLI; do not copy or fork them inside consumers.
- **Official API**: Use official props, variants, slots, and data attributes. Keep business variants and compatibility props out of shared components.
- **Confirmation**: Use `AlertDialog` for confirmations and `Dialog` for forms, details, previews, or settings. Do not use browser-native dialogs or a generic `Dialog` as a confirmation substitute.
- **Destructive actions**: Use the destructive action variant for delete, revoke, archive, and equivalent operations. Disable repeated submission and preserve recoverability during asynchronous work.
- **Styling boundary**: Map shared theme tokens to host variables. Keep application layout and status styling in the consumer, preferably through application classes or official `data-slot` selectors.
- **Remote runtime**: Verify portals, focus management, Escape/Cancel behavior, and light/dark themes inside the iframe and React runtime actually used by the host.
- **Build output**: Build the shared UI package before consumer bundles. Regenerate `app.js` and `app.css`; never edit generated assets manually.
- **Validation**: Scan maintained UI source for native dialogs and stale private imports, then exercise the affected interaction in the browser.

## Default Extension View Baseline

When the task does not specify another visual system, React Extension Views and Workbench Remote Views use shadcn UI, Tailwind CSS, the Xpert host theme installer, and a bounded Studio layout by default.

- Build Tailwind from the Remote View's maintained TSX. Add a source directive for the consumer tree, such as `@source "./**/*.{ts,tsx}"`, and verify representative consumer utilities exist in the emitted `app.css`. The shared package's stylesheet only scans shared component source.
- Keep `html`, `body`, `#root`, and the application shell at `width: 100%` and `height: 100%`. Put `min-width: 0`, `min-height: 0`, and `overflow: hidden` on every relevant grid/flex ancestor so a child cannot expand the host surface.
- Give side panels their own bounded `ScrollArea` or `overflow-y: auto`. Make panels collapsible when they reduce the useful width of the primary workspace; validate both states and a constrained host width.
- Use React state for ephemeral disclosure. Do not add Web Storage merely to remember panel state; use a platform persistence contract only when the product explicitly requires durable state.
- Keep custom CSS focused on layout, overflow, responsive behavior, and genuinely domain-specific visuals. Use Tailwind utilities and semantic variables for ordinary spacing, typography, borders, surfaces, and states.
- Replace native form controls, browser dialogs, text glyphs, and emoji with shared shadcn primitives and the repository icon contract when equivalents exist.

## Host Theme Bridge Contract

Treat host theme installation as a required remote-entry concern. Loading the shared stylesheet is necessary but does not install runtime theme variables.

The host initializes Xpert tokens such as `--xui-color-border`. Shadcn and Tailwind utilities consume semantic variables such as `--border`, `--input`, and `--ring`. Install the mapping after applying the host tokens and repeat it whenever the host theme changes:

```ts
import { installShadcnThemeVars } from '@xpert-ai/plugin-shadcn-ui/theme'

function installHostTheme(theme: RemoteTheme) {
  applyThemeTokens(theme)
  installShadcnThemeVars({ density: theme.density })
}
```

- Import the installer from the stable lightweight `@xpert-ai/plugin-shadcn-ui/theme` export when the workspace exposes it. Do not import the complete shared component package only to install theme variables.
- Some plugin workspaces expose the same installer from `@xpert-ai/plugin-shadcn-ui`; use that workspace's canonical shared export rather than copying the implementation into an individual View. `installShadcnCssVar` is a compatibility alias, not the preferred new API name.
- Forward and apply the host `density` (`default` or `compact`) together with color scheme, radius, typography, and color tokens.
- Centralize this logic in the shared remote bridge or entry bootstrap when several Views share a runtime. Do not rely on each screen component to install the theme.
- Do not assume `@xpert-ai/plugin-shadcn-ui/style.css` maps host variables by itself.

Without a valid `--border`, declarations such as `border-color: var(--border)` become invalid and may fall back to `currentColor`, producing black borders. Keep a defensive base fallback in remote CSS when the host can load the document before initialization:

```css
@layer base {
  *,
  ::after,
  ::before,
  ::backdrop,
  ::file-selector-button {
    border-color: var(--border, var(--xui-color-border, #e4e4e7));
  }
}
```

The fallback protects first paint and degraded hosts; it does not replace `installShadcnThemeVars`.

## Theme Validation

Validate the installed plugin in the actual host iframe, not only in a standalone preview:

1. Confirm the document contains the theme installer style element used by the shared package.
2. Read computed `--xui-color-border`, `--border`, `--input`, and `--ring` from `document.documentElement`.
3. Assert representative `borderBottomColor` and `borderRightColor` values resolve to the semantic border value rather than `currentColor` or black.
4. Exercise light and dark schemes and every supported density.
5. Rebuild all remote entries that share the bridge, verify generated assets contain the installer call, deploy the plugin, restart the API when runtime assets are cached, and repeat the installed-host check.

Use computed-style assertions for the contract and screenshots for visual regression evidence. A screenshot alone does not prove that the semantic variables were installed.
