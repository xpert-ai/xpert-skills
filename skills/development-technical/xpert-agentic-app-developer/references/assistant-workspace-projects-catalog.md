# Share Project Files Through The Assistant `projects` Workspace Catalog

Use this reference when a plugin needs a Project-bound Assistant workspace: a business project, case, engagement, job, or similar entity can own an isolated file space, and every explicitly connected Assistant can share those files with its Primary Agent and specialist subagents.

The sharing boundary is the platform Chat Project, not one Assistant. Connecting multiple Assistants to the same Project lets them reuse the same Workspace Files, FileAssets, and FileChunks without copying files into separate `xperts` catalogs.

## Invariants

Keep these contracts true across the server, Assistant template, View, and tests:

1. Keep the plugin business id and platform Chat Project id distinct.
2. Persist a one-to-one mapping from the business entity to `workspaceProjectId`.
3. Use the business id for domain APIs and persistence relations.
4. Use `workspaceProjectId` for Workspace Files, FileAsset, conversations, Assistant Tasks, and Agent runtime scope.
5. Create the Chat Project id before provisioning and reuse it across retries.
6. Block uploads and file-dependent runs until Project synchronization is ready.
7. Keep conversation `projectId` immutable after creation.
8. Never fall back to the Assistant-wide `xperts` catalog when the product requires project isolation.
9. Derive scope from trusted runtime or server-side mappings, never from Agent-selected arguments.
10. Require both Project access and an explicit Project-to-Assistant connection before any Assistant can use the shared files.

## Choose `projects` Deliberately

Use `catalog: 'projects'` when one business entity needs all of the following:

- an isolated set of source, generated, preview, and export files;
- multiple conversations scoped to the same business entity;
- identical Project-file visibility for the Primary Agent and subagents within an Assistant;
- the same files shared across multiple Assistants that are explicitly connected to the Project;
- a platform-visible Project connected to one or more Assistants;
- lifecycle synchronization such as rename, archive, and restore.

Do not use this pattern when files intentionally belong to the whole Assistant or the current user independently of a business entity. In those cases, select the appropriate Catalog explicitly and document its ownership and sharing model.

## Understand The Two Sharing Layers

Project scope supports sharing at two levels:

| Layer | Shared through the Project | Still isolated |
| --- | --- | --- |
| Within one Assistant | Primary Agent, workflow coordinator, specialist subagents, retries, and sandbox runs use the same Project files | Agent capability and role boundaries still apply |
| Across connected Assistants | Workspace Files, FileAssets, FileChunks, parsed-file search, preview, and generated/exported files | Conversation history, prompts, tools, memory, and Assistant-specific configuration remain scoped to each Assistant |

Do not describe a shared Project as a shared conversation or shared capability graph. Conversation discovery remains keyed by `xpertId + projectId`; two Assistants can read the same Project file while maintaining separate conversation histories and different least-privilege tool sets.

## Model Two Identities

Add a stable mapping and explicit synchronization state to the plugin entity:

```ts
type WorkspaceSyncStatus = 'provisioning' | 'ready' | 'failed'

type DomainProject = {
  id: string
  name: string
  archivedAt: Date | null
  workspaceProjectId: string
  workspaceSyncStatus: WorkspaceSyncStatus
  workspaceSyncError: string | null
}
```

Add a tenant-scoped unique index for `workspaceProjectId`. Do not overload `id` or accept either identity through one ambiguous `projectId` parameter. Prefer names such as:

- `businessProjectId` or domain-specific `caseId` at the business boundary;
- `workspaceProjectId` in the entity and DTO;
- `projectId: workspaceProjectId` only at platform capability boundaries.

Keep the plugin business scope key anchored to the owning Assistant/Xpert. A runtime Project id chooses the Workspace volume; it must not silently replace the plugin's tenant, organization, Assistant, or domain scope.

## Provision Idempotently

Use `ProjectProvisioningRuntimeCapability` from `@xpert-ai/plugin-sdk`:

