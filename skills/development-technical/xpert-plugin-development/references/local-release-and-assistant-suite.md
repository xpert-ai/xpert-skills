# Local Plugin Release And Assistant Suite Provisioning

Use this workflow when a plugin contributes several role Assistants plus an Orchestrator, or when local acceptance repeatedly requires rebuilding, deploying, initializing, connecting, and publishing the same topology.

## Treat Readiness As Separate States

Do not collapse the following states into one “deployed” result:

1. **Source verified**: type checks, targeted tests, package build, generated assets, and `verify:dist` pass.
2. **Plugin registered**: the supported plugin API refreshed or installed the local `source=code` registration.
3. **Plugin running**: any required API restart completed and an observable provider, View, route, template, or tool is loaded.
4. **Assistant suite published**: role Assistants and the Orchestrator were installed from the intended templates, bound, saved, and published.
5. **Acceptance passed**: a fresh conversation exercises the expected runtime graph and business result.

A descriptor with `restartRequired: true` proves registration, not runtime activation. A loaded template proves neither Assistant installation nor publication.

## Fast Validation Tiers

Use the narrowest tier that matches the change, and run the complete tier before release:

- **Inner loop**: changed-package type check, focused unit tests, remote-component build, and asset consistency.
- **Release candidate**: full plugin build, declared tests, `verify:dist`, local deployment, runtime-provider smoke test.
- **Acceptance**: provision a fresh versioned Assistant suite, publish it, and run a bounded end-to-end case.

Do not rebuild or retest unchanged source between deployment and Assistant initialization. After the exact build and tests pass in the same unchanged task, deployment may use `--skip-build --skip-test`; `verify:dist` still runs when the plugin declares it.

## Scope Preflight

Derive installation scope from package metadata before mutation:

| `xpert.plugin.level` | Allowed local scope |
| --- | --- |
| `system` | Tenant scope in the Default tenant |
| `tenant` | Tenant scope |
| `organization` | Organization scope |

Reject mismatches before build, test, or API calls. Do not choose scope merely because an organization or tenant identifier is available.

## Plugin Deployment Command

Run from the platform repository:

```bash
corepack pnpm plugin:deploy:local \
  --plugin-dir <plugin-repo-root>/<plugin> \
  --scope tenant \
  --tenant-id "$XPERT_TENANT_ID" \
  --manifest-file <temporary-output>/plugin-deployment.json
```

For an organization plugin, replace the scope arguments with `--org-id "$XPERT_ORG_ID"`.

The deployment manifest is a secret-free handoff record. It should include declared level, actual scope, build/test/deploy-output status, deployed version, descriptor summary, action, and restart requirement. It is operational evidence, not a reusable plugin artifact; do not commit machine paths or scope identifiers.

## Assistant Suite Profile

Keep reusable topology in a versioned JSON profile. Do not store tenant, organization, workspace, environment, Assistant, or credential identifiers in it.

```json
{
  "schemaVersion": "xpert-assistant-suite@1",
  "key": "acme-acceptance-v2",
  "plugin": {
    "name": "@xpert-ai/plugin-acme",
    "version": "0.2.0"
  },
  "roles": [
    {
      "key": "engineering",
      "templateKey": "engineering-assistant",
      "name": "acme-engineering-acceptance",
      "title": "Engineering Acceptance Assistant",
      "primaryAgentKey": "Agent_Engineering"
    }
  ],
  "orchestrator": {
    "key": "orchestrator",
    "templateKey": "lifecycle-orchestrator",
    "name": "acme-orchestrator-acceptance",
    "title": "Lifecycle Acceptance Assistant",
    "primaryAgentKey": "Agent_LifecycleOrchestrator",
    "externalRoleKeys": ["engineering"]
  }
}
```

Provision it from the platform repository:

```bash
corepack pnpm assistant:suite:init \
  --profile <suite-profile.json> \
  --workspace-id "$XPERT_WORKSPACE_ID" \
  --org-id "$XPERT_ORG_ID" \
  --run-id acceptance-v2-01 \
  --manifest-file <temporary-output>/assistant-suite.json
```

Omit `--environment-id` when there is no default environment. Publication must send `environmentId: null`; an empty UUID is invalid.

## Provisioning Order And Invariants

The initializer should:

1. Verify the plugin descriptor and every exact template before creating anything.
2. Validate plugin version, template provenance, template key, and primary Agent key.
3. Install independent role Assistants first; safe implementations may run these installations in parallel.
4. Install the Orchestrator as a draft.
5. Add each role as a direct External Xpert node from the Orchestrator primary Agent.
6. Set every External Xpert connection to `required: true`; optional connections are not loaded by default at runtime.
7. Save, publish, re-fetch the published graph, and verify exactly one required direct connection per configured role.
8. Write a secret-free installation receipt and only then mark the suite ready for testing.

Default to **create only** with a unique `run-id`. A name collision must fail instead of overwriting. Permit `--resume` only for the exact run after validating official template provenance and primary Agent identity. Resume is recovery from a partial run, not permission to adopt an arbitrary Assistant.

## Version Vocabulary

Keep these identities separate:

- plugin package version;
- Assistant template key and template DSL `team.version`;
- suite profile key/version;
- installed Assistant published version;
- business flow-template key/version, when the plugin owns a workflow.

An acceptance report should record all applicable values. Do not name every layer “v5” without identifying which version changed.

## Runtime Acceptance

After provisioning:

1. Confirm the installed Orchestrator and every role have the expected title, Avatar, template provenance, primary Agent, Middleware, Feature, and View.
2. Confirm External Xpert connections are direct and required.
3. Start a fresh conversation so no old graph checkpoint is reused.
4. Execute one bounded node per role and verify the actual executor, tools, persistence, and audit correlation.
5. Verify deterministic Router and terminal nodes do not create LLM executions.
6. Capture the plugin deployment manifest, Assistant suite receipt, test result, and any required restart as separate evidence.

Keep credentials in Keychain or process environment. Never put tokens, passwords, scope IDs, or installed Assistant IDs in reusable profiles, source files, or chat output.
