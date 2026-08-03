---
name: xpert-llm-token-usage
description: Diagnose, implement, or review LLM Token usage across Xpert model plugins and the host when streaming or non-streaming usage is missing, zero, estimated, inconsistent, or affects execution logs, pricing, billing, quotas, or metrics.
---

# Xpert LLM Token Usage

Use this skill for Token accounting work that crosses `xpert-plugins`, LangChain model adapters, the Xpert Plugin SDK, and downstream usage consumers.

## Authority Principle

Establish one authority chain for every model call:

1. The Provider response is the source of actual usage.
2. The Provider adapter maps raw usage into LangChain's canonical usage contract.
3. The host resolves canonical actual usage before estimates.
4. Execution logs, pricing, billing, quotas, and metrics consume the same resolved object.

Keep shared host resolution provider-agnostic. Put protocol or Provider quirks at the adapter boundary; a model-name or Provider-name condition in shared usage resolution fails review.

Token quantity and Token price are separate contracts. First prove the counts, then apply model-specific pricing, tiers, cache discounts, and currency rules.

## Ownership Boundaries

| Layer | Responsibility | Required evidence or output |
| --- | --- | --- |
| Provider API | Return actual request usage when supported | Raw response or final stream usage event |
| Model plugin / adapter | Request usage and normalize Provider fields | `AIMessage.usage_metadata` with input, output, and total counts |
| Plugin SDK / host | Validate candidates and select one authority | One normalized Token usage object per model call |
| Execution aggregation | Add distinct completed model-call usage events | Execution total equals the sum of its model calls |
| Pricing and billing | Price normalized input/output counts | Same counts as execution, with model-specific rates applied later |

Provider-specific raw fields belong only at the Provider boundary. Shared host code consumes canonical LangChain fields rather than enumerating every Provider response shape.

## Diagnostic Workflow

### 1. Resolve the live path

Identify the actual plugin checkout, host checkout, branches, installed plugin revision, runtime model, streaming mode, and process that served the request. Inspect worktree status before edits.

Completion criterion: the exact source files and runtime revision for the reported call are known; local source, build output, installed plugin, and running process are not conflated.

### 2. Capture raw usage evidence

Inspect one completed non-streaming response and one completed streaming response when both modes are supported. Record:

- raw input, output, and total fields
- whether usage appears only on the final stream event
- cache, reasoning, or audio detail fields
- the canonical `AIMessage.usage_metadata`
- `LLMResult.llmOutput` candidates

Completion criterion: the last boundary containing a valid actual count and the first boundary that loses, replaces, or ignores it are identified.

### 3. Audit the Provider adapter

For streaming requests, enable the Provider's supported usage option. OpenAI-compatible APIs commonly use `stream_options.include_usage`; SDKs may expose a wrapper option such as `streamUsage`. Treat these as adapter details, not universal host fields.

Normalize the Provider response to:

```ts
type CanonicalUsage = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}
```

Attach complete usage once at the scope defined by the Provider contract. A final aggregate stream usage report is one request-level event, not one event per preceding chunk.

Completion criterion: an adapter test proves the request option and canonical usage for every changed streaming mode.

### 4. Resolve canonical host usage

Use this priority for one `LLMResult`:

1. valid actual `generations[].message.usage_metadata`
2. valid actual `llmOutput.tokenUsage`
3. valid `llmOutput.estimatedTokenUsage`
4. valid legacy `llmOutput.totalTokens`, when compatibility requires it
5. zero or unavailable usage

A candidate is valid when every present count is finite and non-negative, and at least one count is positive. An all-zero object is not authoritative and must fall through. Derive a missing or zero total from positive input plus output counts. Preserve a positive Provider total when it is present.

Keep this resolution in one shared helper. Callers should not reproduce the priority chain.

Completion criterion: one resolver test proves each priority and invalid-value fallback without referencing a model or Provider name.

### 5. Align every consumer

Use the resolved object for both detailed usage and total Token reporting. Emit one usage event for each distinct completed model call and add those events at execution scope.

Treat cache read/write counts, reasoning counts, and similar details according to the Provider contract. They are commonly subsets of input or output usage; adding them again to `total_tokens` double-counts usage.

When multiple choices, generations, retries, or final chunks carry usage, prove whether each report is incremental or request-total before summing it. Aggregate only reports with distinct scopes.

Completion criterion: execution total, pricing input/output, billing, quota deduction, and metrics can be traced to the same normalized event without a last-write or duplicate-add path.

## Implementation Rules

- Prefer actual Provider usage over estimates even when the estimate is larger.
- Preserve estimates as a fallback when the Provider omits usage.
- Keep raw Provider field parsing at a typed trust boundary.
- Keep pricing configuration out of Token source selection.
- Preserve legacy generic fields only as explicit low-priority compatibility fallbacks.
- Record usage provenance when an existing contract supports it. Expanding public or persisted schemas for provenance requires an explicit scope decision.
- Historical executions can be corrected only when their original usage evidence was persisted; otherwise report them as non-reconstructable.

## Regression Matrix

Cover the behavior seam with focused tests:

1. streaming actual usage reaches canonical message metadata
2. non-streaming actual `tokenUsage` remains authoritative when message metadata is absent
3. all-zero `tokenUsage` falls through to actual message usage
4. missing actual usage falls through to a valid estimate
5. negative, `NaN`, or malformed candidates fall through
6. missing or zero total derives from positive input plus output
7. legacy total-only usage remains available at its compatibility priority
8. multiple distinct model calls add to one execution total
9. repeated request-total usage on choices or chunks is counted once
10. cache and reasoning detail counts are not added twice
11. no valid source produces explicit zero or unavailable usage
12. execution, pricing, billing, quota, and metrics receive the same normalized counts

Use representative protocol families rather than a list of model names. Add a Provider-specific case only when its adapter contract differs.

## Common Failure Signatures

| Symptom | First boundary to inspect |
| --- | --- |
| Raw log has usage but execution shows `0` | Host resolver accepting an all-zero object or a separate total path |
| Streaming shows `0`, non-streaming works | Provider usage request option and final stream event mapping |
| Estimate is stored despite actual usage | Adapter failed to attach canonical message metadata |
| Execution Token is right but cost is wrong | Model pricing, units, tiers, cache discounts, or currency |
| One execution undercounts several calls | Last-write behavior instead of per-call addition |
| One request is counted several times | Request-total usage repeated across chunks, choices, or generations |

## Validation

Run the smallest complete cross-boundary validation:

1. adapter request and response-mapping tests
2. shared resolver and callback tests
3. Plugin SDK build
4. affected host or API build
5. plugin lifecycle or local deployment validation when plugin code changed
6. one user-owned runtime call after the required process or plugin refresh

Keep source/test proof, build proof, installed-plugin proof, and runtime proof separate in the report.

## Stop Conditions

Pause before implementation when the Provider's usage semantics are undocumented, the same field may represent incremental and request-total counts, or the fix requires a public billing or persistence contract change. Report the known boundary, remaining ambiguity, and smallest evidence needed next.

## Output

Return:

- confirmed authority chain and first failing boundary
- actual versus estimated usage decision
- files changed by repository and ownership layer
- regression cases added
- tests and builds run
- installed/runtime validation still required
- pricing or historical-data limitations kept outside the Token-count fix
