---
name: xpert-platform-local-environment
description: Provision, start, repair, initialize, and verify a local Xpert platform, including user-local PostgreSQL and Redis inside an existing unprivileged cloud Computer, source with Docker infrastructure, or full Docker smoke mode. Use for local setup and plugin-test readiness; not plugin implementation.
---

# Xpert Platform Local Environment

Bring one explicitly selected Xpert checkout to a reproducible, plugin-test-ready local state. Default to `source-hybrid`: run infrastructure with Docker Compose and run the API and Cloud UI from the selected source checkout. Use full Docker only for platform smoke testing or when live host/plugin SDK debugging is not required.

Inside an existing unprivileged Linux Computer, use **process mode** when the user
wants the complete development stack inside that Computer. Read
[process-mode.md](references/process-mode.md) and use its repository-owned Python
CLI. The Node setup/inspection helpers below remain for source-hybrid/Docker mode.

This skill owns platform checkout, local configuration materialization, infrastructure, authorized first-user initialization, API/UI process provenance, health verification, recovery guidance, and a secret-free environment receipt. It does not own plugin code, plugin installation semantics, Assistant DSLs, or application acceptance.

## Route to Companion Skills

- For end-to-end delivery from one feature request, use `cloud-project-delivery` when available. Environment readiness is an intermediate task result: the coordinating Agent continues with delegated implementation, deployment and live tests without asking the user for phase instructions. Missing authorization remains a blocker; an already authorized isolated development environment does not require repeated initialization/deployment approval.
- After the platform is ready, use `xpert-plugin-development` for plugin build, `plugin:deploy:local`, runtime verification, and plugin release states. Read its `references/general.md` local deployment sections rather than duplicating authentication or installation rules here.
- Use `xpert-assistant-dsl-builder` for Assistant template installation, update, publication, and runtime acceptance.
- Use `xpert-agentic-app-developer` and its [Project Pipelines reference](../xpert-agentic-app-developer/references/project-pipelines.md) for App integration with platform pipelines, domain adapters, approvals, historical rounds, and business workspace navigation.

## Environment Modes

| Mode | Use when | Plugin-development consequence |
|---|---|---|
| `source` (`source-hybrid`) | Building or debugging plugins, SDK/contracts, View Host, Assistant provisioning, or host behavior | Default. The API can load an allowlisted host `workspacePath`, and API/UI logs and source provenance are inspectable. |
| `docker` | Quickly proving a released platform image or reproducing ordinary self-hosted behavior | Do not assume an arbitrary host plugin path is visible inside the API container. Use a supported mount/package flow or switch to source mode for local-code plugins. |
| `process` | Developing inside an existing Linux Computer without root or a Docker daemon | Install locked dependencies under persistent home; run real API/Web/database processes and opt in to Local Shell. |

Read [setup-and-lifecycle.md](references/setup-and-lifecycle.md) before setup, start, repair, mode switching, port remediation, or configuration changes. Read [plugin-test-readiness.md](references/plugin-test-readiness.md) before handing the environment to plugin deployment or claiming it is ready for application testing.

For a fresh database or first administrator, also read [first-user-initialization.md](references/first-user-initialization.md). A local setup request can finish at `platform_ready` with verified user access; plugin selection and model configuration are required only when the user's task needs them. Omit `--plugin-dir` from the examples below when no plugin is in scope.

For running initialized agents, Bosi/ClawXpert, or workspace/terminal tools, read [sandbox-readiness.md](references/sandbox-readiness.md). Source-hybrid/Docker setup enables NsJail by default. Process mode uses the explicitly selected Local Shell development provider; verify an actual command before claiming the agent is runnable and do not claim NsJail isolation equivalence.

## Workflow

### 1. Inspect Without Mutation

- Read repository-level instructions for every existing checkout.
- Discover checkouts and worktree state instead of assuming machine-specific paths.
- Inspect tools, declared package manager, platform scripts, local configuration presence, endpoint health, port owners, and process provenance:

```bash
node <skill-dir>/scripts/inspect-xpert-local-environment.mjs \
  --workspace <workspace-root> \
  --platform <xpert-root> \
  --mode source \
  --plugin-dir <plugin-root> \
  --api-url "$XPERT_READINESS_URL" \
  --web-url "$XPERT_WEB_URL" \
  --strict
```

Derive these URLs from the selected environment. The inspector's `--api-url` is the full readiness endpoint, such as `http://localhost:<api-port>/api/health/ready`; deployment/suite CLIs instead take the API origin. The inspector defaults to ports 3000/4200 and does not infer custom ports from `.env`, so pass overrides for an existing environment with different ports.

Do not accept a healthy port as evidence that the selected checkout is running. In source mode, the listening API and Cloud processes must resolve to the selected checkout. In Docker mode, the containers must belong to the selected Compose project.

### 2. Plan, Then Apply

The setup command is dry-run by default:

```bash
node <skill-dir>/scripts/setup-xpert-local-environment.mjs \
  --workspace <workspace-root> \
  --platform <xpert-root> \
  --mode source \
  --plugin-dir <plugin-root>
```

Review the plan, especially checkout target, mode, configuration files, ports, Compose project, and plugin workspace allowlist. Then apply the same plan:

```bash
node <skill-dir>/scripts/setup-xpert-local-environment.mjs \
  --workspace <workspace-root> \
  --platform <xpert-root> \
  --mode source \
  --plugin-dir <plugin-root> \
  --apply
```

