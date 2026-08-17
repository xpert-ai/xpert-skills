# View Client Commands

Use this reference when an Xpert Remote View asks the current browser host to perform a UI-local action through `invokeClientCommand`, including opening another Workbench View, a knowledge document, or an Assistant conversation.

For `assistant.context.set`, use this closed-command protocol together with [extension-view-agent-context.md](extension-view-agent-context.md). This file governs command authorization and dispatch; the companion reference governs how runtime context becomes useful to tools or visible to the model.

## Contents

- [Capability Invariant](#capability-invariant)
- [Current Command Catalog](#current-command-catalog)
- [Declare the Source View Capability](#declare-the-source-view-capability)
- [Register the Host Handler](#register-the-host-handler)
- [Invoke the Command from the Remote View](#invoke-the-command-from-the-remote-view)
- [Define the Target View Query Contract](#define-the-target-view-query-contract)
- [Resolve Local and Host-Composed View Keys](#resolve-local-and-host-composed-view-keys)
- [`workbench.navigation.open` Targets](#workbenchnavigationopen-targets)
- [Test the Closed Protocol](#test-the-closed-protocol)
- [Diagnostic Order](#diagnostic-order)

## Capability Invariant

Treat a client command as a three-part capability contract:

1. The source View manifest allowlists the exact command key in `clientCommands`.
2. The current host surface registers a handler for the same key.
3. The Remote View invokes the key through the bridge and handles the structured result.

Require all three parts. Do not infer View permission from host registration, and do not infer host support from a manifest declaration.

The host must reject an undeclared command before dispatch. A typical rejection is:

```text
Client command 'workbench.navigation.open' is not available
```

Diagnose that message at the manifest allowlist first. Registering or debugging the handler cannot fix a missing `clientCommands` declaration.

## Current Command Catalog

Use this catalog as a quick index, not as proof that a command is available in the current host. Before implementation, verify the active `@xpert-ai/contracts` exports, the target host registration, and the source View manifest. Prefer public constants over copied string literals.

### Public platform commands

These keys are exported by the current `@xpert-ai/contracts` View Extension contract:

| Command constant | Command key | Purpose | Minimum useful payload |
| --- | --- | --- | --- |
| `ASSISTANT_CHAT_SEND_MESSAGE_COMMAND` | `assistant.chat.send_message` | Send a user message through the current Assistant ChatKit. | `{ text: string }` |
| `ASSISTANT_CONTEXT_SET_COMMAND` | `assistant.context.set` | Publish or clear View-scoped Assistant request context. | Set: `{ key, context?, env? }`; clear: `{ key, clear: true }` |
| `WORKBENCH_FILE_OPEN_COMMAND` | `workbench.file.open` | Open a host-managed file preview, optionally anchored to evidence. | `{ name, url, previewUrl?, evidence? }` |
| `WORKBENCH_NAVIGATION_OPEN_COMMAND` | `workbench.navigation.open` | Open a supported Workbench destination. | `{ target, ...targetIdentifiers }` |

Import these from `@xpert-ai/contracts`, or from an active package that deliberately re-exports the same public constants. Do not redeclare their string values in plugin source.

For `assistant.context.set`, follow [extension-view-agent-context.md](extension-view-agent-context.md); successful command dispatch alone does not make the context model-visible. For `workbench.navigation.open`, check the target-specific section below because hosts support different target subsets.

### Host-limited commands

The current hosts also contain commands that are not exported as general platform contracts:

| Command key | Current scope | Purpose | Minimum useful payload |
| --- | --- | --- | --- |
| `workbench.browser.open` | ClawXpert and Data-Xpert Agent Workbench | Open a URL in the host-managed browser preview. | `{ url, title? }` |
| `workbench.file.download` | Data-Xpert Agent Workbench | Download bounded text content as a local file. | `{ fileName, mediaType, content }` |

Treat these as host capabilities, not portable plugin APIs. Before declaring one, confirm the intended host registers the exact key and accepts the payload. If a command should become portable, promote its constant, payload type, handler contract, and tests into the public contracts layer instead of copying the local implementation.

### Current host support snapshot

This matrix summarizes current source registrations and may change. A check mark means a handler is registered, not that every payload or navigation target is supported.

| Command | Generic Xpert page | Shared Assistant shell | ClawXpert Workbench | Data-Xpert Agent Workbench |
| --- | --- | --- | --- | --- |
| `assistant.chat.send_message` | — | ✓ | ✓ | ✓ |
| `assistant.context.set` | — | ✓ | ✓ | ✓ |
| `workbench.file.open` | ✓ | ✓ | ✓ | ✓ |
| `workbench.navigation.open` | ✓ | ✓ | ✓ | ✓ |
| `workbench.browser.open` | — | — | ✓ | ✓ |
| `workbench.file.download` | — | — | — | ✓ |

`workbench.navigation.open` target support is narrower than command registration:

- Generic Xpert page and Shared Assistant shell currently support knowledgebase navigation only.
- ClawXpert Workbench currently supports knowledgebase documents, Assistant conversations, and extension Views.
- Data-Xpert Agent Workbench currently supports knowledgebase documents and Assistant conversations, but not extension View targets.

Do not confuse command keys with related protocol values:

- `knowledgebase.documents`, `assistant.conversation`, and `workbench.view` are navigation targets, not commands.
- `assistant.tool.completed`, `assistant.visualization.emitted`, and `assistant.citation.open` are host events, not commands.
- View `actions` call the provider backend; `hostEvents.subscriptions` deliver host-to-View events. Neither replaces `clientCommands`.

## Declare the Source View Capability

Import public command constants from the active contracts package instead of repeating string literals in provider code.

```ts
import {
  WORKBENCH_NAVIGATION_OPEN_COMMAND
} from '@xpert-ai/contracts'

const manifest: XpertExtensionViewManifest = {
  key: ORDER_REVIEW_VIEW_KEY,
  title: {
    en_US: 'Order Review',
    zh_Hans: '订单复核'
  },
  hostType: 'agent',
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: {
      isolation: 'iframe',
      entry: ORDER_REVIEW_REMOTE_ENTRY_KEY
    },
    dataSource: { mode: 'platform' }
  },
  clientCommands: [
    {
      key: WORKBENCH_NAVIGATION_OPEN_COMMAND,
      label: {
        en_US: 'Open related business page',
        zh_Hans: '打开关联业务页面'
      },
      description: {
        en_US: 'Open the related Workbench view or source record.',
        zh_Hans: '打开关联的工作台视图或来源记录。'
      }
    }
  ]
}
```

Declare only commands the View actually uses. Treat `clientCommands` as a least-privilege allowlist, not as descriptive metadata.

Keep these capability surfaces distinct:

- Use `targetAppMeta.capabilities` to describe application-level availability and Assistant compatibility.
- Use View manifest `clientCommands` to authorize iframe-to-host UI commands.
- Use View manifest `actions` for Remote View-to-provider backend operations.
- Use `hostEvents.subscriptions` for host-to-View browser-local events.

Do not substitute one surface for another.

## Register the Host Handler

Register the command in every host surface where the View may run. A handler registered only in one Assistant page does not make the command available in another chat layout, fixed Workbench, embedded Assistant, or mobile host.

```ts
import {
  WORKBENCH_NAVIGATION_OPEN_COMMAND
} from '@xpert-ai/contracts'

const unregister = registry.register(
  WORKBENCH_NAVIGATION_OPEN_COMMAND,
  async (payload) => openWorkbenchTarget(payload)
)
```

Prefer a shared registration helper when multiple host surfaces should behave consistently. Pass host-specific navigation callbacks into that helper instead of copying payload parsing and validation.

Return structured results:

```ts
type ClientCommandResult =
  | { success: true; status: 'opened'; target: string }
  | { success: false; code: string; message: string }
```

Return `unsupported` when the current host intentionally cannot perform the command. Do not silently ignore it or leak router, token, tenant, organization, Assistant, or API internals to the iframe.

## Invoke the Command from the Remote View

Use the bridge and the same public key. Do not navigate the top window directly from an isolated iframe.

```ts
import {
  WORKBENCH_EXTENSION_VIEW_TARGET,
  WORKBENCH_NAVIGATION_OPEN_COMMAND
} from '@xpert-ai/contracts'

const result = await remoteBridge.invokeClientCommand(
  WORKBENCH_NAVIGATION_OPEN_COMMAND,
  {
    target: WORKBENCH_EXTENSION_VIEW_TARGET,
    viewKey: SUPER_BOM_VIEW_KEY,
    selectionId: versionId,
    parameters: {
      tab: 'features'
    }
  }
)

if (!isSuccessfulClientCommand(result)) {
  showRecoverableNavigationError(result)
}
```

Keep `selectionId` and `parameters` scalar or scalar-array values. Do not send nested objects through `XpertViewQuery.parameters`; serialize a complex filter into one explicit JSON string only when the target provider deliberately supports that contract.

Handle bridge rejection and `{ success: false }` separately. Show a recoverable UI message and keep the current View usable.

## Define the Target View Query Contract

When opening another extension View, make the target manifest and provider accept the deep-link state explicitly.

```ts
dataSource: {
  mode: 'platform',
  querySchema: {
    supportsSelection: true,
    supportsParameters: true
  }
}
```

Consume the state through the normal host query path:

- Resolve `selectionId` to the selected business record.
- Read scalar `parameters` for tabs, modes, filters, or secondary selection.
- Return a stable empty or not-found state when the record is unavailable.
- Keep tenant and organization scoping in the provider.
- Preserve the deep-link state across refresh when the host contract supports it.

Do not add a link that only opens the destination shell while ignoring the requested business record.

## Resolve Local and Host-Composed View Keys

Distinguish the provider-local manifest key from the host-resolved key. The host may compose a globally unique key such as:

```text
<provider-key>__<local-view-key>
```

Prefer a host-issued canonical key when it is available. When a Remote View only owns a stable local key, make the host resolver:

1. Match an exact resolved key first.
2. Match a unique resolved key ending in `__<local-view-key>` only as an explicit compatibility path.
3. Reject zero or multiple matches with a structured error.

Do not spread suffix matching into plugin business code. Keep it at the host View-resolution boundary and test exact, unique-alias, missing, and ambiguous cases.

## `workbench.navigation.open` Targets

Use public target constants and payload contracts from `@xpert-ai/contracts`. The commonly supported targets are:

- Extension View: pass `viewKey`, optional `selectionId`, and optional scalar `parameters`.
- Knowledgebase documents: pass `knowledgebaseId`, optional `documentId`, and optional `parentId`.
- Assistant conversation: pass `conversationId`, with optional `threadId` and `executionId` when the host supports them.

Treat supported targets as a host contract, not a plugin assumption. Return `unsupported_target` for unknown targets and `bad_request` for missing identifiers.

## Test the Closed Protocol

Add tests at each boundary.

### Manifest test

- Assert that every command invoked by the generated Remote View is present in `manifest.clientCommands`.
- Assert that sensitive or unrelated commands are absent.
- Prefer the exported command constant in the assertion.

### Renderer and registry test

- Assert that an undeclared key is rejected before registry dispatch.
- Assert that a declared and registered key reaches the handler.
- Assert that a declared but unregistered key returns a structured unsupported result.
- Assert that the renderer validates the iframe window and `instanceId`.

### Host navigation test

- Cover every intended host surface.
- Verify exact View-key resolution before compatibility alias resolution.
- Verify `selectionId` and scalar `parameters` reach the target View unchanged.
- Verify missing, unsupported, and ambiguous targets remain recoverable.

### Remote View test

- Exercise the real built `app.js`, not only TSX helpers.
- Click the visible link or button and assert the exact command key and payload.
- Verify bridge rejection and `{ success: false }` produce usable error feedback.

### Installed-platform test

- Perform one real click-through in the installed plugin.
- Verify that the destination View opens, not merely that the source click handler ran.
- Verify that the requested record, tab, document, folder, or conversation is selected.
- Confirm that the browser console contains no `Client command ... is not available` error.

Do not consider unit tests sufficient for this protocol. Manifest resolution, host registration, composed View keys, and real iframe dispatch only meet in the installed host.

## Diagnostic Order

Use this order when navigation fails:

1. Inspect the resolved source View manifest and confirm the exact `clientCommands[].key`.
2. Confirm that the current host surface registered the exact key.
3. Inspect the iframe bridge message and compare the command key and `instanceId`.
4. Inspect the structured handler result before changing UI code.
5. Confirm target type and required identifiers.
6. Confirm exact or unique host-composed View-key resolution.
7. Confirm the target manifest accepts selection and parameters.
8. Confirm the target provider and Remote View consume the deep-link state.

Rebuild the Remote View asset and redeploy the plugin after source changes. A stale generated `app.js` or stale installed descriptor can otherwise preserve an already-fixed failure.