```ts
import {
  ProjectProvisioningRuntimeCapability,
  XPERT_RUNTIME_CAPABILITIES_TOKEN,
  type RuntimeCapabilityRegistry
} from '@xpert-ai/plugin-sdk'
```

Generate both ids before the first platform call, save the mapping, and then synchronize:

```ts
const businessProjectId = randomUUID()
const workspaceProjectId = randomUUID()

const entity = await repository.save(repository.create({
  id: businessProjectId,
  workspaceProjectId,
  workspaceSyncStatus: 'provisioning',
  workspaceSyncError: null,
  name: input.name,
  archivedAt: null
}))

await synchronizeWorkspaceProject(scope, entity)
```

Implement synchronization as a state transition around one idempotent `ensure` call:

```ts
async function synchronizeWorkspaceProject(scope: TrustedScope, entity: DomainProject) {
  entity.workspaceSyncStatus = 'provisioning'
  entity.workspaceSyncError = null
  await repository.save(entity)

  const projects = runtimeCapabilities.get(ProjectProvisioningRuntimeCapability)
  if (!projects) throw new Error('Platform Project provisioning capability is unavailable.')

  try {
    await projects.ensure({
      projectId: entity.workspaceProjectId,
      workspaceId: scope.workspaceId,
      xpertId: scope.assistantId,
      name: entity.name,
      status: entity.archivedAt ? 'archived' : 'active'
    })
    entity.workspaceSyncStatus = 'ready'
    entity.workspaceSyncError = null
    return await repository.save(entity)
  } catch (error) {
    entity.workspaceSyncStatus = 'failed'
    entity.workspaceSyncError = error instanceof Error ? error.message : 'Project synchronization failed.'
    await repository.save(entity)
    throw error
  }
}
```

When the product intentionally shares the Project files across multiple Assistants, call `ensure` once for every trusted Assistant id while reusing the same `workspaceProjectId`:

```ts
for (const assistantId of connectedAssistantIds) {
  await projects.ensure({
    projectId: entity.workspaceProjectId,
    workspaceId: scope.workspaceId,
    xpertId: assistantId,
    name: entity.name,
    status: entity.archivedAt ? 'archived' : 'active'
  })
}
```

Every connected Assistant must belong to the requested workspace. `ensure` preserves existing Assistant connections and adds the requested `xpertId`; treat it as additive, not as replacement of the complete connection set. If the product supports removing an Assistant, use an explicit authorized Project membership operation and test that removal separately.

Call the same function after creation, rename, archive, restore, and an explicit retry action. Treat the plugin entity as the source of truth for the desired Project name and status.

Validate that `workspaceId`, every intended Assistant id, and `workspaceProjectId` exist before calling the capability. Expose `provisioning`, `ready`, and `failed` in the View. Disable file upload and file-dependent workflows until the entity is `ready` and all required Assistant connections have been confirmed.

Do not roll back an already accepted business rename or archive only because platform synchronization failed. Preserve the failed state and make reconciliation retryable.

## Configure The Assistant

Require Project scope when the app cannot operate safely without it:

```yaml
team:
  options:
    workspaceScope:
      mode: project-required
```

Use `project-preferred` only when Assistant-wide fallback is a deliberate product behavior. Do not use it as an error recovery path for a project-isolated app.

Install or update this option through the plugin-owned Assistant template. Do not ask users to redraw the Assistant manually.

Apply the policy to every Assistant that participates in the Project-bound product flow. An Assistant becomes eligible to use the shared Project files only after it is explicitly connected to that Project; declaring `project-required` alone does not grant Project access.

## Store Files In The Mapped Project

Use `WorkspaceFilesRuntimeCapability` for all file operations:

```ts
import {
  WORKSPACE_FILES_SOURCE,
  WorkspaceFilesRuntimeCapability,
  type WorkspacePortableFileReference
} from '@xpert-ai/plugin-sdk'

const workspaceFiles = runtimeCapabilities.get(WorkspaceFilesRuntimeCapability)
if (!workspaceFiles) throw new Error('Platform Workspace Files capability is unavailable.')
```

