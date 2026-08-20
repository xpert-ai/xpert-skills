# Managed Queue For Plugins

Use this reference when adding or migrating plugin background jobs.

## Platform contract

New plugin jobs should use platform Managed Queue:

1. Resolve `ManagedQueueService` with `MANAGED_QUEUE_SERVICE_TOKEN`.
2. Enqueue logical jobs with `pluginName`, `queueName`, `jobName`, `payload`, `tenantId`, `organizationId`, `scopeKey`, and `userId` when the job acts for a business user.
3. Declare handlers with `@PluginJobProcessor()`.
4. Let the platform own BullMQ queue, Redis connection, worker, retries, delays, cancellation, and RequestContext restoration.

Do not add plugin-local `BullModule.forRoot()`, `BullModule.registerQueue()`, `@Processor()`, `WorkerHost`, `InjectQueue`, or a separate Redis connection for queue infrastructure.

## Enqueue pattern

```ts
const managedQueue = ctx.resolve<ManagedQueueService>(MANAGED_QUEUE_SERVICE_TOKEN)

await managedQueue.enqueue({
  pluginName,
  queueName: 'wechat.outbound',
  jobName: 'send-message',
  payload,
  tenantId,
  organizationId,
  scopeKey,
  userId,
  jobId,
  delayMs,
  attempts,
  backoffMs
})
```

Persist the returned `jobId` in plugin business tables when users need cancel, retry, or inspection.

## Handler pattern

```ts
@PluginJobProcessor({
  pluginName,
  queueName: 'wechat.outbound',
  jobName: 'send-message',
  concurrency: 1
})
@Injectable()
export class WechatOutboundQueueProcessor {
  async handle(
    job: ManagedQueueJob<WechatOutboundQueueJobData>,
    context: ManagedQueueJobContext
  ) {
    await this.queueService.processSendTextJob(job, context)
  }
}
```

One class can have multiple `@PluginJobProcessor()` decorators when it switches by `job.name`.

## Scope and actor restoration

Treat enqueue identity as part of the durable job contract:

- `tenantId` and `organizationId` isolate plugin data and platform capabilities.
- `scopeKey` routes the job to the processor registered for the matching plugin installation.
- `userId` preserves the business actor for capabilities that require user authority.
- Domain identifiers and revisions belong in the bounded payload, not in ambient request state.

Read the processor's `ManagedQueueJobContext` as the authoritative restored queue ownership. A handler must be able to run after the originating HTTP request and process have ended. Reload current domain objects by ID, revalidate tenant/organization scope, and reject stale revisions before mutation.

Do not enqueue tokens, credentials, Request objects, service instances, ORM entities, full snapshots, file bytes, temporary URLs, or server paths. Store portable references and stable IDs only.

## Assistant Task orchestration

Use Managed Queue as the durable scheduler when a plugin workflow starts a professional Agent through `AssistantTaskRuntimeCapability`:

1. Create a plugin-owned domain task and immutable execution-attempt record.
2. Enqueue the domain task ID, expected revision, operation ID, Agent role key, and bounded policy parameters.
3. Atomically claim the queued domain revision in the processor.
4. Call `startTask` with the installed Assistant ID and stable published `agentKey`.
5. Persist the returned platform `taskId`, `conversationId`, `threadId`, and `executionId` separately from the plugin domain task ID.
6. End the processor invocation; supervise completion through later jobs, domain finalize events, or bounded `getTaskStatus` reconciliation.

Do not use a plugin domain task ID as `startTask.taskId` unless it is also a real platform Task aggregate ID. Let the Assistant Task runtime allocate its identity when the plugin does not own that platform aggregate.

The Queue job and Assistant execution have separate cancellation surfaces. Cancel a waiting Queue job with `ManagedQueueService.cancel`; cancel an already-started Agent execution with `AssistantTaskRuntimeCapability.cancelTask` and the persisted conversation/thread/execution handles.

## Idempotency and recovery

Use an operation ID plus expected domain revision as the logical idempotency key. Protect launch with a unique constraint, atomic status transition, or scoped lock so duplicate Queue deliveries cannot start the same professional Agent twice.

Persist every external handle before scheduling downstream work. On restart, reload nonterminal domain tasks and call `getTaskStatus` with all known Assistant Task handles. Interpret results conservatively:

- `queued` or `running`: keep supervising.
- `succeeded`: require the expected domain finalizer/version before marking business success.
- `failed` or `interrupted`: record a safe failure summary and apply the domain retry budget.
- `unknown` or no result: keep the task recoverable; never infer success.

Assistant execution completion and domain completion are different signals. A professional Agent should finalize through a controlled middleware tool that validates scope, revision, evidence, and completeness. If the execution ends without that finalizer, fail or recover the domain task instead of advancing the workflow.

Keep old attempts as immutable execution records. A retry creates a new attempt and new Assistant execution handles; it must not overwrite the audit trail of the previous run.

## Redis state and locks

Use `ManagedQueueService.getRedis()` for plugin rate-limit state, aggregate state, and locks. Never reach into BullMQ private clients.

Keys must be scoped. Include tenant and the most precise business scope available:

```text
plugin_wechat:{tenantId}:{integrationId}:lock:outbound
plugin_wechat:{tenantId}:{organizationId}:inbound:{aggregateKey}
```

`concurrency` is only a local handler limit inside one API process. Use Redis locks for cross-pod ordering, account limits, or integration limits.

## Failure and retry

Handlers should throw to let BullMQ apply attempts/backoff:

```ts
try {
  await work()
} catch (error) {
  await recordBusinessFailure(job, error)
  throw error
}
```

Plugins still own business observability: message logs, account status, integration health, and user-visible failure reasons.

For Agent-orchestrated jobs, also expose the professional Agent role, attempt number, domain revision, Assistant execution status, finalize status, and conversation/thread/execution handles needed for an authorized View to open the execution record.

## Migration checklist

1. Remove plugin BullMQ dependencies and module imports.
2. Replace `queue.add()` with `ManagedQueueService.enqueue()`.
3. Replace direct job removal with `ManagedQueueService.cancel()`.
4. Replace BullMQ processors with `@PluginJobProcessor()` handlers.
5. Move Redis state and locks to platform Redis.
6. Scope all Redis keys by tenant/org/integration or equivalent.
7. Capture `userId` when the job requires user authority, and consume the restored `ManagedQueueJobContext` in processors.
8. Ensure handlers can run without an HTTP request and revalidate scope plus revision from persisted state.
9. For Assistant Task jobs, persist platform execution handles separately, reconcile nonterminal runs, and require domain finalization before success.
10. Drain old physical queues before production rollout; do not add compatibility consumers unless explicitly requested.