The command may clone the official public Xpert repository when the exact target path is absent, create missing local `.env` files from the checked-out template with generated local-only secrets, run the repository-owned bootstrap, start namespaced infrastructure (including NsJail) and source processes, wait for health, and write a secret-free receipt. It must not overwrite existing configuration or update/switch an existing checkout.

### 3. Respect Human and Security Gates

Pause with a specific action when any of these remains unresolved or unauthorized:

- repository authentication or a non-public fork;
- a branch/ref choice that would change an existing checkout;
- port ownership by another checkout or Compose project;
- elevated volume permissions;
- first-user/platform initialization when not already authorized by the user;
- Xpert deployment credentials or model/provider secrets.

Never ask the user to paste passwords or tokens into chat. Never inspect browser storage, cookies, shell history, or unrelated process environments. Prefer the credential mechanism defined by `xpert-plugin-development` after platform readiness.

A request to set up the system through creation of a super administrator authorizes that initialization. Follow the linked initialization procedure without asking for the same permission again; pause only for a separate unresolved gate.

Likewise, an explicit choice to switch local services to another checkout authorizes stopping the identified API/UI and starting the selected checkout. Preserve unrelated processes, configuration, and shared infrastructure; follow [the checkout-switch procedure](references/setup-and-lifecycle.md#switching-the-active-source-checkout) without asking for the same choice again.

### 4. Prove Plugin-Test Readiness

Platform readiness requires more than dependency installation:

1. the selected checkout and exact commit are recorded;
2. infrastructure is healthy; source-hybrid/Docker verifies its NsJail runner, while process mode verifies its explicitly selected Local Shell capability and reports the weaker isolation;
3. the API readiness endpoint passes;
4. the Cloud UI is reachable;
5. source listeners belong to the selected checkout, or Docker containers belong to the selected Compose project;
6. required plugin workspace roots are allowlisted in source/process mode;
7. the platform exposes the expected local-deploy and Assistant-suite commands;
8. initialization/credentials are ready, or the receipt names the remaining human action.

Only then hand off to `xpert-plugin-development`. Plugin `built`, `staged`, `running`, Assistant `published`, and application `acceptance passed` remain later, distinct states.

### 5. Repair Conservatively

- Before plugin installation in a project-exclusive process-mode instance, read
  [process recovery](references/process-recovery.md) and create a checkpoint when
  the selected checkout supports it. The Coding executor owns ordinary recovery
  and subsequent self-tests; do not require user instructions for those steps.
- When the user authorizes a disposable Computer test instance, its old test
  plugins may be disabled, uninstalled or replaced to resolve conflicts. Record
  the changed plugin set; preserving every prior fixture is not a requirement.
  Keep this permission in the delegated task instead of adding a blanket
  "preserve all existing plugins" restriction. A fresh project-owned instance is
  also an option when repairing obsolete test state would cost more than setup.
- Use the [failure ownership table](references/setup-and-lifecycle.md#failure-ownership) to distinguish platform defects, setup-helper defects, and host-tool constraints. Keep platform fixes and their regression tests in the selected platform checkout; retain workflow and compatibility guidance here.
- For an issue already fixed in source, follow the [fix verification procedure](references/setup-and-lifecycle.md#verify-an-existing-fix): align the running artifact with that source and retest the affected behavior. Keep old workarounds conditional on older revisions.
- Re-run the inspector before changing a failed environment.
- Preserve user-owned `.env`, volumes, databases, repositories, logs, and running
  instances outside the authorized test changes. Disposable test-plugin cleanup
  does not authorize deleting project source, evidence or unrelated instance data.
- Do not resolve collisions by stopping another instance or switching checkouts without existing authorization; never delete/reset user data as a repair shortcut.
- Prefer a targeted restart of the selected API/UI or namespaced Compose project after the cause is known.
- After repair, repeat provenance and health checks; do not rely only on the absence of errors.

## Non-Negotiable Invariants

- The checkout named in the receipt is the checkout actually serving source-mode API and UI processes.
- Compose always uses an explicit project name derived from or supplied for the selected environment.
- Existing repositories, dirty worktrees, `.env` files, volumes, and credentials are never overwritten by setup.
- Configuration generation writes secrets only to ignored local files, never stdout, receipts, documentation, or source control.
- An occupied port owned by another checkout/project blocks setup unless the user explicitly chooses a different port/environment or authorizes reuse after inspection.
- Source setup uses the repository-declared package manager through Corepack and repository-owned scripts.
- Full Docker health does not prove local source-code plugin loading.
- Platform health does not prove plugin registration, runtime loading, Assistant publication, or application acceptance.
- A later successful RPC health check must not erase a failed sandbox execution check. Preserve both results in the handoff receipt; see [sandbox-readiness.md](references/sandbox-readiness.md).

## Expected Output

Return a secret-free receipt containing:

1. environment mode, workspace, platform path, branch, commit, and worktree state;
2. Node, Corepack and package-manager versions; Docker/Compose versions only when used by this mode;
3. generated-versus-preserved configuration paths without values;
4. Compose project, services, source PIDs/log paths, and provenance results;
5. API/UI endpoint health and readiness state;
6. plugin path/SDK compatibility and workspace-allowlist state when supplied;
7. commands discovered for bootstrap, local plugin deployment, Assistant suites, and preview;
8. `ready`, `action_required`, or `failed`, plus remaining human actions and unverified layers.
