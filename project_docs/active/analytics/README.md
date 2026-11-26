# Analytics Product Rebuild

**Direction** — Replace Explore and Business Monitoring with one substantial Analytics product. The user requires an aggressive feature and interface expansion. The catalogue below is required release scope, not optional enhancements. Migration or a navigation merge alone cannot complete this plan.

**Execution ownership** — The user authorizes Codex to implement and verify the Analytics backend and frontend redesign directly. Status and the sole active gate record current ownership. Final browser acceptance belongs to the user.

## Product outcome

[Change Explorer](change_explorer.md) extends the Analytics tools drawer with metric-change attribution and segment investigation.

Replace both old destinations with one **Analytics** entry and a full-width workbench. Dashboards and analyses are objects inside the same workspace, with a shared library, dataset selector, query engine, filters and inspector. Users move from monitoring to investigation to reporting without relaunching windows, rebuilding charts or reselecting data.

Provide a compact shared header, searchable library/fields rail, large dashboard or analysis canvas, contextual inspector and expandable results table. A first visit offers a useful dashboard-starting workspace; return visits restore the selected object and mode. Empty states create real work. Existing dashboards survive. AI Chat and ML Studio remain separate products with direct Analytics entry points.

Retire Explore & Visualize and Business Monitoring as primary landing pages. Renaming them, placing them behind two tabs, or retaining floating windows as the main authoring experience fails this plan. Existing renderers may be reused behind the new application. Ordinary field analysis must work without semantic-model setup; governed metrics retain their authoritative definitions.

## Starting point in the code

- [SideBar.jsx](../../../frontend/frontend/src/components/layout/SideBar.jsx), [DestinationHome.jsx](../../../frontend/frontend/src/components/layout/DestinationHome.jsx), and [CanvasContainer.jsx](../../../frontend/frontend/src/components/layout/CanvasContainer.jsx) expose separate destinations. Explore offers Gallery and AI Chart. Dashboards uses the Business Monitoring home and offers KPI and Chart creation.
- [SmartChartWindow.jsx](../../../frontend/frontend/src/features/charts/SmartChartWindow.jsx) exposes a Pin action, but inspected source calls updateDashboardItem with a new ID and inserts nothing. Repair this interaction. [AIShell.jsx](../../../frontend/frontend/src/features/ai/AIShell.jsx) saves AI results through the dashboard context. Both must target an explicitly selected dashboard.
- [WindowContext.jsx](../../../frontend/frontend/src/context/WindowContext.jsx) and the [dashboard canvas contract](../contracts/dashboard_canvas_state.md) define the single local dashboard. [Semantic metric resolution](../../../backend/routes/semantic_metrics.py) is a baseline execution path; verify rather than assume its capabilities.

## Required feature catalogue

Every row is mandatory for the rebuilt release. Features requiring new execution support receive backend implementation and fixtures. Permanent disabled controls do not count as delivery. Data-dependent availability still requires an accurate explanation.

