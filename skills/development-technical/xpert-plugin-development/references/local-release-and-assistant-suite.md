# Plugin Release And Assistant Suite Updates

Use this workflow to deploy a plugin, create or update its role Assistants, and publish them in dependency order. Prefer the platform CLI over repeated UI operations. Inspect the selected platform's `docs/assistant-suite-release.md`, command `--help`, and `tools/scripts/assistant-suite/` when its contract differs from this reference.

## Separate Readiness States

Record these independently:

1. **Access verified**: authentication succeeds and the target workspace is authorable in the correct organization.
2. **Source verified**: relevant tests, package build, generated assets, and declared `verify:dist` pass.
3. **Plugin registered**: the supported API refreshed or installed the plugin.
4. **Plugin running**: required restart completed, the expected version is loaded, and an observable provider, View, route, or tool works.
5. **Assistant suite published**: all selected templates were applied, instance bindings preserved, and published graphs verified.
6. **Acceptance passed**: a fresh execution exercises the requested business behavior.

`readyForTesting` in a release receipt proves suite publication, not business acceptance. A loaded template does not update an installed Assistant.

## Scope And Authentication

Use the platform's `requireAuthentication` and `createRequestHeaders` from `tools/scripts/local-plugin-cli.mjs` for API automation. Follow [Authentication and organization context](general.md#authentication-and-organization-context) before interpreting a workspace `403` or an omitted workspace as an access denial. Keep credentials in the configured environment or Keychain.

Plugin installation and Assistant authoring can use different scopes in the same release:

| `xpert.plugin.level` | Plugin installation scope |
| --- | --- |
| `system` | Tenant scope in the Default tenant |
| `tenant` | Tenant scope in its owning tenant |
| `organization` | Organization scope |

Assistant suite operations use the target workspace's organization scope. Construct separate headers for the two phases; do not change a system plugin to organization scope because its business workspace belongs to an organization.

## Deploy The Plugin

Run from the selected platform repository. `XPERT_API_URL` is the API origin, not its health endpoint.

```bash
corepack pnpm plugin:deploy:local \
  --plugin-dir "$PLUGIN_DIR" \
  --api-url "$XPERT_API_URL" \
  --scope tenant \
  --tenant-id "$XPERT_TENANT_ID" \
  --manifest-file "$DEPLOYMENT_RECEIPT"
```

For an organization plugin, use `--scope organization --org-id "$XPERT_ORG_ID"`. Select scope from package metadata, then validate before mutation.

The command builds/tests, runs declared `verify:dist`, refreshes an existing local-code registration or installs one, and fetches its descriptor. After the exact build/tests passed in the same unchanged task, `--skip-build --skip-test` avoids repetition; declared `verify:dist` still runs.

Check descriptor `currentVersion` (older contracts may use `version`) and `loadStatus`. `pending_restart` requires a targeted API restart even if the mutation response omitted `restartRequired`. Recheck process provenance, readiness, the loaded descriptor, and a runtime surface after restart. Do not publish templates from a staged-only plugin.

## Portable Suite Profile

Keep reusable topology in a versioned JSON profile. List **every** Assistant to release, including standalone roles and specialists not directly connected to the orchestrator. Each role can declare its own `externalRoleKeys`; those dependencies form a DAG. The orchestrator key must be distinct from role keys.

```json
{
  "schemaVersion": "xpert-assistant-suite@1",
  "key": "acme-suite",
  "plugin": { "name": "@xpert-ai/plugin-acme", "version": "0.2.0" },
  "roles": [
    {
      "key": "illustration",
      "templateKey": "illustration-assistant",
      "name": "acme-illustration",
      "title": "Illustration Assistant",
      "primaryAgentKey": "Agent_Illustration"
    },
    {
      "key": "authoring",
      "templateKey": "authoring-assistant",
      "name": "acme-authoring",
      "title": "Authoring Assistant",
      "primaryAgentKey": "Agent_Authoring",
      "externalRoleKeys": ["illustration"]
    }
  ],
  "orchestrator": {
    "key": "orchestrator",
    "templateKey": "lifecycle-orchestrator",
    "name": "acme-orchestrator",
    "title": "Lifecycle Orchestrator",
    "primaryAgentKey": "Agent_LifecycleOrchestrator",
    "externalRoleKeys": ["authoring"]
  }
}
```

When `plugin.version` is pinned, keep it aligned with the intended package and loaded runtime version; add a package/profile consistency check in the owning plugin. Never put tenant, organization, workspace, environment, installed Assistant, or credential identifiers in a portable profile.

## Choose Create, Refresh, Or Resume

| Intent | Operation |
| --- | --- |
| First installation or an explicitly requested separate suite | Create with a unique `--run-id`; existing names fail |
| Update installed Assistants | `--refresh` with the previous installation/release receipt and a new release receipt |
| Recover an interrupted release | `--resume` with that release's existing receipt |

For an installed suite:

