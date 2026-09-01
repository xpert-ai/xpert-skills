# Extension View Navigation Parameters

Use this reference when an Xpert Extension View or Workbench Remote View exposes deep-linkable selection, route, filter, tab, pagination, sort, or layout state, or when it opens Assistant execution records while the current View must remain selected.

Use it together with [view-client-commands.md](view-client-commands.md) when the Remote View calls `workbench.navigation.open`. That reference defines command authorization and payloads; this one defines how plugin code declares, sends, restores, and tests View parameters.

Platform router implementation is intentionally out of scope. Plugin developers need the public View-query contract and its observable guarantees, not host route names, internal query keys, or framework-specific navigation code.

## Contents

- [Plugin and Platform Boundary](#plugin-and-platform-boundary)
- [Declare the Query Contract](#declare-the-query-contract)
- [Send Complete Plugin State](#send-complete-plugin-state)
- [Restore State from `initialQuery`](#restore-state-from-initialquery)
- [Separate Business State from UI-Only State](#separate-business-state-from-ui-only-state)
- [Open Assistant Execution Records](#open-assistant-execution-records)
- [Tests](#tests)
- [Diagnostic Order](#diagnostic-order)

## Plugin and Platform Boundary

The plugin owns:

- the meaning and defaults of `selectionId` and `parameters`;
- the View manifest declaration for supported query features;
- the complete public payload sent through the Remote View bridge;
- parsing every relevant `initialQuery` delivered by the host;
- deciding which parameter changes require provider data to reload;
- plugin unit tests and installed-platform acceptance tests.

The platform owns:

- serialization of the active resolved View and `XpertViewQuery` into browser navigation state;
- Assistant conversation and thread route changes;
- restoring the active View query after refresh and browser back-forward;
- keeping a valid fixed View selected while a supported Assistant conversation opens.

Plugin code must not construct host or ChatKit URLs, mutate the top-level `location` or History API, depend on private host query-parameter names, or copy host router logic. Treat the platform behavior above as a black-box contract. If the plugin sends and consumes the public contract correctly but the host later omits valid selection or parameters, report a platform defect instead of hiding it with cached or guessed business state.

## Declare the Query Contract

Declare deep-link support in the target View manifest:

```ts
dataSource: {
  mode: 'platform',
  querySchema: {
    supportsSelection: true,
    supportsParameters: true
  }
}
```

Define one typed plugin state and one mapping to `XpertViewQuery`:

```ts
interface ReviewViewState {
  projectId?: string
  route: 'overview' | 'workflow'
  section: 'setup' | 'authoring'
  tab: 'runs' | 'output'
  inspector: 'open' | 'collapsed'
}

function toViewQuery(state: ReviewViewState): XpertViewQuery {
  return {
    selectionId: state.projectId,
    parameters: {
      route: state.route,
      section: state.section,
      tab: state.tab,
      inspector: state.inspector
    }
  }
}
```

Rules:

- Put the primary business identity in `selectionId` when the View supports selection.
- Keep `parameters` values scalar or scalar arrays.
- Serialize a genuinely complex filter into one documented JSON string only when necessary, and tolerate malformed input by using safe defaults.
- Give every field a stable default so missing, older, or manually edited links recover predictably.
- Normalize all incoming values before comparing them or requesting data.
- Do not put tokens, API URLs, tenant or organization ids, sensitive evidence, or large business payloads in navigation parameters.

## Send Complete Plugin State

When plugin UI state should become deep-linkable, compute one complete next state and send it once through the public bridge:

```ts
const next: ReviewViewState = {
  ...current,
  tab: nextTab
}

const query = toViewQuery(next)

const result = await remoteBridge.invokeClientCommand(
  WORKBENCH_NAVIGATION_OPEN_COMMAND,
  {
    target: WORKBENCH_EXTENSION_VIEW_TARGET,
    viewKey: REVIEW_VIEW_KEY,
    selectionId: query.selectionId,
    parameters: query.parameters
  }
)
```

Use the same `next` value for local UI state and the command payload. Do not schedule several partial navigation commands or read stale React closures after state updates. A small typed navigation adapter should normalize values, produce the complete query, invoke the command, and surface structured failure without clearing the current View.

Use a host-issued canonical View key when the public context provides one. If plugin code only knows its local manifest key, follow the key-resolution guidance in [view-client-commands.md](view-client-commands.md); do not duplicate host key-composition rules inside business components.

## Restore State from `initialQuery`

Treat the query in every relevant Remote View `init` message as the authoritative public navigation state. Parse `message.initialQuery` through one typed normalizer rather than reading host URL fields directly:

```ts
function fromInitialQuery(query: XpertViewQuery | undefined): ReviewViewState {
  const parameters = query?.parameters ?? {}

  return {
    projectId: typeof query?.selectionId === 'string' ? query.selectionId : undefined,
    route: parameters.route === 'workflow' ? 'workflow' : 'overview',
    section: parameters.section === 'authoring' ? 'authoring' : 'setup',
    tab: parameters.tab === 'output' ? 'output' : 'runs',
    inspector: parameters.inspector === 'collapsed' ? 'collapsed' : 'open'
  }
}
```

Do not treat `initialQuery` as initialization-only despite its name. The host may reflect navigation changes through another `init`; apply the normalized state again. Keep the handler idempotent so a reflected query does not remount the View, erase unsaved local work, or request the same provider data twice.

## Separate Business State from UI-Only State

Classify every plugin parameter by behavior:

- **Business state** changes provider data: route, selected record, workflow section, filters, pagination, search, or sort.
- **UI-only state** changes presentation without changing the provider request: collapsed panel, inspector visibility, or a layout preference.

Build a canonical key from every business field and no UI-only fields:

```ts
function businessStateKey(state: ReviewViewState) {
  return JSON.stringify([
    state.projectId,
    state.route,
    state.section,
    state.tab
  ])
}
```

On each relevant `init`:

1. Parse and normalize the complete `initialQuery`.
2. Apply UI-only fields so refresh and back-forward remain accurate.
3. Compare the canonical business key with the last applied key.
4. Reload provider data once when the business key changed.
5. When only UI state changed, update in place without remounting or refetching.

If a visual mode changes the provider query or returned data shape, classify it as business state. The distinction is behavioral, not based on the field name.

## Open Assistant Execution Records

Persist the public `conversationId`, `threadId`, and `executionId` returned by the Assistant Task runtime. Open an execution record with `workbench.navigation.open` and the Assistant conversation target as described in [view-client-commands.md](view-client-commands.md). Do not add host URL fields or router state to the command payload.

The observable contract is that opening execution records A and B consecutively selects the requested ChatKit runs while the current plugin View remains on the same deep-linked business page. The plugin should continue to accept reflected `initialQuery` values, but it is not responsible for implementing or repairing the platform's conversation-route preservation.

A characteristic platform-state failure is: the first execution opens correctly because the iframe still displays in-memory state, then the second execution, refresh, or back-forward returns the View to its default page. Inspect the state immediately after the first click; that is often when the public View query first stops being preserved even though the visible iframe has not changed yet.

## Tests

### Plugin tests

- A complete `initialQuery` restores selection, route, filters, tab, and UI-only state.
- Missing or invalid parameters produce documented defaults.
- The typed navigation adapter sends the complete `selectionId` and `parameters` in one command.
- A reflected `init` with the same business key does not remount or request data again.
- A UI-only change updates presentation without provider data loading.
- An actual business-state change requests the expected data exactly once.
- Each execution marker sends its own conversation, thread, and execution handles.

### Installed-platform acceptance test

1. Open a nested plugin business page rather than the View home page.
2. Record its public View selection and parameters.
3. Open execution record A, then execution record B without reopening the View.
4. Verify both requested ChatKit executions open and the plugin View remains on the same business page.
5. Refresh and verify the same page restores.
6. Exercise browser back-forward and a UI-only state such as a tab or panel collapse.
7. Confirm UI-only changes do not show a full business-data loading cycle.

These are black-box integration checks. They validate the plugin/platform contract without requiring platform source code in the plugin skill.

## Diagnostic Order

When a View returns to its default page during Assistant navigation:

1. Confirm the source manifest enables selection and parameters and allowlists the navigation command.
2. Inspect the plugin's outgoing bridge payload; verify the expected public command key and handles or complete View query.
3. Log normalized `initialQuery` values received before and after the first and second actions.
4. Confirm the parser handles repeated `init` messages and does not reset valid state through defaults or stale closures.
5. Use the browser URL only as black-box evidence to locate when state disappeared; do not encode its private field names in plugin code.
6. Reload the final URL to separate deep-link recovery from iframe memory.
7. If the plugin payload and parser are correct but the host no longer supplies the previous selection or parameters, file or fix a platform state-preservation defect.

Fix plugin code only when it violates the public contract. Do not compensate for a platform loss by guessing a record, silently returning to a cached selection, suppressing legitimate `init` messages, or copying platform navigation logic into the plugin.
