# Layered Browser Interaction and Embedded UI Debugging

Use this reference when validating an installed Xpert page through a browser and ordinary click or type operations fail, especially around Shadow DOM, nested or cross-origin iframes, remote components, rich-text editors, or React-controlled `contenteditable` elements.

## Core workflow

Use one closed loop for every meaningful action:

```text
observe current state
  -> locate the real interactive boundary
  -> act through the narrowest reliable layer
  -> verify an observable postcondition
```

Observe again after navigation, modal transitions, iframe reloads, route changes, or any mutation that can replace the target node. Do not reuse stale element assumptions across those transitions.

Define the postcondition before acting. Examples include a changed route, opened dialog, updated field value, enabled submit button, emitted host request, persisted record, visible response, or disappeared loading state. A click that produced no verified state change is not success.

## Interaction escalation ladder

Start at the highest semantic layer and move down only when evidence shows why it cannot reach the target:

1. Use accessible roles, names, labels, placeholder text, or stable `data-testid` attributes on the current document.
2. Inspect the visible DOM, target geometry, enabled state, overlays, and hit target when the semantic locator is missing or ambiguous.
3. Detect Shadow DOM boundaries and locate the element within the correct shadow root instead of searching only the light DOM.
4. Detect iframe boundaries, switch to the correct frame context, then repeat semantic location inside that document.
5. For controlled editors, reproduce a genuine user edit sequence so the framework receives focus, selection, keyboard/input events, and the resulting change notification.
6. Use screen coordinates only for a bounded diagnostic or one-off sanity check after confirming geometry. Do not make coordinates the primary workflow.

After one failed semantic attempt, inspect rather than repeating the same locator. After a second failure, explicitly classify the boundary as ordinary DOM, Shadow DOM, iframe, canvas, overlay, or controlled editor and switch layers.

## Shadow DOM and iframe boundaries

Treat the browser UI as a composed tree, not one flat DOM. A host control can be visible while its actionable descendant lives inside a shadow root; a remote view can be visible while its editor belongs to another document.

For Shadow DOM:

- identify the shadow host first;
- determine whether the root is open and inspectable;
- locate and act inside the root with the same semantic-first rules;
- re-resolve the host after rerenders because shadow content can be replaced.

For iframes:

- identify the frame by stable host metadata, title, or surrounding view identity;
- wait for the frame document and its actual interactive state, not only the outer iframe element;
- perform interactions in the frame context and verify both inner UI state and host/domain state when the bridge is involved;
- expect cross-origin boundaries to limit direct DOM access and use the browser's frame-aware interaction surface or the application's declared bridge instead of bypassing the boundary.

Never open an embedded iframe `src` as a standalone page to make automation easier. The URL may contain short-lived credentials or sensitive bootstrap data, and the standalone document loses host initialization, callbacks, origin assumptions, event subscriptions, and bridge state. If direct preview is required, use the shared Preview Host with sanitized fixtures and the real bridge contract.

## Controlled inputs and rich-text editors

Changing `textContent`, `innerHTML`, or a DOM property with page JavaScript does not prove that a React-controlled input changed. The framework may retain the old state, restore it on the next render, keep the submit action disabled, or send a stale value.

For `input`, `textarea`, and `contenteditable` surfaces:

1. focus the real editable element;
2. establish the intended selection or caret position;
3. use keyboard-like fill, type, paste, or selection commands supported by the browser interaction layer;
4. verify the rendered value and any derived UI state such as validation, dirty state, or enabled actions;
5. submit through the visible user action;
6. verify the resulting request, response, or persisted state.

Use direct event injection only when the product contract explicitly requires an event shape that normal browser input cannot produce. If injection is necessary, dispatch the complete event sequence expected by the component and still verify framework-visible state before submission.

## Coordinate interaction constraints

Coordinate clicks are fragile because viewport size, zoom, scrolling, sticky headers, animation, overlays, and iframe placement can change the hit target. When coordinates are the only available diagnostic:

- capture or inspect the current screen immediately before acting;
- confirm the target rectangle and topmost hit target;
- perform only the bounded action;
- verify the postcondition immediately;
- return to semantic, shadow-root, frame, or event-aware interaction for the repeatable test.

Do not encode coordinate-only flows as acceptance tests.

## Failure diagnosis

Classify failures before choosing the next action:

| Symptom | Likely boundary | Next check |
| --- | --- | --- |
| Element is visible but locator returns nothing | Shadow DOM or iframe | Inspect hosts and frame documents |
| Click reports success but UI does not change | Overlay, wrong hit target, disabled state, or stale node | Inspect geometry and define the expected state transition |
| Text appears but submit remains disabled | Controlled input state was not updated | Repeat with real focus, selection, and input events |
| Frame works alone but not in the host, or vice versa | Missing bridge/bootstrap context | Validate through the host or shared Preview Host |
| A selector worked before navigation and now fails | Node or frame was replaced | Observe again and re-resolve the target |
| Repeated retries produce inconsistent results | Timing contract or unstable locator | Wait for a concrete state and add a stable accessible/test contract |

Prefer fixing the product's accessibility and testability contract when reliable interaction requires persistent low-level workarounds. Add stable labels or test IDs, expose deterministic readiness state, keep iframe titles meaningful, and make host/remote bridge transitions observable.

## Security and evidence

- Never print, copy, or navigate to URLs containing tokens, client secrets, signed workspace references, or bootstrap credentials.
- Keep authentication in the existing signed-in host session.
- Do not scrape Local Storage, cookies, or network headers for credentials.
- Record the user-visible path, boundary encountered, action used, verified postcondition, and any remaining platform-dependent limitation.
- For important workflows, verify authoritative API or domain state in addition to visible success feedback.

