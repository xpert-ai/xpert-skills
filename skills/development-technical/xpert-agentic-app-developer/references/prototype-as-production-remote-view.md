# Prototype-As-Production Remote View Development Standard

Use this standard when designing, implementing, reviewing, or accepting an interactive Xpert Extension View or Workbench Remote View. It defines how a prototype becomes production code without a visual rewrite or framework migration.

This standard is normative for interactive prototypes. A disposable sketch or static wireframe may still be used for early exploration, but it must not become the implementation source, behavior specification, or visual acceptance artifact.

## Required outcome

Build the prototype as the first production implementation of the View:

- one maintained React TypeScript component tree;
- the real `@xpert-ai/plugin-shadcn-ui` components and stylesheet;
- Tailwind utilities and shared semantic theme variables;
- the real Xpert remote-component bridge and message envelopes;
- one repeatable build that emits the `app.js` and `app.css` used by both preview and production;
- one typed UI-facing gateway whose preview adapter is a fixture and whose production adapter is the View Provider.

After visual and interaction acceptance, connecting the View to production must replace the adapter, data, permissions, and runtime infrastructure only. It must not require rebuilding the page from a separate HTML/CSS prototype.

```text
                         same TSX + same app.js/app.css
                                      |
                         typed Remote View gateway
                            /                     \
       shared Preview Host + fixture       Xpert View Host + View Provider
          synthetic business state          authorized persisted state
```

## Non-negotiable rules

### One UI source of truth

- Keep maintained UI source in `remote-components/<entry>/src/**/*.ts(x)`.
- Build the preview from the same entrypoint and generated assets that the View Provider ships.
- Never hand-copy accepted prototype markup into a second production component.
- Never hand-edit generated `app.js` or `app.css`.
- Never import a fixture, sample-data module, or preview configuration from a business component.
- Never branch inside business components on `preview`, `production`, hostname, iframe URL, or fixture presence.

Preview-specific code may exist only in the preview host configuration and adapter boundary. Production-specific code may exist only in the host/provider adapter and server-side implementation.

### Production component primitives from the start

- Import UI primitives from `@xpert-ai/plugin-shadcn-ui`; do not recreate an available primitive with native HTML plus bespoke CSS.
- Use the shared `Select` for ordinary selection and the shared searchable combobox pattern for searchable selection.
- Use official component props, variants, slots, and data attributes before adding consumer overrides.
- Do not add a custom `className` merely to reproduce the shared component's default appearance.
- Limit consumer styling to application layout, responsive behavior, content density, and domain-specific state that the shared component API does not represent.
- Prefer Tailwind utilities and semantic tokens over page-specific CSS selectors. Keep custom CSS small, local, and justified.
- Use Lucide or the platform icon contract instead of copied glyphs, emoji, or CSS-drawn substitutes when an appropriate icon exists.

Read [shadcn-ui.md](shadcn-ui.md) before implementation. Its import, component ownership, confirmation, theme installation, density, fallback, and computed-style rules remain mandatory.

### Real theme and runtime contract

- Load `@xpert-ai/plugin-shadcn-ui/style.css` in the real remote entrypoint.
- Apply host `--xui-*` tokens and install shadcn semantic variables through the shared theme installer.
- Propagate color scheme and density through the same bridge path used in production.
- Exercise portals, focus management, Escape handling, overlays, and keyboard navigation inside the iframe runtime.
- Do not define a parallel prototype token system or copy host theme variables into a standalone stylesheet.

A browser screenshot with plausible colors is insufficient. Acceptance requires computed semantic variables and representative component styles to resolve correctly.

## Contract-first prototype design

Define the runtime boundary before drawing detailed screen states:

1. View manifest key, host type, Feature gate, and remote entry.
2. Initial query and compact response DTO.
3. Paginated or tab-specific data requests.
4. JSON actions and file actions, including success and structured failure results.
5. Allowed client commands and their failure behavior.
6. Forwarded host events and refresh or merge behavior.
7. Locale, theme, density, permissions, and revision fields.

Use concrete TypeScript types for these contracts. The UI-facing gateway must expose the same method signatures in preview and production. Prefer stable result codes plus structured parameters to preview-only prose errors.

The component must not know whether a response came from a fixture or a database-backed provider.

## Preview adapter and fixture

Use the shared repository-level Preview Host described in [remote-view-preview-host.md](remote-view-preview-host.md). Keep only a `preview.config.mjs` and business fixture state beside the Remote View.

The fixture must:

- return the same compact DTO shapes as the real View Provider;
- accept the same query, action, file-action, client-command, and host-event envelopes that the screen uses;
- enforce useful revision, validation, and transition rules rather than returning success unconditionally;
- mutate authoritative in-memory state for successful operations;
- expose deterministic state for browser assertions and reload checks;
- contain synthetic, non-sensitive data only;
- remain outside production bundles.

