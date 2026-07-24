# Icon Design and Implementation

Use this guide for icons rendered by Workbench manifests, fixed menus, extension views, React remote components, navigation, actions, statuses, empty states, and related plugin UI. Prefer one coherent system over unrelated icons chosen screen by screen.

## Contents

- [Icon roles](#icon-roles)
- [Visual language](#visual-language)
- [Application and module identity icons](#application-and-module-identity-icons)
- [Navigation, action, and status icons](#navigation-action-and-status-icons)
- [Host manifest integration](#host-manifest-integration)
- [React and shadcn UI integration](#react-and-shadcn-ui-integration)
- [Theme behavior](#theme-behavior)
- [Source ownership and reuse](#source-ownership-and-reuse)
- [Accessibility](#accessibility)
- [SVG safety](#svg-safety)
- [Validation](#validation)

## Icon Roles

Classify an icon before selecting or drawing it:

1. **Application or module identity**: Distinguishes a top-level capability, plugin, or business module. It may use a custom multi-color glyph.
2. **Navigation**: Helps users recognize destinations. Reuse an identity icon only for a top-level destination; use restrained monochrome icons for secondary navigation.
3. **Action**: Represents a verb such as add, refresh, edit, approve, delete, filter, export, or run. Use a standard monochrome line icon.
4. **Status or data semantics**: Represents success, warning, failure, pending, certification, data type, or object type. Pair shape and text with color so meaning does not depend on color alone.
5. **Decorative or illustrative**: Supports an empty state, onboarding panel, or hero area. Never make decorative artwork look like an actionable control.

Do not use a colorful identity tile for routine buttons, table actions, tabs, filters, or field adornments. Do not use a generic action glyph as the identity of a top-level application when a distinct business metaphor is needed.

## Visual Language

- Choose one clear metaphor per icon and remove details that disappear at the smallest target size.
- Keep corner treatment, stroke caps, stroke joins, perspective, and visual weight consistent across the icon family.
- Prefer simple geometry, strong silhouettes, and optical centering over mathematically exact but visually unbalanced placement.
- Avoid text, logos without authorization, emoji, clip art, mixed icon families, decorative shadows, and gradients that do not survive small sizes.
- Preserve a consistent safe area. Do not let one glyph touch the frame while neighboring glyphs appear undersized.
- Match the icon family already established by the product unless the task explicitly introduces a new identity system.

## Application and Module Identity Icons

Use a custom inline SVG when the application or module needs a distinctive identity. A soft background tile with a stronger foreground glyph is the default style when no product-specific identity system already exists.

Recommended default construction:

- Use a `256 × 256` view box.
- Place a `208 × 208` background tile at `24,24` with a corner radius near `40`.
- Keep the main glyph inside an approximate `60–196` safe area.
- Use two or three coordinated colors plus an optional neutral.
- Use strokes in the approximate `12–17` range on the 256-unit canvas, with rounded caps and joins where appropriate.
- Use a low-chroma background and a stronger foreground so the icon remains readable at 20–24 px.

Treat these measurements as a shared starting grid, not a reason to distort an existing brand mark or a domain glyph. Test optical balance and recognizability at the rendered size.

Use the same identity icon for the view manifest, fixed Workbench menu, primary module header, and related empty state when those surfaces represent the same capability.

## Navigation, Action, and Status Icons

For navigation and actions:

- Prefer the repository-standard monochrome line icon library, such as Lucide React when available.
- Default to 16 px with a `1.75–2` stroke width.
- Use 20 px for prominent actions, top-level secondary navigation, or compact empty states.
- Keep icon placement consistent: leading icons for primary recognition, trailing icons for disclosure or direction.
- Do not mix filled, outlined, hand-drawn, and multi-color action icons in one control system.
- Use destructive styling only for destructive actions; do not make neutral actions red or orange.

For statuses:

- Use stable semantic mappings for success, warning, error, information, pending, and disabled.
- Combine color with a label, badge, shape, or icon difference.
- Reserve animation for progress or live activity and respect reduced-motion preferences.

## Host Manifest Integration

Prefer the object form supported by recent contracts:

```ts
const VIEW_ICON = {
  type: 'svg',
  value: '<svg ...>',
  alt: 'Contract Review'
} satisfies IconDefinition
```

Use the same `IconDefinition` for the manifest `icon` and fixed Workbench menu icon when both identify the same view. If the resolved SDK still types either field as `string`, keep the runtime object and isolate any compatibility cast at the icon assignment. Do not weaken the entire manifest type.

Keep manifest SVGs self-contained. Do not assume iframe CSS, remote-component variables, icon fonts, or external assets are available in the host renderer.

## React and shadcn UI Integration

- Use shared shadcn UI components for buttons, menus, tooltips, tabs, badges, alerts, and other controls around icons.
- Add missing shared shadcn components through the project CLI; do not copy or fork component source into the remote view.
- Use the repository-standard React icon package for action glyphs. Icons are not a substitute for installing the correct shadcn control.
- Size icons through shared component conventions or utility classes instead of ad hoc inline dimensions on every call site.
- Use `currentColor` so icons inherit normal, muted, primary, destructive, warning, success, hover, focus, selected, and disabled states from the control.
- Avoid injecting SVG strings into React with `dangerouslySetInnerHTML`. Prefer typed React SVG components for icons rendered inside the iframe.

## Theme Behavior

- Use host-mapped semantic CSS variables for icons rendered inside a remote component.
- Use fixed, accessible identity colors for manifest icons rendered outside the iframe unless the host explicitly supports and has verified the required CSS variables.
- Verify contrast against default, hover, selected, disabled, destructive, and high-emphasis backgrounds.
- Verify both light and dark themes. A pale tile that works in light mode may need a darker or less luminous dark-theme treatment.
- Do not infer theme from hostname, URL, tenant, or environment. Consume the theme supplied by the host bridge.

## Source Ownership and Reuse

- Keep identity SVG source, palette tokens, names, and accessibility labels in a centralized icon module.
- Reuse one source of truth across manifests, fixed menus, headers, and tests.
- When server and React builds cannot consume the same representation, share neutral path and palette data or generate both representations from one maintained source.
- Do not duplicate long SVG strings across view providers or React components.
- Name icons by semantic role rather than visual appearance, for example `approvalIcon` rather than `orangeClipboardIcon`.
- Keep generated bundles as build artifacts; edit maintained TypeScript or TSX sources.

## Accessibility

- Give every icon-only interactive control an accessible name.
- Add a tooltip for unfamiliar icon-only actions; do not rely on the tooltip as the accessible name.
- Mark decorative icons and icons paired with visible equivalent text as `aria-hidden`.
- Provide meaningful `alt` text for standalone manifest and identity icons.
- Do not repeat visible labels in screen-reader output.
- Preserve a keyboard-visible focus state on the control containing the icon.
- Ensure status meaning remains understandable without color.

## SVG Safety

- Use trusted, compile-time SVG source for manifests and identity icons.
- Never persist or render user-provided SVG as trusted icon markup.
- Exclude scripts, event-handler attributes, `foreignObject`, external URLs, remote images, and unreviewed embedded data.
- Avoid external `<use>` references that depend on a sprite unavailable in the host renderer.
- Keep SVG markup minimal and compatible with the host sanitizer.

## Validation

Before finishing icon work:

- Verify identity icons at 16, 20, 24, and 32 px.
- Verify action icons at the actual button, menu, table, tab, and input sizes where they appear.
- Verify active, inactive, hover, focus, selected, disabled, destructive, and loading states.
- Verify light and dark host themes and any supported high-contrast mode.
- Verify accessible names, decorative hiding, tooltips, and keyboard focus.
- Verify manifest and fixed-menu rendering in the host, not only inside the iframe.
- Verify remote-view icons in the actual iframe runtime, not only in an isolated component preview.
- Verify no identity SVG is duplicated across maintained sources.
- Verify generated remote assets are rebuilt and current.
