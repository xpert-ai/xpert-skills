# Xpert inside an existing Linux Computer

Use this mode for a trusted development instance inside the user's existing Docker
Computer. The outer platform owns the Assistant/project and Computer lifecycle;
the inner instance is the program under test. Keep the normal unprivileged profile.

## Prerequisites and discovery

Read the selected checkout's `AGENTS.md`. Use a dedicated writable checkout under
the current Project root, with no existing `.env`. Pass `--project-root <project-root>`
on every lifecycle command. `prepare` records that binding; later commands reject
unbound or other-project state before starting services or executing authenticated
commands. A same-project retry reuses its instance. A new project gets its own
checkout, database, Redis and plugin directory; reuse dependency/runtime/build
caches rather than the previous project's mutable instance. The checkout must include
`tools/local-environment/cli.py` and its committed dependency locks. If absent,
report the missing capability; do not silently switch to Docker-in-Docker, sudo,
host Docker socket access, or a different repository revision.

The base environment needs Linux, Python 3.12+, Node/Corepack compatible with the
checkout, Git, Supervisor and the usual native build tools. PostgreSQL, pgvector,
Redis and their shared libraries are downloaded on demand, checksum verified and
installed under the user home. Package cache and environment data are separate.
The first run needs network access; repeating setup reuses the locked runtime.

`prepare` is idempotent for its recorded checkout, state and plugin root; it is not a command
for rebinding an existing instance to another project's plugin root. For a new
mapping, use a separate checkout without `.env` and a new state directory, reusing
the runtime/package caches. Do not edit ownership records or overwrite credentials
to bypass this check. A delegated task with an incompatible fixed mapping should
return that concrete blocker promptly so the coordinator can revise its scope.

Distinguish source installation from packaged delivery. Source `workspacePath`
installation must be inside the target's `PLUGIN_WORKSPACE_ROOTS`. A plugin
developed in another project can instead be packed and uploaded to the authorized
instance through `POST /api/plugin/archive` (multipart field `file`, optional JSON
`config`), using the same authenticated execution and declared installation scope.
That route installs an archive, does not submit `workspacePath`, and does not
require rebinding the instance's source allowlist. Still verify dependency closure,
the install receipt, any required restart and a real loaded-tool invocation.

The process-mode bootstrap also installs its tested Node 22 toolchain under the
user home. It leaves the Computer's system Node/Coding CLI installation unchanged;
the platform's native dependencies must build against the project Node version.
It explicitly builds the Local Shell provider's `node-pty` and runs its PTY smoke
test without globally approving other dependency build scripts. API startup also
checks the staged Local Shell plugin's own PTY and, when needed, rebuilds only that
plugin's node-pty against the project Node ABI. The platform's default policy of
skipping arbitrary plugin install scripts remains in place. Cypress's separate
desktop binary is not installed by bootstrap; install it explicitly for Cypress tests.

On an ARM host emulating the AMD64 Computer through QEMU, the tested compatibility
setting is `QEMU_GUEST_BASE=0x800000000000` on the initial `prepare` command. The
environment saves this explicitly supplied setting for its managed processes.
Use it only for that emulation case; native Computers do not need it. Probe Node
native modules and Redis before claiming a different emulator is compatible.

Check the host's available memory, the container's cgroup limit, and free disk
before a full build. AMD64-on-ARM validation completed the finite Web build and
full API startup at 4 CPU / 7 GiB RAM / 1 GiB swap, with a 1 GiB shared-memory
limit. This is an observed test profile, not a minimum or a capacity guarantee.
Earlier watch/prebundle attempts hit OOM at both 6 and 7 GiB; do not infer that a
4 GiB Coding CLI profile can run the complete platform. Budget at least 20 GiB of persistent
storage for source, packages, build outputs and state. Computer resource profiles
are deployment-owned; an Agent reports insufficient capacity instead of changing
isolation or resource limits from inside the guest.

Choose persistent absolute paths and inspect port ownership. Defaults are API
3000, Web 4200, PostgreSQL 15432 and Redis 16379. The browser inside the Computer
uses its own localhost. An outer browser needs the platform's authenticated preview
or explicit development port forwarding; its localhost is a different machine.

## Run the lifecycle

`start` and `restart` are finite orchestration commands with a default 60-second
readiness wait, even when a cold build takes many minutes. Run them in the CLI's
normal foreground command/session; do not detach them with `nohup`, `setsid` or a trailing `&`.
The locally started Supervisor runs services while the Coding CLI task is active.
Keep the finite orchestration command attached so it can start the remaining services.

The following placeholders are caller-selected persistent absolute paths.
Coding CLI tasks are finite: the executor deliberately reaps their descendants
when they finish, including double-forked Supervisor daemons. This is acceptable:
the next task checks and starts the same instance again. The Coding CLI decides
when to start, inspect, repair and stop services; no cross-task process owner is required.

