# Dashboard Canvas State Contract

This document defines the local-first dashboard canvas state for Phase 4 dashboard layout and sharing skeleton work. It is a frontend contract for `chartStudioDashboard:v1`; it does not define a backend API.

The contract is additive. Existing dashboard state and pinned chart/KPI items must continue loading. Missing fields should be normalized in memory and then persisted back to the versioned local storage key without deleting the old `businessMonitoringDashboard` fallback key.

## Storage

Current local storage key:

`chartStudioDashboard:v1`

Legacy fallback key:

`businessMonitoringDashboard`

The app should read `chartStudioDashboard:v1` first. If it is missing or invalid, it may read `businessMonitoringDashboard`, normalize the data into the v1 canvas shape, and save the normalized v1 value. Do not delete, clear, or rewrite the legacy key during this slice.

## Top-Level Shape

The stored value should remain a single object with dashboard state and item arrays so it is compatible with the current `WindowContext.jsx` pattern.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `state` | `DashboardCanvasState` | Yes | Dashboard-level metadata, filters, mode, canvas settings, and sharing skeleton metadata. |
| `items` | `DashboardCanvasItem[]` | Yes | Pinned charts, KPI cards, and future dashboard item types. |

## DashboardCanvasState

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Stable dashboard id. Existing default can remain `dashboard-primary`. |
| `name` | `string` | Yes | User-facing dashboard name. |
| `description` | `string` | No | Optional dashboard description for future sharing/export surfaces. |
| `isVisible` | `boolean` | Yes | Preserve existing visibility behavior if still used by the app. |
| `mode` | `string` | Yes | `edit` or `view`. Missing values normalize to `edit`. |
| `filters` | `DashboardFilters` | Yes | Existing dashboard slicer/filter object from `dashboardFilterUtils.js`. |
| `canvas` | `DashboardCanvasSettings` | Yes | Grid and layout behavior settings. |
| `sharing` | `DashboardSharingSkeleton` | Yes | Local-only future sharing metadata. |
| `layoutVersion` | `integer` | Yes | Current value should start at `1` for the canvas layout shape. |
| `updatedAt` | `string` | No | ISO timestamp for local change tracking. |

## DashboardCanvasSettings

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `columns` | `integer` | Yes | Desktop grid column count. Suggested default: `12`. |
| `rowHeight` | `integer` | Yes | Grid row height in pixels. Suggested default: `40` to `48`. |
| `margin` | `number[]` | Yes | Two-value grid margin such as `[16, 16]`. |
| `containerPadding` | `number[]` | Yes | Two-value container padding such as `[16, 16]`. |
| `compactType` | `string \| null` | Yes | `vertical`, `horizontal`, or `null`, matching `react-grid-layout` semantics. |
| `preventCollision` | `boolean` | Yes | Whether grid items can overlap. Suggested default: `false` for flexible authoring unless UX testing says otherwise. |
| `layoutVersion` | `integer` | Yes | Current canvas settings version. Suggested default: `1`. |

## DashboardCanvasItem

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Stable item id. Existing chart/KPI ids must be preserved. |
| `itemType` | `string` | Yes | Existing values include `chart` and `kpi`. |
| `title` | `string` | Yes | Display title. Normalize from chart spec title, KPI title, or item type fallback. |
| `layout` | `DashboardItemLayout` | Yes | Grid position and size. |
| `locked` | `boolean` | Yes | If true, item cannot move or resize in edit mode. |
| `display` | `DashboardItemDisplay` | Yes | Local presentation preferences. |
| `sourceMetadata` | `DashboardItemSourceMetadata` | Yes | Local source lineage for user-facing labels and future sharing/export. |
| `chartSpec` | `object \| null` | No | Existing `content.chartSpec`-compatible object for chart items when available. |
| `chartType` | `string` | No | Existing chart type field for compatibility. |
| `mapping` | `object` | No | Existing raw chart mapping for compatibility. |
| `semanticConfig` | `object` | No | Existing semantic chart/KPI configuration for compatibility. |
| `localSlicers` | `object[]` | No | Chart-local slicers when supported. Defaults to `[]`. |
| `createdAt` | `string` | No | ISO timestamp when item was created locally. |
| `updatedAt` | `string` | No | ISO timestamp when item was last changed locally. |

## DashboardItemLayout

Use grid coordinates compatible with `react-grid-layout`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `x` | `integer` | Yes | Grid x coordinate. |
| `y` | `integer` | Yes | Grid y coordinate. |
| `w` | `integer` | Yes | Grid width. |
| `h` | `integer` | Yes | Grid height. |
| `minW` | `integer` | No | Optional minimum width. |
| `minH` | `integer` | No | Optional minimum height. |
| `maxW` | `integer` | No | Optional maximum width. |
| `maxH` | `integer` | No | Optional maximum height. |
| `static` | `boolean` | No | Mirrors locked state for `react-grid-layout` when useful. |

