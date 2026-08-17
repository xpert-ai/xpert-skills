# Enterprise Shadcn Remote View Design Principles

Use this standard before designing a new Xpert Workbench or Extension View and when substantially changing an existing View's information architecture, floorplan, visual hierarchy, action model, data presentation, or responsive behavior.

This document governs product and interface design. Use [shadcn-ui.md](shadcn-ui.md) for component and theme implementation, [human-decision-load-and-progressive-disclosure.md](human-decision-load-and-progressive-disclosure.md) for disclosure and confirmation decisions, and [prototype-as-production-remote-view.md](prototype-as-production-remote-view.md) for the production-shaped prototyping workflow.

## Contents

1. [Design posture](#design-posture)
2. [Role and task first](#role-and-task-first)
3. [Information architecture and floorplans](#information-architecture-and-floorplans)
4. [Quiet visual language](#quiet-visual-language)
5. [Spacing and controlled density](#spacing-and-controlled-density)
6. [Shadcn component composition](#shadcn-component-composition)
7. [Action hierarchy](#action-hierarchy)
8. [Data-intensive surfaces](#data-intensive-surfaces)
9. [Status and feedback semantics](#status-and-feedback-semantics)
10. [Human-AI collaboration](#human-ai-collaboration)
11. [Adaptive layout](#adaptive-layout)
12. [Accessibility](#accessibility)
13. [Prototype and review workflow](#prototype-and-review-workflow)
14. [Anti-patterns](#anti-patterns)
15. [Completion gate](#completion-gate)
16. [Design references](#design-references)

## Design posture

Design Xpert Agentic Apps as enterprise decision workbenches, not marketing dashboards or component showcases. Keep the experience:

- **Role-based:** expose information and actions relevant to the user's business responsibility.
- **Task-first:** organize the screen around the current job and its next meaningful action.
- **Quiet:** let business state, exceptions, and decisions carry emphasis; avoid decorative competition.
- **Coherent:** reuse the same component, status, action, and navigation semantics across Views.
- **Accountable:** preserve evidence, provenance, review state, revisions, and consequences around Agent work.
- **Adaptive:** preserve the task and decision hierarchy as space, density, locale, and input mode change.

Enterprise style does not mean making every surface gray, dense, or tabular. It means making complex work predictable, efficient, reviewable, and safe.

## Role and task first

Make the primary viewport answer these questions without opening a secondary surface:

1. Which business object am I working on?
2. Which workflow stage or state is active?
3. What changed or requires attention?
4. What blocks progress, if anything?
5. What is the recommended next action?

Apply these rules:

- Give the active business object, current stage, and blocking state stable locations.
- Present one dominant task per workspace region; move unrelated work to navigation or a dedicated workflow.
- Prefer business language over internal provider, tool, queue, schema, or transport terminology.
- Show relevant context near the task; do not flatten every capability and metric into the initial screen.
- Personalize visibility by role or capability without changing shared interaction semantics.
- Do not make users reconstruct the workflow from a collection of equally weighted cards and buttons.

## Information architecture and floorplans

Choose a floorplan from the work rather than forcing every View into one template. Common enterprise floorplans include:

- **List-detail:** repeated records on the left or top, selected record detail in the main area.
- **Master-workspace-inspector:** hierarchy or queue, primary editor/canvas, contextual evidence or properties.
- **Dashboard-to-workflow:** compact operational summary leading into a dedicated task surface.
- **Step workflow:** stable stage navigation with one current-stage workspace.

Keep the chosen floorplan stable:

- Keep global identity and workflow stage above local content.
- Keep primary navigation, object navigation, workspace controls, and contextual inspection visually distinct.
- Preserve the user's selected object and scroll or editing context when opening details.
- Use the four disclosure layers defined in the progressive-disclosure reference: glance, context, inspection, and dedicated workflow.
- Use an Inspector, Sheet, or Drawer for evidence, history, diagnostics, and properties that must remain associated with the current object.
- Use a full page or Workbench for dense editing and multi-step review; do not put an application inside a Dialog.
- Avoid nested navigation systems that compete to describe the same hierarchy.

## Quiet visual language

Use a neutral-dominant visual system in which emphasis has a business meaning:

- Use semantic host tokens for surfaces, text, borders, focus, primary actions, and statuses; do not establish a plugin-local enterprise palette.
- Reserve the primary or brand accent for the main action, active selection, focus, or a small number of navigational anchors.
- Reserve success, warning, destructive, and informative colors for their semantic states.
- Use spacing, alignment, typography, and subtle surface changes before adding borders or containers.
- Use thin semantic borders only where a boundary improves comprehension or interaction.
- Use elevation primarily for overlays and floating surfaces, not for every content region.
- Keep radius and shadow choices consistent with the shared shadcn theme; avoid arbitrary mixtures of sharp, rounded, and pill-shaped containers.
- Use sentence case and a restrained type hierarchy. Prefer left or start alignment for scanning; reserve centered text for compact empty states or focused messages.
- Use one icon family through the platform icon contract. Do not use emoji, text glyphs, or CSS-drawn approximations as application icons.

Do not hardcode a brand font, blue palette, radius, or shadow recipe in this skill. The host theme and density contract own those values.

## Spacing and controlled density

Use spacing to communicate relationship and density to support work:

- Use the host spacing ramp, preferably derived from a four-pixel rhythm, rather than unrelated one-off values.
- Keep tightly related labels, values, icons, and controls close; increase space between separate decisions or tasks.
- Make repeated records, tables, directory trees, and metadata compact enough to scan.
- Give primary decisions, headings, warnings, and destructive consequences more breathing room.
- Support the platform's `default` and `compact` density modes without maintaining separate layouts.
- Keep toolbar, header, row, and control density internally consistent within one data surface.
- Do not reduce spacing until labels, focus indicators, validation messages, or targets overlap.
- Prefer a 44 CSS pixel touch target for touch-oriented controls when space permits, and never violate the applicable WCAG target-size minimum or its exception rules.

Compact is a deliberate mode, not permission to shrink every font, icon, gap, and target indiscriminately.

## Shadcn component composition

Treat shadcn as the shared primitive and composition layer, not as a substitute for information architecture:

- Start from `@xpert-ai/plugin-shadcn-ui` components and their default visual language.
- Use official props, variants, slots, and `data-*` states before adding consumer overrides.
- Do not add a custom `className` merely to recreate or fight the shared component default.
- Limit consumer Tailwind classes to layout, responsive behavior, sizing required by the floorplan, and domain states absent from the shared API.
- Promote a repeated domain pattern into one plugin-owned composite component instead of repeating long utility-class strings.
- Request a missing reusable primitive in the shared package; do not fork its source into each Remote View.
- Use the shared `Select` for ordinary selection and the shared searchable combobox pattern when search is required.
- Use `AlertDialog` only for consequential confirmation and `Dialog` for bounded forms or focused tasks.
- Preserve the native semantics and accessibility contract of shared components; do not replace a Button, Link, Checkbox, Tab, or Menu with a styled `div`.

Raw semantic HTML remains appropriate for content structure when no interactive shared primitive is needed.

## Action hierarchy

Make action priority visible and consistent:

- Define one page- or task-level primary action. A local region may have one primary action only when it is independent of the page action.
- Use secondary actions for valid alternatives and ghost or icon actions for local tools.
- Keep destructive actions visually and spatially separate from routine actions.
- Place actions near the object or scope they affect; do not make users infer whether a toolbar acts on the page, panel, selection, or row.
- Keep Save, Submit, Approve, Publish, Generate, and Regenerate semantically distinct. Their labels must describe the actual consequence.
- Disable duplicate submission during asynchronous work and show the pending operation at the action origin.
- Expose bulk actions only after selection and state the selected count.
- Keep up to five frequently used global table actions visible; move lower-priority actions to an overflow menu.
- Keep one or two common row actions inline when space and clarity allow; use an overflow menu for larger sets.
- Give every icon-only action an accessible name and a concise tooltip when the icon meaning is not universally clear.

Do not use several equal-emphasis dark or brand-colored buttons to represent one workflow stage.

## Data-intensive surfaces

Choose the component from the data relationship:

- Use Table or Structured List for homogeneous records that users compare, sort, filter, or act on repeatedly.
- Use cards for heterogeneous summaries or objects whose content cannot be meaningfully aligned into columns.
- Use list-detail for selection and inspection; use expandable rows only for compact subordinate details.
- Give tables enough horizontal space. Do not place a data-heavy table inside a narrow card or Dialog.
- Align repeated labels, values, numbers, and status markers to preserve scan paths.
- Use tabular numerals for changing counts, durations, money, measurements, and aligned numeric columns when supported.
- Put global search, filters, display settings, export, and creation actions in a consistent toolbar.
- Put row-specific actions on the row and selection-wide actions in a batch toolbar.
- Paginate or virtualize large datasets through the View Provider; do not fetch the entire collection into the iframe.
- Preserve query, filters, selection, and page state when users inspect an item and return.
- Truncate only when space requires it, and provide an explicit way to reveal or copy the full value.
- Use skeletons for structural loading and preserve the final layout footprint to minimize shift.

An empty state must name what is absent, explain why when useful, and offer the next allowed action. Do not render an unexplained blank panel.

## Status and feedback semantics

Define one domain status vocabulary before drawing status controls. A typical execution vocabulary includes:

| State | Meaning | Required presentation |
| --- | --- | --- |
| Not started | No work has begun | Neutral label or step; no success styling |
| Queued | Accepted but not running | Queue wording and non-animated pending indicator |
| Running | Active work | Label plus bounded motion when motion is allowed |
| Waiting | Human input, dependency, or resource is required | State the dependency and next owner |
| Review required | Output exists but is not accepted | Review label and direct review action |
| Succeeded | Requested work completed | Success label and result or next step |
| Warning | Result exists with a material exception | Warning label and inspectable explanation |
| Failed | Work did not complete | Failure label, reason, and recovery action |
| Cancelled | Work stopped intentionally | Neutral cancelled label and restart path when allowed |
| Stale | A newer revision invalidates the view | Revision message and refresh or reconcile action |

Apply these rules:

- Combine text with icon or shape and semantic color; color alone never communicates status.
- Place a status next to the object or action it describes.
- Use a Badge or indicator only when the state deserves scanning attention; use plain text for routine metadata.
- Avoid walls of status chips. Consolidate groups and expose the underlying details on demand.
- If a colored dot represents an execution record, render it as an accessible Button with status, sequence, timestamp, and destination in its accessible name or contextual label.
- Do not encode progress, success, or failure solely through animation.
- Keep transient feedback near the action and durable state in the business object or execution history.
- Announce asynchronous errors and important completion changes through an appropriate live region without stealing focus.

## Human-AI collaboration

Treat Agent output as reviewable work, not unexplained system truth:

- State what the Agent can do and the material limits relevant to the current task.
- Distinguish Agent suggestion, generated draft, human edit, review-required output, approved version, and published or frozen result.
- Show evidence, provenance, revision, and confidence or uncertainty where they affect a decision.
- Make it efficient to invoke, dismiss, correct, retry, or refine Agent assistance.
- Explain why the Agent produced a result through inspectable evidence or rationale, not permanent verbose text in the primary workspace.
- When intent is uncertain, narrow the operation, ask one focused material question, or produce a reversible draft.
- Preserve user corrections and make the consequence of approval, regeneration, rollback, or replacement explicit.
- Keep an audit path from the visible result to its execution record, inputs, evidence, reviewer, and revision.
- Do not use confidence styling to imply correctness or transfer accountability from the system to the user.
- Do not interrupt users with confirmations for ordinary drafts, reads, reversible edits, or informational warnings.

## Adaptive layout

Adapt the information architecture instead of proportionally shrinking a desktop canvas:

- Preserve the active object, task title, primary action, blocking state, and unsaved-work signal at every supported width.
- Collapse global or object navigation before compressing the primary workspace beyond usability.
- Move a secondary Inspector into a Sheet or Drawer when it cannot remain beside the workspace.
- Move lower-priority toolbar actions into an overflow menu while keeping the primary action visible.
- For data tables, preserve essential columns and expose secondary data through row detail or controlled horizontal scrolling.
- Avoid horizontal page scrolling; restrict horizontal scrolling to an intentional data or canvas region.
- Let dense fixed-layout editors declare a documented minimum supported width and provide a useful constrained-width state.
- Test long localized labels and increased text size, not only short English or Chinese fixture content.

Do not merely scale fonts and controls down until a three-column desktop layout fits.

## Accessibility

Treat accessibility as an acceptance condition for the design, not a later implementation pass:

- Provide a complete keyboard path with logical focus order and no keyboard trap.
- Keep focus indicators visible, sufficiently contrasted, and unobscured by sticky headers, overlays, or drawers.
- Maintain applicable WCAG contrast for text, meaningful non-text graphics, component boundaries, and focus states.
- Pair color with text, icon, shape, position, or pattern for every meaningful state.
- Give controls programmatic names; icon-only controls require an accessible name independent of Tooltip visibility.
- Associate every form control with a persistent label. Place validation near the field and provide an error summary for long forms when useful.
- Announce asynchronous validation, errors, and consequential status changes without moving focus unexpectedly.
- Preserve usable target sizes across default and compact density; density does not waive accessibility.
- Respect `prefers-reduced-motion` and provide non-motion status cues.
- Ensure zoom, text resizing, long content, and localization do not clip essential information or actions.
- Restore focus deliberately after Dialog, Sheet, Popover, and menu dismissal.

## Prototype and review workflow

Use the production-shaped prototype standard and review design decisions against real states, not a polished populated screenshot:

1. Write the role, primary task, active object, blocking conditions, and primary action.
2. Choose the floorplan and disclosure layers.
3. Define the action and status vocabularies.
4. Compose the View from real shadcn components and semantic tokens.
5. Build deterministic fixture scenarios for loading, populated, partial, empty, error, denied, stale, running, review-required, and completed states as applicable.
6. Review default and compact density, light and dark themes, representative widths, long labels, keyboard navigation, and reduced motion.
7. Verify that the same generated assets and component tree pass the installed-host workflow.

Review the result by task outcomes:

- Can the user identify the active object and stage immediately?
- Is the next action clear without reading every panel?
- Are blockers and uncertainty visible without dominating the page?
- Can details be inspected without losing selection or work?
- Can Agent output be traced, corrected, reviewed, and recovered?
- Does the hierarchy survive narrow width, compact density, dark mode, and long localization?

Use [workbench-e2e-visual-validation.md](workbench-e2e-visual-validation.md) for executable visual and behavioral evidence.

## Anti-patterns

Reject or redesign these patterns unless a documented domain constraint justifies them:

- Marketing-style hero sections, gradients, glass effects, or oversized promotional metrics inside an operational Workbench.
- A mosaic of equal-weight cards used as a substitute for workflow and information hierarchy.
- Nested bordered cards where spacing or one shared surface would communicate grouping.
- Several primary buttons competing within one task region.
- A fixed plugin-local "enterprise blue" palette or font that bypasses host semantic tokens.
- Every metadata value rendered as a Badge or pill.
- Unlabelled colored dots, icon-only controls, or hover-only actions with no keyboard equivalent.
- Tables placed inside narrow Dialogs or small cards.
- Dialogs or drawers that contain an entire multi-step application.
- Density achieved by shrinking type, targets, and focus indicators rather than removing noise and improving grouping.
- Responsive behavior implemented only by scaling or clipping a desktop layout.
- Direct copies of shared shadcn components or broad CSS overrides that recreate their defaults.
- AI results presented as final truth without evidence, revision, correction, or review state.
- Empty, error, waiting, or permission states represented by blank space or a toast alone.

## Completion gate

Do not approve a new or substantially refactored View unless all applicable statements are true:

- The active business object, workflow stage, blocking state, and recommended next action are clear.
- The page has a stable floorplan and one dominant task per workspace region.
- Spacing and alignment create hierarchy before borders, cards, color, or elevation.
- Semantic tokens provide a quiet neutral base and reserve accent and status colors for meaning.
- Shared shadcn components and official variants are used without redundant restyling.
- Action scope and priority are visible; destructive and bulk actions appear only in the correct context.
- Tables, lists, cards, inspectors, dialogs, and full workflows match their semantic purpose.
- Statuses use a shared vocabulary and never rely on color alone; interactive indicators are accessible controls.
- Agent suggestions, drafts, edits, reviews, approvals, and frozen results are distinguishable and traceable.
- Loading, partial, empty, error, denied, stale, long-running, and recovery states exist where applicable.
- The floorplan remains usable in default and compact density, light and dark themes, supported widths, and long localized content.
- Keyboard navigation, focus visibility, target size, contrast, announcements, motion preferences, and focus restoration were tested.
- Visual evidence uses the real production component tree and generated assets, and behavioral evidence proves authoritative state.

## Design references

The standard synthesizes stable guidance from these primary design systems and human-AI sources:

- [SAP Fiori design principles](https://experience.sap.com/fiori-design-web/design-principles/): role-based, adaptive, simple, coherent enterprise UX.
- [Fluent 2 layout](https://fluent2.microsoft.design/layout) and [design tokens](https://fluent2.microsoft.design/design-tokens): spacing, hierarchy, adaptivity, and semantic tokens.
- [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) and [status indicators](https://carbondesignsystem.com/patterns/status-indicator-pattern/): data-intensive interaction and status semantics.
- [shadcn/ui introduction](https://ui.shadcn.com/docs) and [theming](https://ui.shadcn.com/docs/theming): composition, defaults, and semantic CSS variables.
- [Microsoft HAX guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/): capabilities, uncertainty, correction, explanation, and user control in human-AI interaction.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): contrast, keyboard, focus, target size, reflow, and status accessibility requirements.