1. Let the Coding CLI prepare the dedicated checkout and perform finite setup:

```bash
python3 <xpert-root>/tools/local-environment/cli.py \
  --platform <xpert-root> --state <persistent-state> --project-root <project-root> prepare \
  --plugin-root <plugin-parent> --supervisor-mode detached
python3 <xpert-root>/tools/local-environment/cli.py \
  --platform <xpert-root> --state <persistent-state> --project-root <project-root> bootstrap
```

2. The Coding CLI manages services with ordinary project commands. Xpert's
`start` launches a local Supervisor in detached mode and retains dependency order,
readiness checks, private logs and database initialization. No host service client,
platform token, Docker socket or extra privilege is needed. Other applications may
use the CLI's available shell/session facilities and their own startup commands.

A service may stop when the Coding CLI task completes or is cancelled. Do not
weaken executor cleanup or seek an external owner to keep it alive. Before a later
attempt or independent review, inspect the original project instance and call
`start` again when necessary; preserve the package, source, database and credentials.
Save project paths, startup commands and test evidence rather than assuming a saved
PID is still alive. A stopped process alone is not a failed deliverable.
`sandbox_service_start` is a host Assistant tool, not a command available to the CLI
or a prerequisite for this flow. Stop services when the current work is finished.

3. Start and verify the project instance:

```bash
python3 <xpert-root>/tools/local-environment/cli.py \
  --platform <xpert-root> --state <persistent-state> --project-root <project-root> start
python3 <xpert-root>/tools/local-environment/cli.py \
  --platform <xpert-root> --state <persistent-state> --project-root <project-root> initialize
python3 <xpert-root>/tools/local-environment/cli.py \
  --platform <xpert-root> --state <persistent-state> --project-root <project-root> status --strict
```

For an infrastructure-only milestone, omit bootstrap initially and call
`start --infra-only` after prepare; the local owner starts Supervisor automatically. The environment records
the empty public schema before applying migrations. `start` uses the repository's
OIDC initializer to create/reuse a private signing key in the state directory.
`initialize` creates the required default tenant and a separate development
organization through onboarding/login, saves a generated password privately and
verifies the administrator. Never echo the credential file.

4. After the implementation CLI exits, a separate execution reviewer checks the
same project instance with `status`. If its services stopped, use `start` with
the recorded checkout, state and project root, then verify health and the unchanged
candidate. Process identities may change on restart; do not require cross-task
process survival. Keep any completion/protocol diagnostic even if business
artifacts look correct.

Reuse the generated `status.json`, `database-initialization.json` and administrator
verification receipt as task evidence; do not ask the model to transcribe large
logs into a report. `status` includes the owned Supervisor generation and service
PIDs for current ownership checks, not a requirement to preserve them across tasks.
PostgreSQL legitimately changes WAL,
statistics and control files while running: validate database continuity with
`SELECT system_identifier FROM pg_control_system()` and a known application record
or test value, not a byte-for-byte hash of the live data directory. Configuration
and credentials must remain stable across an idempotent prepare; never print them.

Long setup/build commands can take minutes. Use the executor's long-run status and
cancellation mechanisms, inspect bounded progress and resume from the last verified
state. On a readiness timeout, exit **75** and JSON `status: pending` mean the
orchestration can resume; `serviceStillRunning` distinguishes an active owned
process from a stage not yet started. This is not a success or a failed build.
While the Coding CLI task remains active, the local Supervisor can continue a
build after a bounded start command returns. Task completion or cancellation may
stop it; the next task rechecks state and resumes through start.
Inspect `status` and bounded logs, then repeat **`start` with the same service
selection** to wait for that process and continue remaining stages. In particular,
after a full start times out on Web, repeating full start also proceeds to API.
Do not repeat `restart` just because the caller timed out, and do not
interpret a running build PID as readiness. Setup/start holds the environment
mutation lock; status/logs remain available. To stop during a long wait, end the
finite waiting command first, then stop the selected service. Do not launch competing mutations while an earlier start/bootstrap still owns
the lock.