| Area | Capabilities |
| --- | --- |
| Unified application | One Analytics destination; dashboard/analysis modes in one shell; shared dataset/context bar; persistent last object; collapsible library and inspector; full-width canvas; contextual actions; focus/fullscreen mode. |
| Asset library | Multiple dashboards and saved analyses; create/rename/duplicate/delete; search; sort by name/recent update; favorites; tags; recent items; separate saved objects and recoverable drafts; direct open. |
| Visual query builder | Searchable typed fields; metrics/dimensions; click-to-add and drag-to-place; multiple measures and groups; aggregation; sort/top N; date grains; AND/OR filter groups; explicit Run/refresh; result table; invalid-field feedback. |
| Visualizations | Vertical/horizontal bar, grouped/stacked/100% stacked bar, line, area/stacked area, scatter, pie/donut, histogram, table and KPI. Field-role validation; deterministic chart suggestions; legends/tooltips; axis labels and titles. |
| Tables and pivots | Sortable results; column ordering/visibility; number/date formats; pinned identifier column; paging or virtualization; pivot rows/columns/measures; correct totals/subtotals; displayed-result CSV. |
| Metrics and calculations | Sum/average/min/max/count/distinct count; median/percentile; row count; safe calculated measures; ratios; percent of total; running total; moving average; rank and cumulative contribution. Visible definitions, units and execution order. |
| Time intelligence | Day/week/month/quarter/year; absolute/relative date ranges; previous period/year and custom comparison range; absolute/percentage delta; aligned comparison trends; zero/missing baselines; partial-period labels. |
| Dashboard composition | Multiple dashboards; blank and useful starter layouts; charts/KPI/text/markdown notes/section headings; add/duplicate/remove tiles; drag/resize/reorder; locks; view/edit modes; grid snapping; chart inspector; reusable local templates; presentation layouts. |
| Interactive monitoring | Date/category/number filters; dataset/tile scope; filter chips/reset; chart-click cross-filtering; linked selections; exclusions; category drilldown; permitted detail rows; visible affected-tile scope. Snapshots remain distinct. |
| Investigation | Open live tile in Analysis with effective filters/configuration; breadcrumb/back; independent draft; drill history; segment comparisons; pin copy to chosen dashboard; deliberate origin update with conflict detection; preserve dashboard scroll/layout. |
| Presentation | Light/dark themes; palettes/per-series colors; conditional colors; KPI targets/reference lines; units/decimals/currency/percent; readable loading/empty/errors; responsive layout; keyboard/screen-reader support. |
| Save and recovery | Explicit save and recoverable draft autosave; dirty indicator; query/layout undo/redo; local saved revisions/restore; duplicate before experimentation; quota/read errors; corrupt-data recovery; stale-write detection; schema migration and untouched legacy backups. |
| Analytical trust | Durable dataset binding; full/preview/snapshot scope; metric/filter explanations; source/lineage inspector; manual refresh with truthful timestamps; schema-change validation; cancellation/stale-response isolation; clearly labeled last successful result after failed refresh. |
| Connected sources | Uploads and Data Hub; compatible governed workspace joins through the existing relationship engine; explicit dataset/field remapping on import; visible unsupported join/field failures. Never substitute a primary table for a joined analysis. |
| AI integration | Gallery and AI Chart inside Analytics; send selected context to AI Chat; save verified AI results to chosen dashboard; preserve grounding and duplicate detection; open actual destination after save; repair ineffective chart Pin action. |
| Reporting and portability | CSV results; chart PNG; dashboard PDF/print presentation; validated JSON import/export of definitions with deliberate dataset remapping; preserve title/filter/limit/timestamp/snapshot labels in reports. |
| Professional usability | Searchable actions/keyboard shortcuts; undo/redo shortcuts and accessible alternatives; field examples; useful no-data onboarding/templates; deliberate destructive actions; dense/comfortable layout; no decorative nonfunctional controls. |

Server scheduling, email alerts, organization accounts, real-time collaboration and access-controlled team publishing need separate infrastructure and remain outside this local rebuild. Templates, advanced calculations, joined analysis, reporting and recovery above are in scope now. No mock sharing, fake freshness or invented anomaly claims.

## Mandatory experience design

The main canvas receives most of the screen. The header contains the current object name, dataset context, save state and primary actions. The left rail switches between a searchable asset library and typed fields; it is collapsible. The right inspector edits the selected chart/tile or query properties without covering the result. The results table expands below the analysis canvas. Panels collapse into accessible drawers on narrow screens; avoid nested page scroll areas and oversized empty welcome cards.

Dashboard mode provides a working board with edit/view/presentation controls. Analysis mode provides a visual builder with measure, dimension, time and filter roles and an immediate chart/table result area. They share selection, source context, style language and saved objects. Opening a tile for investigation changes the working object inside this shell, retains origin/breadcrumb context and offers separate Save analysis, Pin copy and Update original actions.

First use offers blank or template dashboard creation and Start analysis from a dataset. Templates must generate editable real objects, not static screenshots or invented business results. Returning users see their actual saved work and recoverable drafts. The library is a functional navigation tool with search, favorites and recents, not a decorative row of cards.

Use the existing themes as the foundation but redesign spacing, typography, hierarchy, chart framing, controls and panel composition throughout Analytics. Match the visual quality of a dedicated analytics application. Both themes, keyboard focus, field selection, validation, pending queries, save errors and empty states are part of the design requirement.

