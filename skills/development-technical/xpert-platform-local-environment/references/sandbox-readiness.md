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