The default full start prepares Web first, starts a lightweight Vite preview of that
complete build, then prepares/migrates/starts the API. It reuses Angular's locked Vite
and the repository's API/OIDC proxy configuration. The frontend compiler and
dependency prebundler do not stay resident alongside the API and browser. The
Computer build configuration uses JIT, no source maps, serial TypeScript and
bounded Node/Go memory; it is a development configuration, not the production AOT
release gate. `build --service web|api` can prepare an artifact as a separate finite
task; this command owns compilation directly and must have a sufficient task
budget. For long emulated builds, use bounded `start` and keep the coding task
active until its required build and tests finish.
Startup and restart reuse a build only when private receipts match source bytes
(including dirty/new files), lock/install metadata, project Node, build settings,
generated input assets and output bytes. Missing or changed inputs/outputs trigger
a new build; a failed/interrupted build never publishes a success receipt. Keep
the frozen dependency installation intact; manual edits inside node_modules are
unsupported. API reuse still runs schema apply and verify on every startup.
When source contains a fix missing from the running artifact, use the repository
CLI's `build --service api` or normal API start and verify the resulting artifact.
That difference alone is not evidence of a corrupt Nx cache. Do not globally set
`NX_SKIP_NX_CACHE=true` for the staged API build: each stage can then recompile
the same dependencies. If a specific cached target is demonstrably stale, rebuild
that target once, retain the evidence, then allow subsequent stages to reuse its
verified dependencies. Avoid running a manual library build followed by a second
unconditionally cold build of the entire stack.
After editing platform frontend source, `restart --service web` rebuilds it.
Plugin-only backend work normally needs only an API restart. A
continuous frontend watch process needs a separately sized resource profile.

The CLI also provides `logs --service api` (or `terminal`), `restart --service api`,
`restart`, `stop`, and `stop --service web`. Restart keeps the local Supervisor
alive; full stop ends it as well. After full stop, task cleanup or Computer recreation,
call `start` with the same checkout/state/home to launch the local processes again.
Stale process identities must not be adopted. Conflicting ports or unrelated `.env`
files require a different owned environment or deliberate configuration repair.

`prepare` defaults to detached supervision for new environments. To change a
previously managed environment, repeat prepare with `--supervisor-mode detached`;
this changes the next startup policy without replacing its database or credentials.
Detached processes are still subject to executor cleanup. Explicit `managed` plus
`supervise` remains available for callers that choose to hold a foreground Supervisor,
but is not required for Coding CLI development or review.

## Plugin handoff

Before installation into a project-exclusive instance, use the supported
[checkpoint and restore procedure](process-recovery.md). Keep it within the
Coding task's development/self-test loop. No existing checkpoint means no assumed
rollback capability; a shared instance requires targeted recovery instead.

Use `xpert-plugin-development` for package metadata, scope, tests and deployment.
Use the environment's non-authenticated `exec -- <command>` for finite builds,
tests and packaging too. It applies the selected Node and saved compatibility
settings, including `QEMU_GUEST_BASE` on the emulated profile. A raw shell command
that only prepends Node to `PATH` does not inherit those saved settings. `exec`
starts commands in the platform checkout; select another plugin directory with
the package manager's `--dir`/`--prefix` option or an explicit child-shell `cd`.
After initialization, the environment can supply a fresh local token to that CLI
without printing it or putting credentials on the command line:

```bash
python3 <xpert-root>/tools/local-environment/cli.py \
  --platform <xpert-root> --state <persistent-state> --project-root <project-root> exec --authenticated -- \
  corepack pnpm plugin:deploy:local --plugin-dir <plugin-root> --no-keychain
```

This executes the requested command with the environment's local development
credentials. It does not select a plugin scope, grant access to the outer platform,
or certify deployment. Inspect the deployment receipt; when a restart is required,
restart only the inner API, wait for health and invoke the actual plugin surface.
The private plugin store is outside the source checkout. An archive must declare
its own runtime dependencies and required peer closure; this exposes packages that
only worked through an ancestor checkout's node_modules. The host explicitly links
SDK/contracts. Do not add a broad node_modules symlink to hide a packaging defect.
Rebuild a versioned artifact, rerun its tests, and retry the real archive install.

## Acceptance and limits

- `status --strict` verifies owned listeners plus actual database/Redis/API/Web
  responses. It does not prove plugin behavior, model configuration or Agent autonomy.
- Verify Local Shell through a real scoped tool call when the test needs shell tools.
  Commands share this trusted development container's user permissions. NsJail
  network/filesystem/cgroup isolation remains a separate integration test.
- Keep the same package artifact/hash when promoting from the inner instance to
  the final target platform. Installation there is a separate release fact.
- Record who wrote the code, ran deployment and executed acceptance. A human or
  external coding assistant running commands is not proof of autonomous project
  orchestration by the platform Assistant.

## Stable plugin identity and installation conflicts

Keep a plugin's canonical package name stable across versions and retries. The
installation scope plus canonical package name identifies an update; version,
archive digest and runtime directory identify its candidate artifact. Do not
rename the package or change its npm scope just to prepare another version.
The platform excludes that plugin's old declarations when checking its update,
while still rejecting claims owned by other plugins. A shared tool name alone
does not authorize replacing a different package. Use the install/update API;
do not uninstall the old version first.

Registration preflight runs before schema changes and installation publication.
An explicit conflict from another package must leave the old runtime intact.
Report that conflict and the selected project binding once; do not repeatedly
restart, rewrite names or delete unrelated plugins. Project isolation prevents
previous projects' fixtures from being part of the normal installation baseline.
