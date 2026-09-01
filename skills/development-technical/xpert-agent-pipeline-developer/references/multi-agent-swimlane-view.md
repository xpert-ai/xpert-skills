# Multi-Agent Swimlane View

Use this reference to implement the default `pipeline_overview` View. It is a server-projected, zoomable and pannable matrix whose rows are accountable role Assistants, columns are ordered business stages, task cards are persisted workflow nodes, and edges show the selected Case's actual control flow.

The swimlane must be operational and inspectable, not a static diagram. It shows what each Assistant actually did, what can happen next, what is blocked, and how an authorized user opens or advances the relevant work.

## Required Companion Contracts

Load `xpert-agentic-app-developer` and read these skill-relative paths:

- `references/enterprise-shadcn-design-principles.md`
- `references/shadcn-ui.md`
- `references/human-decision-load-and-progressive-disclosure.md`
- `references/assistant-task-orchestration.md`, especially **Task Identity and Persistence** and **View Execution Records**
- `references/view-client-commands.md`, especially **Open Assistant Task Execution Records**
- `references/remote-view-icons.md`

Use the current repository's shadcn source resolved by the companion `shadcn-ui.md` for every interactive View primitive. Use `@xpert-ai/plugin-shadcn-ui` only when locally available; otherwise install the required official components into the current project with the shadcn CLI. Never reference another checkout to obtain the package. Do not use native `<select>`, `<button>`, `<dialog>`, ad hoc hover panels, emoji icons, or a second component system. Semantic HTML and SVG are appropriate for the lane grid and edge geometry.

## Server Projection

Project a selected Case into a View model containing at least:

```ts
type PipelineProjection = {
  case: {
    id: string
    title: string
    status: string
    revision: number | string
    templateKey: string
    templateVersion: number
    progress?: number
    nextAction?: { label: string; actionKey: string } | null
    blockerSummary?: string | null
  }
  lanes: Array<{
    key: string
    title: string
    order: number
    assistant: {
      assistantId: string
      displayName: string
      avatarUrl?: string | null
      avatarFallback?: string
      status?: string
    }
    recentExecutions: ExecutionRecord[]
  }>
  stages: Array<{ key: string; title: string; order: number }>
  nodes: Array<{
    key: string
    title: string
    kind: 'task' | 'router' | 'terminal'
    laneKey?: string
    stageKey: string
    status: string
    executable?: boolean
    blocker?: string | null
    openMode?: 'dialog' | 'view' | 'component'
    workspaceKey?: string
    componentKey?: string
    summary?: Record<string, unknown>
    recentExecutions?: ExecutionRecord[]
  }>
  edges: Array<{ from: string; to: string; active?: boolean; outcome?: string }>
}
```

Execution records follow the Assistant Task persistence contract and carry stable Case, node, lane/role, Assistant, task, conversation/thread, execution, attempt, status, timing, and safe summary identifiers. Project only records the current user may inspect.

The client may own geometry, zoom, pan, hover, focus, and lane selection. The server owns nodes, routes, executability, statuses, blockers, execution identities, and completion evidence.

## Page Header and Case Context

Follow the Agentic App principle of reducing human decision load. At normal desktop width, compose the selected Case context as one compact horizontal command row rather than stacked summary cards or a metadata grid. Allow deliberate wrapping only when the host width or localization requires it. Keep these primary fields in that row:

- selected Case identity/title;
- current state or most important blocker;
- progress when meaningful;
- next authorized action;
- one visually dominant primary action, plus compact secondary actions such as refresh/filter/zoom.

Move device/line or equivalent scope metadata, template version, revision, timestamps, risk counts, detailed scope, and secondary identifiers into a focusable/touch-accessible shadcn `HoverCard`, `Popover`, or detail disclosure anchored to a clearly named context affordance. Do not create a large empty metadata grid or reserve blank cells for absent values. Never hide a critical blocker, approval requirement, or primary action exclusively in hover content.

## Grid and Edge Rendering

Render the lane/stage matrix from the projection:

- sticky Assistant/lane header column;
- sticky stage header row;
- ordered rows and columns from server keys/order;
- task cards positioned by lane and stage;
- router and other control-flow logic nodes represented as compact diamonds rather than task cards;
- terminal nodes represented explicitly with a distinct end-state symbol;
- one SVG edge layer aligned with the same scrolling and transform coordinate system as node cards;
- deterministic edge paths with arrowheads, route labels, active/blocked styling, and no geometry stored as business truth.

