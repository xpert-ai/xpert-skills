# Database Access and Transaction Boundaries

Read before adding or changing plugin persistence, background task claims, quota accounting, or multi-record mutations. These are Agent coding and review requirements; they do not claim that the current SDK enforces a database sandbox.

## Default plugin boundary

- Use scoped ORM repositories for ordinary operations on plugin-owned entities and verified platform data capabilities for host-owned data or atomic domain commands. Preserve tenant/organization scope, authorization, revisions, and bounded query sizes.
- Do not introduce plugin-owned transaction lifecycles: `DataSource.transaction`, `EntityManager.transaction`, `repository.manager.transaction`, `QueryRunner.startTransaction`/`commitTransaction`/`rollbackTransaction`, or SQL `BEGIN`/`COMMIT`/`ROLLBACK`.
- Do not bypass this boundary through aliases, helper wrappers, a separate database connection/pool, raw `.query()` calls, or unrestricted SQL passed through a QueryBuilder. ORM query builders for scoped, parameterized entity queries remain usable under the host's supported contract.
- Do not treat a full TypeORM Repository as a restricted capability: its manager and related objects can expose transaction and raw SQL entry points. Avoid those entry points even when the SDK makes them accessible. An ORM operation may internally use a transaction; the restriction is on plugin-controlled transaction lifetimes, not database atomicity itself.
- Never wait for HTTP, GitHub, LLM, file/network I/O, queue completion, retries, sleeps, or platform capability calls while a transaction is open. A capability may borrow another connection even in the same process. This also applies to ORM listeners/subscribers invoked during a transactional save.

`await` does not release a transaction's connection or locks. Duplicate jobs waiting on a row lock can exhaust the shared API connection pool while the lock owner waits for another connection. Database rollback also cannot undo an already completed external call.

## Verify installed ORM identity

Before using `TypeOrmModule.forFeature` or host repositories, inspect the target
loader's supported host peers. On hosts implementing ORM peer links, declare a
compatible `typeorm` peer and, when using Nest ORM integration, an
`@nestjs/typeorm` peer. Keep declared ORM peers external to the bundle and use
development dependencies for compilation; do not ship private runtime copies.
Both `DataSource` constructor identity and Nest's entity-registration
storage must be shared with the host, even when the versions already match.

Verify this with the actual staged archive/source installation. A workspace
symlink, broad `NODE_PATH`, or copying business code into the platform's built-in
plugins can hide the boundary failure and does not prove portable installation.
If the running host lacks this contract, report the platform compatibility blocker
instead of repeatedly changing injection syntax or creating a separate connection.
Record the actual host build that provides the links; local source changes alone
do not establish runtime support.

## Preserve atomicity through platform capabilities

Choose the smallest supported operation:

- Single-row changes: scoped ORM writes, unique constraints, and explicit conditional updates using the expected revision; inspect the affected-row result. Separate reads and writes are not an atomic claim.
- Multi-record changes: an existing typed platform domain command or bounded atomic operation contract, with the platform owning the short database transaction.
- Task claims and quotas: an existing atomic claim/reservation capability with stable operation IDs and retry semantics. A plugin-local transaction wrapper is not a platform capability.
- Reliable external delivery: atomically persist business state plus durable delivery intent through a supported platform command, then dispatch after commit and reconcile using the operation ID.

Inspect the target host's actual SDK types, implementation, and tests before choosing an interface. Do not invent an `atomic()`/quota/claim API or assume one exists because this guide describes the desired boundary. If a needed capability is absent, identify the gap and propose a narrow host capability; implement host changes only when within the task's scope. Do not silently substitute a plugin-managed transaction or independent writes that lose atomicity.

An approved platform atomic interface should accept bounded data operations or a typed domain command. Renaming an arbitrary `async` transaction callback does not constrain plugin code; it still permits external waits. Host transaction implementations should use the same transaction manager for all database work, bounded lock/statement waits, and commit before external dispatch.

For workflows with external calls, use this shape:

```text
platform atomic claim / revision check / quota reservation -> commit
external work with bounded timeouts and a stable idempotency key
platform conditional result write using current ownership and revision -> commit
```

Use platform-managed, scoped leases when work must be coordinated across API processes; see [Managed Queue](managed-queue.md). Revalidate ownership before side effects and result writes, and stop advancement after lease loss. A lease does not replace database constraints or external-operation idempotency, and it must not retain a database transaction while work runs.

## Existing code and migrations

When repairing an existing plugin, inventory transaction entry points and their transitive calls, including repository managers, helper methods, entity hooks, and host capabilities. Prioritize moving external waits out of transactions and preventing duplicate workers from accumulating database lock waits.

Preserve necessary atomic invariants while migrating to supported platform operations. Do not mechanically remove transactions from quota reservation, related-row writes, approval/audit/outbox persistence, or revision updates. A focused repair may retain an existing short, database-only transaction until a suitable platform replacement exists; document the remaining use and capability gap, and do not expand it into a general plugin transaction helper. This transitional exception never permits external calls inside a transaction.

Schema migrations follow the repository's separate migration lifecycle. Their SQL/transaction needs do not authorize raw SQL or transaction management in plugin request handlers, tools, hooks, or job processors.

## Review and verification

For affected concurrency paths, verify duplicate deliveries, stale revisions, quota contention, rollback/partial-failure behavior, and retry idempotency. When changing transaction/connection behavior, use a real isolated database with a small connection pool and a delayed external-call fixture: external waits must retain no transaction/row lock, and unrelated queries must remain serviceable. Mocks alone do not prove lock or pool behavior. Report any retained legacy transaction and the exact validation performed; documentation-only edits do not require production changes.
