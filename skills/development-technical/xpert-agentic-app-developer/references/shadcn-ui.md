# Shadcn UI Notes

Read this reference when implementing React Workbench or remote component UI with Xpert's shadcn design system. Keep it as a concise, extensible list of project-specific rules.

## Resolve the Component Source First

Use exactly one shadcn source owned by the current repository:

1. Inspect the current project manifest, lockfile, workspace configuration, `components.json`, and existing UI imports.
2. Use `@xpert-ai/plugin-shadcn-ui` only when that package is already a dependency or workspace package resolvable entirely inside the current repository/workspace.
3. If the package is absent, do not search a sibling checkout or point the build at another project's package. Run the official shadcn CLI from the current project root: initialize only when `components.json` is absent, then add the exact required components with the repository's package manager, for example `pnpm dlx shadcn@latest init` followed by `pnpm dlx shadcn@latest add button hover-card`.
4. Keep the CLI-generated component source, `components.json`, stylesheet changes, dependencies, and lockfile in the current project. Import through its configured local alias, commonly `@/components/ui/...`.
5. Never use an absolute/sibling filesystem import, TypeScript or bundler alias to another checkout, `file:` or `link:` dependency, or `NODE_PATH` to obtain `@xpert-ai/plugin-shadcn-ui`. Do not copy component files from another project.

Do not migrate an existing project between shared-package and CLI-local modes merely for consistency. Preserve its established current-repository mode unless the user explicitly requests a migration.

## Key Rules

- **Imports**: In shared-package mode, use only public `@xpert-ai/plugin-shadcn-ui` exports and load its stylesheet once. In CLI-local mode, use the aliases and stylesheet generated/configured in the current project. Do not use private subpaths or mix both modes in one View.
- **Source ownership**: Add or update official components with the shadcn CLI in the selected current-repository owner: the local shared package when it exists there, otherwise the consuming project. Do not copy or fork source from a different repository.
- **Primitive availability**: Verify that the required primitive exists in the selected source before implementing the consumer. If absent, run the shadcn CLI in that same current-repository owner, inspect the generated diff, then build/test it before rebuilding the Remote View. Do not replace a missing primitive with an ad hoc hover panel or modal.
- **Official API**: Use official props, variants, slots, and data attributes. Keep business variants and compatibility props out of the generated/base primitives.
- **Confirmation**: Use `AlertDialog` for confirmations and `Dialog` for forms, details, previews, or settings. Do not use browser-native dialogs or a generic `Dialog` as a confirmation substitute.
- **Destructive actions**: Use the destructive action variant for delete, revoke, archive, and equivalent operations. Disable repeated submission and preserve recoverability during asynchronous work.
- **Styling boundary**: Map shared theme tokens to host variables. Keep application layout and status styling in the consumer, preferably through application classes or official `data-slot` selectors.
- **Remote runtime**: Verify portals, focus management, Escape/Cancel behavior, and light/dark themes inside the iframe and React runtime actually used by the host.
- **Build output**: In workspace-package mode, build the local shared UI package before consumer bundles. In CLI-local mode, build the current project directly. Regenerate `app.js` and `app.css`; never edit generated assets manually.
- **Validation**: Scan maintained UI source for native dialogs and stale private imports, then exercise the affected interaction in the browser.

## Radix Trigger and Overlay Contract

Radix primitives that use `asChild` measure and position from the child element's DOM ref. In React 18, every shared control used as a trigger for `HoverCard`, `Popover`, `Tooltip`, `DropdownMenu`, `Dialog`, or a similar primitive must forward its ref to the actual DOM element. A component can render and receive clicks while still violating this contract, causing portaled content to appear offscreen or anchor to the wrong location.

- Implement shared trigger controls such as `Button` with `React.forwardRef`, preserving the native element ref type and existing props. If the shared package cannot change immediately, isolate one typed ref-forwarding adapter at the integration boundary rather than disabling `asChild` throughout the application.
- Keep `HoverCard` content optional. Support hover and keyboard focus, and provide an equivalent controlled click/touch path when the same disclosure must work on touch devices. Keep blockers, required instructions, and the only primary action outside the overlay.
- Validate the trigger's `aria-expanded` or equivalent state, the content's visible state, and the overlay's bounding box inside the current iframe viewport. A DOM match or `isVisible()` alone is insufficient because an offscreen portaled element may satisfy both.
- Capture at least one screenshot with the overlay open when its position or visual hierarchy is part of acceptance.

