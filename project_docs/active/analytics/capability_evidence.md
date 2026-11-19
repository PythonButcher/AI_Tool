# Analytics capability evidence

This maps the required [catalogue](README.md) to implementation and verification evidence. The [contract](../contracts/analytics_workspace.md) defines execution and persistence, and [execution status](../status/project_execution_status.md) records current ownership and acceptance.

| Required area | Implementation | Evidence / remaining verification |
| --- | --- | --- |
| Unified application | AnalyticsShell, analyticsNavigation, and app navigation | One 52 px Analytics bar with a workspace switcher, mode, dataset, and contextual actions. Focused navigation tests cover the mounted destination and legacy aliases. |
| Asset library | Shell collection CRUD/search/tags/favorites/recents and independent drafts | Shell save/reload/draft tests pass; broader lifecycle assertions in progress. |
| Visual builder | AnalyticsBuilder; backend query | Multiple fields/measures, drag/click roles, nested filters, grains and limits; numerical fixtures pass. |
| Visualizations | AnalyticsResult; executionQuery | Fifteen views, role validation and suggestions; renderer fixtures and final build required. |
| Tables/pivots | ResultTable/PivotTable; aggregate/pivot execution | Correct average totals and paging fixtures pass; display/export assertions in progress. |
| Metrics/calculations | query.py aggregation/formula/post-calculation pipeline | Nine aggregation fixtures, unsafe-expression cases and post-calculation tests pass. Definitions exposed in builder/source inspector. |
| Time intelligence | query.py period/comparison/alignment; Builder and Result | Inclusive dates, grains, zero baseline and aligned-series fixtures pass. Partial bucket notice is explicit. |
| Dashboard composition | AnalyticsDashboard, AnalyticsNote, templates and inspector | Starter layouts query dataset fields. Integration tests cover one-click generation and undo. Editable tiling, notes, sections, and templates are available. |
| Interactive monitoring | Scoped dashboard filters, chart/table selection, date range selectionFilter | Frontend tests confirm dataset scoping and applying filters to both segment populations. Backend tests cover typed date boundaries and membership. |
| Investigation | Shell investigate/pin/origin conflict checks, segment comparison | Focused tests cover independent drafts, stale pins, origin updates, and origin conflicts. |
| Presentation | Shared theme, AnalyticsAppearance, Result, shell CSS | Dashboard blueprint and chart-centered workbench use both shared themes. Inspector exposes palettes, series colors, targets, number formats, and axis labels. |
| Save/recovery | analyticsStorage and useAnalyticsWorkspace | Migration, corruption, quota, stale-write, independent draft, retry and insertion identity tests pass. |
| Analytical trust | Explicit-source query contract, metadata inspector, abort/sequence guards | Source/lineage/fingerprint, missing fields and stale-response tests pass. Live freshness is never inferred. |
| Connected sources | inline/DataHub/workspace source resolver and field remapper | Governed workspace identity and Data Hub policy fixtures pass; real-data smoke check required. |
| AI integration | analyticsChatBridge; AIShell; WindowContext; SmartChartWindow | AI regression suite, explicit target/deduplication and bridge tests pass; receiver integration assertions required. |
| Reporting/portability | CSV/PNG/PDF/print, validated collection imports/exports | Chrome verified PDF generation from rendered results. CSV safety and remapping have focused tests. |
| Professional usability | Docked tools drawer, shortcuts, typed fields, density, focus, and confirmations | Dashboard and Analysis share one drawer with labeled tool groups. Chrome verified narrow Focus exit and the drawer's placement below the tools row. |
| Change attribution | Change Explorer endpoint, waterfall, factor details, and typed segment drill | Chrome with fixture data verified a flat total with offsetting segment movements and opened the exact segment and periods in Analysis. |

## Current engineering evidence

- 74 focused Analytics backend tests passed, and the changed Python modules compiled.
- 56 frontend tests across Analytics, WindowContext, and AI Chat passed.
- The production build passed. Chrome on an isolated retail-orders fixture confirmed the overview, investigation, responsive header, theme switching, and PDF generation. Browser acceptance belongs to the user.