Use a stable layout algorithm. Parallel nodes may share a cell with deterministic stacking. Recalculate geometry after data, density, font, container, or zoom changes. Do not let SVG edges drift when the canvas scrolls, pans, or resizes.

### Diamond Logic Nodes

Render every router, decision, branch, merge, or equivalent control-flow logic node with the same diamond visual grammar:

- use a compact square rotated 45 degrees, or an equivalent SVG diamond, with the logic/router icon centered inside;
- connect the incoming edge at the left vertex and outgoing edges at the right, top, or bottom vertices as layout requires;
- place the business question/title immediately below the diamond and the current decision/waiting state below the title;
- place each branch value in a small label adjacent to its outgoing edge, not inside a task-style rectangle;
- use edge line style and semantic color to distinguish selected, pending, unavailable, and rejected branches without relying on color alone;
- keep the diamond and labels aligned with the same pan/zoom transform as task cards and edges.

Do not render a router as a rounded rectangular task card. A logic node coordinates flow; it does not imply a human or Assistant work item. The client may calculate its geometry, but its route fact, outcomes, selected branch, and status come from the server projection.

## Assistant Card Contract

The sticky card at the start of each lane represents the actual accountable Assistant, not a decorative role label.

### Actual Assistant Avatar

- Resolve Assistant identity and Avatar through the authorized platform Assistant profile/View Provider contract.
- Render with shadcn `Avatar`, `AvatarImage`, and `AvatarFallback`.
- Use the real Avatar whenever present; initials are only the missing/broken-image fallback.
- Keep display name and role/lane title visible or accessible.
- Do not hardcode a copied image, expose a private media URL/token, or treat an icon as an Avatar.

### Lane Selection

Make the Assistant card a shadcn `Toggle` or `Button` with `aria-pressed` semantics:

- activating it selects and visually emphasizes the entire lane;
- non-selected lanes may dim, but cross-lane dependencies and critical blockers remain legible;
- activating it again or pressing Escape clears selection;
- keyboard focus and activation match pointer behavior;
- selection is local presentation state and never changes business truth.

Execution-marker activation must stop propagation so it does not accidentally toggle the lane.

### Recent Execution Markers

Place recent execution records at the Assistant card's bottom-right as compact, focusable dots. This strip is the lane-level recent-execution summary:

- show at most 10 records for the selected Case/lane, newest at the right;
- retain all immutable records server-side; when more exist, expose a `+N`/history affordance rather than silently implying only ten exist;
- each dot represents one real attempt, including failed, cancelled, interrupted, retried, and superseded attempts;
- dots use semantic color plus an accessible status label; color is never the only signal;
- hover or keyboard focus opens a shadcn `HoverCard` containing safe execution details;
- activation opens the exact ChatKit conversation/thread/execution using the allowlisted public client command.

Recommended status mapping:

| Execution status | Visual intent |
| --- | --- |
| queued / pending | muted or pending |
| running | primary/info with non-disruptive activity cue |
| succeeded / completed | success |
| warning / needs-review | warning |
| failed | destructive |
| cancelled / interrupted / superseded | neutral with explicit label |

The HoverCard should include status, task/node, attempt, safe summary, start/end or duration, and actor/Assistant identity when authorized. It must not expose chain-of-thought, hidden prompts, secrets, internal runtime routes, or unrestricted tool payloads.

Use the `xpert-agentic-app-developer` reference `references/assistant-task-orchestration.md` for persistence and record shape, and `references/view-client-commands.md` for exact ChatKit navigation.

## Task and Control Node Cards

Every task card must show title, state, and enough context to distinguish executable, running, completed, blocked, failed, and waiting-for-human states. Router and terminal nodes must be visible and inspectable; do not flatten the process into a linear stepper.

Use the blueprint's `openMode` to define card activation:

| `openMode` | Use when | Interaction |
| --- | --- | --- |
| `dialog` | bounded important information or a short read-only summary is sufficient | shadcn `Dialog`; use `AlertDialog` for consequential confirmation |
| `view` | dense detail, multi-step work, independent navigation, or a full workflow operation is required | open the authorized `workspaceKey` View |
| `component` | a bounded workflow component can complete the operation in context | open the allowlisted `componentKey` in the approved container |

Do not force every card into a full page, and do not place complex multi-step work inside a cramped Dialog. Consequential writes need explicit confirmation and server authorization regardless of container.

### Task-Node Execution Markers

Every task node with execution attempts must also render its own compact execution-marker strip at the task card's bottom-right:

