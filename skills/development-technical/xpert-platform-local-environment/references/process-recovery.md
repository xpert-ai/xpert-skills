# Recovering an exclusive process-mode test instance

Use the selected checkout's `tools/local-environment/cli.py checkpoint` capability
before an installation experiment. Check `checkpoint --help` first; older
checkouts do not contain this capability. A skill reference does not install it.
Do not change the revision or inject helpers into an ongoing frozen trial.

This is for a test instance explicitly reserved for one Project. The
`--exclusive-project` argument records that existing authorization; it neither
grants access nor proves exclusivity. Never use full-state restore on a shared
instance or a production target. For those, use the platform's supported targeted
uninstall/rollback path.

In an explicitly disposable Computer test instance, the executor may disable or
uninstall obsolete/conflicting test plugins; their continued presence is not an
implicit requirement. Prefer the selected platform's supported uninstall path.
When the API cannot start, use its supported offline recovery if available, or
provision a fresh project-owned instance from the prepared checkout and caches.
Do not spend the whole task reconstructing internal storage just to preserve an
old fixture that the user authorized removing. Record the removed plugin set or
new instance identity and verify the requested feature there. Preserve project
source and failure evidence. If neither recovery nor fresh setup can run within
the available scope/capability, report that concrete limitation to the coordinator.

## Before installation

Start from a healthy initialized instance. Keep code, artifacts and task evidence
in the Project workspace, outside the environment state directories below.
Record the existing plugin versions and desired archive digest in task evidence.

```bash
python3 <platform>/tools/local-environment/cli.py --platform <platform> --state <state> \
  checkpoint create --name before-install --exclusive-project <project-id>
python3 <platform>/tools/local-environment/cli.py --platform <platform> --state <state> start
```

Creation briefly stops the four owned services, keeps the managed Supervisor,
requires a clean PostgreSQL shutdown and copies the cold state. It leaves services
stopped and returns `checkpoint_created`; run finite `start` before deployment.
An exit 75 still means pending: continue with `start`, not another restart.
Choose a new checkpoint name for each new baseline; existing checkpoints are
never overwritten. Keep adequate disk space for the baseline and restore copy.

The covered state directories are `postgres`, `redis`, `data`, `public`, `plugins`
and `templates`. Source code, build outputs, sandbox workspaces, logs, credentials
and process identities are not restored. Configuration/credential hashes, checkout
revision and dependency/runtime identities must still match. Plugin-store links
to the selected host checkout remain links; that checkout and its dependencies
must be preserved. Other external state links are unsupported. This is local
installation recovery, not a portable machine backup or a source-code rollback.

## Recover a failed installation

Keep the failed installation receipt and logs. The same Coding executor can run:

```bash
python3 <platform>/tools/local-environment/cli.py --platform <platform> --state <state> \
  checkpoint restore --name before-install --exclusive-project <project-id>
python3 <platform>/tools/local-environment/cli.py --platform <platform> --state <state> start
python3 <platform>/tools/local-environment/cli.py --platform <platform> --state <state> \
  checkpoint verify --name before-install --exclusive-project <project-id>
```

Restore works without a healthy API. It verifies the checkpoint and instance
binding, stops owned services, checks port ownership and database continuity,
stages a verified copy, and moves the previous state into a private retained backup.
Operations share the lifecycle mutation lock. An interrupted restore leaves a
journal; normal managed service startup refuses partial state. Repeat the same
restore command to resume. A changed already-restored directory is a concrete
conflict, not permission to overwrite it or delete the journal manually.

`state_restored` proves the copied state matched the checkpoint at restore time.
`environment_recovered` additionally requires all four owned services to pass their
health probes and PostgreSQL to retain its system identifier. Neither proves plugin
behavior or task acceptance. Check existing loaded plugin versions, then fix your
plugin, package a new identifiable candidate, redeploy and run real feature cases.

Backups contain private instance data; leave them in the private environment
directory, never include them in task artifacts. Keep only secret-free receipts
and relevant redacted logs as evidence. Retained backups consume disk until the
project owner deliberately removes them; the helper does not perform automatic
retention cleanup. A failed copy is not a published checkpoint.
