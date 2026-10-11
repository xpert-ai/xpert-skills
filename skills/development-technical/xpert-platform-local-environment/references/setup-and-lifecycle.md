# Setup and Lifecycle

Read this reference when selecting an environment mode, cloning or bootstrapping Xpert, materializing local configuration, starting services, resolving collisions, or repairing an unhealthy environment.

## Supported Repository Set

- Official public platform: `https://github.com/xpert-ai/xpert.git`
- Application/plugin repository: selected by the user or discovered from the task workspace
- Optional shared plugin repository: `https://github.com/xpert-ai/xpert-plugins.git`, only when the requested plugin needs it

Reuse an existing checkout when it is the intended repository. Never clone optional repositories merely because they are adjacent, and never infer authorization for a private enterprise repository.

## Lifecycle States

Keep these states distinct:

1. `planned`: paths, mode, ports, commands, and mutations are known; nothing changed.
2. `checkout_ready`: the selected repository exists and its branch, commit, remote, and dirty state are recorded.
3. `configured`: required local configuration files exist and remain outside source control.
4. `dependencies_ready`: the repository-owned bootstrap completed for source mode.
5. `infrastructure_ready`: the selected Compose project is healthy, or an explicitly approved dependency set is reused.
6. `platform_started`: API and UI were launched or adopted with correct ownership.
7. `platform_ready`: API readiness and UI reachability pass with correct provenance.
8. `plugin_test_ready`: initialization, credential handoff, workspace allowlist, and local-deploy prerequisites are satisfied.

Failure at a later state does not erase evidence for earlier states. Report the last verified state and exact next action.

## Source-Hybrid Mode

Use source-hybrid by default for plugin and Agentic App development:

1. discover or clone the intended Xpert checkout;
2. read its `AGENTS.md`, root `package.json`, package-manager declaration, bootstrap script, Compose files, and environment template;
3. create only missing local configuration;
4. run the repository-owned bootstrap through Corepack;
5. start database, Redis, and the default NsJail runner under an explicit Compose project name; verify authenticated runner health before starting the source API;
6. start API and Cloud with the checked-out repository's scripts;
7. wait for the current readiness endpoint and UI URL;
8. prove both listeners belong to this checkout;
9. hand off plugin deployment to `xpert-plugin-development`.

For the current platform shape, expected scripts commonly include `bootstrap`, `start:api`, `start:cloud`, `plugin:deploy:local`, `assistant:suite:init`, and `remote-view:preview`. Discover them from the checked-out `package.json`; do not assume they remain stable.

Check the installed Node version against the checkout's dependencies before bootstrap. Use a compatible installed runtime consistently for both bootstrap and detached API/UI processes; recording one Node version while launching services with another makes the receipt misleading.

On macOS, a present Docker CLI does not imply a running daemon. Check the server with `docker info`; start the installed Docker application when needed for the authorized setup. Once the daemon is ready, repeat container and port inspection: old containers with restart policies may start automatically. Keep unrelated instances intact.

When the user requests an empty database, split infrastructure startup from API startup and follow [first-user-initialization.md](first-user-initialization.md) to capture emptiness before schema synchronization. The one-shot setup command starts the API immediately after infrastructure and does not capture that proof.

### Local configuration

Do not overwrite an existing `.env`. For a fresh public checkout, derive missing local configuration from the checked-out `docker/env.example`, not from copied documentation or another user's environment.

When generating fresh local configuration:

- generate random local values for session, JWT, encryption, MCP state/token, database, and Redis secrets;
- keep values aligned between source and infrastructure configuration where they represent the same dependency;
- set source-mode API/UI URLs and ports explicitly;
- enable NsJail by default: generate its token, use host loopback port `8090` for source API or the service URL for Docker API, set a dedicated sandbox directory and matching UID/GID; use Docker Desktop development resource mode on macOS;
- use writable host paths for source `LOG_DIR` and `XPERT_TEMPLATE_DIR`, under the environment state directory; remap `LOG_FILE_PATH` as well when it is set, because it overrides `LOG_DIR`;
- set `PLUGIN_WORKSPACE_ROOTS` to the narrowest parent containing the supplied plugin repository;
- never print secret values or include them in the receipt;
- preserve generated files only when they are ignored by the target repository.

If existing source and infrastructure files disagree on dependency credentials or ports, report the key names only and stop. Do not rewrite either file automatically.

Keep container paths in Docker configuration. The generator adapts paths only when creating a missing source `.env`. If a configuration generated during the current task causes a host-path failure, make a targeted correction and restart the affected service; do not elevate permissions to make `/var/lib/xpert` writable. Preserve pre-existing user configuration and inspect it before proposing a change.

### Process state and logs

Keep source process state outside the platform repository, for example:

```text
<workspace-root>/.xpert-local-environment/<environment-key>/
├── state.json
├── api.log
└── cloud.log
```

The state file contains paths, PIDs, endpoints, Compose project, commit, and timestamps only. It must not contain environment values, credentials, headers, or plugin configuration.

