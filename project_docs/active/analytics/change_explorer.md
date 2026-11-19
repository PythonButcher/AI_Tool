# Change Explorer

## Behavior

Change Explorer turns a KPI comparison into an auditable bridge from the baseline to the current value. It ranks segment contributions and separates changes in observation volume from changes in the average value per observation. The tool describes arithmetic drivers and their observed values.

The Analytics drawer exposes a comparison form, an interactive waterfall, driver details, and CSV export. Opening a driver in Analysis preserves the metric, periods, source, and effective filters. The [Analytics contract](../contracts/analytics_workspace.md) defines typed segment equality for drills. Dashboard-wide filters for the selected source can carry into the comparison. Tile-specific filters retain their tile scope.

## Endpoint contract

`POST /api/analytics/change-explorer` accepts the explicit-source request fields `source`, optional inline `dataset` and `semantic_model`, and optional `expected_fingerprint`. It resolves the source once and preserves governance and workspace lineage. The comparison accepts `date_field`, `segment_field`, `baseline: {start, end}`, `current: {start, end}`, optional shared `filters`, `metric: {aggregation: "count_rows" | "sum", field?}`, and an optional integer `limit` (default 12, range 1–30). Dates are inclusive YYYY-MM-DD in UTC. The baseline must end before the current period starts. Existing row limits and a 20,000 distinct-segment cap bound execution. Validation errors use the Analytics 400 shape and unexpected failures use its safe 500 shape.

Return `schema_version: 1`, `dataset` with existing identity, scope, fingerprint, and source-row-count semantics, `analysis_lineage`, `executed_at`, `baseline`, `current`, `date_field`, `segment_field`, `metric`, `segment_count`, `totals`, and `drivers`. The comparison totals and every driver carry the same numeric fields `baseline_value`, `current_value`, `delta`, `baseline_count`, `current_count`, `volume_effect`, and `rate_effect`. Each driver also carries `kind: "segment" | "missing" | "other"` and `segment` (source scalar or null). The missing segment includes null labels. The other row aggregates all omitted contributions and appears last only when needed. Rank regular rows by descending absolute delta with deterministic ties. Counts are matched row counts for count_rows and non-null numeric observations for sum. Empty period contributions are zero. Reject invalid nonnumeric values with a useful error. Keep exact underlying precision and expose finite JSON.

For sum, compute count × mean per segment. Use symmetric two-factor attribution: volume effect is count change times the average of both period means and rate effect is mean change times the average of both counts. An absent cohort uses the observed period's mean for attribution, giving its entrance or exit entirely to volume. When both counts are zero, the contributions are zero. For count_rows the full change is volume. Sum segment contributions into total effects and aggregate omitted rows without recomputing a blended mean. Within numeric tolerance, every row reconciles, shown rows including other add to totals, and current minus baseline equals total delta. Preserve both populations under identical filters.

## Verification

Numerical and Flask fixtures in `tests/test_analytics_change_explorer.py` cover offsetting segments, factor reconciliation, typed drills, missing and omitted segments, dates, filters, source identity, and limits. `AnalyticsShell.test.jsx` covers the drawer, the request contract, retained results, and the transition to the filtered analysis.