## Default Extension View Baseline

When the task does not specify another visual system, React Extension Views and Workbench Remote Views use shadcn UI, Tailwind CSS, the Xpert host theme installer, and a bounded Studio layout by default.

- Build Tailwind from the Remote View's maintained TSX. Add a source directive for the consumer tree, such as `@source "./**/*.{ts,tsx}"`, and verify representative consumer utilities exist in the emitted `app.css`. In shared-package mode, remember that its stylesheet scans only shared component source; in CLI-local mode, include the generated local components in the current project's Tailwind source boundary.
- Keep `html`, `body`, `#root`, and the application shell at `width: 100%` and `height: 100%`. Put `min-width: 0`, `min-height: 0`, and `overflow: hidden` on every relevant grid/flex ancestor so a child cannot expand the host surface.
- Give side panels their own bounded `ScrollArea` or `overflow-y: auto`. Make panels collapsible when they reduce the useful width of the primary workspace; validate both states and a constrained host width.
- Use React state for ephemeral disclosure. Do not add Web Storage merely to remember panel state; use a platform persistence contract only when the product explicitly requires durable state.
- Keep custom CSS focused on layout, overflow, responsive behavior, and genuinely domain-specific visuals. Use Tailwind utilities and semantic variables for ordinary spacing, typography, borders, surfaces, and states.
- Replace native form controls, browser dialogs, text glyphs, and emoji with primitives from the selected current-project shadcn source and the repository icon contract when equivalents exist.

## Host Theme Bridge Contract

Treat host theme installation as a required remote-entry concern. Loading the selected shadcn stylesheet is necessary but does not install runtime theme variables.

The host initializes Xpert tokens such as `--xui-color-border`. Shadcn and Tailwind utilities consume semantic variables such as `--border`, `--input`, and `--ring`. Install the mapping after applying the host tokens and repeat it whenever the host theme changes:

```ts
import { installShadcnThemeVars } from '@xpert-ai/plugin-shadcn-ui/theme'

function installHostTheme(theme: RemoteTheme) {
  applyThemeTokens(theme)
  installShadcnThemeVars({ density: theme.density })
}
```

- In shared-package mode, import the installer from the stable lightweight `@xpert-ai/plugin-shadcn-ui/theme` export when the current workspace exposes it. Do not import the complete component package only to install theme variables.
- Some current workspaces expose the same installer from `@xpert-ai/plugin-shadcn-ui`; use that local workspace's canonical public export. `installShadcnCssVar` is a compatibility alias, not the preferred new API name.
- In CLI-local mode, implement one small current-project theme adapter that maps the host `--xui-*` tokens to the shadcn semantic variables declared by the local stylesheet. Do not import or copy an installer from another checkout.
- Forward and apply the host `density` (`default` or `compact`) together with color scheme, radius, typography, and color tokens.
- Centralize this logic in the shared remote bridge or entry bootstrap when several Views share a runtime. Do not rely on each screen component to install the theme.
- Do not assume either the package stylesheet or CLI-generated stylesheet maps host variables by itself.

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

The fallback protects first paint and degraded hosts; it does not replace the selected mode's semantic-variable adapter.

## Theme Validation

Validate the installed plugin in the actual host iframe, not only in a standalone preview:

1. Confirm the document contains the current project's theme-adapter effect or style element for the selected shadcn mode.
2. Read computed `--xui-color-border`, `--border`, `--input`, and `--ring` from `document.documentElement`.
3. Assert representative `borderBottomColor` and `borderRightColor` values resolve to the semantic border value rather than `currentColor` or black.
4. Exercise light and dark schemes and every supported density.
5. Rebuild all remote entries that share the bridge, verify generated assets contain the installer call, deploy the plugin, restart the API when runtime assets are cached, and repeat the installed-host check.

Use computed-style assertions for the contract and screenshots for visual regression evidence. A screenshot alone does not prove that the semantic variables were installed.
