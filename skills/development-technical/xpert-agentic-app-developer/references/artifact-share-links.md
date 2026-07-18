# Artifact Share Links

Use platform Artifacts for generated previews and share links. Keep four concerns separate:

- `Artifact`: stable container for one business resource.
- `ArtifactVersion`: immutable content backed by Workspace Files.
- `ArtifactLink`: revocable access to the latest or one fixed version.
- `ArtifactAccessLog`: platform-owned audit history.

## Prefer No Plugin Publication Entity

Do not add a plugin-owned publication entity merely to store Artifact IDs or URLs. Use the platform as the source of truth when the app needs one deterministic share per business resource:

1. Find or create the Artifact by stable source identity: `pluginName + resourceType + resourceId`.
2. Reuse content with `listArtifactVersions()` and `ensureArtifactVersion()` using a content checksum as `idempotencyKey`.
3. Use a stable `shareKey`, then call `getArtifactShare()`, `ensureArtifactShare()`, and `revokeArtifactShare()`.
4. Return the platform-provided `publicUrl`; never construct a share URL.

Add plugin persistence only when the product needs plugin-specific approval state, multiple independent publications, async export-job recovery, or local reporting that platform Artifact records cannot provide.

## Publishing Rules

- Write self-contained output to Workspace Files and pass its portable reference to the Artifact version.
- Use `versionMode: 'version'` for reproducible approvals and `latest` for a stable link that follows the current ArtifactVersion. `latest` does not expose live working state; publish a new ArtifactVersion explicitly.
- Keep domain versions separate from Artifact versions. Sharing must not silently create a business document, canvas, or deck version.
- Make public sharing a trusted Workbench action. Require explicit user confirmation for `public_link`; an Agent must not publish anonymously on its own.
- Use `organization_all` or `workspace_all` for authenticated sharing. Use short-lived signed previews before durable publication and never log or persist preview tokens.
- Use `safeHtmlProfile: 'strict'` for static output. Use `interactive` only for a self-contained viewer that needs client-side behavior and does not call authenticated plugin APIs.
- Repeated Copy Link calls must reuse the same ArtifactVersion and share when content and policy match.

## Workbench And Cleanup

Load share state only for the selected detail when practical; avoid one Artifact lookup per list row. Expose explicit Share, Copy Link, Update Share, and Revoke actions.

When the business resource is archived or deleted:

1. Find the Artifact by source identity.
2. Revoke the stable share key.
3. Archive or delete the Artifact.
4. Delete plugin-owned Workspace Files separately; deleting an Artifact does not delete those files.

Test stable identity, version/share idempotency, fixed versus latest behavior, public confirmation, revoke/delete behavior, tenant and organization isolation, returned `publicUrl`, and absence of secrets or file internals in results and logs.
