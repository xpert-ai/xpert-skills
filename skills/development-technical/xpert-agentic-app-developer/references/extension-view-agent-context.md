# Extension View Context for Agents

Use this reference when an Extension View publishes its current selection to an Assistant, or when an Agent or tool must interpret phrases such as “current item”, “this object”, or “the selected record”.

## Contents

- [Runtime invariant](#runtime-invariant)
- [Publish context from the View](#publish-context-from-the-view)
- [Make context useful to the Agent](#make-context-useful-to-the-agent)
- [Resolve tool arguments from runtime context](#resolve-tool-arguments-from-runtime-context)
- [Recommended combined design](#recommended-combined-design)
- [Security and consistency](#security-and-consistency)
- [Lifecycle and race handling](#lifecycle-and-race-handling)
- [Minimum tests](#minimum-tests)

## Runtime invariant

`assistant.context.set` writes a View-owned context entry into the host Assistant request context. In the normal ChatKit path, the value flows through:

```text
Extension View
  -> assistant.context.set
  -> ChatKit request.context
  -> Agent runtime config.configurable.context
```

Treat `config.configurable.context` as runtime configuration for middleware and tools. It does **not** automatically appear in the system prompt, human message, model-visible Agent state, or model input. Therefore, a static prompt such as “read `currentRecord.recordId`” is incorrect unless a separate, tested model-call boundary injects that value.

## Publish context from the View

Publish after the selected record is loaded or changes:

```ts
await invokeClientCommand('assistant.context.set', {
  key: 'recordWorkspace',
  env: {
    activeRecordId: selectedRecord.id
  },
  context: {
    currentRecord: {
      recordId: selectedRecord.id,
      recordCode: selectedRecord.code,
      title: selectedRecord.title,
      revision: selectedRecord.revision
    },
    currentView: {
      viewKey: 'record_workspace',
      selectedItemId
    }
  }
})
```

Allowlist the exact command in the source View manifest and register it in every intended host surface:

```ts
clientCommands: [{ key: 'assistant.context.set' }]
```

Follow [view-client-commands.md](view-client-commands.md) for the complete manifest, host-handler, bridge, and installed-host protocol. The host should merge contexts by View-owned key instead of letting one View overwrite unrelated context entries.

The resulting runtime context should remain small and structured:

```json
{
  "recordWorkspace": {
    "currentRecord": {
      "recordId": "d5d35e40-a4b9-4a30-8a4a-bc2fffd6d44a",
      "recordCode": "REC-0042"
    }
  },
  "env": {
    "activeRecordId": "d5d35e40-a4b9-4a30-8a4a-bc2fffd6d44a"
  }
}
```

## Make context useful to the Agent

Use a middleware or model-call wrapper to read `config.configurable.context`, select only model-safe fields, and add a dynamic system message before the model call:

```text
<extension_view_context>
Current View: Record Workspace
Selected Record:
- recordId: d5d35e40-a4b9-4a30-8a4a-bc2fffd6d44a
- recordCode: REC-0042
- revision: 16

When the user says “current record” or “this item”, use this recordId.
</extension_view_context>
```

Use prompt injection when the selected UI object affects explanation, planning, delegation, or several explicit tool calls. Keep the injected context compact, clearly delimited, and generated at request time. Never copy the full selected object into the model context.

Do not rely on static Assistant-template text to expose a runtime value. A template can explain the semantics of injected context, but it cannot make `configurable.context` visible by itself.

## Resolve tool arguments from runtime context

For tools whose natural target is the current UI object, make the target identifier optional at the model-facing schema boundary:

```ts
const getRecordSchema = z.object({
  recordId: z.string().uuid().optional()
}).strict()
```

Resolve the effective identifier inside a shared, typed adapter:

```ts
function resolveRecordId(
  input: { recordId?: string },
  config: RunnableConfig
): string {
  const runtimeContext = config?.configurable?.context
  const context = isExtensionViewContext(runtimeContext) ? runtimeContext : null

  const recordId =
    input.recordId ??
    context?.recordWorkspace?.currentRecord?.recordId ??
    context?.env?.activeRecordId

  if (!recordId) {
    throw new NoActiveContextError(
      'Select a record in the active View or provide recordId.'
    )
  }

  return z.string().uuid().parse(recordId)
}
```

Prefer this order:

```text
explicit tool input
  -> structured Extension View context
  -> documented env compatibility field
  -> no_active_context
```

Use this pattern when the tool clearly operates on the selected object; when copying opaque IDs adds no audit value; or when avoiding repeated model clarification is more important than displaying the ID in the call. Return a compact `resolvedFrom` field such as `tool_input` or `extension_view_context` when it helps auditability.

Keep IDs required for tools that should never infer a target, especially cross-record mutations, high-risk operations, or commands whose target may differ from the current UI selection.

## Recommended combined design

Use both mechanisms when the Agent must reason about the UI and reliably call tools:

```text
Extension View
  -> assistant.context.set
  -> ChatKit request.context
  -> LangGraph configurable.context
       -> filtered dynamic prompt context for model understanding
       -> deterministic tool-argument resolution for reliability
```

Make tool-side resolution the primary mechanism for target identity. Add prompt context only for the fields the Agent needs to plan or explain. Do not force the model to copy an opaque UUID when the tool can resolve it deterministically.

## Security and consistency

After resolving an identifier from runtime context:

- Validate UUIDs and field types.
- Enforce tenant, organization, user, and Assistant authorization.
- Reload the current record from the server.
- Treat View-provided revision, status, labels, derived values, and other mutable facts as hints only.
- Keep write-operation requirements such as `expectedRevision`, `idempotencyKey`, confirmation, and `changeSummary`.
- Exclude tokens, credentials, short-lived URLs, server file paths, raw content bodies, and unrelated record fields from View context and prompt injection.

Context locates the current object; it never replaces server-side fact or permission checks.

## Lifecycle and race handling

Republish context when:

- The View finishes initialization.
- The selection changes.
- The selected object reloads and its safe summary changes.
- The View resumes or remounts.

Clear only the View-owned key:

```ts
await invokeClientCommand('assistant.context.set', {
  key: 'recordWorkspace',
  clear: true
})
```

Treat context publication as asynchronous. Await a successful result before marking the selection context ready. Prevent an immediate user send from racing ahead of the first publication, for example by temporarily disabling send or showing “Syncing current selection”.

Guard against stale cleanup. A cleanup from an old iframe instance must not erase context published by a newer instance. Use an instance or generation token in the host contract, or make the host compare publication ownership before clearing. Never let one View clear another View’s key.

## Minimum tests

- Verify selection changes produce the expected View-owned entry in ChatKit `request.context`.
- Verify the Agent runtime receives the same safe fields in `config.configurable.context`.
- Verify the model prompt contains only allowlisted fields when prompt injection is enabled.
- Verify omitting `recordId` resolves it from runtime context.
- Verify explicit `recordId` takes precedence over runtime context.
- Verify missing context returns `no_active_context`, not a schema-required error.
- Verify cross-tenant, cross-organization, cross-user, and unauthorized identifiers are rejected server-side.
- Verify remount, selection switch, and stale cleanup do not retain or erase the wrong context.
- Verify publication completes before an immediately submitted message can run.
- Exercise the installed host; unit tests alone do not prove manifest resolution, host registration, iframe dispatch, ChatKit request assembly, or runtime propagation.
