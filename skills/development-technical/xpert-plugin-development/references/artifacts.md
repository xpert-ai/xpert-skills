# Platform Artifacts In Plugins

Use this reference when a plugin creates, versions, previews, shares, revokes, archives, or deletes Xpert Artifacts through `@xpert-ai/plugin-sdk`.

## Table Of Contents

1. [Core Model](#core-model)
2. [Runtime Capabilities](#runtime-capabilities)
3. [Stable Identity And Scope](#stable-identity-and-scope)
4. [Create An Artifact](#create-an-artifact)
5. [Create Artifact Versions](#create-artifact-versions)
6. [Share An Artifact](#share-an-artifact)
7. [Create A Signed Preview](#create-a-signed-preview)
8. [Make Share Actions Idempotent](#make-share-actions-idempotent)
9. [Update, Revoke, Archive, And Delete](#update-revoke-archive-and-delete)
10. [Agent Tool And Workbench Design](#agent-tool-and-workbench-design)
11. [HTML And Public-Link Security](#html-and-public-link-security)
12. [Async Export And Share Flow](#async-export-and-share-flow)
13. [Testing Checklist](#testing-checklist)
14. [Common Mistakes](#common-mistakes)

## Core Model

Treat the four platform objects as separate concerns:

1. `Artifact` is the stable product container owned by a plugin business resource.
2. `ArtifactVersion` is one immutable content snapshot backed by Workspace Files.
3. `ArtifactLink` is a revocable access entrypoint to the latest or one fixed version.
4. `ArtifactAccessLog` is platform-managed audit data for access and lifecycle events.

Do not model a copied URL as the Artifact itself. Content can gain versions without changing Artifact identity, and access policy can change without rewriting content.

The normal lifecycle is:

```text
generate bytes
  -> write Workspace Files
  -> create/find Artifact
  -> create ArtifactVersion
  -> preview or share ArtifactLink
```

## Runtime Capabilities

Import the typed capability keys from the SDK:

```ts
import {
  ArtifactsRuntimeCapability,
  WorkspaceFilesRuntimeCapability,
  XPERT_RUNTIME_CAPABILITIES_TOKEN,
  type ArtifactAccessMode,
  type ArtifactsApi,
  type RuntimeCapabilityRegistry
} from '@xpert-ai/plugin-sdk'
```

Inside an Agent middleware tool, require the scoped capabilities from the execution context:

```ts
const capabilities = context.runtime.capabilities
if (!capabilities) {
  throw new Error('Xpert runtime capabilities are not available.')
}

const workspaceFiles = capabilities.require(WorkspaceFilesRuntimeCapability)
const artifacts = capabilities.require(ArtifactsRuntimeCapability)
```

Inside a Nest service provided by a plugin, inject the registry and fail clearly when the host does not provide the capability:

```ts
import { Inject, Injectable, Optional } from '@nestjs/common'

@Injectable()
export class ReportService {
  constructor(
    @Optional()
    @Inject(XPERT_RUNTIME_CAPABILITIES_TOKEN)
    private readonly runtimeCapabilities?: RuntimeCapabilityRegistry
  ) {}

  private artifacts(): ArtifactsApi {
    const api = this.runtimeCapabilities?.get(ArtifactsRuntimeCapability)
    if (!api) {
      throw new Error('Platform Artifacts capability is not available.')
    }
    return api
  }
}
```

Use the typed `ArtifactsRuntimeCapability` key. Do not define a plugin-local copy of the API when the installed SDK already exports the official types.

## Stable Identity And Scope

Use this source identity consistently:

```text
tenant + organization + pluginName + resourceType + resourceId
```

Choose `resourceId` according to the desired version boundary:

- Use a report, deck, site, dashboard, or document ID when many exports are versions of one Artifact.
- Use an export or deployment ID when every export must be a separate Artifact.
- Never use a random ID on every retry; `createArtifact()` is intended to locate the existing container for a stable source identity.

Set `source.checksum` only as mutable source metadata. It is not part of Artifact identity.

Agent middleware receives a scoped Artifacts API from the host. A long-lived plugin service should still pass the relevant `scope` when it owns tenant, organization, user, workspace, project, or Xpert context:

```ts
scope: {
  tenantId,
  organizationId,
  userId,
  workspaceId,
  projectId,
  xpertId
}
```

Do not expose these scope fields as ordinary Agent tool arguments. Derive them from trusted runtime context or the plugin's scoped business entity.

## Create An Artifact

Create the Workspace Files object before registering an Artifact version. Artifact metadata does not store raw bytes.

```ts
import { createHash } from 'node:crypto'

const buffer = Buffer.from(html, 'utf8')
const sha256 = createHash('sha256').update(buffer).digest('hex')

const written = await workspaceFiles.writeRuntimeBuffer({
  folder: 'reports/exports',
  fileName: `report-${reportId}.html`,
  originalName: `report-${reportId}.html`,
  mimeType: 'text/html',
  buffer,
  metadata: {
    pluginName: '@xpert-ai/plugin-report-studio',
    reportId
  }
})

const artifact = await artifacts.createArtifact({
  source: {
    pluginName: '@xpert-ai/plugin-report-studio',
    resourceType: 'report',
    resourceId: reportId,
    checksum: reportChecksum
  },
  kind: 'html',
  title: report.title,
  description: report.summary,
  metadata: {
    reportStatus: report.status
  }
})
```

Supported `kind` values are `html`, `markdown`, `pdf`, `pptx`, `image`, `file`, `site`, and `presentation`.

Keep `metadata` compact and non-sensitive. Do not place HTML, buffers, base64, tokens, private URLs, or entire business records in Artifact metadata.

## Create Artifact Versions

Create a version only when content has changed or the product explicitly publishes a new snapshot. Do not create a version when the user merely opens a share dialog or copies a link.

```ts
const version = await artifacts.createArtifactVersion({
  artifactId: artifact.id,
  workspaceFileRef: written.reference,
  mimeType: 'text/html',
  fileName: written.name,
  title: report.title,
  description: report.summary,
  size: written.size ?? buffer.length,
  sha256,
  sourceVersionId: report.versionId,
  checksum: reportChecksum,
  setCurrent: true,
  metadata: {
    sourceRevision: report.revision
  }
})
```

Rules:

1. Persist `artifact.id` and `version.id` on the plugin business record.
2. Use the portable `written.reference`, never a host path or `/workspace/...` string.
3. Let the platform verify optional `size` and `sha256` against Workspace Files.
4. Use `sourceVersionId` for the plugin's immutable version/export ID.
5. Set `setCurrent: false` only for staged versions that should not become latest.
6. Prevent duplicate version creation in plugin logic; `createArtifactVersion()` always represents a new immutable version.

## Share An Artifact

Choose link version behavior explicitly:

- `latest` resolves the Artifact's current version every time it is opened.
- `version` pins the link to one immutable `artifactVersionId`.

Use a fixed version for approvals and reproducible exports:

```ts
if (!trustedUiAction.userConfirmedPublicLink) {
  throw new Error('Public Artifact sharing requires explicit user confirmation.')
}

const link = await artifacts.createArtifactLink({
  artifactId: artifact.id,
  artifactVersionId: version.id,
  versionMode: 'version',
  access: {
    mode: 'public_link',
    userConfirmedPublicLink: true
  },
  presentation: {
    disposition: 'inline',
    allowDownload: true,
    safeHtmlProfile: 'strict'
  },
  metadata: {
    sourceVersionId: report.versionId
  }
})

return {
  artifactId: artifact.id,
  artifactVersionId: version.id,
  artifactLinkId: link.id,
  publicUrl: link.publicUrl
}
```

For an always-latest link, omit `artifactVersionId` and use `versionMode: 'latest'`.

Access modes:

| Mode | Use |
| --- | --- |
| `owner_only` | Private owner access. |
| `workspace_all` | Authorized workspace access. |
| `organization_all` | Authorized organization access. |
| `custom_principals` | Explicit principals; also provide `customPrincipals`. |
| `public_link` | Anonymous web access; require explicit user confirmation. |
| `signed_preview` | Short-lived tokenized preview; normally use `createSignedPreviewLink()`. |

Creating `public_link` also requires a user-scoped operation. Ensure the trusted runtime or explicit Artifact scope contains the authenticated `userId`; do not substitute an Agent-supplied user ID.

Always copy and return `link.publicUrl`. Do not build the URL from `window.location`, a frontend base URL, an API base URL, an Artifact ID, or a link ID. The platform chooses the public origin and short slug.

The current canonical public route is:

```text
https://<xpert-public-base>/artifacts/share/<artifact-link-slug>
```

Treat this route as platform-owned. Plugins should depend only on the returned `publicUrl`.

## Create A Signed Preview

Use a signed preview before durable publication:

```ts
const preview = await artifacts.createSignedPreviewLink({
  artifactId: artifact.id,
  artifactVersionId: version.id,
  versionMode: 'version',
  ttlSeconds: 15 * 60,
  presentation: {
    disposition: 'inline',
    allowDownload: false,
    safeHtmlProfile: 'strict'
  }
})
```

The returned URL contains an opaque `xpert_artifact_preview` token. Do not log it, include it in analytics, store it as a durable share URL, or return it in an Agent-visible audit summary. Create another preview when the old one expires.

## Make Share Actions Idempotent

Persist enough link state on the plugin business record:

```ts
type PluginArtifactState = {
  artifactId?: string | null
  artifactVersionId?: string | null
  artifactLinkId?: string | null
  artifactPublicUrl?: string | null
  artifactLinkVersionMode?: 'latest' | 'version' | null
  artifactLinkAccessMode?: ArtifactAccessMode | null
}
```

When the user clicks **Copy link** repeatedly:

1. Reuse the saved active link when version mode, access mode, presentation policy, and target version still match.
2. Do not create another Artifact Version.
3. If policy or fixed target changed, revoke the previous link and create a new link.
4. If saved link state is incomplete or known stale, create a replacement and persist all returned IDs and `publicUrl` atomically.

Do not assume `createArtifactLink()` is idempotent; each call creates a distinct access entrypoint.

## Update, Revoke, Archive, And Delete

Update link policy or retarget a link explicitly:

```ts
await artifacts.updateArtifactLinkAccess(artifactLinkId, {
  versionMode: 'latest',
  artifactVersionId: null,
  presentation: {
    allowDownload: false,
    safeHtmlProfile: 'interactive'
  }
})
```

When changing access to `public_link`, include a fresh trusted user confirmation in the `access` patch.

Revoke a share without deleting the Artifact:

```ts
await artifacts.revokeArtifactLink(artifactLinkId)
```

Archive or delete the container:

```ts
await artifacts.archiveArtifact(artifactId)
await artifacts.deleteArtifact(artifactId)
```

`deleteArtifact()` marks the Artifact deleted and revokes its links. It does not replace the plugin's Workspace Files retention policy. When deleting an exported file:

1. Revoke related Artifact Links.
2. Mark/delete the Artifact as required by product semantics.
3. Delete the plugin-owned Workspace Files object with `WorkspaceFilesRuntimeCapability`.
4. Clear saved link/version references on the plugin business record.

## Agent Tool And Workbench Design

Prefer product-specific operations such as `presentation_share_html`, `report_publish`, or `site_deploy` over exposing the raw platform Artifacts API as generic Agent tools.

Agent-visible tool results should contain only compact fields:

```ts
{
  artifactId,
  artifactVersionId,
  artifactLinkId,
  publicUrl,
  status: 'ready'
}
```

Do not return HTML, buffers, base64, preview tokens, tenant IDs, or Workspace Files internals.

Treat public sharing as a privileged user action:

1. A Workbench or trusted UI asks the user to confirm public publication.
2. The authenticated backend verifies the user and resource scope.
3. Only that trusted flow sets `userConfirmedPublicLink: true`.
4. An Agent tool may prepare/export an Artifact, but must not silently convert it to `public_link`.

If the product supports an explicit Agent share tool, require a platform confirmation/HITL result rather than accepting an untrusted boolean in natural-language tool input.

## HTML And Public-Link Security

Choose the narrowest HTML profile:

- `strict` disables scripts and network access; use it for static reports and documents.
- `interactive` allows self-contained client-side behavior; use it only when charts, controls, or presentation playback require JavaScript.

For both profiles:

1. Produce self-contained HTML.
2. Do not embed platform tokens, signed Workspace Files URLs, tenant/organization/workspace IDs, or API credentials.
3. Reject unsafe HTML, SVG, URLs, path traversal, and oversized embedded assets before writing the file.
4. Do not rely on authenticated plugin APIs at Artifact view time.
5. Set `allowDownload` deliberately.
6. Use `disposition: 'attachment'` for formats that should not render inline.

Public slugs are non-guessable access handles, not authorization for private modes. Never replace platform policy checks with plugin-generated slugs or tokens.

## Async Export And Share Flow

When sharing requires a new export, use this state machine:

```text
user clicks Share/Copy link
  -> find reusable completed export
  -> otherwise enqueue export
  -> worker writes Workspace Files
  -> worker creates/finds Artifact and creates ArtifactVersion
  -> share operation creates/reuses ArtifactLink
  -> UI receives and copies platform publicUrl
```

Queue payloads should contain business IDs, scope, expected checksum, and portable references when available. Do not enqueue HTML/base64 or a public token.

Make retries safe:

1. Give the export job an idempotency key.
2. Persist the completed export's `artifactId` and `artifactVersionId` before creating a link.
3. On retry, reuse the existing version when the export ID/checksum already matches.
4. Create a link only after the version and Workspace Files object are valid.
5. Report `queued`, `running`, `succeeded`, `failed`, and actionable failure stages to the UI.

## Testing Checklist

Test Artifact creation:

1. Stable source identity reuses the Artifact container.
2. Changed content creates one new version and updates current version as requested.
3. Repeated Copy link does not create another version.
4. Workspace Files reference, size, MIME, SHA-256, and checksum are correct.
5. Missing `platform.workspace.files` or `platform.artifacts` fails clearly.

Test links:

1. `latest` follows the current version; `version` remains pinned.
2. `public_link` without explicit user confirmation is rejected.
3. Signed preview expires and its token is not logged or persisted as a durable URL.
4. Changed access policy revokes/replaces or updates the intended link.
5. Revoked and expired links cannot be opened.
6. `allowDownload: false` blocks the download route.
7. Copied URL equals the platform-returned `publicUrl` and uses a short link slug.

Test isolation and cleanup:

1. Cross-tenant and cross-organization access is rejected.
2. Agent tool schemas do not expose tenant, organization, workspace, project, or Xpert scope.
3. Logs contain no preview token, file bytes, HTML, or credentials.
4. Deleting a plugin export revokes links before deleting the Workspace Files object.
5. Queue retries do not duplicate versions or links.

Run the plugin's focused typecheck, unit tests, and build. If SDK or platform Artifacts code changed, also run the corresponding `plugin-sdk` and `server-ai` tests/builds.

## Common Mistakes

1. Treating an Artifact as a URL instead of a versioned product container.
2. Using a new random `resourceId` on every retry.
3. Creating an Artifact Version whenever the share dialog opens or Copy link is clicked.
4. Calling `createArtifactLink()` repeatedly without persisting/reusing the returned link.
5. Hardcoding `userConfirmedPublicLink: true` in an Agent-callable tool.
6. Constructing a share URL from `window.location`, API base URL, Artifact ID, or link ID.
7. Passing a sandbox path instead of `WorkspacePortableFileReference` to `createArtifactVersion()`.
8. Deleting the Workspace Files object before revoking links.
9. Persisting signed preview tokens or logging public content bodies.
10. Using `interactive` HTML for content that works under `strict`.
