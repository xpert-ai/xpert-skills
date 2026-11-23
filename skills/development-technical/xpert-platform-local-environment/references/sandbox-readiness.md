# Default NsJail Sandbox

Local setup starts NsJail by default, together with database and Redis. No extra opt-in is needed.

- Generate `NSJAIL_RUNNER_TOKEN` in ignored local configuration.
- Source API: `NSJAIL_RUNNER_URL=http://127.0.0.1:8090`, an absolute `SANDBOX_VOLUME`, and the repository's NsJail + host-development Compose overlays.
- Docker API: use `http://nsjail-runner:8090` and share the API's `/sandbox` mount with the runner.
- Match runner UID/GID to the sandbox directory owner. On macOS use Docker Desktop with `XPERT_NSJAIL_USE_CGROUP_V2=false` for local development.
- Check authenticated runner health during setup. Keep the explicit Compose project and check port ownership.
- Preserve existing configuration and workspace data. If an older configuration lacks required keys, report them and complete that configuration before startup; do not silently replace it.

Before handing off agent testing, run a harmless sandbox command and one minimal message in a **new conversation**. Old failed messages may lack retry checkpoints. API health alone does not prove agent execution.

```bash
node <skill-dir>/scripts/inspect-xpert-local-environment.mjs \
  --workspace <workspace-root> --platform <xpert-root> --mode source \
  --sandbox-provider nsjail --strict
```

This read-only inspector checks configuration and authenticated RPC health. A successful exit still reports `execution: not_checked`; it neither creates a runtime nor proves an Agent conversation works.

## Minimal execution check

Read the selected checkout's Runner protocol and POC client before sending requests (`.deploy/nsjail-runner/runner.py` and `poc_validate.py` in the current layout). Use a fresh temporary directory strictly below the configured workspace root and keep the Runner token in memory. Do not use a tenant's existing files as a probe.

For the current protocol:

1. Create a runtime with `POST /v1/runtimes`, an ID consisting of 16–64 lowercase hexadecimal characters, the temporary `workspacePath`, and `workingDirectory: "/workspace"`. A UUID containing hyphens is rejected.
2. Execute a harmless command through `POST /v1/runtimes/<id>/exec`, such as a fixed marker, `id -u`, and `pwd`, with bounded output and a short timeout. Check the exit code, timeout flag, marker, and expected non-root identity; a successful HTTP response alone is insufficient.
3. Destroy only the created runtime, then clean up only the probe's directory in `finally`. The Runner can create `.apps` inside it, so an empty-directory-only removal may fail. Preserve the original RPC/command error if cleanup also fails, and report cleanup failure separately.
4. Save the safe result as `execution: passed | failed`. Keep protocol/health, command execution, and fresh Agent-conversation acceptance as separate observations. If a model is not configured, leave the conversation check explicitly unverified.

Do not relabel a previously observed `execution: failed` as `not_checked` or success when a later health-only inspector passes. Merge the execution evidence into the final receipt and name the affected tests as `action_required`; API/UI `platform_ready` can remain true.

## Verify the directory-identity fix

The corrected Runner implementation validates a pinned directory descriptor in a child running as the configured workspace identity when the privileged ownership view differs. The implementation, Linux ownership/permission regressions, and detailed explanation belong in the selected checkout's `.deploy/nsjail-runner/workspace_identity.py`, `test_workspace_identity.py`, and Runner README.

First establish that the selected source contains that correction and that the intended Runner image was built from it. Then verify runtime creation and repeated non-root commands in the same shared workspace. Runtime creation alone can miss a later preparation failure. On success, update the current execution result with the corrected artifact's identity and retain the prior failure as history.

For an older or unverified image, `/health` can still pass while runtime creation or execution returns `Managed application directory must be writable by the configured workspace UID/GID`. Record the deployed revision and compare host ownership, configured `XPERT_NSJAIL_UID`/`XPERT_NSJAIL_GID`, and the privileged/workspace-user observations. Route a reproduced failure on a corrected image back to the platform regression tests instead of repeating generic ownership workarounds.

Changing VirtioFS to gRPC FUSE is not a verified general remedy. Keep UID 0, disabled ownership checks, recursive permission changes, and unrestricted sandboxes out of this compatibility procedure. A source-only patch or successful health check leaves execution `action_required` until the corrected artifact passes the command check.
