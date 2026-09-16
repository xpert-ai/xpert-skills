# Agent Tool Parameter Design: Minimize What the Model Must Supply

Design middleware tool input schemas so the model supplies **only the information that requires its judgment**. Everything derivable from context, from the server's own governed data, or constant across the call must be supplied once, or not at all.

Real failure pattern (bom-lifecycle 0.10.11, `bom_lifecycle_upsert_case_products`): the batch item schema was reused from the single-item schema, so every array element required `caseId` and a `product` wrapper that the call already carried at the top level. The model's two natural payloads — flat row fields; then nested without per-item `caseId` — were both rejected by the strict schema, burning two tool rounds before a third succeeded. The tool description was correct the whole time; **the shape defeated the prose**.

## Principles

1. **The model supplies judgments, not context.** Fields constant for the call (`caseId`), server-managed counters (`expectedRevision`, `operationId`), and data the server can recover from its own governed snapshot (`sourceReferences`, `rawExtraction`, page numbers) are supplied once at the call level or omitted entirely.
2. **A required field inside an array element must differ per element.** Before finalizing an item schema, ask: does this field vary between items? If the answer is no, move it to the call level.
3. **Match the model's natural output shape.** Do not invent wrapper objects (`{ product: {...} }`) or identity echoes that a business-minded model will not produce spontaneously. If you need nesting for disambiguation, the tool description alone will not carry it — expect repeated `invalid_tool_input` rounds.
4. **Schema friction converts directly into wasted rounds and repeat-guard trips.** Every avoidable required field is a chance for the model to fail strict validation, retry, and hit `repeated_invalid_tool_input` blockers. A good shape saves model rounds, tokens and latency.
5. **Reuse schemas with an omit/extend audit.** Copying a single-item schema as an array-element schema drags call-level fields (like `caseId`) into every element. When composing schemas, diff the required fields against "what does each element actually carry".
6. **Let the server rebuild what it can.** Prefer identifiers the model copies from earlier tool output (`rowIds`, `evidenceIds`, `refId`) over raw payloads; the server reconstructs verified content from its own snapshot and the write-time catalog. Raw JSON, quotes and revisions must never be model-supplied.
7. **Long descriptions do not substitute for a good shape.** Describe the semantics of the minimal fields, and state explicitly which fields are deliberately absent ("caseId is supplied once for the whole call; never repeat it inside items").
8. **Regression-test the failure shapes.** When a schema bug reaches production, capture the model's actual failing payloads as fixtures: the natural shape must parse; the historical failing shapes must still be rejected (for the right reason).

## Checklist before shipping a tool schema

- [ ] Every required field either varies per element or is genuinely per-call — nothing constant is duplicated.
- [ ] No field exists that the handler ignores or the server recomputes from its own data.
- [ ] No wrapper level that carries exactly one child and no extra semantics.
- [ ] Strict schema error messages list only fields the model can actually correct.
- [ ] The most natural payload a competent model would write passes validation on the first try (assert it in a unit test).
- [ ] The historical failing payload from a real incident is asserted to be rejected (regression pin).