For an authoritative mutation, the expected path is:

```text
user action -> executeAction -> fixture validates and mutates state
            -> structured result with revision -> UI requests fresh data
            -> refreshed state remains after iframe reload
```

A local-only React state update or success toast does not prove the action contract.

## Required state matrix

Prototype and review the states that materially affect structure or user decisions, not only the populated happy path:

- initializing and loading;
- populated and partially populated;
- empty with an actionable next step;
- field validation and action failure;
- permission denied or capability unavailable;
- stale revision or concurrent update conflict;
- long-running, retryable, cancelled, and completed execution where applicable;
- disabled, read-only, and pending-review controls;
- long labels, large counts, dense tables, and constrained width;
- light and dark theme;
- every supported density and representative responsive width.

Use deterministic fixture scenarios or query parameters to reach each required state. Do not encode a screenshot-only state inside the component.

## Development workflow

### 1. Establish the production skeleton

- Register the real View manifest and Feature ownership.
- Create the production TSX entrypoint, typed gateway, theme bootstrap, and i18n boundary.
- Add the repeatable asset generation and freshness check.

### 2. Implement with shared components

- Compose the screen from shadcn UI primitives and Tailwind layout utilities.
- Express business-specific status and hierarchy without restyling shared primitives by default.
- Preserve accessibility names, keyboard operation, focus order, and visible focus.

### 3. Add the preview adapter

- Create the plugin-owned fixture with representative data and state transitions.
- Launch the real built assets in the shared Preview Host.
- Keep all fixture selection outside the business component tree.

### 4. Iterate on real behavior

- Review visual hierarchy and responsive layout in the iframe.
- Exercise data requests, mutations, file actions, errors, host events, and reload behavior.
- Fix issues in the maintained production source and rebuild; never patch the preview artifact.

### 5. Connect production infrastructure

- Implement the real View Provider against the same typed contract.
- Add authorization, tenant and organization scoping, persistence, queues, files, and real client-command handlers at their proper boundaries.
- Remove no UI code when switching adapters. Any required screen rewrite signals that the prototype boundary was incorrect.

### 6. Validate both environments

- Run the Preview Host behavior and visual suite against real generated assets.
- Deploy the plugin and repeat platform-dependent paths in the installed host.
- Compare key preview and installed-host screenshots only after both use the same theme, density, locale, data shape, and viewport.

Read [workbench-e2e-visual-validation.md](workbench-e2e-visual-validation.md) for executable acceptance and installed-platform coverage.

## What local preview can and cannot prove

The shared Preview Host can prove:

- asset loading and bridge initialization;
- component composition, styling, responsive layout, and theme handling;
- query and action envelope compatibility;
- deterministic state transitions, host-event handling, and reload behavior;
- keyboard and iframe-local accessibility behavior.

It cannot by itself prove:

- authentication, authorization, tenant isolation, or server-side access control;
- real plugin registration, Feature gating, or middleware availability;
- cookies, CORS, Workspace Files, Managed Queue, or Sandbox Runtime behavior;
- ChatKit client-command registration in every intended host surface;
- database concurrency, durability, or production-scale performance.

These require an installed-platform pass. Never describe Preview Host evidence as full integration evidence.

## Prohibited migration pattern

Do not use this sequence:

```text
native HTML/CSS mockup -> copy class names -> recover missing CSS
                       -> translate controls to shadcn -> remap theme variables
                       -> rebuild host interactions -> production
```

It creates two UI architectures, makes screenshots depend on undeclared CSS, hides iframe and bridge defects until late, and turns component migration into reimplementation.

Use this sequence instead:

```text
typed contracts -> production TSX + shadcn + Tailwind
                -> real build in shared Preview Host
                -> accepted UI and interaction states
                -> real View Provider adapter
                -> installed-platform verification
```

## Review and completion gate

Do not approve the Remote View as ready for production unless all applicable statements are true:

- The prototype and installed View use the same maintained TSX entrypoint and generated assets.
- Shared shadcn components are used where available; native substitutes and redundant restyling have been removed.
- Tailwind and semantic host theme variables provide styling without a parallel prototype theme.
- Business components contain no fixture imports, environment sniffing, or preview-specific branches.
- Preview and production adapters satisfy the same typed UI contract.
- The fixture proves authoritative mutation, structured failure, revision, refresh, and reload behavior where applicable.
- Required loading, empty, error, permission, concurrency, long-running, theme, density, and responsive states were exercised.
- Generated assets pass freshness checks and were not edited manually.
- Installed-host checks cover every platform-dependent capability used by the View.
- Browser evidence verifies observable UI state and authoritative host/server state, not only clicks or toasts.

Record any justified exception next to the affected View with its owner, scope, reason, risk, and removal condition. An exception must not create a second maintained UI implementation.
