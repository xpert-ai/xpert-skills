# Sandbox Action Bundles and Sandbox Jobs

Read this reference when a plugin needs Chromium, PDF/PPTX export, document conversion, or another heavyweight operation in a short-lived isolated Runtime.

## Contents

1. [Select the capability](#select-the-capability)
2. [Preserve the architecture boundary](#preserve-the-architecture-boundary)
3. [Use the public contracts](#use-the-public-contracts)
4. [Declare an Action](#declare-an-action)
5. [Build a deterministic bundle](#build-a-deterministic-bundle)
6. [Design the business queue job](#design-the-business-queue-job)
7. [Resolve and probe Sandbox Jobs](#resolve-and-probe-sandbox-jobs)
8. [Pass portable inputs and outputs](#pass-portable-inputs-and-outputs)
9. [Run, persist, cancel, and retry](#run-persist-cancel-and-retry)
10. [Develop and validate](#develop-and-validate)
11. [Develop a Runtime Provider](#develop-a-runtime-provider)
12. [Diagnose health](#diagnose-health)
13. [Avoid common mistakes](#avoid-common-mistakes)

## Select the capability

| Need | Use |
| --- | --- |
| Lightweight delayed/retryable work | Managed Queue |
| Workspace-owned files | Workspace Files |
| Fixed heavyweight isolated runtime | Managed Queue + Sandbox Jobs + Workspace Files |
| Interactive commands tied to a conversation | Interactive Agent Sandbox |

Do not use Sandbox Jobs solely because work is asynchronous. Use them when immutable system dependencies, isolation, resource bounds, or container lifecycle are required.

## Preserve the architecture boundary

Use these terms and owners consistently:

| Layer | Owner | Plugin responsibility |
| --- | --- | --- |
| Sandbox Runtime Suite | Platform | None; do not add plugin code to platform images |
| Browser Runtime | Platform | Declare compatible Runtime/Playwright requirements |
| Runtime Definition | OSS Runtime Suite | Reference its stable profile name only from Action manifest |
| Runtime Binding | Runtime Provider | Map a Definition to a Provider-owned immutable artifact |
| Runtime Provider SPI | OSS Plugin SDK | Implement only for system-level infrastructure plugins |
| Sandbox Action Bundle | System plugin | Build and publish deterministic business runtime files |
| Sandbox Job | Platform Runtime | Invoke by Action name/version from a background handler |

Hard rules:

1. Do not create a plugin Dockerfile for common Browser Runtime work.
2. Do not add plugin names, actions, images, or Providers to `SandboxRuntimeDefinitionRegistry`.
3. Do not accept or pass command, image, profile, entrypoint, environment, Docker options, or host paths in `run()`.
4. Do not mount a plugin installation directory or host `node_modules` into a Sandbox.
5. Keep business state in plugin entities; treat `SandboxJob` as generic runtime evidence.
6. Keep a browser-free fallback independent when the product has one.

The API process consumes the heavyweight execution pool at conservative local concurrency and initializes any installed system Runtime Providers. OSS production installs no hardened Provider, while Pro and community distributions register their Provider in API. Sandbox Jobs Runtime remains responsible for idempotency, capacity, Provider calls, materialization, validation, and cleanup.

## Use the public contracts

Import the platform-owned declarations instead of recreating local lookalikes:

| Development area | Public contracts | Import from |
| --- | --- | --- |
| Action manifest | `XpertPluginSandboxActionDefinition` | `@xpert-ai/contracts` |
| Action execution | `SandboxJobsRuntimeCapability`, `SandboxJobsApi`, `SandboxJobRunInput`, `SandboxJobSnapshot` | `@xpert-ai/plugin-sdk` |
| Error/retry handling | `SandboxJobRuntimeError`, `isSandboxJobRuntimeError()` | `@xpert-ai/plugin-sdk` |
| Queue routing/readiness | `ManagedQueueExecutionPool`, `ManagedQueueExecutionPoolHealth`, `ManagedQueueService` | `@xpert-ai/plugin-sdk` |
| Runtime implementation | `SandboxRuntimeDefinition`, `SandboxRuntimeBinding`, `SandboxRuntimeArtifact`, `SandboxRuntimeInstance`, `ISandboxRuntimeProvider` | `@xpert-ai/plugin-sdk` |
| Provider/paths registration | `SandboxRuntimeProviderStrategy()`, `SandboxWorkspaceMapper`, `SandboxWorkspaceMapperStrategy()` | `@xpert-ai/plugin-sdk` |

Treat the exported declarations and their TSDoc as the source of truth:

1. `SandboxJobsApi.run()` accepts Action identity, structured payloads, and portable references only. Do not widen its contract with engine-specific fields.
2. Treat `runtimeRef` as opaque. Make Provider `destroy()` idempotent and able to clean up from persisted Binding/runtime evidence after reload.
3. Check both `getActionHealth()` and `getExecutionPoolHealth()` before creating the business export record or enqueueing heavyweight work; repeat the check on the server even when the UI already checked it.
4. Keep Runtime Definition provider-neutral. A Provider owns Binding/artifact selection, while the selected evidence is persisted for the actual attempt.
5. Never import `server-ai` classes into a plugin or Provider distribution. If the minimum supported host SDK lacks a new contract, keep one named compatibility adapter and remove it after the SDK dependency is upgraded.

When reviewing platform code, use `SandboxActionRegistry`, `SandboxRuntimeDefinitionRegistry`, `SandboxRuntimeBindingSelector`, `SandboxRuntimeHealthService`, `SandboxJobRuntimeCapabilityService`, and `SandboxJobCapacityService` to locate behavior. These are Core implementation classes, not plugin imports.

## Declare an Action

Only system-level plugins may declare executable Sandbox Actions in v1.

Build the Action under the plugin's `dist` tree:

```text
dist/sandbox-actions/report-export/
├── action.json
└── bundle/
    ├── runner.mjs
    ├── assets/
    └── runtime-modules/    # Action-owned dependencies, if needed
```

Use an Action manifest like:

```json
{
  "name": "report.export",
  "version": "1.0.0",
  "runtimeProfile": "browser/playwright-1.61/v1",
  "runtimeContractVersion": "1",
  "playwrightVersion": "1.61.0",
  "bundle": "./bundle",
  "entrypoint": "runner.mjs",
  "bundleSha256": "<tree-sha256>"
}
```

Point `.xpertai-plugin/plugin.json` at the generated manifest:

```json
{
  "sandboxActions": "./dist/sandbox-actions/report-export/action.json"
}
```

Action name/version are the plugin-facing public identity. The Runtime Profile is an Action compatibility constraint, not a `run()` parameter. Increment `actionVersion` for behavior or bundle contract changes; do not use a separate `rendererVersion`.

## Build a deterministic bundle

Prefer a package script such as `build:sandbox-action` that:

1. removes the previous Action output;
2. bundles the Runner/entrypoint with esbuild for the Runtime's Node target;
3. marks Runtime-provided dependencies such as `playwright-core` external;
4. copies pinned templates, themes, fonts, or static resources;
5. includes other JS dependencies under a normal Action directory such as `bundle/runtime-modules`;
6. rejects symlinks and non-regular files;
7. sorts files by POSIX relative path;
8. computes per-file SHA-256 and a deterministic tree hash;
9. writes `action.json` only after the bundle is complete.

Use the platform tree-hash format exactly:

```text
for each sorted regular file:
  SHA256.update(relativePath + NUL + byteLength + NUL + fileSha256 + LF)
```

Keep the bundle under 256 MiB and 20,000 files. Never put Action dependencies in nested `node_modules`: npm excludes that directory from a packed dependency, so a source-tree hash can pass while production receives different content. Exclude packaging metadata that npm silently drops, including `.npmignore`, `.gitignore`, `.npmrc`, and `.DS_Store`. Release verification must run a real `npm pack --ignore-scripts --json`, extract the tarball, and execute the same Action verifier against the extracted package. A dry-run file list is useful diagnostics but is not release proof.

Do not include a raw upstream source tree twice. When production HTML and the Action share a pinned runtime, load the built Action copy in production and allow a source-tree fallback only in development.

## Design the business queue job

Create a plugin-owned record before enqueueing. Store operation/format, immutable version or checksum, business status, queue job ID, optional Sandbox Job ID, portable output reference, integrity metadata, and user-facing error details.

Keep the queue payload to business identifiers:

```ts
await managedQueue.enqueue({
  pluginName: MY_PLUGIN,
  queueName: 'report.export',
  jobName: 'render',
  payload: { exportId },
  tenantId,
  organizationId,
  scopeKey,
  jobId: `report-export:${exportId}`,
  attempts: 3,
  backoffMs: { type: 'exponential', delay: 5_000 },
  executionPool: 'sandbox-browser'
})
```

Call `sandboxJobs.run()` only from the background handler because it waits for capacity and completion. The handler must work without an HTTP request or active conversation.

## Resolve and probe Sandbox Jobs

Use the official SDK capability:

```ts
import {
  SandboxJobsRuntimeCapability,
  XPERT_RUNTIME_CAPABILITIES_TOKEN,
  type RuntimeCapabilityRegistry,
  type SandboxJobsApi
} from '@xpert-ai/plugin-sdk'

const jobs = capabilities?.get(SandboxJobsRuntimeCapability)
if (!jobs) throw new Error('Platform Sandbox Jobs capability is unavailable.')
```

Probe by Action identity before accepting an operation:

```ts
const health = await jobs.getActionHealth({
  pluginName: MY_PLUGIN,
  action: REPORT_ACTION,
  actionVersion: REPORT_ACTION_VERSION
})
```

Health covers Action presence/validity, system-level authorization, bundle hash, Runtime Definition, contract and Playwright compatibility, API-local Binding, immutable artifact policy, Provider, and actual Runtime manifest. Cache health briefly (the platform uses 45 seconds), not indefinitely, and select again before execution.

Also probe the execution pool before presenting an operation as available:

```ts
const pool = await managedQueue.getExecutionPoolHealth({
  executionPool: 'sandbox-browser'
})

if (!pool.available) {
  return {
    available: false,
    reason: 'WORKER_UNAVAILABLE',
    message: pool.warning
  }
}
```

Treat availability as capability discovery, not tenant configuration. Browser-backed features should be on by default and return a concise warning for a missing Action, Definition, Binding, Provider artifact, or API queue consumer. `RUNTIME_UNBOUND` means the API executor has no compatible Binding and is the expected OSS production state until a Provider distribution is installed. `PROVIDER_UNAVAILABLE` means a registered Provider cannot enumerate Bindings. Reject the operation before enqueueing, explain that HTML/fallback remains available, and do not add a plugin feature switch whose only purpose is runtime readiness.

If the plugin currently targets an older published SDK, isolate a narrow structural compatibility interface in one named file. Remove it once the dependency exports the Action-oriented API. Do not spread `any` assertions through business code.

## Pass portable inputs and outputs

Inside the handler, load the immutable business snapshot and persisted assets. Pass each binary as:

```ts
{
  reference: asset.portableReference,
  targetPath: `assets/${asset.id}/${safeName}`,
  size: asset.size,
  sha256: asset.sha256
}
```

Rules:

- Require `source: 'platform.workspace.files'` and matching tenant.
- Persist size/SHA-256 when the asset is accepted.
- Use regular relative paths; reject absolute paths, null bytes, and `..`.
- Keep JSON payload small; never embed binary base64.
- Derive output destination from authenticated scope/business state, never Agent/browser input.
- Never derive a host path from `/workspace` or `/sandbox`.

Read `references/workspace-files.md` when handling locators or cross-scope destinations.

## Run, persist, cancel, and retry

```ts
const result = await jobs.run({
  jobId: exportRecord.id,
  action: REPORT_ACTION,
  actionVersion: REPORT_ACTION_VERSION,
  idempotencyKey: `report-export:${exportRecord.id}:${exportRecord.inputChecksum}`,
  scope: {
    tenantId: exportRecord.tenantId,
    organizationId: exportRecord.organizationId,
    userId: exportRecord.userId,
    pluginName: MY_PLUGIN,
    businessResourceType: 'report-export',
    businessResourceId: exportRecord.id
  },
  payload: { format: exportRecord.format, document: snapshot.document },
  files,
  outputs: [{
    path: `report.${exportRecord.format}`,
    originalName: exportRecord.fileName,
    mimeType: exportRecord.mimeType,
    destination: trustedWorkspaceDestination
  }],
  timeoutMs: 300_000
})
```

Use an immutable checksum in the idempotency key. Persist `result.id`, attempt, Runtime/Profile evidence (`provider`, `runtimeBindingId`, `artifactDigest` when returned), and output portable reference/size/SHA-256/MIME type. Never copy output bytes into queue state or a plugin JSON record.

For cancellation, use the caller-known `jobId` and cancel both layers:

```ts
await jobs.cancel({ jobId: exportRecord.sandboxJobId ?? exportRecord.id })
await managedQueue.cancel({
  jobId: exportRecord.queueJobId,
  executionPool: 'sandbox-browser'
})
```

Only rethrow errors marked retryable. `SANDBOX_CAPACITY_UNAVAILABLE`, `SANDBOX_START_FAILED`, `BROWSER_LAUNCH_FAILED`, `EXPORT_TIMEOUT`, and `EXPORT_OOM` may retry. Action unavailable/invalid, Profile/version mismatch, invalid input/output, and cancellation do not. Normal quota saturation waits inside `run()` and does not spend a Managed Queue attempt.

## Develop and validate

Use this minimum checklist:

1. For Provider/Pro integration tests, build Browser Runtime once as local image `xpert-sandbox-browser:local` and start the API with the Provider registered. For ordinary OSS production tests, expect `RUNTIME_UNBOUND` and verify the browser-free fallback; development/test may use the local Browser Runtime.
2. Build through the plugin workspace's Nx target.
3. Verify Action manifest fields and recompute tree hash from both `dist` and an extracted final `npm pack` tarball.
4. Verify bundle contains no links, unsafe paths, runtime browser, or raw duplicate upstream tree.
5. Compare npm dry-run Action files with `dist`.
6. Unit-test that queue payload contains business IDs and `run()` contains Action identity but no profile/image/command.
7. Test missing Action/Definition/Binding/Provider/API-consumer warnings and preserve browser-free fallback behavior.
8. Run the Action with the fixed Browser Runtime digest under non-root, read-only, drop-capabilities, and no-network settings.
9. Validate representative PDF/PPTX structures, CJK/Emoji fonts, and the maximum supported page count.
10. Run the repository plugin lifecycle harness.

For local-only fallback, allow `exportBackend: 'local'` and an executable path only in development/test. Force `sandbox-job` in production. Do not add production `CHROME_PATH` deployment instructions.

## Develop a Runtime Provider

Only build a Provider when the target distribution needs a new execution engine. Common plugin browser work should build an Action instead.

Implement the public, minimal `ISandboxRuntimeProvider`; a standalone Provider distribution must never import `server-ai` internals or widen this SPI with the interactive Agent `ISandboxProvider/SandboxBackendProtocol`:

```ts
@Injectable()
@SandboxRuntimeProviderStrategy('podman-runtime')
export class PodmanRuntimeProvider implements ISandboxRuntimeProvider {
  readonly type = 'podman-runtime'
  readonly version = '1.0.0'
  readonly capabilities = {
    isolation: 'hardened', ephemeral: true, resourceLimits: true,
    networkPolicy: true, readOnlyRootFilesystem: true
  } as const

  listBindings() { /* return runtimeProfile + immutable artifact */ }
  getBindingHealth(input) { /* verify engine, artifact, manifest, guarantees */ }
  create(options) { /* create/reattach one Job-scoped instance */ }
  destroy(options) { /* idempotently reclaim runtimeRef or Job labels */ }
}
```

Provider requirements:

1. Package as `private: true`, `xpert.plugin.level=system`; organization-level registration is rejected.
2. Keep Runtime Definitions provider-neutral. Declare artifact choice only through `listBindings()`.
3. Accept only Core-provided Definition, Binding, resource/security policy, Job scope, and volume roots. Never accept plugin command/image/environment.
4. Return a Runtime instance with `workspaceRoot`, file upload/download, fixed argv execution, optional termination, and stable `id`/`runtimeRef`.
5. Make `destroy()` idempotent across Provider reload/config changes. Label or otherwise index instances by tenant/job/profile/binding.
6. Register a separate `SandboxWorkspaceMapperStrategy` only when the engine needs host/runtime path translation. Do not add engine strings to OSS Volume code.
7. Connect to the engine lazily. API startup and module discovery must not fail just because Docker/Podman/Kubernetes is temporarily unavailable.
8. Let the API executor probe local Provider health every 15 seconds with a 45-second cache and publish Redis evidence for observability; probe locally again before execution.
9. Pin production artifacts by immutable digest. Generate a Provider-owned lock from Runtime Artifact release catalogs and fail production packaging when it is absent or mutable.
10. Register the Provider and its Binding in the API process. Keep the `sandbox-browser` pool separate at concurrency one by default, and add engine access only to distributions that install the Provider. Do not add a Docker socket mount to OSS base Compose.
11. Test non-root, read-only root, no-new-privileges, capability drop, network policy, resource limits, cancel/OOM/deadline, engine restart, path traversal, tenant isolation, and orphan cleanup.

When a distribution supports both interactive Agent Sandboxes and Sandbox Jobs on one engine, implement two strategy classes and share only the low-level engine adapter and container utilities. The interactive class implements `ISandboxProvider`; the Job class implements `ISandboxRuntimeProvider`. Register both in the API process, but never make one strategy implement both contracts: Job execution must not inherit terminals, setup scripts, reusable environments, or arbitrary commands. In Xpert Pro, `DockerSandboxProvider` and `DockerSandboxRuntimeProvider` follow this split inside one Docker Sandbox module; the plugin repository must not duplicate the Docker engine implementation.

For Docker development, use `xpert-sandbox-browser:local` automatically and return a build hint when absent. Do not add `SANDBOX_BROWSER_RUNTIME_IMAGE`, profile JSON, Provider selector, or `CHROME_PATH` as production configuration.

## Diagnose health

Diagnose from outer to inner layers:

| Reason | Check |
| --- | --- |
| `WORKER_UNAVAILABLE` | The API-owned `sandbox-browser` Managed Queue pool has a live consumer and Redis is reachable |
| `PROVIDER_UNAVAILABLE` | A registered system Provider can enumerate its Bindings without an engine/client error |
| `RUNTIME_UNBOUND` | A system Provider is loaded and lists a compatible Binding for the Definition |
| `PROFILE_MISSING` | Runtime Definition Catalog contains the Action's profile |
| `VERSION_MISMATCH` | Action contract and Playwright versions match the Definition |
| `PROFILE_UNHEALTHY` | Artifact exists, immutable lock is valid, manifest/security checks pass, warm-up completed |
| `ACTION_MISSING` / `ACTION_INVALID` | System plugin package contains the declared manifest and exact bundle hash |

Do not “fix” health by downloading a browser into the API container or mounting the plugin directory into a Runtime.

For `Sandbox Action bundle hash mismatch`, inspect the installed package rather than adding environment variables: create a real npm tarball, extract it, recompute the tree hash under the manifest's `bundle` root, and compare the file list with build output. Rebuild dependencies into `runtime-modules`, reinstall the corrected package, then restart the API so its Action Registry reloads it.

## Avoid common mistakes

| Mistake | Correct approach |
| --- | --- |
| Add a plugin-specific platform Definition | Declare compatibility in the plugin Action; deploy a generic Runtime Definition and Provider Binding |
| Let the plugin maintain a browser image | Use platform Browser Runtime |
| Pass `profile` or `rendererVersion` to `run()` | Pass `action` and `actionVersion` only |
| Package `playwright-core` and Chromium in the Action | Externalize Playwright and use the Runtime copy |
| Mount plugin directories into Sandbox | Verify/cache/materialize the Action by hash |
| Put deck/assets in queue payload | Persist snapshot/references and queue only business IDs |
| Treat `containerRef` as business state | Persist `sandboxJobId` and portable outputs |
| Add Docker/path branches to OSS Core | Register a system Runtime Provider and workspace mapper strategy |
| Expose Docker socket in OSS base Compose | Add engine access only to the Pro/community API distribution that installs the Provider |
| Mix browser Jobs into the default queue | Keep the API-owned `sandbox-browser` physical pool separate and default its concurrency to one |
| Retry deterministic validation errors | Respect runtime `retryable` and error codes |
| Add feature flags for Runtime readiness | Default on; derive availability from Action and execution-pool health, with warning and HTML/fallback |