```bash
corepack pnpm assistant:suite:init \
  --profile "$SUITE_PROFILE" \
  --api-url "$XPERT_API_URL" \
  --org-id "$XPERT_ORG_ID" \
  --workspace-id "$XPERT_WORKSPACE_ID" \
  --refresh \
  --installation-file "$PREVIOUS_INSTALLATION_RECEIPT" \
  --manifest-file "$NEW_RELEASE_RECEIPT"
```

A completed release receipt can select exact Assistant IDs for the next release, even after their names change. Legacy `xpert-assistant-suite-installation@1` receipts are accepted after scope/plugin checks. Without a receipt, use the exact original `--run-id`; the CLI matches profile base names plus that suffix, template provenance, and primary Agent identity. Do not adopt fuzzy name matches or create duplicates to avoid a failed update.

For a new suite, omit `--refresh` and `--installation-file`, use a unique `--run-id`, and choose a new `--manifest-file`. Without an explicit path, creation writes under `~/.xpert/assistant-suites/`. Refresh and resume require a manifest path; an existing path is rejected without `--resume`.

`--dry-run` validates the local profile only. It sends no API requests and does not prove authentication, permissions, template availability, or runtime readiness.

Omit `--environment-id` to preserve **each existing Assistant's** environment. An explicit value overrides only the orchestrator; role environments remain unchanged. New Assistants without an override publish with `null`, never an empty UUID.

## Preparation, Bindings, And Publication

The CLI must:

1. Verify the loaded plugin, all exact templates, and existing targets before mutation; reject provenance, scope, version, or primary Agent mismatches.
2. Prepare every draft before publishing. Preserve instance-owned Assistant/Agent model selections, including explicit null inheritance, schema-declared middleware model fields, memory/speech models, environments, tools, and knowledge bindings.
3. Resolve tool references by exact IDs or explicit provider/component identity. Display names are not identity. Missing or ambiguous bindings must fail before draft persistence; never remove tools, invent IDs, or change models just to make publication pass.
4. Verify that template content stayed unchanged during preparation.
5. Publish all roles in dependency order, then the orchestrator. Rebind each caller to newly published child descriptors with direct `required: true` External Xpert connections. Do not connect every specialist directly to the orchestrator unless the profile declares that edge.
6. Re-fetch and verify published graphs, models, environments, and required connections before marking the receipt `readyForTesting`.

Roles removed from the previous receipt are disconnected from the updated suite; their historical Assistants are retained. Inspect the impact of intentional local graph customizations before applying a template update.

Authoring and published graph endpoints return different projections. Fetch the draft through the authoring endpoint; request model relations explicitly when comparing published models. A missing relation in a default `/team` response does not prove a model was cleared. Use the CLI's verification or inspect current controller contracts instead of comparing raw responses with different shapes.

## Resume And Publication Failures

```bash
corepack pnpm assistant:suite:init \
  --profile "$SUITE_PROFILE" \
  --api-url "$XPERT_API_URL" \
  --org-id "$XPERT_ORG_ID" \
  --workspace-id "$XPERT_WORKSPACE_ID" \
  --resume \
  --manifest-file "$NEW_RELEASE_RECEIPT"
```

Keep the recorded API target, scope, profile, plugin/template content, and environment choices unchanged. The receipt pins target IDs and progress. Completed roles are verified and skipped; prepared drafts are reused. Repeating resume on a completed release must not publish extra versions.

Distinguish two failures:

- **Before database commit:** validation, binding, stale-snapshot, or persistence failure preserves the previous published version and draft. Diagnose the error, then resume the same release when its pinned inputs still match.
- **After commit:** `XPERT_PUBLICATION_ACTIVATION_PENDING` reports a committed version whose trigger/event activation remains incomplete. Resume activation through `POST /api/xpert/:id/publication/resume` with `{ "version": "<committed-version>" }`, using the same authoring scope. The suite CLI performs this recovery, including a lost publication response. Do not create another version as a retry. Recovery requires the expected version, preserves later drafts, and clears the server checkpoint only after activation succeeds.

Changed templates, scope, published versions, or outside draft edits stop recovery. An interrupted template synchronization with no completed checkpoint has an unknown outcome: inspect the current draft before starting a new reviewed release. Never edit receipt hashes, remove locks for a live writer, or write the database directly to force recovery.

## Receipts And Acceptance

Store deployment and release receipts outside source control in a protected local directory. Release receipts are atomically written with mode `0600` and guarded against concurrent local writers. They contain deployment-specific identifiers but no credentials or draft content; do not copy those identifiers into skills, reusable templates, or chat output.

Record plugin package version, template key/DSL `team.version`, suite profile identity, installed published version, and business flow-template version separately.

Match verification to the requested task. For deployment smoke testing, inspect all published bindings and run one bounded capability in a fresh conversation with the required authorized Project/workspace context. For full application acceptance, additionally exercise the relevant role delegation, tools, persistence, errors, and business outputs. Confirm deterministic Router/terminal nodes do not create LLM executions when that behavior is in scope. Report unexercised layers explicitly.
