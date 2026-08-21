# Middleware And MCP Tool Contract Design

Use these rules whenever creating or reviewing Xpert Agent middleware tools, normal plugin tools, plugin-managed MCP tools, or MCP App tool adapters. Share domain services where appropriate, but design each exposed tool as a small, explicit contract.

## Contents

1. [Choose the correct tool surface](#choose-the-correct-tool-surface)
2. [Define one bounded intent](#define-one-bounded-intent)
3. [Validate every input with a strict schema](#validate-every-input-with-a-strict-schema)
4. [Design ChatKit titles and change summaries](#design-chatkit-titles-and-change-summaries)
5. [Define Agent middleware tool icons](#define-agent-middleware-tool-icons)
6. [Return allowlisted DTOs](#return-allowlisted-dtos)
7. [Disclose data progressively](#disclose-data-progressively)
8. [Paginate collections at the data source](#paginate-collections-at-the-data-source)
9. [Preserve scope, authorization, and concurrency](#preserve-scope-authorization-and-concurrency)
10. [Design revisioned draft mutations](#design-revisioned-draft-mutations)
11. [Model long-running work as jobs](#model-long-running-work-as-jobs)
12. [Annotate effects and visibility](#annotate-effects-and-visibility)
13. [Test the contract](#test-the-contract)

## Choose the correct tool surface

1. Use Agent middleware tools for Xpert-native, authenticated workflows that need the active tenant, organization, user, Agent, conversation, Workbench, or platform runtime capabilities.
2. Use plugin-managed MCP tools for portable, externally consumable MCP services installed as Toolsets.
3. Use MCP App-only tools for iframe drilldown or UI actions that should not be model-visible.
4. Do not expose the same internal operation through MCP merely to make it callable by an Xpert Agent. Do not use MCP to bypass native authorization, revision checks, review, or host context.
5. When both surfaces are justified, share a typed domain service and implement separate middleware and MCP adapters. Keep identity restoration, visibility, transport metadata, and response formatting in the adapters.

## Define one bounded intent

1. Give each tool one clear read, mutation, submission, cancellation, or publication intent.
2. Prefer narrow operations such as `get_project_summary`, `list_clips`, `get_clip`, and `update_clip_timing` over `execute`, `manage`, or whole-document replacement tools.
3. Separate reads from mutations. Never hide writes inside a tool described as a read.
4. Require explicit identifiers for the business object being addressed. Allow an identifier to be omitted only when a trusted host context can resolve exactly one current object.
5. Return a mutation receipt rather than the new full object graph: include identifiers, new revision, status, changed object IDs, and the next useful action.
6. Do not echo the complete input payload in the result.

## Validate every input with a strict schema

Treat the tool schema as an untrusted-boundary contract, not as documentation only.

1. Use the Zod major/import path compatible with the host SDK. For current LangChain middleware integrations, prefer the repository's established `zod/v3` boundary unless the host contract explicitly supports another version.
2. Use `.strict()` on the root object and on nested business objects. Use `.passthrough()` only for a documented opaque platform/provider payload that the plugin does not interpret.
3. Reject unknown keys, placeholder IDs, sentinel values such as `currentProject`, and coercions that can silently change meaning.
4. Describe fields in terms useful to the model: identify the source of IDs/revisions, units, supported values, omission behavior, and limits.
5. Constrain every scalar:
   - use `.uuid()` or a precise pattern for identifiers
   - trim strings and set realistic minimum/maximum lengths
   - use enums instead of free-form mode/status/type strings
   - require finite integers where fractional values are invalid
   - bound timestamps, durations, dimensions, counts, and percentages
6. Bound every array, record, filter list, batch, and nested collection. Add uniqueness checks when duplicate entries would be ambiguous or destructive.
7. Validate cross-field invariants with `.refine()` or `.superRefine()`: `end > start`, mutually exclusive selectors, compatible modes, matching revisions, and conditional required fields.
8. Keep context-derived security fields out of model input. Resolve tenant, organization, user, workspace, Xpert, conversation, roles, tokens, and credentials from the authenticated runtime.
9. Resolve an omitted current business ID from trusted Workbench/runtime context before handler execution, then validate the resolved value. Return an actionable error when no unambiguous current object exists.
10. Include `baseRevision` or an equivalent compare-and-swap token when a mutation is planned from prior state. For service-owned current-draft tools, accept `baseRevision` as audit/planning context while the service still reads the authoritative current revision and writes through compare-and-swap. Allow `expectedRevision` on multi-step reads so an Agent can reject stale planning data.
11. Accept files through the platform's runtime file descriptor or portable file-reference contract. Do not accept base64 blobs, host filesystem paths, publicized internal URLs, or caller-supplied volume scope fields.
12. Set `verboseParsingErrors: true` on every LangChain structured tool so invalid model arguments return actionable validation details.
13. Keep MCP `inputSchema` equally strict and bounded. When declaring `outputSchema`, keep it aligned with the actual `structuredContent` DTO.

Example:

```ts
import { z } from 'zod/v3'

export const listClipsSchema = z.object({
  projectId: z.string().uuid().optional().describe(
    'Project UUID. Omit only when the active Workbench supplies the current project.'
  ),
  expectedRevision: z.number().int().positive().optional(),
  trackIds: z.array(z.string().min(1).max(160)).min(1).max(50).optional(),
  start: z.number().min(0).max(86_400).optional(),
  end: z.number().positive().max(86_400).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
}).strict().refine(
  (value) => value.start == null || value.end == null || value.end > value.start,
  { path: ['end'], message: 'end must be greater than start' }
)

export type ListClipsInput = z.infer<typeof listClipsSchema>
```

Never weaken runtime validation to solve TypeScript generic expansion. Isolate the overloaded `tool()` type at one typed SDK boundary as described in `general.md`, while keeping the real Zod schema and inferred handler input.

## Design ChatKit titles and change summaries

Apply these rules to Xpert-native LangChain Agent middleware tools. Standard MCP tools use their MCP annotations and `_meta` contracts instead; do not copy `metadata.toolName` into MCP metadata unless an explicit Xpert adapter supports it.

1. Give every model-visible Agent middleware tool a stable default display title through localized `metadata.toolName`, normally `{ en_US, zh_Hans }`. Keep `name` as the stable, non-localized machine identifier used for model selection, event filtering, logs, and the event `tool` field.
2. Treat `metadata.toolName` as the default ChatKit title. Resolve it using the current normalized locale, then fall back to another supported locale and finally the stable tool name. Do not make tool execution correctness depend on localized display text.
3. Add a bounded `changeSummary` only when a user-visible mutation needs a runtime-specific business description that the fixed title cannot express, such as the affected document, version, or decision. Omit it for reads and deterministic actions whose meaning is already clear from `metadata.toolName`; do not create unnecessary prose work for the model.
4. When `changeSummary` is present, middleware may use the resolved value as the `ON_TOOL_MESSAGE` title and message for `running`, `success`, and `fail`. Event delivery remains observational and must not fail or roll back the business operation.
5. Before emitting or forwarding a tool event to ChatKit, recursively remove `changeSummary` from structured `input`, `output`, arguments, nested values, and JSON previews. It is progress/audit context, not a user-facing input field. Preserve the stable tool name, target business identifiers, status, and compact mutation receipt.
6. Keep custom event and automatic `on_tool_start` behavior aligned: both must show the localized fixed title when no dynamic summary is needed, and neither may expose `changeSummary` in expandable structured details.

```ts
const saveContractHeaderTool = tool(
  async (input) => {
    const contract = await service.upsertContractHeader(input)
    return JSON.stringify({
      contractId: contract.id,
      status: contract.status,
      message: 'Contract header was saved.'
    })
  },
  {
    name: 'contract_upsert_header',
    description: 'Create or reset the parsed contract header.',
    schema: contractHeaderSchema,
    verboseParsingErrors: true,
    metadata: {
      toolName: {
        en_US: 'Save contract header',
        zh_Hans: '保存合同抬头'
      }
    }
  }
)
```

## Define Agent middleware tool icons

Apply this contract to Xpert-native Agent middleware tools and their ChatKit execution rows. Keep Workbench/Remote View icons and standard MCP/MCP App icons on their own UI or MCP metadata contracts; do not reuse the runtime-only fields below for those surfaces.

1. Define one semantic default icon for the tool family on the owning middleware strategy's `meta.icon`. Use the platform `IconDefinition` shape rather than a component instance or a business-specific ChatKit mapping.
2. Let the host copy `meta.icon` into each runtime tool as the reserved `metadata.middlewareIcon` fallback. Plugin and middleware authors must not set `middlewareIcon` themselves.
3. Add `metadata.toolIcon` only when one tool's action is meaningfully different from the middleware family. Do not repeat the same default icon on every tool.
4. Preserve this resolution order everywhere: explicit `metadata.toolIcon` -> host-inherited `metadata.middlewareIcon` from `meta.icon` -> Toolset/Provider/type fallback -> generic fallback. A specific tool override must never be replaced by the middleware default.
5. Keep title and icon independent. `metadata.toolName` controls the localized title; `toolIcon` and `meta.icon` control visual identity. Never infer one from the other.
6. Accept only valid platform icon definitions: `type` is `svg`, `image`, `font`, `emoji`, or `lottie`; `value` is non-empty; optional `color` and `alt` are strings; optional `size` is finite, positive, and at most 64. Prefer a small static SVG for monochrome tool icons.
7. Treat inline SVG as trusted static code owned by the plugin or platform. Do not derive it from model output or user content, and do not include scripts, event handlers, `foreignObject`, external resources, credentials, or tenant-specific data. Image icons must use stable governed assets, not expiring grants or private URLs.
8. Keep ChatKit generic. Never add `if (toolName === '...')` icon branches or import business icons into shared tool-row components. New execution events should carry the resolved icon directly; historical events may resolve the middleware icon through their Toolset/Provider identity.

```ts
const VIEW_SOURCE_ICON = {
  type: 'svg',
  value: '<svg viewBox="0 0 24 24" aria-hidden="true">...</svg>'
} as const

class SourceInspectionMiddleware implements IAgentMiddlewareStrategy<Options> {
  readonly meta: TAgentMiddlewareMeta = {
    name: 'SourceInspectionMiddleware',
    label: { en_US: 'Source inspection', zh_Hans: '来源检查' },
    description: { en_US: 'Inspect governed source assets.', zh_Hans: '检查受控来源资料。' },
    icon: VIEW_SOURCE_ICON
  }

  createMiddleware() {
    return {
      tools: [
        tool(viewSource, {
          name: 'source_view',
          description: 'View one governed source.',
          schema: viewSourceSchema,
          verboseParsingErrors: true,
          metadata: {
            toolName: { en_US: 'View source', zh_Hans: '查看来源' }
          }
        }),
        tool(approveSource, {
          name: 'source_approve',
          description: 'Approve one reviewed source.',
          schema: approveSourceSchema,
          verboseParsingErrors: true,
          metadata: {
            toolName: { en_US: 'Approve source', zh_Hans: '确认来源' },
            toolIcon: { type: 'emoji', value: '✅', alt: 'Approved source' }
          }
        })
      ]
    }
  }
}
```

When changing the host runtime rather than a plugin, keep icon inheritance in the common middleware assembly path so normal Agent middleware, plan-mode/client tools, and hidden or built-in subgraphs behave consistently. Normalize the resolved icon once when emitting the ChatKit component step, and keep the Provider icon endpoint as the compatibility path for stored events that only contain Toolset identity.

## Return allowlisted DTOs

1. Return only fields needed to understand the result, continue the workflow, address the next object, or detect a conflict.
2. Map entities and provider responses into explicit response DTOs. Never serialize ORM entities, SDK runtime objects, provider payloads, or database rows directly.
3. Prefer allowlisting fields in a mapper or DTO class. Do not rely on deleting a few known-sensitive fields from a large object.
4. Omit credentials, tokens, cookies, tenant internals, filesystem paths, portable file references, presigned/private URLs, raw provider responses, stack traces, large logs, document snapshots, embeddings, binary content, and internal configuration unless the tool's explicit purpose requires a safe representation.
5. Keep text fields bounded. Return previews plus an item-level `get` tool for large content.
6. Return stable machine fields such as `id`, `status`, `revision`, `errorCode`, `failureCode`, `createdAt`, `nextCursor`, and `hasMore`; localize display strings in the frontend when possible.
7. For MCP tools, place the stable DTO in `structuredContent` and keep `content` to a concise fallback summary. Do not duplicate a large DTO as text.
8. For MCP Apps, keep the initial result compact and let the iframe call app-visible paged/drilldown tools.

Example DTO class:

```ts
export class MediaAssetSummaryDto {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly mimeType: string,
    readonly size: number,
    readonly usedByClipCount: number
  ) {}

  static from(entity: MediaAssetEntity, usedByClipCount: number) {
    return new MediaAssetSummaryDto(
      entity.id,
      entity.originalName,
      entity.mimeType,
      entity.size,
      usedByClipCount
    )
  }
}
```

Use an explicit mapper instead of a class when that is simpler; the rule is field allowlisting, not a specific serialization library.

## Disclose data progressively

Design reads as a hierarchy:

1. `get_*_summary`: return identity, status, revision, settings, counts, and available follow-up reads.
2. `list_*`: return bounded summaries with filters and pagination.
3. `get_*`: return one exact item after its ID has been discovered.
4. specialized evidence/detail tools: return expensive or large subresources only when needed.
5. mutation tools: accept exact IDs plus the current revision and return a compact receipt.

Keep nested collections out of parent summaries. For example, return track and clip counts from a project summary, list tracks separately, list clips by track/time/type, then get one clip. Include fields such as `availableReads`, `nextAction`, or related IDs only when they genuinely help the Agent choose the next bounded call.

Do not make `get_project` return the complete timeline, every media record, every job, every version, and every log. Do not provide a whole-document save tool when narrow deterministic mutations can express the supported edits.

## Paginate collections at the data source

1. Paginate every potentially growing collection, including projects, clips, assets, jobs, versions, exports, logs, transcript segments, search evidence, and audit events.
2. Use either page pagination (`page`, `pageSize`) or cursor pagination (`cursor`, `limit`). Keep one response shape consistent within a resource family.
3. Default to a small page such as 20 and enforce a hard maximum, normally 100 or lower for expensive records.
4. Apply filters, authorization scope, stable ordering, and pagination in the database/provider query. Do not fetch all rows and slice them in memory.
5. Add a deterministic tie-breaker such as `id` after `createdAt` or the business sort key. Prefer cursor/keyset pagination for large or frequently changing datasets.
6. Return `items` plus navigation metadata such as `page`, `pageSize`, `total`, `hasMore`, or `nextCursor`. Do not compute an expensive exact `total` when the provider cannot do so efficiently; use `hasMore` instead.
7. Bound search windows, time ranges, join depth, selected columns, and provider page traversal. Reject unbounded export-like reads from model-visible tools.
8. Exact single-item `get` tools do not need pagination, but any nested collection in their result does.

## Preserve scope, authorization, and concurrency

1. Reconstruct middleware identity from authenticated runtime context. For queued work, restore the initiating user's tenant, organization, user, workspace, and business context from the trusted job envelope.
2. Treat MCP identity according to the Toolset/runtime session contract. Never trust model-provided tenant or user IDs as authorization evidence.
3. Scope every query by tenant and organization before business IDs. Verify the resource relationship and permission again in the handler/service; a valid UUID is not authorization.
4. Keep internal paths/references server-side. Return an approved grant, artifact, or other purpose-specific handle only when the user-facing operation needs it.
5. Require optimistic concurrency on mutations and return a stable conflict code plus the current revision. Do not let the model silently overwrite or rebase state.
6. Normalize not-found, unauthorized, expired, and cross-scope failures when revealing existence would leak data.
7. Require explicit confirmation or the platform HITL mechanism for destructive, externally visible, financial, publication, or sharing actions.

## Design revisioned draft mutations

Use this pattern for Agent tools that edit drafts, semantic models, configuration documents, design canvases, or other user-reviewable resources.

1. Let the Agent express intent while the service owns revision, concurrency, validation, and persistence. Prefer high-level intent tools such as `add_measure`, `configure_relationship`, or `update_step` over model-authored whole-document saves.
2. Expose a small workflow: `get_*_context` for current revision, object indexes, counts, validation summary, and busy state; `get_*_schema` or `get_*_capabilities` before referencing new fields/actions; narrow intent mutation tools for common changes; raw patch only as a fallback for unsupported edits.
3. Put `targetId`, optional `operationId`, and optional `baseRevision` on every draft mutation. Add bounded `changeSummary` only when the mutation needs a runtime-specific display description, following [Design ChatKit titles and change summaries](#design-chatkit-titles-and-change-summaries). Resolve omitted current target IDs only from trusted Workbench/runtime state.
4. Treat `baseRevision` as planning context and audit evidence, not as a model-owned lock. The service should read the current authoritative draft when applying the mutation.
5. Make `operationId` idempotent. Store the compact mutation receipt for the last or relevant operation IDs; if the same operation is retried, return the stored receipt instead of applying the change again.
6. Apply the mutation as the smallest deterministic delta. Avoid replacing the full draft when the intent only adds or updates one field, item, relationship, or visibility flag.
7. For JSON Patch-like raw deltas, require every `replace` or `remove` to have an immediately preceding `test` for the same path. High-level intent tools should generate those guards internally for destructive field updates.
8. Persist through compare-and-swap: read current draft, apply the delta, validate the resulting draft, save only if the stored revision still matches, and return a compact receipt with `revision`, changed paths/object IDs, operation count, validation summary, and stable conflict/busy codes.
9. Allow at most one service-owned safe rebase when the delta is guarded, idempotent, and scoped to a small intent. Report `rebasedFromRevision` or an equivalent field in the receipt. Do not let the Agent loop indefinitely; after a failed precondition or busy draft, re-read context and retry at most once.
10. Choose the draft write strategy by the plugin's existing collaboration substrate. If the plugin already implements Yjs/CRDT collaborative editing, represent Agent changes through the same collaboration protocol: presence/focus, CRDT operations, remote-change merge, materialization, and existing conflict policy. If the plugin does not already use Yjs/CRDT, use the simplest server-draft strategy: let Agent mutations write the authoritative server draft directly and supersede browser-local or autosave drafts without checking whether the frontend has saved. Do not add locks, leases, or unsaved-draft gates solely for Agent edits. Still use `operationId`, guarded deltas, compare-and-swap, validation, and compact receipts; surface conflicts only for guarded precondition failures, genuine server busy states, authorization failures, or validation failures.
11. Emit running/success/fail events for every user-visible mutation that has `changeSummary`; otherwise use the localized fixed tool title. Strip `changeSummary` from ChatKit-visible structured details. Serialize writes per target resource when multiple tool calls can mutate the same draft, and let the Workbench refresh only after mutation success.
12. Keep mutation results compact. Return receipts and diagnostics, not the full draft. Provide explicit read tools for a refreshed summary, item details, or paged content.

## Model long-running work as jobs

1. Queue transcription, analysis, rendering, bulk import/export, and other long work through the platform runtime instead of blocking a tool call.
2. Let the start tool validate and freeze the input, enqueue the job, and return `jobId`, `status`, source revision, and a polling/cancellation hint.
3. Provide bounded `get_job`, `list_jobs`, and `cancel_job` tools. Keep progress, stage, timestamps, result IDs, retryability, and stable failure codes in their DTOs.
4. Do not inline generated files or extensive logs. Return a result/artifact ID and use the platform's approved access flow.

## Annotate effects and visibility

1. Mark MCP tools with accurate `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` annotations.
2. Set MCP App visibility deliberately: `['model', 'app']` for shared tools and `['app']` for iframe-only drilldown/action tools.
3. Keep CSP and permissions on the MCP App resource metadata, not the tool metadata.
4. Publish Workbench refresh/events only for mutations or job state changes that affect the visible target. Do not refresh the editor after ordinary summary/list/get reads.
5. Keep tool descriptions honest about side effects, required review, asynchronous completion, and what a successful response proves.

## Test the contract

Cover at least:

1. valid minimum and maximum inputs
2. missing required fields, unknown keys, invalid UUIDs/enums, overlong strings, oversized arrays/pages, and cross-field violations
3. omitted current ID with and without valid host context
4. tenant, organization, user, permission, and parent-child ownership mismatches
5. stale `expectedRevision` and `baseRevision`
6. stable pagination without duplicates or gaps, including equal sort keys
7. DTO allowlisting: assert sensitive references, URLs, paths, snapshots, provider payloads, and internal fields are absent
8. response-size behavior: a summary and one page must not grow linearly with the complete project/resource graph
9. read-only tools do not mutate or emit mutation refresh events
10. mutation idempotency, conflicts, audit records, and compact receipts
11. revisioned draft behavior: guarded destructive patches, one safe service-owned rebase, duplicate `operationId` handling, stale preconditions, busy drafts, CRDT-backed Agent operations when collaboration already exists, direct server-draft overwrite when it does not, and Workbench refresh events
12. MCP `tools/list`, annotations, visibility, `structuredContent`, output schema, and app-only access enforcement
13. actionable LangChain parsing errors with `verboseParsingErrors: true`
14. localized `metadata.toolName` selection and fallback for Agent middleware tools
15. fixed-title tools omit unnecessary `changeSummary`; dynamic summaries drive progress titles but are absent from all emitted ChatKit structured input/output details
16. middleware `meta.icon` inheritance, explicit `metadata.toolIcon` precedence, supported icon validation, Provider icon serialization for historical events, and generic ChatKit rendering without business tool-name branches

Reject these anti-patterns during review:

1. `z.object({}).passthrough()` for interpreted business input
2. optional IDs without a trusted and unambiguous context resolver
3. arrays or strings without hard bounds
4. returning `entity`, `document`, `raw`, `response`, or `metadata` wholesale
5. fetching all records before pagination
6. returning complete files, base64, public internal URLs, or Workspace paths
7. using one generic tool for unrelated reads and writes
8. duplicating the native middleware surface as MCP without an external portability requirement
9. copying the same `toolIcon` onto every tool instead of defining `meta.icon` once
10. setting the host-reserved `middlewareIcon` directly from plugin code
11. hardcoding business tool names or business icon imports in shared ChatKit components
