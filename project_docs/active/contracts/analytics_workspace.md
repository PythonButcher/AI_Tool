# Analytics workspace contract

## Ownership and boundaries

Codex owns the engine and studio redesign under the user's explicit authorization. The [roadmap](../analytics/README.md) defines required scope and [delivery evidence](../analytics/capability_evidence.md) tracks verification. Analytics runs as a local, single-user workspace.

## Query API

`POST /api/analytics/query` accepts `source`, `query`, optional `dataset`, `semantic_model`, `metadata_only` and `expected_fingerprint`. It returns `schema_version: 1`. The source is mandatory:

| kind | Required identity | Execution |
| --- | --- | --- |
| inline | `id`, attached `dataset` row objects | Exact attached table; optional matching semantic model. Frontend checks content identity before sending. Scope is explicitly unknown unless supplied. |
| datahub | `id` | Stored dataset only; never active fallback. Stored governance policy is enforced. |
| workspace | `analysis_context` | Existing relationship executor validates workspace/model versions, joins and governance. No primary-table substitution. |

`query` has `mode: aggregate | rows | histogram | pivot`, `measures`, `group_by`, `filters`, optional `period`, `comparison`, `sort`, `limit`, `offset`, `columns`, `field`, `bins`, and `normalize_stack`. Inline requests are capped at 100,000 rows; resolved tables at one million rows. Results are capped at 10,000 rows, groups at 20,000, measures at 12, grouping fields at four, and detail columns at 100. These are local execution limits, not claims that the source itself is small.

Each measure has a unique identifier `id` and either a raw `field` with `aggregation`, a governed `metric_id`, or an arithmetic `formula` over earlier measure IDs. Raw aggregations are sum, avg, min, max, count, count_distinct, count_rows, median and percentile. Percentile uses `percentile` in [0,1] and linear interpolation. Count excludes nulls; row count includes all matching records. Sum/min/max/average/median of missing numeric values is null. Governed metric definitions and their built-in filters remain authoritative.

Formulas accept finite numbers, preceding identifiers, parentheses and + - * /. Calls, attributes, indexing and arbitrary execution are rejected. Zero division and missing operands produce null. Formulas execute on base aggregates before post-calculations. Optional `post` is none, percent_total, running_total, moving_average, rank or cumulative_percent. Post-calculations run over the sorted complete groups before result limits. Moving averages use `window` 1–100 and include shorter initial windows. Rank is descending with ties sharing the minimum rank. Percentage calculations return 0–100 values; formula ratios are ordinary numbers. `summary` contains base totals reaggregated from matching source rows, never sums of displayed averages or ranks. Percentage stacks normalize each displayed group across nonnegative measures; summary remains base totals.

Groups use `{field, grain?}`. Grains are day, week, month, quarter and year. Dates use UTC; weeks begin Monday. A date `period` is `{field,start,end}` or `{field,last_days,end?}`. End dates include the entire UTC day. Relative dates end today unless an end date is supplied. Numeric date encodings require conversion. Invalid non-null dates fail rather than disappearing silently. Boundary buckets can be partial and the interface states that completeness is unknown.

Filters are arrays (implicit AND), leaf rules `{field,operator,value?,values?,type?}`, or `{op: and|or,rules:[...]}`. Supported operators are eq, neq, gt, gte, lt, lte, in, not_in, contains, is_null, and not_null. A date-only comparison uses the entire UTC calendar day for equality and inclusive upper boundaries. Date membership lists match UTC instants. Contains is literal and case-insensitive. Maximum nesting is five levels, with 30 child rules per group and 1,000 membership values. Dashboard filters intersect with a matching live tile's query filters and both populations of segment comparisons. Dashboard filters carry the source identity and optional tile IDs. AI snapshots remain immutable. Unknown fields and unavailable sources produce visible errors.

Comparison `kind` is previous_period, previous_year, custom (start/end), or segment (independent filters). Temporal comparison retains categorical filters and changes the date interval. Segment comparison replaces the main filter tree with the baseline's complete tree and shares the same date period. Temporal trends align by position in the requested period and preserve other category keys. Segment trends align category keys. Missing matches are null. Percentage delta is `(current-baseline)/abs(baseline)*100`; missing/zero baselines produce null. Totals and deltas cover the entire matching populations before limits.

Pivot treats the last grouping field as columns and earlier fields as rows. Multiple measures are supported. Row, column and grand totals independently reaggregate source records, preserving averages and ratios. Post-calculation pivots are rejected. Histogram bins use numeric data, a bounded bin count and explicit start/end values; the final bin includes its upper boundary. Scatter displays bounded detail rows for two selected numeric fields. Table rows use the same execution result as charts and exports.

