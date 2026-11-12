# Packaged native-tool plugin delivery in a process-mode Computer

Use this after the CLI has implemented, tested, packed and clean-installed its
own plugin. The helper supplies transport and evidence collection, not business
logic, expected results or final acceptance. Use current source contracts when a
platform revision differs; do not spend a whole task reconstructing these routes.

## Install the exact artifact

For a Project-exclusive process-mode instance, first follow the environment
skill's [checkpoint procedure](../../xpert-platform-local-environment/references/process-recovery.md).
The Coding task may restore that instance, repair its own integration defect,
and install a newly versioned artifact before submitting the final candidate.
Preserve each attempt's digest and receipts. Independent review pins the final
candidate; it must not modify the package to turn a failed check into a pass.

If the assigned Computer test instance is disposable, ordinary deployment repair
may include disabling or uninstalling a conflicting old test plugin. Record that
change in the environment receipt and test the final candidate normally. Only
require coexistence with other plugins when the feature or task actually asks for
it; removing a fixture must not be reported as a successful coexistence test.

Run finite commands through the selected environment's authenticated execution.
`XPERT_API_URL` is an origin; its token and tenant/organization identifiers are
injected by the environment. Never supply outer-platform credentials in the guest.
Choose the plugin's declared installation scope. For a tenant-level package:

```bash
python3 <platform>/tools/local-environment/cli.py --platform <platform> --state <state> \
  exec --authenticated -- python3 <skill>/scripts/plugin-acceptance.py --scope tenant \
  install --archive <artifact.tgz> --sha256 <implementation-receipt-sha256> \
  --evidence <project>/evidence/install.json
```

This uploads multipart `file` to `POST /api/plugin/archive`; it submits no
`workspacePath` or configuration. Preserve the receipt. Honor `restartRequired`
or `pending_restart` with the process-mode CLI's finite API restart command, then
check the descriptor's installed/running versions and `loadStatus`. Use the CLI's
managed background-command facility for long finite builds/restarts; wait on its
returned handle. `nohup`, double-forking or a trailing `&` does not transfer process
ownership to the platform-managed Supervisor.

## Invoke the actual host provider

Create a case JSON array from the functional requirements. Every entry has a
discovered tool `name`, `arguments`, and `expect`, a nonempty JSON-RPC `result` or
`error` expectation. Expected objects are recursive subsets; arrays/scalars match
exactly. Include meaningful `structuredContent` values, boundary cases and error
behavior. Do not use an empty result object as business acceptance.

Run `verify` under **organization scope** for client access, including tenant-owned
plugins. The host chooses publication ownership and grants the current organization
access; a tenant publication alone does not imply organization authorization.

```bash
python3 <platform>/tools/local-environment/cli.py --platform <platform> --state <state> \
  exec --authenticated -- python3 <skill>/scripts/plugin-acceptance.py --scope organization \
  verify --plugin <package-name> --component <provider-component-key> \
  --cases <project>/evidence/live-cases.json --evidence <project>/evidence/live-results.json
```

The helper reads descriptors, enables the registered Provider, obtains its managed
credential, then sends `initialize`, `notifications/initialized`, `tools/list` and
the case `tools/call` requests over real Streamable HTTP. It forwards tenant and
organization context on RPC requests as well as platform API requests, replacing
the platform credential with the managed MCP credential for the actual calls.
It handles JSON/SSE and session identity. It refuses redirects and a different endpoint origin (loopback
aliases at the same port are equivalent). Secrets remain in memory and are redacted
from receipts. A failed case exits nonzero; it is not an accepted task.

This helper implements the legacy Streamable HTTP client protocol. It requests
`2025-11-25`, accepts a negotiated `2025-06-18` or `2025-03-26`, and records the
advertised and negotiated versions separately. A publication advertising modern
`2026-07-28` does not make a legacy `initialize` message modern; do not copy that
advertisement into the handshake header. A modern-only server needs a client
transport that implements that protocol. Receipts use escaped Unicode JSON so
even malformed-Unicode test arguments can be preserved without losing the results.

Native providers do not need a portable resource manifest. An enable response
claiming that a loaded native provider lacks such a manifest indicates an older
host installation bug; report that concrete blocker rather than adding an unrelated
manifest or bypassing publication/credential authorization.

The Agent reviews archive identity, loaded version, call results and coverage,
then records its Project acceptance decision. `casesPassed` is one evidence item;
the transport helper intentionally never sets `acceptancePassed` true.

Source contracts: `plugin-resource/plugin-resource.controller.ts`,
`plugin-resource/mcp/plugin-mcp-server.service.ts`, and `mcp-publication/` under
`packages/server-ai/src`. Credentials use `POST .../mcp/:componentKey/credential`;
enable may omit `createdApiKey` when a reusable key already exists.

For helper maintenance, run `python3 scripts/test-plugin-acceptance.py` and
`python3 scripts/test-plugin-acceptance-sdk.py --platform <platform> --node <node>`.
The latter uses the platform's actual MCP SDK with temporary loopback fixtures;
it does not use a platform account, install a plugin or accept business behavior.