## Architecture and delivery rules

Navigation spans App, SideBar, MenuBar, DestinationHome and CanvasContainer. Introduce a central Analytics destination adapter, mapping legacy explore/dashboards actions into one shell. Build focused shell, library, query builder, results, dashboard editor and inspector components under `frontend/frontend/src/features/analytics/`. Reuse established chart/grid/theme primitives where appropriate. Replace obsolete orchestration instead of embedding a competing application inside CanvasContainer.

Use one collection owner for durable objects and separate recoverable editing drafts. Local revisions and undo stacks must be bounded by retention and storage capacity. Do not persist full source data in every analysis or autosave the entire collection on every pointer movement. Decide any storage upgrade from measured collection size and recovery requirements; retain portable versioned records and legacy backups.

Define typed versioned query/result contracts for multiple measures, pivots, calculations, comparisons, detail rows and relationship-backed sources. Reuse metric and relationship execution instead of duplicating their semantics. Separate execution from chart formatting so charts, tables, dashboards and exports share one result. Do not retain raw chart-helper arithmetic as a competing Analytics engine.

Codex must verify current source before assuming any earlier backend patch or migration exists. Extend contracts and tests before dependent UI implementation. Required features unsupported today remain implementation obligations; they are not automatically deferred. Preserve AI Chat, ML Studio, Data Hub and Data Model outside the replaced Analytics paths.

## Implementation sequence

### 1. Establish the Analytics architecture and execution contracts

**Lead** — Codex. Trace source identity, query execution, metric definitions, filters, pinning, AI results and navigation. Produce a capability matrix mapping every catalogue row to existing behavior, required backend changes, frontend work and acceptance fixtures. Design the shared query/result and versioned collection contracts for the entire rebuilt product, with additive implementation stages.

Implement source-safe baseline queries, validate temporal and empty-result behavior, and define migration preserving identities, layouts, filters, snapshots and repeat-save semantics. Define local drafts/revisions, failure recovery and import/export boundaries. Assess governed relationships and full-data versus preview execution explicitly. Prepare the new shell's concrete state/interaction contract so visual implementation can start without waiting for every advanced computation.

**Exit** — The architecture covers the full feature catalogue, baseline behavior is tested, and the first source-backed frontend assignment is ready. Contract work is a dependency, not delivery of Analytics.

### 2. Replace both destinations with the Analytics application

**Lead** — Antigravity, with Codex review between bounded assignments. Deliver collection migration, the full-width shell, real asset library, shared dataset context, central navigation integration and library CRUD. Add favorites, tags, recents and last-object restoration. Build a substantial new interface rather than preserving the old landing screens. Legacy launch actions route to the corresponding object/action inside Analytics.

Sequence assignments by dependency: collection migration; reusable shell/library composition; navigation integration; persisted library actions. Each has exact files, one state boundary and observable acceptance. Components may be built before app wiring to keep reviews bounded, but an unmounted shell is intermediate work, never completion.

**Exit** — One Analytics entry opens the new application with actual saved objects. Old primary landing screens are retired. Users can create/open/manage work, restore selection and reach existing entry points. Existing tile IDs, layouts, filters and snapshots survive reload; corrupt data and failed writes remain recoverable. Every exposed action functions.

### 3. Deliver the analytical engine and visual analysis workbench

**Lead** — Codex for backend/contract work, then Antigravity for each proven interaction. Implement the full query-builder, visualization, pivot, calculation and time-intelligence catalogue. Backend assignments cover explicit source and relationship execution; multiple measures/groups; pivot/calculation/comparison semantics; and detail queries/capability metadata. Each precedes its dependent UI assignment and includes numerical fixtures.

Define histogram binning and boundaries, scatter row/aggregation scope, percentage denominators, null behavior, percentile interpolation, pivot totals, calculation order, week starts and partial-period comparison semantics. Validate calculated expressions with an allowlisted parser, not arbitrary code evaluation. Add bounded result sizes, request identity/cancellation and cache invalidation. Dataset or metric changes require revalidation, never silent substitution.

**Exit** — Users build, format, save and reopen analyses with every required chart and computation. Tables and charts use the same results; raw fields work without model setup. Ordinary and joined sources remain correctly bound. Invalid or stale queries preserve drafts and cannot overwrite the latest result.

