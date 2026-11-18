# Analytics capability evidence

This maps the required [catalogue](README.md) to the working implementation and its verification. It is not a release acceptance claim. Functional integration is in progress; Antigravity's visual pass follows engineering verification. The [contract](../contracts/analytics_workspace.md) defines execution and persistence semantics.

| Required area | Implementation | Evidence / remaining verification |
| --- | --- | --- |
| Unified application | AnalyticsShell; analyticsNavigation; App, CanvasContainer, SideBar, MenuBar | Mounted destination and legacy aliases; navigation tests and final build required. |
| Asset library | Shell collection CRUD/search/tags/favorites/recents and independent drafts | Shell save/reload/draft tests pass; broader lifecycle assertions in progress. |
| Visual builder | AnalyticsBuilder; backend query | Multiple fields/measures, drag/click roles, nested filters, grains and limits; numerical fixtures pass. |
| Visualizations | AnalyticsResult; executionQuery | Fifteen views, role validation and suggestions; renderer fixtures and final build required. |
| Tables/pivots | ResultTable/PivotTable; aggregate/pivot execution | Correct average totals and paging fixtures pass; display/export assertions in progress. |
| Metrics/calculations | query.py aggregation/formula/post-calculation pipeline | Nine aggregation fixtures, unsafe-expression cases and post-calculation tests pass. Definitions exposed in builder/source inspector. |
| Time intelligence | query.py period/comparison/alignment; Builder and Result | Inclusive dates, grains, zero baseline and aligned-series fixtures pass. Partial bucket notice is explicit. |
| Dashboard composition | AnalyticsDashboard; AnalyticsNote; templates and inspector | Real grid/layout/locks, text/Markdown/sections, local templates; integration fixtures in progress. |
| Interactive monitoring | Scoped dashboard filters, chart/table selection, date range selectionFilter | Dataset/tile scope and snapshots distinguished; filter/drill fixtures in progress. |
| Investigation | Shell investigate/pin/origin conflict checks, segment comparison | Independent draft and stale-pin tests pass; origin update/conflict test required. |
| Presentation | Shared theme, AnalyticsAppearance, Result, shell CSS | Palettes/series/conditional colors, targets/units, responsive panels; enterprise visual polish implemented across Shell, Builder, Result, Dashboard and CSS with zero Analytics ESLint warnings. |
| Save/recovery | analyticsStorage and useAnalyticsWorkspace | Migration, corruption, quota, stale-write, independent draft, retry and insertion identity tests pass. |
| Analytical trust | Explicit-source query contract, metadata inspector, abort/sequence guards | Source/lineage/fingerprint, missing fields and stale-response tests pass. Live freshness is never inferred. |
| Connected sources | inline/DataHub/workspace source resolver and field remapper | Governed workspace identity and Data Hub policy fixtures pass; real-data smoke check required. |
| AI integration | analyticsChatBridge; AIShell; WindowContext; SmartChartWindow | AI regression suite, explicit target/deduplication and bridge tests pass; receiver integration assertions required. |
| Reporting/portability | CSV/PNG/PDF/print, validated collection imports/exports | CSV safety and remapping tests in progress; actual browser download/layout verification remains unperformed. |
| Professional usability | Actions search, shortcuts, typed fields/examples, density/focus, destructive confirmations | Accessible controls, anchored command popover, segmented mode switcher, 2-column builder cards and testable table alternatives implemented. |

## Current engineering evidence

- 36 focused Analytics backend query tests (`tests/test_analytics_query.py`) and 70 combined Analytics and AI backend tests passed. Changed Python modules compile.
- 26 focused Analytics and WindowContext frontend tests across 6 suites (`AnalyticsShell`, `analyticsStorage`, `analyticsTransforms`, `analyticsChatBridge`, `analyticsNavigation`, `WindowContext`) passed.
- Enterprise visual polish applied across `AnalyticsShell.jsx`, `AnalyticsShell.css`, `AnalyticsBuilder.jsx`, `AnalyticsResult.jsx`, and `AnalyticsDashboard.jsx` with zero ESLint warnings in `src/features/analytics/`.
- The frontend production build (`npm --prefix frontend/frontend run build`), `agent_harness_check.py`, `ci_harness_check.py`, `check_active_gate.py`, and `git diff --check` all passed. Browser acceptance belongs to the user.