A saved PID is a hint, not proof. Verify that the process exists, its command/current directory belongs to the selected checkout, and its expected port and endpoint are healthy.

Record the launcher PID separately from the actual `listenerPid`: Corepack, pnpm, and Nx can introduce several parent processes. After a targeted restart, update both process identity and health evidence in the receipt. Do not leave the old launcher PID in a successful handoff.

Start source processes with output redirected to the protected environment log files, and inspect only bounded tails or targeted matches during readiness and diagnosis. Startup frameworks may print expanded configuration or environment payloads; never stream or copy an unbounded startup log into chat, a receipt, or CI output. Redact secret-bearing lines, prefer quiet health polling, and report only the failing subsystem, stable error, provenance, and log path needed for follow-up.

First startup can spend time compiling and installing the template's default `PLUGINS` before opening the API port. Use bounded log progress and child-process state to distinguish active work from failure. Once health passes, check for skipped initialization such as template-directory permission errors; readiness alone does not prove every bootstrap subsystem succeeded. A browser opened before API readiness may remain on `/onboarding/unknown`; navigate back to the root after the API is ready.

## Docker Smoke Mode

Use full Docker when the goal is a released/self-hosted platform smoke test:

1. create `docker/.env` only when absent;
2. create required bind-mount directories without deleting or changing existing contents;
3. start the checked-out `docker/docker-compose.yml` with the NsJail overlay and an explicit project name; the setup script adapts the overlay build/mount paths to the Docker Compose base directory;
4. wait for the API container healthcheck and web endpoint;
5. verify containers and published ports belong to that Compose project.

Do not run `sudo chown` automatically. If bind-mount permissions prevent startup, report the exact directories and documented UID/GID requirement for the user to approve or perform.

Do not claim an arbitrary host plugin `workspacePath` can be loaded in Docker mode. The API container must receive that path through a supported mount/package mechanism. Prefer source-hybrid for local plugin code.

## Checkout Rules

- Missing target: setup may clone the official public repository into the exact requested path.
- Existing target: confirm it is a Git repository and record its remote/branch/commit/dirty state.
- Existing dirty target: setup may run non-destructive bootstrap/start commands but must not pull, switch, reset, clean, or overwrite files.
- Requested ref on a missing target: clone that branch/tag when Git supports it.
- Requested ref on an existing target: do not switch automatically; require the checkout already matches or stop for a user decision.
- Never infer that the newest branch is required. Record the platform commit used for plugin acceptance.
- Compare Git status before and after bootstrap. Repository builds may regenerate tracked remote-component assets; disclose these separately from manual source edits and do not reset them automatically.

## Port and Ownership Rules

Default ports are discovered from current configuration and scripts; common source defaults are API `3000` and Cloud `4200`, while full Docker commonly publishes API `3000` and web `80`.

Before starting:

1. enumerate listeners on required ports;
2. resolve PID, command, and current directory when supported;
3. in source mode, adopt only a healthy listener owned by the selected checkout;
4. in Docker mode, adopt only containers labeled with the selected Compose project;
5. otherwise stop and report the owner without killing it.

Infrastructure ports may be reused only after the user or existing environment contract explicitly permits reuse. Reusing a healthy Postgres/Redis listener does not guarantee database or tenant isolation; record the decision.

## Recovery Matrix

| Symptom | Diagnose first | Safe response |
|---|---|---|
| API port healthy but wrong checkout | listener PID, command, cwd | Stop and ask whether to use that checkout, stop it, or choose another port. |
| Compose shows another repository's services | project label and working-directory label | Use an explicit unique project name; do not operate on the other project. |
| API ready, UI unavailable | Cloud process/log, UI port, API proxy config | Restart only the selected Cloud process after fixing the cause. |
| Plugin deploy requests restart | deployment receipt and API log | Restart the selected API, recheck provenance/health, then verify runtime. |
| Bootstrap fails | first failing repository command and tool versions | Fix that prerequisite and resume; do not delete `node_modules` or lockfiles by default. |
| Source API cannot create logs or templates under `/var/lib/xpert` | `LOG_DIR`, `LOG_FILE_PATH`, `XPERT_TEMPLATE_DIR` and configuration provenance | Correct task-generated source paths to writable local directories, restart API, and refresh receipt PIDs. |
| Agent reports NsJail provider unavailable while API is ready | selected agent sandbox and API `NSJAIL_RUNNER_URL`/`NSJAIL_RUNNER_TOKEN` | Follow [sandbox-readiness.md](sandbox-readiness.md); configure/start the matching runner, preserve workspace paths, restart API, and prove an actual scoped command. |
| Docker bind mount denied | exact mount and owner/mode | Request the documented permission action; do not elevate automatically. |
| Existing `.env` is incomplete | missing key names and checked-out template | Ask for or add only non-secret safe defaults; never replace the file wholesale. |

## Setup Stopping Conditions

Stop retries after one targeted retry for a transient start/health failure. Repeated unchanged failure requires log-based diagnosis, not another full setup run. Stop immediately for wrong process provenance, conflicting Compose ownership, missing credentials, dirty-checkout ref changes, or permission elevation.
