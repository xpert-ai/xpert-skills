# Middleware And MCP Tool Contract Design

Use these rules whenever creating or reviewing Xpert Agent middleware tools, normal plugin tools, plugin-managed MCP tools, or MCP App tool adapters. Share domain services where appropriate, but design each exposed tool as a small, explicit contract.

## Contents

1. [Choose the correct tool surface](#choose-the-correct-tool-surface)
2. [Define one bounded intent](#define-one-bounded-intent)
3. [Validate every input with a strict schema](#validate-every-input-with-a-strict-schema)
4. [Return allowlisted DTOs](#return-allowlisted-dtos)
5. [Disclose data progressively](#disclose-data-progressively)
6. [Paginate collections at the data source](#paginate-collections-at-the-data-source)
7. [Preserve scope, authorization, and concurrency](#preserve-scope-authorization-and-concurrency)
8. [Model long-running work as jobs](#model-long-running-work-as-jobs)
9. [Annotate effects and visibility](#annotate-effects-and-visibility)
10. [Test the contract](#test-the-contract)

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
10. Require `baseRevision` or an equivalent compare-and-swap token for mutations. Allow `expectedRevision` on multi-step reads so an Agent can reject stale planning data.
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
5. Require optimistic concurrency on mutations and return a stable conflict code plus the current revision. Never silently rebase or overwrite.
6. Normalize not-found, unauthorized, expired, and cross-scope failures when revealing existence would leak data.
7. Require explicit confirmation or the platform HITL mechanism for destructive, externally visible, financial, publication, or sharing actions.

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
11. MCP `tools/list`, annotations, visibility, `structuredContent`, output schema, and app-only access enforcement
12. actionable LangChain parsing errors with `verboseParsingErrors: true`

Reject these anti-patterns during review:

1. `z.object({}).passthrough()` for interpreted business input
2. optional IDs without a trusted and unambiguous context resolver
3. arrays or strings without hard bounds
4. returning `entity`, `document`, `raw`, `response`, or `metadata` wholesale
5. fetching all records before pagination
6. returning complete files, base64, public internal URLs, or Workspace paths
7. using one generic tool for unrelated reads and writes
8. duplicating the native middleware surface as MCP without an external portability requirement
