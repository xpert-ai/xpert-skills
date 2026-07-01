# Managed Queue For Plugins

Use this reference when adding or migrating plugin background jobs.

## Platform contract

New plugin jobs should use platform Managed Queue:

1. Resolve `ManagedQueueService` with `MANAGED_QUEUE_SERVICE_TOKEN`.
2. Enqueue logical jobs with `pluginName`, `queueName`, `jobName`, `payload`, `tenantId`, `organizationId`, and `scopeKey`.
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
  async handle(job: ManagedQueueJob<WechatOutboundQueueJobData>) {
    await this.queueService.processSendTextJob(job)
  }
}
```

One class can have multiple `@PluginJobProcessor()` decorators when it switches by `job.name`.

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

## Migration checklist

1. Remove plugin BullMQ dependencies and module imports.
2. Replace `queue.add()` with `ManagedQueueService.enqueue()`.
3. Replace direct job removal with `ManagedQueueService.cancel()`.
4. Replace BullMQ processors with `@PluginJobProcessor()` handlers.
5. Move Redis state and locks to platform Redis.
6. Scope all Redis keys by tenant/org/integration or equivalent.
7. Ensure handlers can run without an HTTP request.
8. Drain old physical queues before production rollout; do not add compatibility consumers unless explicitly requested.
