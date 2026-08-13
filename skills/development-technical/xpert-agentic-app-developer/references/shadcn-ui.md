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

## Host Theme Bridge Contract

Treat host theme installation as a required remote-entry concern. Loading the shared stylesheet is necessary but does not install runtime theme variables.

The host initializes Xpert tokens such as `--xui-color-border`. Shadcn and Tailwind utilities consume semantic variables such as `--border`, `--input`, and `--ring`. Install the mapping after applying the host tokens and repeat it whenever the host theme changes:

```ts
import { installShadcnThemeVars } from '@xpert-ai/shadcn-ui/theme'

function installHostTheme(theme: RemoteTheme) {
  applyThemeTokens(theme)
  installShadcnThemeVars({ density: theme.density })
}
```

- Import the installer from the stable lightweight `@xpert-ai/shadcn-ui/theme` export. Do not import the complete shared component package only to install theme variables.
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
