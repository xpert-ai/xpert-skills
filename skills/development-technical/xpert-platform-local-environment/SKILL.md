---
name: xpert-platform-local-environment
description: Provision, start, inspect, repair, and verify a local Xpert platform environment for plugin and Agentic App testing, using a source checkout with Docker infrastructure by default or full Docker smoke mode. Use when Xpert must be cloned, bootstrapped, made healthy, or proven to be the exact instance loading a local plugin; do not use for plugin implementation itself.
---

# Xpert Platform Local Environment

Bring one explicitly selected Xpert checkout to a reproducible, plugin-test-ready local state. Default to `source-hybrid`: run infrastructure with Docker Compose and run the API and Cloud UI from the selected source checkout. Use full Docker only for platform smoke testing or when live host/plugin SDK debugging is not required.

This skill owns platform checkout, local configuration materialization, infrastructure, API/UI process provenance, health verification, recovery guidance, and a secret-free environment receipt. It does not own plugin code, plugin installation semantics, Assistant DSLs, or application acceptance.

## Route to Companion Skills

- After the platform is ready, use `xpert-plugin-development` for plugin build, `plugin:deploy:local`, runtime verification, and plugin release states. Read its `references/general.md` local deployment sections rather than duplicating authentication or installation rules here.
- Use `xpert-assistant-dsl-builder` for Assistant template installation, update, publication, and runtime acceptance.
- Use `xpert-agent-pipeline-developer` for multi-role Case pipelines, role Assistants, External Xpert orchestration, dashboard/swimlane product behavior, and end-to-end application acceptance.

## Environment Modes

| Mode | Use when | Plugin-development consequence |
|---|---|---|
| `source` (`source-hybrid`) | Building or debugging plugins, SDK/contracts, View Host, Assistant provisioning, or host behavior | Default. The API can load an allowlisted host `workspacePath`, and API/UI logs and source provenance are inspectable. |
| `docker` | Quickly proving a released platform image or reproducing ordinary self-hosted behavior | Do not assume an arbitrary host plugin path is visible inside the API container. Use a supported mount/package flow or switch to source mode for local-code plugins. |

Read [setup-and-lifecycle.md](references/setup-and-lifecycle.md) before setup, start, repair, mode switching, port remediation, or configuration changes. Read [plugin-test-readiness.md](references/plugin-test-readiness.md) before handing the environment to plugin deployment or claiming it is ready for application testing.

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
  --strict
```

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

The command may clone the official public Xpert repository when the exact target path is absent, create missing local `.env` files from the checked-out template with generated local-only secrets, run the repository-owned bootstrap, start namespaced infrastructure and source processes, wait for health, and write a secret-free receipt. It must not overwrite existing configuration or update/switch an existing checkout.

### 3. Respect Human and Security Gates

Pause with a specific action when any of these is required:

- repository authentication or a non-public fork;
- a branch/ref choice that would change an existing checkout;
- port ownership by another checkout or Compose project;
- elevated volume permissions;
- first-user/platform initialization;
- Xpert deployment credentials or model/provider secrets.

Never ask the user to paste passwords or tokens into chat. Never inspect browser storage, cookies, shell history, or unrelated process environments. Prefer the credential mechanism defined by `xpert-plugin-development` after platform readiness.

### 4. Prove Plugin-Test Readiness

Platform readiness requires more than dependency installation:

1. the selected checkout and exact commit are recorded;
2. infrastructure is healthy or explicitly reused;
3. the API readiness endpoint passes;
4. the Cloud UI is reachable;
5. source listeners belong to the selected checkout, or Docker containers belong to the selected Compose project;
6. required plugin workspace roots are allowlisted in source mode;
7. the platform exposes the expected local-deploy and Assistant-suite commands;
8. initialization/credentials are ready, or the receipt names the remaining human action.

Only then hand off to `xpert-plugin-development`. Plugin `built`, `staged`, `running`, Assistant `published`, and application `acceptance passed` remain later, distinct states.

### 5. Repair Conservatively

- Re-run the inspector before changing a failed environment.
- Preserve user-owned `.env`, volumes, databases, repositories, logs, and running instances.
- Do not automatically stop, kill, delete, reset, pull, or switch anything to resolve a collision.
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

## Expected Output

Return a secret-free receipt containing:

1. environment mode, workspace, platform path, branch, commit, and worktree state;
2. Node, Corepack, package-manager, Docker, and Compose versions;
3. generated-versus-preserved configuration paths without values;
4. Compose project, services, source PIDs/log paths, and provenance results;
5. API/UI endpoint health and readiness state;
6. plugin path/SDK compatibility and workspace-allowlist state when supplied;
7. commands discovered for bootstrap, local plugin deployment, Assistant suites, and preview;
8. `ready`, `action_required`, or `failed`, plus remaining human actions and unverified layers.
