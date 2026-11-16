# Analytics Workspace Overhaul

**Status** — Deferred proposal. Activate one phase at a time after the user approves implementation and the project records the scope in its active gate.

## Product outcome

Give Datastream one **Analytics** sidebar destination with two views. **Dashboards** opens by default for a first visit and gives users a place to track KPIs and trends. **Explore** lets users build charts, inspect a result, and save an analysis. Remember the last view on return and carry the relevant dataset and analysis settings when switching through a chart action. Keep AI Chat and ML Studio as separate destinations.

The core workflow starts with a movement on a dashboard. A user opens the chart in Explore, changes a date range or breaks the result down by a field, and saves the investigation or pins it to a dashboard. A new user can also start from a dataset and build the first useful view without configuring a semantic model first. Where a governed metric exists, use its definition consistently across both views.

## Starting point in the code

- [SideBar.jsx](../../../../frontend/frontend/src/components/layout/SideBar.jsx), [DestinationHome.jsx](../../../../frontend/frontend/src/components/layout/DestinationHome.jsx), and [CanvasContainer.jsx](../../../../frontend/frontend/src/components/layout/CanvasContainer.jsx) expose separate destinations. Explore offers Gallery and AI Chart. Dashboards uses the Business Monitoring home and offers KPI and Chart creation.
- [SmartChartWindow.jsx](../../../../frontend/frontend/src/features/charts/SmartChartWindow.jsx) already pins charts to a dashboard. [AIShell.jsx](../../../../frontend/frontend/src/features/ai/AIShell.jsx) saves AI results through the dashboard context. Reuse these entry points and establish a destination selector once multiple dashboards are available.
- [WindowContext.jsx](../../../../frontend/frontend/src/context/WindowContext.jsx) and the [dashboard canvas contract](../../contracts/dashboard_canvas_state.md) define the single local dashboard, chart and KPI records, filters, and saved result provenance. [Semantic metric resolution](../../../../backend/routes/semantic_metrics.py) is an existing backend entry point. Verify its supported inputs and the existing chart query paths before promising comparisons, drilldowns, or refresh behavior.

## Starter release

| Area | Capabilities |
| --- | --- |
| Dashboards | Create, rename, duplicate, and delete local dashboards. Offer a blank canvas and a starter layout with room for KPIs, trends, and breakdowns. Add chart, KPI, and text tiles. Support reorder and resize, view and edit modes, and dashboard-level date and category filters with visible scope. |
| Explore | Start from the chart gallery, AI Chart, a dataset, or an existing dashboard chart. Offer a field picker, table preview, and bar, line, and table views as the baseline. Expose supported aggregation, grouping, sorting, top N, date grain, and filters. Save, reopen, rename, duplicate, and delete named explorations. |
| Investigation | Offer prior-period KPI and trend comparisons for compatible time-based queries. Allow a dashboard chart to open in Explore with its context intact. Support drilling from an aggregate into a filtered breakdown where the source supports it. Pin to a selected dashboard, with an explicit update action for the original tile. |
| Trust and recovery | Show the dataset, metric or aggregation, effective filters, and available freshness or snapshot information. Distinguish loading, no matching rows, missing fields, unsupported operations, and failed requests. Keep the last good saved state and the current draft available when a save fails. |
| Export | Export the displayed table result as CSV where supported. Make the applied filters and any result limits visible so the user can tell the scope of the export. |

Follow-on candidates include scheduled refresh and alerts, governed team sharing, reusable dashboard templates, and automated anomaly detection. Evaluate those after the local workflow is proven. The starter release uses the existing local-first model and labels saved snapshots and live results according to their actual behavior.

## Implementation sequence

### 1. Verify analysis and persistence contracts

**Lead** — Codex. Trace the dataset selection, chart query, semantic metric, filter, pinning, and AI result paths. Record which chart options and comparison operations each supported source can execute. Confirm where the app stores or derives dataset identity, metric or field mappings, date grain, and local and dashboard filters.

Define an additive contract for a reusable analysis configuration and a versioned local collection of dashboards and explorations. Include stable identities, normalized chart settings, dataset and metric references, filter scope, and provenance. Define how the existing single dashboard becomes the first dashboard, how old storage is preserved, and how AI result snapshots and duplicate detection keep working. Confirm the same-device draft and save behavior. Implement a focused backend change only where existing query behavior cannot satisfy a starter-release requirement.

**Exit** — Contract and capability coverage are verified against source and focused fixtures. The next handoff can point to exact fields, supported operations, and failure behavior.

### 2. Unify navigation and migrate existing dashboards

**Lead** — Frontend owner after contract review. Replace the two sidebar entries with Analytics. Integrate Dashboards and Explore under a shared header with two accessible views and clear dataset context. Keep existing navigation actions and entry points working by mapping them to the appropriate Analytics view. Retain the existing editors during the transition. Add the dashboard picker and local dashboard creation, rename, duplicate, and deletion once migration behavior is verified.

**Exit** — An existing user can reload and find their dashboard, tile IDs, positions, filters, and snapshots intact. A new user can create a first dashboard. Repeated startup does not duplicate data, and malformed data or failed writes follow the verified recovery path. Return to Codex for migration and navigation review.

### 3. Strengthen dashboard and Explore authoring

**Lead** — Frontend owner in separate dashboard and Explore handoffs after navigation review. Improve dashboard setup with starter layouts, tile editing, and scoped filters. Improve Explore with chart and table previews, field and filter controls, named analyses, and explicit save behavior. Use the verified capability coverage for supported controls. Where an operation is unavailable, show the reason at the relevant control.

**Exit** — A user can set up a useful dashboard, create and reopen an analysis, and apply filters with predictable results. Verify that incompatible fields across datasets never silently change a tile's query. Return each bounded change to Codex for review before the next one starts.

### 4. Connect monitoring, investigation, and reporting

**Lead** — Codex for integration and contract review. The frontend owner implements the bounded interaction work once the required behavior is verified. Bring the source dataset and chart configuration into Explore from a dashboard tile. Carry effective filters with visible scope, preserve dashboard state on return, and keep investigation edits in the Explore draft until the user chooses to pin a copy or update the original. Add supported prior-period comparisons, drilldowns, and CSV export. Offer AI result saves to the appropriate dashboard while preserving snapshots and repeat-save behavior.

**Exit** — A user can spot a change, inspect the underlying breakdown, and save the result without rebuilding the chart or reselecting its dataset. Changed source fields and unavailable data produce a recoverable state. Codex returns the integrated release to the user for browser acceptance.

## Verification before release

- Check migration and reload with an existing v1 dashboard, legacy-only storage, malformed current data, and a failed write. Verify saved layouts, item references, filters, AI snapshots, and repeated migration. Add focused coverage in [WindowContext tests](../../../../frontend/frontend/src/context/WindowContext.test.jsx) and the dashboard state and filter tests as appropriate.
- Compare Explore, dashboard, and CSV results on the same fixture. Check that they use the same dataset, aggregation, and intended filters. Include date boundaries, no rows, zero comparison baselines, and unsupported comparisons. Verify that updates to a draft leave the original tile intact until explicitly applied.
- Verify that saved analyses reopen, pinning targets the chosen dashboard, deletion requires a deliberate action, and AI Chat save and dashboard-open flows still work. Check keyboard navigation and save and error feedback in both Analytics views.
- Run focused frontend tests and `npm run build` from `frontend/frontend`. Run focused backend tests and compile changed Python modules if query contracts change. Run the repository harness, active-gate validator when applicable, and `git diff --check` before control returns. Final browser acceptance belongs to the user.
