# Workbench E2E and Visual Validation

Use this reference when an Agentic App adds or changes a Workbench view, remote component, multi-step interaction, host bridge, persistent editor state, or screenshot-driven UI.

## Golden principles

1. Treat E2E tests as executable product acceptance criteria, not merely page-load smoke tests.
2. Load the real built remote-component JavaScript and CSS. Do not validate only source components or a hand-written test substitute.
3. Exercise the workflow as a user would: open the feature, edit or select content, invoke the action, observe feedback, save, reload, and verify the result.
4. Assert both UI state and authoritative host/domain state. A visible success toast alone is not proof of a successful mutation.
5. Capture deterministic screenshots for visually significant states and compare them with the supplied reference, design system, and surrounding product UI.
6. Never hide an actual interaction defect with `force: true`, arbitrary sleeps, broad error suppression, or weakened assertions.
7. Treat a simulated View Host and an installed Xpert platform as complementary validation surfaces, not interchangeable ones.

## Representative View Host harness

Build a small test host when the platform does not already provide one. It should:

- load the same generated iframe entry and styles shipped by the plugin;
- send the real remote-component initialization envelope;
- implement only the declared bridge messages used by the view;
- keep an inspectable in-memory domain state for data, action, file-access, host-event, and Assistant-context requests;
- return realistic compact DTOs, revisions, failures, and asynchronous state transitions;
- fail the test on uncaught page errors and unexpected console errors;
- use small deterministic media and document fixtures;
- never embed credentials, production data, Bearer tokens, or portable Workspace references in the iframe fixture.

Prefer the platform's official View Host test harness when available. Do not duplicate platform internals beyond the bridge contract required by the plugin.

## Workflow coverage

For each important workflow, cover the relevant sequence:

```text
initial state
  -> user opens feature
  -> user supplies or selects input
  -> UI shows the derived state
  -> user invokes mutation
  -> host/domain state changes
  -> save or background work completes
  -> reload/reopen restores the expected state
  -> a downstream workflow still works
```

Include negative paths when meaningful: cancel, invalid input, stale revision, denied permission, missing file, failed background job, or local-dirty conflict. Clean up synthetic records and clips so one scenario cannot contaminate later assertions.

Use semantic locators based on accessible role, label, title, or stable `data-testid`. Avoid selectors tied to generated class names or incidental DOM depth.

Wait for observable state transitions rather than elapsed time. Examples include a status label, persisted revision, host request, media ready state, completed job, or changed document value. A fixed delay may be used only for a real debounce or animation contract and should be bounded tightly.

## Visual QA

When a user supplies screenshots or the change materially affects layout:

1. Reproduce the same interaction state, viewport class, locale, theme, and representative data.
2. Capture the whole workflow surface and, when useful, focused panel or component screenshots.
3. Compare hierarchy, spacing, typography, alignment, overflow, clipping, selection feedback, action prominence, disabled states, and responsive behavior.
4. Inspect minimum and typical panel sizes, not only a large viewport.
5. Verify that floating controls remain clickable and inside their intended surface.
6. Record intentional differences, such as retaining the Xpert design system instead of copying another product's theme.

Provide an opt-in screenshot path for repeatable local evidence, for example:

```sh
WORKBENCH_E2E_SCREENSHOT=/tmp/agentic-app-workbench.png \
  pnpm exec nx test:e2e <plugin-project>
```

Screenshot comparison supplements behavioral assertions; it does not replace them. Use pixel-diff thresholds only for stable, deterministic surfaces. For dynamic media, fonts, canvases, and animations, prefer state-specific visual inspection plus structural assertions.

## Validation boundary

A simulated-host E2E can verify plugin behavior, bridge contracts, persistence intent, reload logic, generated assets, and most UI regressions. It cannot prove the correctness of real platform authentication, authorization, tenant/organization isolation, cookies and CORS, Workspace File grants, Managed Queue workers, Sandbox Runtime capacity, plugin installation, or production networking.

Run an installed-platform browser pass when any of those capabilities are in scope. Verify the browser Network panel or platform logs when transport behavior matters, and use real user permissions and representative private files without exposing credentials to the remote component.

## Required completion evidence

For a substantive Workbench change, report the applicable evidence:

- production build and generated-asset freshness check;
- typecheck and focused unit/integration tests;
- full Workbench E2E result;
- screenshot/visual QA result when layout or reference imagery is involved;
- plugin harness or manifest validation;
- installed-platform validation, or an explicit statement that installation was not requested and remains unverified.

