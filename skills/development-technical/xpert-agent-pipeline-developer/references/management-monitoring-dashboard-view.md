# Management Monitoring Dashboard View

Use this reference to implement the default `operations_dashboard` View for a multi-Agent pipeline application. Its job is management monitoring: reveal portfolio health, throughput, bottlenecks, exceptions, and recent activity, then take the user into the exact Case that needs attention.

The dashboard supports the pipeline Workbench; it does not replace the `pipeline_overview` swimlane.

## Required Implementation Baseline

- Use Apache ECharts / ECharts.js (`echarts`, preferably tree-shaken modules from `echarts/core`) as the default statistical chart library.
- Bundle ECharts with the Remote View. Do not load it from a CDN or assume `window.echarts` exists.
- Use `@xpert-ai/plugin-shadcn-ui` for controls, filters, tables, dialogs, hover disclosures, skeletons, and alerts.
- Consume a tenant-scoped server `dashboardProject` operation that returns metric definitions and chart-ready series.
- Navigate from an actionable aggregate or row to the selected Case's swimlane through the allowlisted `workbench.navigation.open` command.

Use a different chart library only when the user explicitly requests it or the host contract requires it; record the reason in the implementation decision.

## Information Architecture

Design the dashboard around management questions rather than available fields:

1. **What requires attention now?** Show active, blocked, overdue, failed, or approval-waiting Cases and the dominant primary action.
2. **Is the process healthy?** Show throughput, cycle time, recovery time, failure rate, and trend against the selected time window or target.
3. **Where is work accumulating?** Compare roles, lanes, and stages using queue, running, blocked, and completed counts.
4. **Which Cases or executions explain the signal?** Provide a compact, sortable drill-down table.

Avoid a page made entirely of KPI tiles and tables. At least one meaningful statistical chart must visualize change, distribution, comparison, or bottlenecks when the projection contains sufficient data.

## Default Layout

Use a responsive 12-column content grid. Prefer this hierarchy on desktop:

1. flat page header with title, current monitoring scope/time window, and refresh or one primary action;
2. one compact KPI strip containing only the most decision-relevant metrics;
3. primary trend or exception chart spanning about eight columns;
4. secondary distribution or bottleneck chart spanning about four columns;
5. role/stage health comparison across the full width when it materially adds information;
6. actionable Cases and recent Agent executions near the bottom as compact tables or lists.

On narrower widths, stack charts before dense tables and keep the primary action visible. Do not reserve large empty metadata cells. Do not wrap every text group in a Card; use `Card` only for independent chart, metric, or table objects that benefit from a boundary.

## Chart Selection

Choose a chart because it answers a question:

| Question | Preferred ECharts form |
| --- | --- |
| How is volume, failure, or cycle time changing? | line or area time series |
| Which role/stage has the largest queue or blocker count? | sorted horizontal bar |
| How do statuses compose per role/stage? | stacked bar |
| Where are time/stage bottlenecks concentrated? | heatmap |
| How is a small whole divided into a few stable categories? | donut, used sparingly |

Avoid pie/donut charts for many categories, 3D effects, gauges without an operational threshold, and decorative animation. If the projection cannot support a truthful comparison, render an honest empty or insufficient-data state instead of fabricated points.

## Dashboard Projection Contract

`dashboardProject` should return already-authorized, aggregation-safe data such as:

```ts
type DashboardProjection = {
  scope: { tenantId: string; organizationId?: string; from: string; to: string }
  generatedAt: string
  revision: string
  kpis: Array<{
    key: string
    label: string
    value: number | string | null
    unit?: string
    trend?: number | null
    target?: number | null
    status?: 'neutral' | 'info' | 'success' | 'warning' | 'critical'
    definition?: string
  }>
  series: Array<{
    key: string
    chartIntent: 'trend' | 'comparison' | 'composition' | 'bottleneck'
    dimensions: string[]
    rows: Array<Record<string, string | number | null>>
  }>
  cases: Array<{ caseId: string; title: string; status: string; stage: string; progress?: number }>
  executions: Array<{ executionId: string; caseId: string; roleKey: string; status: string; startedAt: string }>
}
```

The exact transport shape may differ, but preserve these properties:

- the server owns authorization, metric definitions, time-window semantics, and aggregation;
- every drill-down datum carries a stable Case or execution identity;
- missing values remain missing, not silently coerced to zero;
- timestamps and units are explicit;
- generated time/revision supports stale-data indication.

Do not calculate organization-wide metrics from a paginated browser list. Do not expose cross-tenant aggregates, internal prompts, or unrestricted execution payloads.

## ECharts Integration

Register only the charts, components, and renderers used by the View. Keep chart options derived from the projection and host theme tokens rather than hardcoded screenshots.

For each chart:

- initialize once after the container is mounted;
- call `setOption` when projection, theme, locale, or density changes;
- observe the container with `ResizeObserver` and call `resize()`;
- remove event listeners and call `dispose()` on unmount;
- use stable series keys to avoid visual churn;
- disable or reduce animation when the user prefers reduced motion;
- expose a concise textual summary or data table for non-visual access;
- use ECharts ARIA support where compatible;
- map semantic states to host tokens and never rely on color alone.

Handle chart clicks only for explicitly actionable data. Convert the point to a stable Case identifier and issue the public navigation command; never build internal host URLs in the iframe.

## Controls and Progressive Disclosure

Use shadcn `Select`, `Tabs`, `ToggleGroup`, `Popover`, `Calendar`, or `Command` for time range, scope, grouping, and status filters. Use shadcn `Table`, `Badge`, `Progress`, `Skeleton`, `Alert`, `Tooltip`, `HoverCard`, and `ScrollArea` as appropriate. Never use native `<select>`, native `<button>`, or a hand-built modal/tooltip.

Keep the page header limited to monitoring scope, freshness/state, and essential actions. Put metric definitions, aggregation rules, sample windows, target explanations, and secondary identifiers in a `HoverCard` or detail disclosure. Hover-only information must also be reachable by focus/touch; do not hide blockers, critical warnings, or the primary next action exclusively in hover content.

## States and Failure Handling

Provide explicit states for:

- initial loading with layout-preserving Skeletons;
- no Cases in the selected scope;
- insufficient samples for a chart;
- partial metric failure while other panels remain usable;
- stale projection with generated time and refresh action;
- permission denied or unavailable drill-down;
- theme/density changes and container resize.

Never convert a failed request into a plausible zero. Keep prior data visibly stale only when policy permits it.

## Dashboard Acceptance Checklist

- The registered View kind is `operations_dashboard`, backed by `dashboardProject`.
- ECharts is bundled and at least one chart answers a real management question when data exists.
- KPI, chart, and table hierarchy works at desktop and narrow widths without large empty regions.
- Chart selection matches the question and contains units, time windows, labels, and accessible alternatives.
- Resize, theme, reduced-motion, loading, empty, stale, partial-error, and permission states are verified.
- Actionable chart points and rows open the exact selected Case in the swimlane.
- No aggregate is produced from incomplete client-side pagination.
- No native interactive elements or undeclared component library is used.