Use explicit Project scope in server-side upload and export flows:

```ts
const uploaded = await workspaceFiles.uploadBuffer({
  catalog: 'projects',
  scopeId: entity.workspaceProjectId,
  projectId: entity.workspaceProjectId,
  buffer,
  originalName,
  mimeType,
  folder: `files/${PLUGIN_KEY}/sources/${sourceId}`,
  metadata: { businessProjectId: entity.id, sourceId }
})
```

Use a stable plugin-owned directory layout:

```text
files/<plugin-key>/
├── sources/<source-id>/...
├── generated/...
├── previews/...
└── exports/...
```

Build and persist a portable reference from the trusted result:

```ts
const reference: WorkspacePortableFileReference = {
  source: WORKSPACE_FILES_SOURCE,
  catalog: uploaded.catalog,
  scopeId: uploaded.scopeId,
  projectId: entity.workspaceProjectId,
  filePath: uploaded.filePath,
  workspacePath: uploaded.workspacePath,
  originalName,
  name: uploaded.name,
  mimeType: uploaded.mimeType ?? mimeType,
  size: uploaded.size ?? buffer.length
}
```

Persist the reference, not a sandbox path, host absolute path, signed URL, Buffer, or Base64. Use the same reference for download, preview, delayed jobs, and retries. Let the platform issue short-lived signed access URLs when a user opens or downloads the file.

For Agent tools operating inside an already Project-bound runtime, prefer `resolveRuntimeReference`, `readRuntimeBuffer`, and `writeRuntimeBuffer`; the runtime supplies the trusted Project scope. Do not expose Catalog or Project selectors in the Agent-visible tool schema.

## Register File Understanding

Create a FileAsset before finalizing the plugin source version:

```ts
const understood = await workspaceFiles.understandFile({
  ...reference,
  purpose: 'workspace',
  parseMode: 'deep',
  runInline: false,
  metadata: { source: PLUGIN_KEY, businessProjectId: entity.id }
})

await sourceVersionRepository.save({
  businessProjectId: entity.id,
  fileReference: reference,
  fileAssetId: understood.fileAssetId
})
```

Await the `understandFile` call so the FileAsset id is durably associated with the source version. `runInline: false` may leave parsing and vector indexing in progress; track that readiness separately with `getUnderstandingStatus` instead of detaching the registration Promise.

If the plugin also parses the file into domain requirements, facts, evidence, or rows, keep that domain representation separate from File Understanding:

- FileAsset and FileChunk provide the canonical parsed-source index.
- Plugin evidence stores domain meaning and references `fileAssetId + chunkId`.
- Use `listUnderstandingChunks` or `searchUnderstandingChunks` to reuse the existing index.
- Use `validateUnderstandingReferences` before accepting evidence links.
- Do not create a second vector index containing the same source text solely for domain evidence search.

## Bind Every Conversation And Agent Run

Pass `workspaceProjectId` as the trusted platform `projectId` whenever the plugin starts an Assistant Task. Persist it on the conversation at creation, not only in transient run configuration.

Apply the same rule to:

1. the Primary Agent conversation of every connected Assistant;
2. workflow coordinator runs within each connected Assistant;
3. interpretation, planning, authoring, or other specialist Assistant Tasks;
4. cross-Assistant handoffs that are intended to retain the same Project file scope;
5. retries and manual reruns;
6. sandbox-backed tasks that read or write Workspace Files.

Reject a run when the route or request Project differs from the conversation's persisted `projectId`. Never mutate an existing conversation to move it between Projects. Create a new conversation in the target Project instead.

When one connected Assistant hands work to another, create or select a conversation for the target `xpertId + projectId`; do not reuse the source Assistant's conversation. Pass the same trusted `workspaceProjectId` so the target Assistant can read the shared files while keeping its own conversation and execution history.

In Project mode, all `parsed_file_*` tools must resolve one visibility set:

