# Platform Collaboration

Use `platform.collaboration` when a plugin needs users, Agents, or system jobs to edit one live business resource together. Let the platform own Yjs persistence, state-vector synchronization, sessions, WebSocket transport, cross-node propagation, and presence. Keep the plugin responsible for its Yjs schema, resource authorization, business projection, UI, and version policy.

## Contents

1. [Responsibility boundary](#responsibility-boundary)
2. [Prepare the plugin](#prepare-the-plugin)
3. [Register a document provider](#register-a-document-provider)
4. [Use the server runtime capability](#use-the-server-runtime-capability)
5. [Create a browser collaboration session](#create-a-browser-collaboration-session)
6. [Connect a browser client](#connect-a-browser-client)
7. [Project presence into the UI](#project-presence-into-the-ui)
8. [Publish presence](#publish-presence)
9. [Represent Agent operations](#represent-agent-operations)
10. [Handle materialization and strong reads](#handle-materialization-and-strong-reads)
11. [Archive and delete documents](#archive-and-delete-documents)
12. [Security rules](#security-rules)
13. [Testing checklist](#testing-checklist)

## Responsibility boundary

Use this ownership model:

| Concern | Owner |
| --- | --- |
| Yjs schema and field meaning | Plugin |
| Business resource authorization | Plugin Provider |
| Initial Yjs state | Plugin Provider |
| Business entity projection | Plugin Provider |
| Complete authoritative Yjs state | Platform |
| Update sequence and hash idempotency | Platform |
| WebSocket gateway and reconnect repair | Platform |
| Session credentials | Platform |
| User, Agent, and system presence | Platform |
| Business versions, save, finalize, export | Plugin |

Do not create a plugin-specific WebSocket Gateway, Redis presence store, collaboration session table, or update journal. Do not treat a plugin business entity as a second authoritative document after migration.

The capability currently uses Yjs. It transports binary state as base64 DTO fields and never passes a `Y.Doc` across the plugin runtime boundary. Import and own one compatible `yjs` runtime in the plugin.

## Prepare the plugin

Use compatible contracts and SDK versions and add Yjs as a direct plugin dependency:

```json
{
  "peerDependencies": {
    "@xpert-ai/contracts": "^<supported-version>",
    "@xpert-ai/plugin-sdk": "^<supported-version>"
  },
  "dependencies": {
    "yjs": "^13.6.0"
  }
}
```

Import the platform API from the SDK:

```ts
import {
  CollaborationDocumentProvider,
  CollaborationRuntimeCapability,
  XPERT_RUNTIME_CAPABILITIES_TOKEN,
  type CollaborationMaterializationEvent,
  type CollaborationProviderContext,
  type ICollaborationDocumentProvider,
  type RuntimeCapabilityRegistry
} from '@xpert-ai/plugin-sdk'
```

Use a stable provider key in the form `<plugin-or-product>.<resource-type>`, for example:

```ts
export const BOARD_COLLABORATION_PROVIDER = 'canvas.board'
```

Never include a tenant, organization, user, or resource id in the provider key. Supply the business id separately as `resourceId`.

## Register a document provider

Register one Provider for each collaborative resource type. Make every lifecycle method idempotent because initialization can race and materialization can retry.

```ts
import { Injectable } from '@nestjs/common'
import * as Y from 'yjs'

@Injectable()
@CollaborationDocumentProvider(BOARD_COLLABORATION_PROVIDER)
export class BoardCollaborationProvider implements ICollaborationDocumentProvider {
  constructor(private readonly boards: BoardService) {}

  async authorize(context: CollaborationProviderContext) {
    return this.boards.canAccess({
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      boardId: context.resourceId,
      operation: context.operation
    })
  }

  async initializeDocument(context: CollaborationProviderContext) {
    const board = await this.boards.requireBoard(context.resourceId, context)
    const doc = createBoardYDoc(board)

    return {
      stateBase64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'),
      schemaVersion: 1,
      initialSequence: board.revision,
      metadata: { kind: 'board' }
    }
  }

  async materializeDocument(event: CollaborationMaterializationEvent) {
    const doc = new Y.Doc()
    Y.applyUpdate(doc, Buffer.from(event.stateBase64, 'base64'))
    const view = materializeBoardYDoc(doc)

    await this.boards.projectCollaborationState({
      boardId: event.resourceId,
      scope: event,
      sequenceNumber: event.sequenceNumber,
      stateBase64: event.stateBase64,
      stateVectorBase64: event.stateVectorBase64,
      view
    })
  }

  async onDocumentDeleted(context: CollaborationProviderContext) {
    await this.boards.removeCollaborationMirror(context.resourceId, context)
  }
}
```

Add the Provider to `@XpertServerPlugin({ providers: [...] })`.

Follow these Provider rules:

- Authorize the exact `resourceId` inside `tenantId` and `organizationId` scope.
- Distinguish `read`, `write`, `manage`, `initialize`, `materialize`, and `delete` when business permissions differ.
- Return the same initial state for repeated calls over unchanged business data.
- Preserve a legacy business revision with `initialSequence` during migration.
- Do not create a business version from `initializeDocument` or `materializeDocument`.
- Project by `sequenceNumber`; accept a retry of the same or a newer complete state.
- Keep materialization free of network broadcasts that could create update loops.

## Use the server runtime capability

Inject the scoped runtime registry into a plugin service. The platform binds tenant, organization, workspace, user, and Agent execution identity to this registry.

```ts
import { Inject, Injectable } from '@nestjs/common'

@Injectable()
export class BoardCollaborationService {
  constructor(
    @Inject(XPERT_RUNTIME_CAPABILITIES_TOKEN)
    private readonly capabilities: RuntimeCapabilityRegistry
  ) {}

  private collaboration() {
    return this.capabilities.require(CollaborationRuntimeCapability)
  }
}
```

Do not accept tenant or organization ids from a browser payload and forward them as authority. Use the runtime-scoped capability and let the Provider verify the resource.

Ensure a document lazily:

```ts
const document = await this.collaboration().ensureDocument({
  providerKey: BOARD_COLLABORATION_PROVIDER,
  resourceId: boardId,
  schemaVersion: 1
})
```

Submit a server-side mutation by reading the authoritative state, generating a Yjs delta, and applying only that delta:

```ts
const collaboration = this.collaboration()
const document = await collaboration.ensureDocument({
  providerKey: BOARD_COLLABORATION_PROVIDER,
  resourceId: boardId,
  schemaVersion: 1
})
const state = await collaboration.getDocumentState({ documentId: document.id })

const doc = new Y.Doc()
Y.applyUpdate(doc, Buffer.from(state.updateBase64, 'base64'))
const before = Y.encodeStateVector(doc)

doc.transact(() => {
  patchBoardYDoc(doc, input)
}, 'board:rename-element')

const update = Y.encodeStateAsUpdate(doc, before)
await collaboration.applyUpdate({
  documentId: document.id,
  updateBase64: Buffer.from(update).toString('base64'),
  origin: 'board:rename-element',
  actor: {
    actorType: 'agent',
    actorKey: executionActorKey,
    displayName: xpertName
  }
})
```

Use `expectedSequence` only for destructive or order-sensitive operations such as replacing an entire order, deleting a resource, or restoring a snapshot:

```ts
await collaboration.applyUpdate({
  documentId: document.id,
  updateBase64,
  origin: 'board:restore-snapshot',
  expectedSequence: state.sequenceNumber
})
```

Do not require `expectedSequence` for normal CRDT field editing. Let Yjs merge concurrent updates.

## Create a browser collaboration session

Create the session on the server after the plugin resource has been authorized:

```ts
const document = await collaboration.ensureDocument({
  providerKey: BOARD_COLLABORATION_PROVIDER,
  resourceId: boardId,
  schemaVersion: 1
})

const session = await collaboration.createSession({
  documentId: document.id,
  access: canEdit ? 'write' : 'read'
})
```

Return the session through an authenticated View Extension action. The descriptor contains:

- `sessionId`
- one-time `clientKey`
- `documentId`
- fixed `namespace`
- backend-generated `connectionUrl`
- `read` or `write` access
- safe actor identity
- `expiresAt`

Never send the Remote Component a platform token, tenant id, organization id, or raw user primary key. Never replace `connectionUrl` with `window.location.origin`; frontend and backend base URLs can differ.

## Connect a browser client

Let the Remote Component own its Yjs and Socket.IO dependencies. Adapt them to the framework-neutral SDK client:

```ts
import { io } from 'socket.io-client'
import * as Y from 'yjs'
import {
  createCollaborationClient,
  createCollaborationPresenceStore,
  createSocketIoTransportAdapter,
  createYjsDocumentAdapter
} from '@xpert-ai/plugin-sdk'

const doc = new Y.Doc()
const socket = io(session.connectionUrl, {
  autoConnect: false,
  transports: ['websocket'],
  auth: {
    sessionId: session.sessionId,
    clientKey: session.clientKey,
    documentId: session.documentId
  }
})

const presenceStore = createCollaborationPresenceStore({
  selfActor: session.actor,
  onChange: ({ collaborators, remoteSessions }) => {
    setCollaborators(collaborators)
    renderRemotePresence(remoteSessions)
  }
})

const client = createCollaborationClient({
  session,
  transport: createSocketIoTransportAdapter(socket),
  document: createYjsDocumentAdapter(doc, {
    applyUpdate: (target, update, origin) => Y.applyUpdate(target, update, origin),
    encodeStateVector: (target) => Y.encodeStateVector(target),
    mergeUpdates: (updates) => Y.mergeUpdates(updates)
  }),
  initialPresence: { mode: 'edit' },
  batchMs: 40,
  syncIntervalMs: 2_000,
  presenceHeartbeatMs: 5_000,
  onAck: (ack) => setRevision(ack.sequenceNumber),
  onPresence: presenceStore.upsert,
  onPresenceSnapshot: (items, { selfClientId }) => presenceStore.replace(items, selfClientId),
  onPresenceRemove: presenceStore.remove,
  onConnectionChange: setConnectionState,
  onError: reportCollaborationError
})

client.connect()
```

Call `client.disconnect()` when switching resources or unmounting the view. The client removes listeners and timers and makes a best-effort flush of queued local updates.

The SDK uses a stable `client.remoteOrigin` for server-applied updates. If plugin observers perform side effects, ignore this origin to avoid echoing remote work back to the server.

Clear both the client and its presence projection when switching resources or unmounting:

```ts
client.disconnect()
presenceStore.clear()
```

## Project presence into the UI

Treat actor identity and connection identity as different concepts:

- `presenceId` is a stable, opaque identity for one user, Agent, or system actor.
- `clientId` identifies one browser tab, device, or virtual presence session.
- `selfClientId` identifies the exact Socket connection owned by the current client. It can change after reconnecting.

Use the presence store snapshot according to the rendering purpose:

| Projection | Use it for | Identity rule |
| --- | --- | --- |
| `collaborators` | Avatar group and collaborator count | Deduplicate by `presenceId`; include `session.actor` even when alone. |
| `remoteSessions` | Cursors, selections, focus rings, and canvas badges | Exclude only `selfClientId`; preserve another tab owned by the same actor. |
| `sessions` | Diagnostics or session-level indicators | Keep every active `clientId`. |

Never implement remote presence as `items.filter((item) => item.presenceId !== session.actor.presenceId)`. That removes every other tab owned by the current user and can make the collaborator UI disappear. Do not cache the first Socket id as permanent identity; pass the `selfClientId` delivered with every presence snapshot to `presenceStore.replace`.

The platform stores each client presence with an independent TTL. The SDK also removes silent remote sessions locally when their refreshes stop, covering a lost `presence-remove` event. Keep the avatar group visible when only the local actor is present, and use responsive sizing or overflow rather than hiding the entire group on narrow workbenches.

## Publish presence

Publish only compact UI location and status:

```ts
client.setPresence({
  pageId: activePageId,
  pointer: { pageId: activePageId, x: normalizedX, y: normalizedY, visible: true },
  focus: { kind: 'element', pageId: activePageId, elementId: selectedElementId },
  selection: { kind: 'elements', elementIds: selectedElementIds },
  viewport: { zoom, width: canvasWidth, height: canvasHeight },
  mode: 'edit'
})
```

For collaborative text, encode Yjs Relative Positions into `anchorRelativeBase64` and `headRelativeBase64`. Do not send absolute character offsets when concurrent edits can move the range.

Use normalized pointer coordinates in the 0..1 page coordinate system. Render presence in the outer application DOM when the editable visual is isolated in a Shadow DOM.

Do not put document text, element props, access tokens, arbitrary plugin JSON, or media bytes in presence. Presence is ephemeral, size-limited, and expires when heartbeats stop.

## Represent Agent operations

Use virtual presence for an Agent tool that reads or mutates a specific document:

```ts
await collaboration.upsertVirtualPresence({
  documentId: document.id,
  actor: {
    actorType: 'agent',
    actorKey: `${xpertId}:${agentKey}:${conversationId}:${document.id}`,
    displayName: xpertName
  },
  presence: {
    status: 'editing',
    toolName: 'board_patch_element',
    operationLabel: 'Updating chart colors',
    pageId,
    focus: { kind: 'control', pageId, elementId, fieldKey: 'palette' }
  }
})
```

Update the status to `done` or `failed` after the tool finishes, or remove it explicitly:

```ts
await collaboration.removeVirtualPresence({
  documentId: document.id,
  actorKey
})
```

Prefer the Xpert title/name for `displayName`. Keep `actorKey` stable for one xpert/agent/conversation/document combination. Do not create one collaborator identity per tool call.

Do not invent a pointer for an Agent. If the tool input identifies a page, element, text field, or control, publish that semantic focus and render a badge near the target.

## Handle materialization and strong reads

Treat platform Yjs state as authoritative and the plugin entity as a materialized view.

After `applyUpdate`, the platform:

1. commits the complete Yjs state and immutable update row;
2. broadcasts the accepted update;
3. calls `materializeDocument`;
4. records `materializedSequence` on success;
5. queues a retry when materialization fails.

Do not roll back the CRDT update because a plugin projection failed. Make `materializeDocument` safe to retry against complete current state.

Before save-version, finalize, export, or another strongly consistent action:

1. call `ensureDocument`;
2. call `getDocumentState` without a state vector;
3. materialize or derive the operation input from that state;
4. bind the resulting business version/export to its sequence and checksum.

Do not create a business version from ordinary editing, presence, playback, reconnect, or export unless the product explicitly defines export as a versioning action.

## Archive and delete documents

Use `archiveDocument` to stop normal editing while retaining state:

```ts
await collaboration.archiveDocument({ documentId })
```

Use `deleteDocument` for platform soft deletion and optional Provider cleanup:

```ts
await collaboration.deleteDocument({ documentId })
```

The plugin remains responsible for business-record retention, immutable versions, Artifacts, and Workspace Files. Do not delete published files merely because a live collaboration document was archived.

## Security rules

- Derive scope from the injected runtime, not caller-controlled ids.
- Authorize every Provider operation against the exact business resource.
- Use only the backend-provided `connectionUrl`.
- Keep browser sessions single-document and short-lived.
- Never expose platform tokens or internal scope ids to a Remote Component.
- Keep update origins, focus keys, labels, and selections bounded.
- Reject unknown element or field keys before mutating the Yjs schema.
- Sanitize URLs, SVG, HTML, and file references in plugin business logic.
- Keep presence free of content and credentials.
- Do not pass `Y.Doc` through the runtime capability boundary.
- Do not use Workspace Files as a live collaboration-state database.

## Testing checklist

Test at least:

- Provider initialization is idempotent.
- Provider authorization rejects cross-tenant and cross-organization access.
- Two clients editing different fields merge successfully.
- Same-field conflicts converge deterministically.
- Duplicate update bytes do not advance sequence twice.
- `expectedSequence` rejects a stale destructive operation.
- A state-vector request returns a real delta.
- A read-only session cannot submit updates.
- An expired or invalid session cannot connect.
- Reconnect restores missed updates.
- Presence heartbeat, snapshot, removal, and expiry work.
- The initial presence snapshot reports the exact `selfClientId`, and reconnect updates it.
- The collaborator list includes the local actor when no remote session exists.
- Two tabs owned by the same user produce one collaborator and one remote session per opposite tab.
- Different users are deduplicated by actor while their cursor sessions remain independent.
- A silent remote session is removed locally even when `presence-remove` is lost.
- Narrow Workbench layouts keep the collaborator control visible and usable.
- User, Agent, and system presence coexist.
- Agent focus renders without a fabricated pointer.
- Materialization failure retries and catches up to the latest sequence.
- Version creation and export read authoritative state.
- Ordinary editing and presence do not create business versions.
- Backend restart and plugin reinstall preserve existing collaborative documents.

For cluster validation, run two API nodes against the same database and Redis. Verify update and presence propagation through pub/sub, then temporarily interrupt Redis and confirm periodic state-vector synchronization restores convergence.