Response fields are `dataset` (identity, fingerprint, source_row_count, scope), `fields` (name, type, examples), `metrics`, `analysis_lineage`, `executed_at`, `columns`, `rows`, `summary`, `pivot`, `comparison`, `row_count`, `total_result_rows`, `limit`, `offset`, `truncated`, `filters` and `period`. Metadata-only calls return source/schema information and recognize valid ISO dates in text columns. `executed_at` records query time. `expected_fingerprint` rejects changed source contents when provided. Normal queries revalidate fields on every run.

Validation failures return 400 `{error,code}`; unexpected failures return a safe 500 message and are logged. Missing, stale and unavailable sources never select another source automatically. Frontend cancellation aborts waiting and rejects stale responses; it does not promise termination of synchronous server computation.

## Collection and recovery

The sole collection owner is `useAnalyticsWorkspace`, exposed through WindowContext. Local storage key `analyticsWorkspace:v1` contains `schemaVersion:1`, increasing `revision`, `activeDashboardId`, `activeAnalysisId`, `lastView`, `dashboards`, `explorations`, `drafts`, `templates`, `recent`. Dashboard records contain `state`, `items`, and bounded `revisions`; analyses contain identity/name/config, optional cached result, tags/favorite/timestamps and revisions. Analyses store source identities, not full attached source tables.

Migration reads `chartStudioDashboard:v1`, then `businessMonitoringDashboard`, preserving item IDs, layouts, filters, snapshots and unknown metadata. Legacy keys remain untouched. A damaged current value is never overwritten automatically. Recovery preserves original bytes under a timestamped recovery key before restoring the displayed backup. Unknown schema versions require recovery. Read/parse/quota errors are visible. Failed writes retain a pending candidate for retry/export; saved state is acknowledged only after storage succeeds. Stale writes compare original serialized storage bytes before committing; this detects observed conflicts but is not a cross-process atomic transaction.

Drafts autosave after 800 ms and are preserved synchronously before switching analyses. Saved objects and editing drafts are independent. Query undo retains 30 entries, dashboard undo 20 and saved revisions ten. Revisions restore through ordinary persistence and failure handling. Import validates the version and object identities, creates new IDs, retains current work, and marks imported sources for deliberate confirmation. Field remapping updates groups, measures, filters, dates and detail columns without changing metric or measure identities. Live execution stays blocked until source confirmation; backend validation then checks every field.

Dashboard state can carry an `analyticsSource` for overview creation and the filter editor. Each tile retains its own query source. Starter layouts use the selected dataset's measures, dates and categories where available, with a numeric distribution when appropriate. Live tiles without cached results query on open.

## Integration and reporting

The Tools row opens one docked drawer for workspace actions, Change Explorer, library, formatting, reports, AI and charts, and revisions. Dashboard toolbar actions and the drawer share the dashboard state, filter editor, and refresh operation.

[Change Explorer](../analytics/change_explorer.md) compares record count or a numeric sum over two disjoint UTC periods. Opening a driver in Analysis carries over the exact source, periods, metric, and filters. The generated equality filter uses `type: "segment"` to preserve typed segment identity, including null labels. Editing the generated clause in the ordinary builder switches it to the selected filter's normal semantics.

Legacy destination requests `explore` and `dashboards` resolve to `analytics` with the corresponding inner view. The sidebar has one Analytics entry. Gallery selection opens an independent analysis draft. AI Chart remains reachable. Chart Pin inserts a real tile in a chosen dashboard. AI Chat saves verified immutable snapshots to a chosen dashboard, deduplicating by grounded result key within that dashboard. Write failures do not report success. Opening the dashboard selects the saved target.

Analytics-to-chat context is a deliberate composer draft, never an automatic provider call. Explicit Data Hub/workspace context excludes unrelated attached rows; inline context checks the exact attachment. The source is visible and can be cleared. Earlier chat session context cannot override that selection. AI answers remain subject to existing grounding rules.

Investigation copies a tile query plus effective filters into an independent draft. Pin copy creates a separate tile. Update original checks that the original tile still exists and matches the captured record, preserving layout and rejecting concurrent edits. Dashboard live refreshes keep the last successful result on errors and identify stale data. Imported and AI snapshot tiles remain visibly distinct.

CSV exports use the displayed result's columns/order and neutralize spreadsheet-formula strings. PNG exports the chart. PDF/print reports include visible titles, execution times, result limits and scope labels. Versioned JSON offers full workspace backup and live definitions without cached live results; immutable AI snapshots retain their grounding. Imports never execute automatically. Local templates contain live definitions/layout/notes and exclude fixed AI snapshots.

## Verification

Run `tests/test_analytics_query.py` with the repository Python path; run focused tests under `features/analytics`, WindowContext, AI Chat and navigation; then the frontend production build, Python compilation, repository harness and whitespace checks. Browser acceptance belongs to the user. Engineering tests do not assert visual acceptance or live provider quality.