- filter the records to that exact Case and node; do not show a lane-wide aggregate on a task card;
- show at most the configured limit of 10, newest at the right, and expose `+N`/history when more exist;
- use the same semantic status mapping, accessible labels, shadcn `HoverCard` details, and exact ChatKit navigation as Assistant-card markers;
- retain failed, cancelled, interrupted, retried, and superseded attempts;
- stop marker events from activating the task card's Dialog/View/component action;
- show no decorative or synthetic dot when a node has no real execution attempt.

The Assistant card and task card may both reference the same immutable attempt: the Assistant card answers “what has this lane's Assistant done recently?”, while the task card answers “what executions belong to this exact process node?”. They must resolve the same execution identity and status rather than maintaining duplicated client state.

## Drag-to-Pan Canvas

The entire lane canvas must support drag-to-pan without breaking controls:

- start panning only from empty canvas/background or while a documented modifier such as Space is held;
- ignore pointer starts inside buttons, links, inputs, task cards, Assistant cards, scrollbars, and execution markers;
- use pointer capture and a small movement threshold to distinguish drag from click;
- update the scroll/transform position shared by DOM nodes and SVG edges;
- suppress accidental text selection and click only after the threshold is crossed;
- preserve native touch panning where possible and provide keyboard/scroll alternatives;
- restore cursor and capture state on pointer up, cancel, blur, and unmount.

Drag-pan changes presentation only. It must not move nodes, reorder stages, or rewrite workflow truth unless the user explicitly asks for a process designer, which is a different product.

## Filters, Zoom, and View State

Use shadcn `Checkbox`, `Toggle`, `ToggleGroup`, `Select`, `DropdownMenu`, or `Popover` for blocked-only filters, zoom presets, fit-to-view, and lane focus. Do not use native controls.

Keep filter, selected lane, pan, and zoom as ephemeral View state. Keep the selected Case in the Workbench navigation state when the host contract supports it. A refresh reprojects server truth without inventing transitions.

## Status and Visual Semantics

Use host semantic tokens for success, running/info, warning, destructive, and muted states. Combine color with icon, label, border, or pattern. Preserve contrast in light/dark themes and Windows high-contrast behavior where supported.

Use `remote-view-icons.md` for interface icon sourcing. Assistant Avatars are identity media and follow the Avatar contract above; interface actions use approved icons, not Avatars or emoji.

## Loading, Empty, Error, and Stale States

Provide explicit states for:

- no Case selected;
- loading Case and flow projection with layout-preserving Skeletons;
- no records yet for an Assistant;
- partial Assistant profile/Avatar failure with a safe fallback;
- stale Case revision and refresh/retry;
- permission-denied node workspace or execution record;
- missing/deleted ChatKit execution with an auditable error;
- oversized graphs with scroll, pan, zoom, and virtualization/degradation strategy.

Never generate fake execution dots or animate task completion to make the pipeline appear active.

## Performance and Accessibility

- Avoid rerendering all lanes on every pointer move; apply pan via scroll or a single transform and throttle geometry work.
- Measure nodes after fonts/layout settle and observe size changes.
- Virtualize only when it does not detach visible edges or break keyboard traversal.
- Provide logical tab order: header actions, Assistant lane selectors and execution markers, then visible task cards.
- Every dot, icon-only action, status, and route outcome has an accessible name.
- HoverCard content is reachable on keyboard focus and an equivalent touch/click path exists.
- Respect reduced motion and do not use continuous animation for completed/static states.

## Swimlane Acceptance Checklist

- The registered View kind is `pipeline_overview` and data comes from `flowProject` plus authorized execution records.
- Rows are real accountable Assistants and show their actual platform Avatars with safe fallback.
- Each Assistant card can select its whole lane and shows at most 10 real, semantically colored lane-level execution dots at bottom-right.
- Each task card with attempts shows its node-filtered execution dots at bottom-right; markers never trigger the parent card action.
- Hover/focus reveals safe execution details; activating a dot opens the exact ChatKit record.
- Failed, retried, cancelled, interrupted, and superseded attempts remain inspectable.
- Node card activation follows the declared `dialog`, `view`, or `component` mode.
- Drag-to-pan works on canvas background without hijacking card/control interaction; edges stay aligned.
- Header information forms one compact desktop row, wraps only when constrained, and moves secondary metadata into a correctly positioned focusable/touch-accessible disclosure.
- Router and equivalent logic nodes use the required diamond grammar with labeled outcomes; terminal nodes remain visually distinct.
- Theme, resize, zoom, pan, keyboard, touch, empty/error/stale, and large-graph behavior are exercised.
- All interactive primitives come from the resolved current-repository shadcn source; no cross-repository UI import or native select/button/dialog is shipped.