### 4. Deliver complete dashboard authoring and monitoring

**Lead** — Antigravity with Codex contract/review ownership. Build editable starter templates, chart/KPI/text/section tiles, inspector formatting, targets/reference lines, scoped filters and grid editing. Include view/edit/presentation modes, undo/redo, saved revisions and bounded recoverable autosave. Configure analytical tiles through the shared analysis workbench rather than a second incompatible builder.

**Exit** — Users create a useful multi-tile dashboard, customize its visuals and layout, apply filters with visible scope, save/reload and restore a revision. Templates are editable, snapshots remain identified, and incompatible dataset fields cannot silently affect queries. Empty/unavailable data produces an actionable state.

### 5. Connect investigation, AI and reporting

**Lead** — Codex for integration contracts and Antigravity for bounded interactions. Deliver cross-filtering, category/detail drilldown, segment/time comparisons, drill history, origin updates, selected-dashboard pinning and AI entry points. Add CSV/PNG/PDF exports and validated JSON portability with source remapping. Use common query results and exact effective filters throughout.

**Exit** — Users can spot a movement, select a segment, inspect underlying rows, compare periods, save an analysis, pin/update a tile and produce a report without rebuilding context. Origin updates are deliberate and conflict-aware. AI saves target the correct dashboard and stay idempotent there. Reports disclose filters, limits and snapshot/live scope.

### 6. Harden the integrated product and retire duplicate paths

**Lead** — Codex integration review with bounded Antigravity repairs. Verify the entire catalogue, remove duplicate primary Explore/Business Monitoring paths and resolve theme/accessibility/responsive/large-result issues. Exercise corruption, quota, stale identity, schema change and draft recovery. Reconcile contracts with actual implementation before user acceptance.

**Exit** — Every required capability has implementation and acceptance evidence. Core journeys contain no dead buttons, lost drafts or unrelated datasets. The visual replacement is substantial. Final browser acceptance stays in chat and belongs to the user.

## Definition of done

The rebuild is incomplete if delivery stops at persistence, a renamed sidebar, a basic three-chart builder, an unmounted shell, or old screens behind a shared header. Core catalogue features cannot be silently reassigned to future work. A technical blocker must name its affected requirement, evidence and resolution path; it does not remove the requirement.

Every capability must have an owner, contract, implementation location and verification evidence before release. Use the capability matrix to prevent feature lists from becoming untracked promises. Bounded gates continue until this full definition of done is met or a concrete blocker is recorded. A migration, shell or individual interaction handoff must never be presented as completion of the rebuild.

## Engineering verification before release

- Check migration and reload with an existing v1 dashboard, legacy-only storage, malformed current data, and a failed write. Verify layouts, references, filters, snapshots and repeated migration in [WindowContext tests](../../../frontend/frontend/src/context/WindowContext.test.jsx) and storage tests.
- Compare analysis, dashboard, pivot, comparison and export results on common numerical fixtures. Cover multiple measures, totals, calculation order, nulls, typed filters, date boundaries, week starts, zero denominators, partial periods, sorting/top N and empty rows. Prove independent drafts cannot mutate their origin until explicitly applied.
- Verify that saved analyses reopen, pinning targets the chosen dashboard, deletion requires a deliberate action, and AI Chat save and dashboard-open flows still work. Check keyboard navigation and save and error feedback in both Analytics views.
- Exercise rapid dataset changes and late query responses; joined-source identity; detail-row permissions; undo/redo; saved revision restoration; autosave limits; corrupt/unknown storage; conflicting writes; import remapping and malicious expression/CSV inputs. Last successful results must be labeled when stale.
- Verify both themes and representative wide desktop, tablet and narrow layouts; keyboard-only operation and accessible chart/table alternatives. Verify bounded rendering for large result sets and no query loops on every keystroke. Browser actions require explicit authorization; engineering assertions do not claim user acceptance.
- Run focused frontend tests and `npm run build` from `frontend/frontend`. Run focused backend tests and compile changed Python modules if query contracts change. Run the repository harness, active-gate validator when applicable, and `git diff --check` before control returns. Final browser acceptance belongs to the user.
