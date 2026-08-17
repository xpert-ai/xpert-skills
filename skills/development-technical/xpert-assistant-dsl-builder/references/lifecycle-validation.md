# Assistant Lifecycle Validation

## Contents

- Pre-change checks
- Source and build validation
- Delivery-source refresh
- Draft import or update
- Instance-owned bindings
- Publication
- Runtime acceptance
- Failure diagnosis

## Pre-Change Checks

1. Inspect each relevant Git worktree separately and preserve unrelated changes.
2. Identify the authoritative source DSL and every generated or copied form of it.
3. Inspect current host contract types and one working graph from the same platform version.
4. Record the intended target Assistant, environment, and whether the task creates a new draft or updates an existing one.
5. Identify which model, credential, knowledge, or other resource bindings belong to the reusable source and which belong to the installed instance.
6. Define any runtime mutations, test data, and cleanup requirements before execution.

Do not infer permission to overwrite an existing Assistant, replace user-owned bindings, publish a draft, or run state-changing acceptance tests.

## Source And Build Validation

Run validation in this order:

1. Run the bundled Assistant DSL validator.
2. Run graph contract tests.
3. Run tests for middleware or tools used by child Agents.
4. Run type checks and build the owning package when applicable.
5. Confirm that built or copied DSL assets match the source.
6. Run `git diff --check`.

Do not rely on an earlier successful build after changing the DSL, its contribution metadata, dependencies, or the build copy step.

Treat warnings as questions to resolve, not automatic failures. Verify any intentional exception against the current platform contract and capture it in repository tests.

## Delivery-Source Refresh

Some Assistant DSLs are imported directly. Others are delivered by a plugin, package, catalog, or another registration mechanism.

When a delivery source exists:

1. Use its supported build and refresh command.
2. Keep credentials in the platform's configured secret mechanism.
3. Never print passwords, tokens, tenant IDs, organization IDs, or credential payloads.
4. Restart the owning service when activation requires it.
5. Fetch or inspect the loaded descriptor after refresh.
6. Compare the loaded DSL version, Agent keys, connections, and dependencies with the source.

A successful upload or staging response does not prove that the running process loaded the new graph.

For a plugin-delivered template, verify:

- plugin package name, version, source, and load status;
- template key and owner;
- DSL version and exact Agent keys;
- required plugins and Skill dependency ownership;
- middleware providers required by the graph.

Skip this section when no delivery layer exists.

## Draft Import Or Update

Choose the operation deliberately:

- Import or install a new Assistant when the user requested a new instance or when preserving an existing instance is important.
- Update the exact existing draft only when that target is confirmed.
- Prefer the platform's template installation flow when it installs dependencies and rolls back incomplete creation.

Before saving a draft, verify:

- the workspace is authorable;
- the primary Agent and every connection endpoint exist;
- required providers and Skills are available;
- an approved model binding is valid;
- instance-owned bindings are preserved unless replacement was requested.

If no enabled primary model exists, do not alter global model settings implicitly. Use an explicitly approved binding or ask the user to configure one.

Refreshing a reusable template never rewrites an installed Assistant automatically. Record the resulting Assistant identifier and inspect the saved draft.

## Instance-Owned Bindings

Keep tenant, organization, credential, Assistant, conversation, and knowledge-base identifiers out of reusable DSLs unless the artifact is explicitly an instance snapshot.

After importing or creating an organization-owned Assistant:

1. Fetch the saved draft.
2. Fetch only approved resources in the same tenant and organization scope.
3. Add the required resource nodes.
4. Add direct connections to the Agents that consume those resources.
5. Align any duplicate ID arrays maintained by the current schema.
6. Save and inspect validation errors.
7. Re-fetch the draft to confirm persistence.

Do not weaken tenant or organization scoping to make a nested Agent find resources. Correct the binding or propagation contract instead.

## Publication

Draft update and publication are separate changes.

1. Inspect the complete draft graph and instance bindings.
2. Resolve validation errors.
3. Publish a new version with an appropriate version marker or release note.
4. Fetch the published graph.
5. Compare Agent nodes, connections, middleware, Skills, tools, knowledge bindings, and primary Agent against the draft.

Do not claim runtime readiness from the draft alone. An existing published Assistant remains on its prior graph until the platform successfully publishes the new version.

If publication fails, preserve the draft and error details. Do not repeatedly mutate the graph without first identifying which contract failed.

## Runtime Acceptance

Use a dedicated test Assistant, environment, or bounded test input when execution can change persistent state.

Test progressively:

1. Start a fresh conversation or execution context.
2. Submit one explicit bounded task.
3. Confirm that the primary Agent delegates to the intended child.
4. Inspect the child execution inputs and confirm that every correctness-critical identifier, target list, and budget is present under its declared Agent parameter name; do not accept a free-text `input` packet as equivalent.
5. Confirm that each child invokes only its connected middleware, Skills, tools, and knowledge sources.
6. Confirm that returned results match the declared task/result contract.
7. Confirm that expected outputs or artifacts were persisted.
8. Confirm that muted internal output did not flood the user conversation.
9. Confirm that no Agent called capabilities outside its role boundary.
10. Repeat with a small multi-item input, then a representative bounded batch when applicable.

Expected generic outline:

```text
Coordinator
  Worker A
    Retriever
    Validator
  Worker B
    Retriever
    Validator
```

The exact tree depends on conditional branches. Every executed Agent and tool call must still correspond to an intended graph edge and role.

Before a state-changing run, record target identifiers and define cleanup or rollback. Never delete user data merely to make a rerun clean.

## Failure Diagnosis

No child execution:

- Check Agent connection, `leaderKey`, parent prompt, follower availability, and execution conditions.

Child runs but a tool is absent:

- Check middleware ownership, workflow connection, provider load state, dependency installation, and enabled tool map.

Child runs but cannot access knowledge:

- Check the direct knowledge connection, `knowledgebaseIds`, and runtime organization propagation.
- Do not connect the resource to an unrelated Agent merely to hide a delegation bug.

Tool succeeds but expected output is missing:

- Confirm whether the tool persisted data or only returned prose.
- Check item identifiers, tenant/organization filters, completion events, and consumer refresh behavior.

Skill middleware appears in the graph but is unavailable:

- Verify dependency owner, component key, target Agent, installation record, and middleware connection.

Source is current but Assistant behavior is old:

- Verify the delivery source was activated after build.
- Verify the intended Assistant draft was imported or updated.
- Verify a new version was published.
- Start a fresh conversation to exclude stale checkpoints.

Draft and published graph differ:

- Stop runtime testing against the ambiguous version.
- Preserve the failing draft and publication response.
- Restore or select the last verified published version through the platform's supported version flow if needed.
- Do not overwrite reusable source with an instance-bound export.

Platform routes and data-transfer objects can change between host versions. Inspect current controllers and contracts or use the supported UI flow before scripting draft updates, publication, graph comparison, or persistence queries.
