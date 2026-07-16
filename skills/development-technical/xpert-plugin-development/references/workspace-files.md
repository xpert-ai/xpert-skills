# Platform Workspace Files In Plugins

Use this reference when a plugin reads, writes, sends, uploads, queues, or persists files that belong to the Xpert platform workspace.

## Table Of Contents

1. [Core Principle](#core-principle)
2. [Platform Capability](#platform-capability)
3. [Locator And Reference Types](#locator-and-reference-types)
4. [Agent Tool Schema Design](#agent-tool-schema-design)
5. [Read Files From Agent Runtime](#read-files-from-agent-runtime)
6. [Write Files To Agent Runtime](#write-files-to-agent-runtime)
7. [Async Jobs And Queues](#async-jobs-and-queues)
8. [Explicit Workspace Operations](#explicit-workspace-operations)
9. [Security Rules](#security-rules)
10. [Compatibility Notes](#compatibility-notes)
11. [Testing Checklist](#testing-checklist)
12. [Common Mistakes](#common-mistakes)

## Core Principle

Plugins must not treat sandbox paths as host paths.

`/workspace/report.docx` is a sandbox-visible path. It is not guaranteed to exist in the API process, Docker host, or plugin worker process. Do not fix this by hardcoding `/workspace -> /sandbox`, because that bypasses Volume/Workspace mapping, tenant isolation, Docker/local-shell differences, and future catalog extensions.

The standard solution is:

1. Let sandbox tools create or reference files as `/workspace/...` or workspace-relative paths.
2. Let the platform runtime capability resolve those paths into scoped workspace file references.
3. Let plugins persist portable references for delayed work.
4. Let plugins use host `fs` only for explicit legacy local absolute paths that are known to be readable by the plugin process.

## Platform Capability

Use `platform.workspace.files` through the plugin SDK:

```ts
import {
  WorkspaceFilesRuntimeCapability,
  type WorkspaceFilesApi
} from '@xpert-ai/plugin-sdk'
```

The API supports legacy explicit operations and runtime-aware operations:

```ts
type WorkspaceFilesApi = {
  uploadBuffer(input): Promise<WorkspaceFile>
  understandFile(input): Promise<WorkspaceUnderstoodFile>
  readBuffer(input): Promise<WorkspaceFileBuffer>
  deleteFile(input): Promise<void>

  resolveRuntimeReference(input): Promise<WorkspacePortableFileReference>
  readRuntimeBuffer(input): Promise<WorkspaceRuntimeFileBuffer>
  writeRuntimeBuffer(input): Promise<WorkspaceFile & { reference: WorkspacePortableFileReference }>
}
```

Prefer the runtime-aware methods for plugin tool inputs and sandbox outputs:

1. `resolveRuntimeReference()` normalizes a runtime locator into a portable reference without reading bytes.
2. `readRuntimeBuffer()` reads bytes and returns the portable reference used to read them.
3. `writeRuntimeBuffer()` writes bytes into the current runtime workspace and returns a portable reference.

Use explicit `uploadBuffer()`, `readBuffer()`, `deleteFile()`, and `understandFile()` only when the plugin already has an explicit workspace scope such as catalog and project/Xpert identifiers.

## Locator And Reference Types

A runtime locator can be:

```ts
type WorkspaceFileLocator =
  | string
  | {
      path?: string | null
      filePath?: string | null
      workspacePath?: string | null
      originalName?: string | null
      name?: string | null
      mimeType?: string | null
      mimetype?: string | null
      size?: number | null
    }
  | WorkspacePortableFileReference
```

Accepted path forms:

1. `/workspace/a.docx`
2. `a.docx`
3. `./a.docx`
4. an already persisted portable reference

The platform returns a portable reference:

```ts
type WorkspacePortableFileReference = {
  source: 'platform.workspace.files'
  filePath: string
  workspacePath: string
  catalog?: 'projects' | 'users' | 'knowledges' | 'skills' | 'xperts' | null
  scopeId?: string | null
  tenantId?: string | null
  userId?: string | null
  projectId?: string | null
  xpertId?: string | null
  isolateByUser?: boolean | null
  originalName?: string | null
  name?: string | null
  mimeType?: string | null
  size?: number | null
}
```

Persist this reference when future jobs must read the same file. Do not persist sandbox absolute paths as business references.

## Agent Tool Schema Design

Keep Agent-visible file parameters small. Do not expose `tenantId`, `catalog`, `scopeId`, `projectId`, `xpertId`, or `isolateByUser` as normal tool parameters.

Recommended Zod shape:

```ts
const fileDescriptorSchema = z
  .object({
    path: z.string().optional().describe('Workspace path, sandbox /workspace path, or legacy absolute local path.'),
    filePath: z.string().optional().describe('Workspace-relative file path alias.'),
    workspacePath: z.string().optional().describe('Workspace-relative or sandbox /workspace path alias.'),
    fileRef: z
      .object({
        source: z.string().optional(),
        filePath: z.string().optional(),
        workspacePath: z.string().optional()
      })
      .passthrough()
      .optional()
      .describe('Platform workspace file reference returned by Xpert.'),
    originalName: z.string().optional(),
    name: z.string().optional(),
    mimeType: z.string().optional(),
    mimetype: z.string().optional(),
    size: z.number().int().positive().optional()
  })
  .passthrough()
```

For tool ergonomics, accept both nested and top-level forms:

```ts
const sendFileSchema = z.object({
  integrationId: z.string().optional(),
  file: fileDescriptorSchema.optional(),
  path: z.string().optional(),
  filePath: z.string().optional(),
  workspacePath: z.string().optional(),
  fileRef: fileDescriptorSchema.shape.fileRef.optional(),
  originalName: z.string().optional(),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  mimetype: z.string().optional(),
  size: z.number().int().positive().optional()
})
```

Normalize these aliases into one internal descriptor before resolving the file.

## Read Files From Agent Runtime

Inside Agent middleware tools, get the capability from the middleware context:

```ts
const workspaceFiles = context.runtime.capabilities.require(WorkspaceFilesRuntimeCapability)

const file = await workspaceFiles.readRuntimeBuffer({
  path: '/workspace/report.docx',
  originalName: 'report.docx'
})
```

The platform-scoped runtime automatically supplies:

1. tenant id
2. user id
3. current project id, when present
4. current Xpert id, when no project is active
5. sandbox workspace root, such as `/workspace`

Default scope inference:

1. `projectId` wins and resolves to `catalog: 'projects'`.
2. Otherwise `xpertId` resolves to `catalog: 'xperts'` with `isolateByUser: false`.

Typical send/upload pattern:

```ts
import { createHash } from 'node:crypto'

const file = await workspaceFiles.readRuntimeBuffer(input.fileRef ?? input.filePath ?? input.path)
const sha256 = createHash('sha256').update(file.buffer).digest('hex')

await sender.send({
  fileName: file.name,
  mimeType: file.mimeType,
  size: file.size ?? file.buffer.length,
  sha256,
  bytes: file.buffer,
  fileRef: file.reference
})
```

If a plugin also supports a legacy host-readable absolute path, make that an explicit fallback:

```ts
if (shouldUseWorkspace(input)) {
  return workspaceFiles.readRuntimeBuffer(locator)
}

return readLegacyHostFile(absolutePath)
```

`shouldUseWorkspace()` should return true for:

1. `fileRef.source === 'platform.workspace.files'`
2. `/workspace` and `/workspace/...`
3. relative paths such as `report.docx`

## Write Files To Agent Runtime

When a plugin generates bytes that should appear in the current Agent workspace, use `writeRuntimeBuffer()`:

```ts
const written = await workspaceFiles.writeRuntimeBuffer({
  path: 'exports/report.docx',
  originalName: 'report.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  buffer
})

return {
  filePath: written.filePath,
  workspacePath: written.workspacePath,
  fileRef: written.reference,
  size: written.size ?? buffer.length
}
```

Do not write directly into guessed Volume directories from a plugin. The platform should own destination normalization and scope inference.

## Async Jobs And Queues

Queues must not persist base64 or raw buffers. Persist the portable reference plus integrity checks:

```ts
type QueuedFilePayload = {
  type: 'file'
  filePath: string
  fileRef?: WorkspacePortableFileReference
  fileName: string
  mimeType?: string
  size: number
  sha256: string
}
```

At enqueue time:

```ts
const file = await workspaceFiles.readRuntimeBuffer(locator)

await queue.enqueue({
  type: 'file',
  filePath: file.filePath,
  fileRef: file.reference,
  fileName: file.name,
  mimeType: file.mimeType,
  size: file.size ?? file.buffer.length,
  sha256: createHash('sha256').update(file.buffer).digest('hex')
})
```

At retry/send time:

```ts
const file = payload.fileRef
  ? await workspaceFiles.readRuntimeBuffer(payload.fileRef)
  : await readLegacyHostFile(payload.filePath)

const sha256 = createHash('sha256').update(file.buffer).digest('hex')
if (payload.size !== file.buffer.length || payload.sha256 !== sha256) {
  throw new Error('Queued file changed before send')
}
```

When reading a portable reference in a delayed job, the reference already contains scope. The job should not need the original Agent runtime scope.

If the capability is missing and the payload contains `fileRef`, fail with a structured error and do not call the third-party channel.

## Explicit Workspace Operations

When the plugin already knows the workspace scope, use explicit APIs:

```ts
await workspaceFiles.uploadBuffer({
  tenantId,
  userId,
  catalog: 'projects',
  projectId,
  buffer,
  originalName: 'report.docx',
  mimeType,
  folder: 'files/my-plugin'
})
```

Read/delete with explicit references:

```ts
const file = await workspaceFiles.readBuffer({
  tenantId,
  userId,
  catalog: 'projects',
  projectId,
  filePath: 'files/my-plugin/report.docx'
})

await workspaceFiles.deleteFile({
  tenantId,
  userId,
  catalog: 'projects',
  projectId,
  filePath: 'files/my-plugin/report.docx'
})
```

Register a workspace file for platform understanding/parsing:

```ts
await workspaceFiles.understandFile({
  tenantId,
  userId,
  catalog: 'projects',
  projectId,
  filePath: 'files/my-plugin/report.docx',
  originalName: 'report.docx',
  mimeType,
  purpose: 'workspace',
  parseMode: 'auto'
})
```

Use explicit operations for admin/plugin-managed flows. Use runtime operations for Agent/sandbox flows.

## Security Rules

Required path rules:

1. Reject empty paths.
2. Reject null bytes.
3. Reject `..` segments.
4. Reject the workspace root itself as a file.
5. Reject absolute paths outside the current workspace root.
6. Treat relative paths as workspace-relative, not process-cwd-relative.
7. Keep scope inference in the platform, not in business plugin schema.

Required payload rules:

1. Never persist raw file bytes in queue payloads.
2. Never persist base64 file content for retry.
3. Persist `fileRef`, `size`, `sha256`, and display metadata.
4. Validate `size` and `sha256` before sending delayed files.
5. Keep third-party upload tokens separate from platform file references.

Required isolation rules:

1. Do not hardcode tenant directories.
2. Do not hardcode `/sandbox`.
3. Do not derive project/Xpert scope from user input when runtime context already provides it.
4. Do not expose scope parameters to Agents unless the product explicitly requires cross-scope admin behavior.

## Compatibility Notes

Some plugin repositories may temporarily depend on an older `@xpert-ai/plugin-sdk` package that does not yet expose the latest workspace runtime types. In that case:

1. Do not use `any` across the implementation.
2. Define a narrow local structural type for the capability boundary.
3. Keep the local type names obviously temporary and compatible with the platform contract.
4. Remove the local structural types once the plugin SDK dependency includes the official types.

Example boundary:

```ts
type WorkspaceFilesReader = {
  readRuntimeBuffer(input: WorkspaceFileLocator): Promise<WorkspaceRuntimeFileBuffer>
}
```

Keep downstream code typed against this narrow interface.

## Testing Checklist

Unit test platform file behavior in plugins:

1. `/workspace/a.docx` resolves through `readRuntimeBuffer()`.
2. `a.docx` and `./a.docx` resolve as workspace-relative paths.
3. `fileRef.source === 'platform.workspace.files'` is replayed through `readRuntimeBuffer()`.
4. Unsafe paths such as `../secret`, empty path, null byte, and workspace root fail.
5. Empty files fail when the third-party channel cannot send them.
6. Oversized files fail before channel upload.
7. Legacy absolute host paths still work only when intentionally supported.

Unit test Agent middleware:

1. Tool schema does not expose tenant/catalog/scope/project/Xpert parameters.
2. Tool calls with `/workspace/...` use `context.runtime.capabilities`.
3. Missing capability returns a structured error and does not call the third-party channel.
4. Returned payload includes file name, MIME type, size, sha256, and portable reference.

Unit test queues:

1. Enqueued payload contains `fileRef`.
2. Enqueued payload does not contain `buffer`, `base64`, or `fileContent`.
3. Retry reads by `fileRef` before legacy `filePath`.
4. Retry validates `size` and `sha256`.
5. Historical payloads with only `filePath` still follow the legacy path if compatibility is required.

Validation commands depend on the plugin package, but usually include:

```bash
pnpm --dir <plugin-dir> typecheck
pnpm --dir <plugin-dir> test -- <relevant-specs> --runInBand
```

If platform runtime code changed, also run the focused platform tests for workspace-files runtime behavior.

## Common Mistakes

1. Calling `fs.stat('/workspace/file.docx')` from a plugin service.
2. Adding `tenantId`, `catalog`, `scopeId`, `projectId`, or `xpertId` to an Agent-visible send-file schema.
3. Persisting `/workspace/...` in business tables as the canonical file reference.
4. Persisting base64 in a queue payload.
5. Re-reading queued files from host paths even when a portable `fileRef` exists.
6. Sending a delayed file without validating that `size` and `sha256` still match.
7. Guessing Docker bind mount paths inside plugin code.
8. Treating `filePath` aliases from tool input as process-cwd-relative paths.
