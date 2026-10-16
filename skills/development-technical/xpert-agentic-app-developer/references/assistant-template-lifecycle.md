# Assistant Template Lifecycle

Use the plugin-owned template for first installation and later upgrades. Keep plugin loading, draft synchronization, publication, and runtime acceptance separate.

## Initial Installation

Create an Assistant when none is installed, or when the user requests a separate instance. For an `appConfig` App, use the host-governed Explore setup flow when creating its scoped Workspace, Knowledge bases, and Assistant. A suite release does not replace those application resource setup steps.

## Batch Updates Through The CLI

For a plugin that ships several Assistants, prefer the platform `assistant:suite:init` command and a portable `xpert-assistant-suite@1` profile. Follow [Plugin release and Assistant suite updates](../../xpert-plugin-development/references/local-release-and-assistant-suite.md) for executable create, refresh, and resume commands.

- Include every role, including standalone Assistants and specialists not directly connected to the main Assistant. Declare each caller's `externalRoleKeys` as a dependency DAG.
- Use `--refresh --installation-file` to update exact installed Assistant IDs, with a new `--manifest-file`. A previous completed release receipt can serve as the installation receipt. Without one, use the exact original run ID and verified template provenance; do not infer identity from display names.
- Use creation only for first installation or a requested separate suite. Use `--resume` with the same release receipt after an interruption.
- Preflight all templates and targets, synchronize all drafts, then publish children before callers and the orchestrator last. Rebind each caller to the current published child with a direct `required: true` connection.
- Preserve installed models, schema-declared middleware model fields, tools, knowledge bindings, and environments. Tool matching must use stable identity; missing/ambiguous bindings fail before draft persistence.
- Omitted `--environment-id` preserves each existing environment. An explicit value overrides only the orchestrator; new instances without one use `null`.
- Re-fetch published graphs and bindings. Keep deployment and release receipts outside source control; scope and installed IDs belong only in protected operational records.

Before running the CLI, verify that the selected host exposes the current refresh/resume contract. Its local `--dry-run` does not perform network authorization or runtime checks.

## Single-Assistant UI Update

When updating one Assistant interactively or using a host without the batch CLI:

1. Deploy/refresh the plugin and verify the intended template is actually loaded.
2. Open the existing digital expert canvas.
3. Choose `Assistant Settings` -> `Update from Template`.
4. Review graph changes and the impact on intentional local customizations; preserve instance-owned resource/model/environment bindings.
5. Save and publish the same Assistant.
6. Verify its original identity, slug, conversations, Project bindings, permissions, and integrations remain attached.
7. Run a bounded installed-platform smoke test appropriate to the task.

Both the CLI and UI should use the supported platform template synchronization/publication logic. Do not redraw a graph manually or create a replacement Assistant to work around an unavailable update action; inspect template provenance and loaded contribution first.

## Failure Recovery

A failure before publication commit leaves the prior version and draft intact. Resume the recorded release after resolving the cause. `XPERT_PUBLICATION_ACTIVATION_PENDING` means the new version already committed: resume activation for that expected version, rather than publishing another version. The CLI handles this path and verifies/skips completed roles, so retrying a completed release does not increment versions.

If templates, scope, or drafts changed outside the recorded release, inspect the differences before beginning a new release. Do not edit receipt hashes or bypass permissions to force recovery.

## Verification Checklist

- Authentication and organization-scoped workspace authoring access are verified separately from plugin installation scope.
- The loaded plugin version and template identities match the profile.
- The intended existing Assistants were refreshed through the supported CLI/API or UI path; IDs and slugs remain stable.
- Models, environments, tools, knowledge, middleware, and Skill connections match the intended updated graph and preserved bindings.
- Every declared caller/child dependency resolves to the new child publication with exactly one direct required connection.
- Primary conversations and Project-scoped resources still resolve when relevant to the change.
- All selected Assistants are published; a fresh bounded execution proves the tested behavior. Suite `readyForTesting` alone does not prove business acceptance.
