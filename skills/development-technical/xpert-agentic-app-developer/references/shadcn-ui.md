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