Suggested defaults:

Charts: `w: 6`, `h: 8`, `minW: 3`, `minH: 5`.

KPI cards: `w: 3`, `h: 4`, `minW: 2`, `minH: 3`.

Default positions must be deterministic and should not stack all migrated items at `x: 0, y: 0`.

## DashboardItemDisplay

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `showHeader` | `boolean` | Yes | Whether the canvas item header is visible. Suggested default: `true`. |
| `compact` | `boolean` | Yes | Compact card chrome. Suggested default: `false`. |
| `showLegend` | `boolean \| null` | No | Chart preference when supported. `null` means use chart default. |
| `accent` | `string \| null` | No | Optional future visual accent token. |
| `paletteId` | `string \| null` | No | Optional local palette choice for chart rendering. `null` means use the app default palette. |
| `seriesColors` | `object` | No | Optional local chart color overrides keyed by stable dataset label or series id. Values should be valid CSS colors. |
| `customColors` | `string[]` | No | Optional ordered local palette colors for charts that need category or slice colors. Values should be valid CSS colors. |

Chart appearance fields are local presentation preferences. They must not change backend chart, metric, slicer, or decision contracts. If unsupported or invalid colors are found during migration, normalize to the default palette instead of blocking chart rendering.

## DashboardItemSourceMetadata

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `sourceSurface` | `string` | Yes | `dashboard`, `ai_chat`, `chart_window`, `explore`, or `unknown`. |
| `sourceMode` | `string` | Yes | `raw`, `semantic`, or `unknown`. |
| `sourceArtifactId` | `string \| null` | No | AI Chat artifact id or other source id when known. |
| `datasetName` | `string \| null` | No | User-facing dataset label when available. |
| `createdByLabel` | `string \| null` | No | Local-only author label placeholder. |

## DashboardSharingSkeleton

This object is local-only. It must not imply real auth, permissions, live sharing, team access, or backend sync.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `enabled` | `boolean` | Yes | Suggested default: `false`. Indicates the sharing skeleton panel has local metadata, not real sharing. |
| `status` | `string` | Yes | `local_draft`, `not_connected`, or `ready_for_future_backend`. |
| `ownerLabel` | `string` | No | Local owner label. No identity guarantee. |
| `visibility` | `string` | Yes | Suggested values: `private_local`, `team_placeholder`, `selected_people_placeholder`. |
| `intendedRecipients` | `string[]` | Yes | Local labels only. No invites are sent. |
| `teamPlaceholders` | `string[]` | Yes | Local team labels only. |
| `shareNotes` | `string` | No | User notes for future sharing. |
| `lastPreparedAt` | `string \| null` | No | ISO timestamp when the skeleton metadata was last updated. |
| `authRequired` | `boolean` | Yes | Must be `true` for real sharing; communicates future requirement. |
| `backendConnected` | `boolean` | Yes | Must be `false` in this slice. |

Recommended user-facing copy should say the sharing setup is local and future-facing. Avoid copy such as `Invite sent`, `Public link copied`, `Access granted`, or `Shared with team`.

## Migration Rules

If existing `state.mode` is missing, normalize to `edit`.

If existing `state.canvas` is missing, create default canvas settings.

If existing `state.sharing` is missing, create a local skeleton with `status: local_draft`, `authRequired: true`, and `backendConnected: false`.

If an item is missing `layout`, assign a deterministic slot based on item order and item type. Do not overlap all items at the origin.

If an item is missing `locked`, normalize to `false`.

If an item is missing `display`, create default display preferences.

If an item is missing `sourceMetadata`, infer safe local metadata from existing fields. Use `unknown` rather than guessing when source is unclear.

If parsing or migration fails, keep the app usable with an empty dashboard state and do not delete existing storage keys.

## Invariants

View mode must not allow accidental item movement or resizing.

Slicers must remain usable in view mode.

Locked items must not move or resize in edit mode.

Dashboard item removal must also clear stale minimized or locked window state for that item.

Dashboard slicer and chart-local slicer conflicts must still render on the affected chart.

Pinning from AI Chat and chart windows must create dashboard canvas items with layout metadata.

Reloading the app must restore dashboard items, layouts, mode, lock states, filters, and sharing skeleton metadata.

No sharing skeleton UI may call backend sharing endpoints or create fake live links in this slice.