1. all FileAssets in the trusted current Project;
2. explicit attachments linked to the current conversation;
3. duplicates removed.

Apply the same set to list, search, search-all, read, and preview. A FileAsset id from another Project must produce a non-enumerating inaccessible/not-found result.

## Open The Project Assistant From The View

Expose `workspaceProjectId` and synchronization state in the View DTO, while keeping business mutations keyed by the business id.

Declare `workbench.navigation.open` in the View's `clientCommands` allowlist, then request the host-owned Project route:

```ts
await invokeClientCommand('workbench.navigation.open', {
  target: 'assistant.project',
  projectId: entity.workspaceProjectId
})
```

Do not build `/chat/x/.../p/...` URLs inside the plugin. Let the host filter conversations by `xpertId + projectId`, restore the most recent Primary conversation, or create one when none exists.

Guard repeated navigation in the remote component so normal data refreshes do not reopen the same Project or replace the current conversation.

## Enforce Security Boundaries

- Resolve tenant, organization, user, workspace, Assistant, and Project from trusted context or the persisted mapping.
- Revalidate plugin-domain access, user Project membership, and the current Assistant's explicit Project connection on every read and mutation.
- Keep `tenantId`, `catalog`, `scopeId`, `projectId`, `xpertId`, and `isolateByUser` out of Agent-visible schemas.
- Reject unsafe paths, null bytes, root paths, and traversal segments.
- Never reveal whether a rejected FileAsset exists in another Project.
- Do not send tenant ids, organization ids, signed URLs, or portable references into an untrusted iframe unless the declared View file-access protocol requires a bounded resource object.
- Keep business scope keyed to the Assistant/Xpert even though file scope is keyed to the Project.

## Handle Existing Data Explicitly

Do not silently reinterpret old `xperts` references as Project references. Choose and document one rollout policy:

1. migrate old files and records with an auditable mapping job;
2. keep old records read-only in their original scope;
3. require users to create new business entities after the feature launches.

Never provide a hidden fallback from a failed Project mapping to the Assistant-wide folder, because that breaks isolation and makes Primary/subagent behavior inconsistent.

## Test The Complete Boundary

Cover at least these cases:

- creation saves two distinct ids and provisions exactly one Chat Project;
- retry reuses `workspaceProjectId` and does not create a duplicate;
- the platform Project connects to every intended Assistant and appears in Projects;
- two connected Assistants can list, search, read, and preview the same Project FileAsset without copying it;
- an unconnected Assistant cannot access the Project files even when given the Project or FileAsset id;
- connected Assistants keep separate `xpertId + projectId` conversation histories while sharing Project files;
- rename, archive, and restore reconcile through `ensure`;
- upload, portable reference, FileAsset, generated files, and exports all use the mapped Project;
- File Understanding registration is awaited and `fileAssetId` is saved;
- Primary and each specialist Agent can list and search the same Project file;
- a FileAsset from another Project cannot be listed, searched, read, or previewed;
- conversations are filtered by `xpertId + projectId` and cannot change Project;
- `project-required` rejects execution without a Project;
- synchronization failures gate upload/workflow and expose a retry action;
- non-Project Assistants preserve their existing conversation or `xperts` behavior.

## Reject These Anti-Patterns

1. Use the business id directly as the Chat Project id without an explicit identity contract.
2. Save the mapping only after provisioning succeeds.
3. Pass `projectId` to the run but leave the conversation unbound.
4. Start some subagents without `workspaceProjectId`.
5. Upload source files to `xperts` and exports to `projects`.
6. Fire-and-forget `understandFile` and lose the FileAsset id.
7. Add Project selection fields to Agent tools.
8. Persist `/workspace/...`, a host path, or a signed URL as the canonical file reference.
9. Build a duplicate vector index for domain evidence copied from FileChunks.
10. Fall back to `xperts` when Project provisioning or authorization fails.
11. Assume that sharing Project files also shares conversations, prompts, memories, tools, or Agent permissions.
12. Connect only one Assistant and expect another Assistant to inherit Project access automatically.
