# Human Decision Load And Progressive Disclosure

Use this reference when an Agentic App exposes review gates, warnings, assumptions, diagnostics, evidence, approvals, or detailed operational state. Design the domain behavior thoroughly, but make the user decide only when a real decision is necessary.

## Contents

1. [Minimize mandatory decisions](#minimize-mandatory-decisions)
2. [Classify the interaction](#classify-the-interaction)
3. [Design Agent and Tool behavior](#design-agent-and-tool-behavior)
4. [Disclose UI detail progressively](#disclose-ui-detail-progressively)
5. [Choose the right UI primitive](#choose-the-right-ui-primitive)
6. [Apply the rule to common flows](#apply-the-rule-to-common-flows)
7. [Validate decision load](#validate-decision-load)

## Minimize mandatory decisions

Comprehensive system behavior does not require a comprehensive set of user prompts. Automate deterministic, authorized, and safely reversible work within the user's stated scope. Surface what happened, what the system assumed, and what remains uncertain without forcing the user to acknowledge every detail.

Follow these rules:

- Never ask for confirmation merely to prove that the user saw information.
- Do not ask the user to choose a default that the system can determine from policy, current context, or a clearly recommended safe option.
- Do not expose implementation choices, internal retry strategy, routing details, or tool sequencing as end-user decisions.
- Ask only when missing input would materially change the outcome, authority, scope, cost, external effect, or accepted risk.
- Consolidate related choices into one bounded decision when they share one consequence. Do not combine unrelated consequences into an opaque blanket approval.
- Prefer a recommended default and concise explanation over an undifferentiated list of options.
- Preserve control through visible status, audit history, undo, retry, or correction rather than preventive confirmation when the action is safely reversible.

## Classify the interaction

Classify every proposed prompt or gate before implementing it:

| Class | Examples | Required behavior |
| --- | --- | --- |
| Informational | status, confidence, assumptions, warnings, diagnostics, evidence coverage | Show concisely; let the user inspect details; do not require confirmation. |
| Low-risk and reversible | search, preview, draft creation, filtering, retry, reversible edits within the requested scope | Proceed automatically; show the result and offer undo/correction when useful. |
| Material choice | two valid interpretations, missing scope, a choice that changes the business result | Ask one focused question, explain the impact, and recommend a default when possible. |
| Consequential authorization | publish, approve, delete, external send, financial commitment, security-sensitive change, destructive override | Require explicit confirmation and enforce it in the service boundary. |

A warning is not automatically a decision. Severity describes information; confirmation is justified by the consequence of the next action.

## Design Agent and Tool behavior

Keep the Agent moving through non-blocking work:

- In prompts, tell the Agent to continue through authorized read-only, draft, diagnostic, and safely reversible steps without asking for confirmation at every stage.
- Return compact status, warnings, assumptions, changed counts, and the next automatic step from tools. Use a distinct `confirmation_required` state only when policy actually requires a human decision.
- Do not add `confirmed: true`, approval tokens, or mandatory dry-run calls to ordinary reads, previews, draft writes, or reversible mutations.
- When explicit confirmation is required, bind it to the exact target, action, revision, and consequence; revalidate authorization and current state on execution.
- Let the Agent summarize passive information after acting instead of pausing before acting.
- When several items share one approved transaction, confirm the transaction once rather than each item. Keep item-level review only where each item is an independent business decision.
- Keep uncertainty visible. Do not convert low confidence into a forced confirmation unless accepting that uncertainty has a material consequence.

## Disclose UI detail progressively

Build a clear information hierarchy instead of laying every detail across the primary surface:

1. **Glance layer:** show the task state, primary result, one primary action, and compact badges, counts, or severity markers.
2. **Context layer:** reveal a short explanation, breakdown, or related metadata near the item when requested.
3. **Inspection layer:** open evidence, diagnostics, history, and structured details in a focused panel without losing the user's place.
4. **Dedicated workflow:** use a full page or task workspace for dense editing, comparison, or multi-step review rather than expanding an oversized card or dialog.

Group related information, align repeated fields, use consistent spacing, and preserve scan paths. Truncate long identifiers and excerpts with an explicit way to reveal or copy them. Do not use color as the only status signal.

Avoid walls of chips, permanently expanded diagnostics, large flat metadata regions, nested bordered cards without hierarchy, and dialogs that attempt to contain an entire application workflow.

## Choose the right UI primitive

Choose components by semantic purpose:

- **Badge, icon, counter, or concise inline status:** glanceable state such as warnings, blockers, coverage, or completion.
- **Tooltip:** a short label or clarification; never essential instructions or critical consequences.
- **Popover:** compact contextual metadata or a small set of secondary actions that can be dismissed without losing work.
- **Expandable section:** related detail that belongs in the current reading flow but is not needed initially.
- **Side panel, sidebar, or drawer:** evidence, record details, diagnostics, history, and comparisons that should remain beside the current list or canvas.
- **Dialog:** a bounded form or focused task that temporarily interrupts the page.
- **Confirmation dialog / alert dialog:** only an actual consequential authorization, with consequence-focused copy and safe cancellation.
- **Full page or workbench:** dense, long-running, or multi-step work with its own navigation and state.

Do not put irreversible consequences only inside a tooltip or transient toast. Do not use a confirmation dialog as a generic detail viewer. Make every disclosure control keyboard accessible, labelled, and predictable.

## Apply the rule to common flows

| Situation | Prefer | Avoid |
| --- | --- | --- |
| Extraction confidence and evidence gaps | summary badges plus an evidence/diagnostics side panel | one confirmation per warning or missing field |
| Agent creates or updates a draft | execute, show a receipt, preserve history or undo | asking permission for every intermediate write |
| Optional field was not found | mark it as not found and continue | blocking the run until the user acknowledges it |
| Several review candidates need real business judgment | grouped review queue with clear recommended actions | a sequence of repetitive modal prompts |
| Publish, external send, delete, or controlled override | one explicit, scoped confirmation | passive notification after an irreversible action |
| Large metadata or audit payload | concise indicator and on-demand panel | permanently flattening the complete payload into the main page |

## Validate decision load

Before finishing, verify:

- Every confirmation maps to a documented material consequence; remove any acknowledgement-only confirmation.
- The happy path completes without incidental confirmation prompts.
- Informational warnings and diagnostics remain discoverable without blocking progress.
- Safely reversible actions expose an appropriate correction, retry, history, or undo path.
- Required authorization cannot be bypassed through Agent tools, View actions, retries, or stale UI state.
- Related decisions are consolidated without hiding independent consequences.
- Primary screens remain scannable at typical and minimum sizes; detailed data opens through an appropriate disclosure surface.
- Popovers, expandable sections, panels, dialogs, and confirmation controls work with keyboard navigation, focus management, accessible names, and non-color status cues.
