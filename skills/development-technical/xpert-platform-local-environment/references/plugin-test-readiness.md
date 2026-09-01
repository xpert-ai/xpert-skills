# Plugin Test Readiness

Read this reference after platform health passes and before installing a local plugin, provisioning Assistants, or reporting an application as testable.

## Readiness Gates

### Platform identity

- selected platform path, remote, branch, and commit are recorded;
- the worktree's dirty state is disclosed;
- source API/UI provenance or Docker Compose ownership is proven;
- API readiness and UI reachability pass against the recorded endpoints.

### Plugin loading prerequisites

- the platform exposes its current `plugin:deploy:local` command or the fallback installation contract has been inspected;
- the plugin root exists, is inside an allowed `PLUGIN_WORKSPACE_ROOTS` boundary in source mode, and is visible to the API process;
- plugin SDK/contracts peer ranges are compatible with the selected checkout or the mismatch is explicitly recorded;
- installation scope inputs can be discovered from plugin metadata without guessing tenant/organization identifiers;
- local deployment credentials are available through the mechanism prescribed by `xpert-plugin-development`, or `action_required` names that missing gate.

Full Docker is not local-code-ready merely because the plugin exists on the host. Verify the API container can resolve the plugin path through an explicit mount or use a packaged installation path.

### Initialization and user access

- the platform has completed first-user/organization initialization;
- the user can authenticate without exposing credentials to Codex output;
- the target tenant/organization/workspace exists;
- required model/provider configuration for the intended runtime test is present, or tests are scoped to behavior that does not need it.

### Test surfaces

Confirm the requested plugin can be observed through at least one real surface after deployment:

- provider/tool schema and one tool invocation;
- plugin route or server provider;
- Workbench/Remote View in the View Host;
- middleware binding in an Assistant;
- Assistant suite execution;
- application-specific backend/Case flow.

Select the smallest surface that proves runtime loading, then run the application's broader acceptance separately.

## Handoff to Plugin Deployment

Once the gates pass:

1. load `xpert-plugin-development`;
2. build, test, and validate deployable assets;
3. run the platform-owned `plugin:deploy:local` using the plugin-declared scope;
4. distinguish `built`, `staged`, and `running`;
5. restart the selected API only when required;
6. repeat environment provenance and health checks after restart;
7. invoke an observable runtime surface;
8. provision/publish Assistants only after the plugin is running.

For an installed Workbench runtime check after restart, reload or reopen the signed-in top-level host route and wait for its View tab and iframe initialization to remount. Do not validate through a standalone iframe URL or a detached pre-restart document. This proves only the selected observable plugin surface; broader application acceptance still belongs to the application/pipeline skill.

Do not embed plugin credentials, tenant selection heuristics, or Assistant DSL mutation in the environment setup script. Those belong to the narrower companion skills and may change independently.

## Secret-Free Receipt

The environment handoff receipt should include:

```text
status: ready | action_required | failed
mode: source | docker
platform path, branch, commit, dirty count
configuration paths: generated | preserved | missing
compose project and service health
API/UI URLs and health
source PIDs/log paths and provenance, or Docker container ownership
plugin root and workspace visibility
discovered bootstrap/deploy/Assistant/preview scripts
remaining human initialization or credential action
unverified plugin, Assistant, model, and application layers
```

Never include `.env` values, passwords, JWTs, cookies, authorization headers, Keychain contents, complete plugin configuration, or customer data.

## Acceptance Boundary

Use these exact statements:

- `platform_ready`: selected Xpert instance is healthy and correctly identified.
- `plugin_test_ready`: platform plus initialization, workspace visibility, and safe authentication handoff are ready for local deployment.
- `plugin_running`: only after `xpert-plugin-development` proves an observable plugin runtime surface.
- `assistant_ready`: only after Assistant installation/publication and one execution agree.
- `application_accepted`: only after the application-specific end-to-end scenarios pass.

Never collapse them into “setup complete” or “deployed.”
