> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 2 Semantic Integration Note

## What changed

- The Explore workflow now treats semantic metrics and dimensions as first-class field explorer items with better search, business-only filter chips, clear inferred/custom badges, and direct quick actions for semantic charts, KPI cards, dashboard filters, and metric editing.
- The Business workflow now presents semantic metrics and dimensions as actionable definition cards instead of passive chips, making it easier to launch semantic charts or KPI cards and open the metric editor from the same surface.
- The semantic metric editor now has a clearer split between inferred and custom metrics, read-only treatment for inferred definitions, a duplicate-to-custom path, and lightweight local suggestion chips for names, descriptions, and formula templates.
- Semantic chart windows now validate missing or deleted semantic selections more clearly and keep semantic mode/status messaging consistent.
- Dashboard filter tooling now opens more naturally when semantic filter actions add a new filter target, and the dashboard bar styling now respects the shared theme variables better in light and dark mode.

## How to use it

1. Open **Explore** and switch to **Business Fields** to browse semantic metrics and dimensions.
2. Use the quick action pills on a business field:
   - `Chart` creates a semantic chart.
   - `KPI` creates a semantic KPI card for metrics.
   - `Filter` seeds a dashboard filter for the relevant semantic dimension.
   - `Edit` opens the semantic metric editor.
3. Open **Business** to manage the semantic layer directly:
   - Metrics and dimensions now show definition badges and one-click actions.
   - Custom metrics are editable.
   - Inferred metrics are read-only but can be duplicated into a custom metric.
4. In the metric editor, use **Smart suggestions** to quickly apply a name, description, or formula template without depending on backend AI calls.

## Notes

- Raw dataset charting and drag-and-drop behavior remain intact.
- Semantic charts and KPI cards continue resolving through `/api/semantic-metrics/resolve`.
- The frontend production build succeeds. Remaining warnings are pre-existing in unrelated files (`KpiCardWindow.jsx`, `RawDataViewer.jsx`, `WhiteBoard.jsx`, and `useWindowInteraction.js`).
