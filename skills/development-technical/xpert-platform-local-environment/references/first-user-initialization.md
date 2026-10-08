# Fresh Database and First Administrator

Use this procedure when the user requests a new local database or initialization through creation of the first super administrator. Initialization authorization can be included in the original request; do not require it a second time. This procedure is separate from plugin deployment and model/provider configuration.

## Establish a Fresh Database

- Select a new database/data directory rather than clearing existing data. A new Compose project name alone does not isolate bind mounts: inspect the resolved database mount, database name, and port ownership.
- Configure and bootstrap with `--skip-start` if using the setup helper, then start only the selected infrastructure. Do not launch API schema synchronization or seed/demo commands yet.
- Record evidence of the new data directory or volume and query the selected database before API startup. For the current Postgres layout, `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';` should return zero. Check other application schemas if the checkout uses them. Preinstalled extensions do not constitute imported business data.
- Start the API/UI only after recording that evidence. The initialization itself will create tables, roles, permissions, and default tenant/organization records, so “started from an empty database” does not mean it remains empty afterward.
- If existing business data is discovered, stop initialization and select an isolated target within the user's authorization. Never interpret “use an empty database” as permission to erase an existing database.

## Discover the Initialization Contract

Read the selected checkout before sending requests. Current source pointers are:

- `packages/server/src/tenant/tenant.controller.ts`: public first-tenant guard and onboarding endpoint;
- `packages/server/src/tenant/tenant.service.ts`: tenant, role, and default organization creation;
- `apps/cloud/src/app/onboarding/tenant-details/tenant-details.component.ts`: actual onboarding request shape;
- `packages/server/src/auth/commands/handlers/auth.login.handler.ts`: login shape and returned identity.

At the verified checkout, `GET /api/tenant/onboard` reports onboarding state; `POST /api/tenant/onboard` accepts `name`, `superAdmin`, and `defaultOrganization`. The `superAdmin.hash` field receives the new plaintext password over the local request and is hashed by the server. Do not pre-hash it or insert a user directly into SQL. Recheck these contracts when the checkout changes.

The public POST guards against an existing tenant. Check initialization state first and never retry the POST blindly after a timeout: tenant/user/organization creation can partially succeed. Inspect safe identifiers and database state before deciding on recovery.

## Credential Handoff and Verification

Use user-specified account and organization names. When no preference is available, state local-only defaults (for example `admin@xpert.local` and `Xpert Local`) and generate a strong random password. Do not encode a fixed account or password into the skill or repository.

Keep the generated password out of command arguments, stdout, logs, receipts, and source control. Save it before initialization using exclusive creation in a private environment directory (`0700`) and a credential file (`0600`). Hand the user a clickable local file path. Do not overwrite an existing credential file on retry or silently enroll it in a browser password store or plugin credential store.

After creating the tenant and organization:

1. Log in through the current login API using the saved password; keep returned tokens in memory.
2. Verify that the returned role is `SUPER_ADMIN` and make one authenticated request such as the current `/api/auth/alive` endpoint.
3. Confirm the expected tenant and default organization and their association with the created account. Record identifiers and verification booleans, not password hashes or tokens.
4. Verify API/UI health and process provenance again, then open the root UI and confirm it reaches a usable login or signed-in page.
5. Report the URL, account name, credential-file link, organization, and startup instructions. Note unconfigured model providers when relevant; do not require provider secrets to complete account setup.

Record database freshness and initialization results alongside the environment receipt. `platform_ready` plus verified administrator access completes this scope; `plugin_test_ready` still requires the separate plugin-specific gates.
