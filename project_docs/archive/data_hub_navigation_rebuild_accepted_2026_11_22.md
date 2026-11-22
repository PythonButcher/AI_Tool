# Data Hub and navigation rebuild

**Accepted on November 22, 2026.** Historical delivery plan.

Goal: Give Datastream a clearly labeled Data Hub, fix the welcome actions, and replace the Commands dropdown with a persistent application header.

## What users should see

**Data Hub** opens a full workspace for finding and opening saved datasets. **Data Preview** opens the active dataset. **Upload data** starts import. Make those same destinations and actions work from the welcome screen and header. Reserve **Data Model** for defining and relating business data and **Analytics** for working with it.

This roadmap defines the delivery order for the Data Hub and navigation rebuild. The execution status and sole active gate identify the current scope and owner. [Execution status](../active/status/project_execution_status.md) · [Active gate](../active/active_gate/README.md) · [Frontend ownership](../active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md)

## What exists today

| Surface | Source finding |
| --- | --- |
| **Welcome to Datastream** | The two buttons emit `upload` and `hub`. The workspace handler has no `upload` case. It treats `hub` as the Data Preview window, which requires an active dataset with preview rows. [Welcome screen](../../frontend/frontend/src/components/layout/DestinationHome.jsx) · [Action dispatch and preview](../../frontend/frontend/src/components/layout/CanvasContainer.jsx) |
| **Workspace command labeled Catalog** | Directly toggles Data Preview. The **Catalog** tab in the side pane is a separate field or semantic browser for the current context. The collapsed **Commands** header currently hides common actions. [Header and commands](../../frontend/frontend/src/components/layout/MenuBar.jsx) · [Side pane tabs](../../frontend/frontend/src/components/layout/DataPane.jsx) |
| **Data Hub in the Connect pane** | This is the existing dataset catalog screen. Names are plain text. `Remove` is the only row action and sits in the rightmost column of a table clipped by the narrow pane. The search box sends a `query` parameter which the current legacy list route ignores. [Data Hub screen](../../frontend/frontend/src/features/database/DataHubWindow.jsx) · [Catalog API](../../backend/routes/datahub_routes.py) |
| **Catalog search inside Upload** | The Upload component has a separate search tab with an **Open** button that has no handler. It can fall back to hard-coded sample entries when the dataset list is empty. This explains the second catalog-like surface. [Upload and search](../../frontend/frontend/src/components/data_management/FileUpload.jsx) |
| **Data Model and Analytics selectors** | Data Model can add an existing source to its workspace. Analytics can select a saved dataset by ID. Both are real consumers of catalog entries. The source review found no separate, fully functioning top-level dataset catalog to restore. [Data Model source picker](../../frontend/frontend/src/features/data-model/AddSourcePanel.jsx) · [Analytics dataset picker](../../frontend/frontend/src/features/analytics/AnalyticsShell.jsx) |

## Delivery order

### Phase 1 — Fix entry points and labels

Make **Upload data** open the existing file-import flow, including when no dataset is loaded. Make the welcome **Data Hub** button and any direct Data Hub command open the same real catalog surface. Use the existing catalog for the repair if the full destination is delivered in a separate step. Relabel the Workspace **Catalog** command **Data Preview** and give the user an honest unavailable state when there is no active dataset. Reuse one shell action per destination so the buttons agree. Keep the current upload callback and dataset attachment behavior.

**Files and acceptance.** Inspect `App.jsx`, `DestinationHome.jsx`, `CanvasContainer.jsx`, `MenuBar.jsx`, `DataPane.jsx`, and `FileUpload.jsx` under `frontend/frontend/src`. Focused interaction tests should show that both welcome buttons work from an empty workspace, that the Data Hub and Data Preview controls open the surfaces named, and that successful upload still attaches the result. The existing upload and source-list contracts are sufficient for this repair. The active gate and authorization record determine who edits the frontend.

### Phase 2 — Rebuild Data Hub as the dataset destination

Give the catalog a full-width list and dataset details view with a useful first-load state. Show name, source type, size or row count when available, date, and an ID or other safe detail that distinguishes same-name entries. Make search return real matches. Give every appropriate row a visible **Open in Analytics** action and an accessible details action. Use the selected source ID, preserve the existing analysis draft, and surface stored-source readiness or unavailability through the Analytics contract. Preserve a clearly labeled **Remove** action with confirmation for the exact dataset. Show the existing dependency explanation when removal is blocked. Keep Connect for adding data and route the old search tab to the same dataset destination.

**Backend and frontend boundary.** Codex first verifies managed and legacy rows against `GET /api/data-sources` and `GET /api/data-sources/<source_id>` in `backend/routes/data_workspaces.py`. The list returns `{sources}` with `source_id`, `name`, `source_kind`, timestamps, counts, and governance metadata where available. Prefer this safe metadata contract for display. Use search behavior that matches the data shown, while preserving existing `GET /api/datahub/list` consumers. Preserve the original `DELETE /api/datahub/<dataset_id>` dependency checks and stable IDs. For Analytics, carry `{kind: 'datahub', id, name}` through the existing workspace transition and let `POST /api/analytics/query` resolve the stored source. The catalog itself should not load or attach raw rows on selection. Keep an explicit distinction between opening a dataset in Analytics and adding it to a Data Model workspace.

**Files and acceptance.** Start with `DataHubWindow.jsx` and its stylesheet, the shell destination and `FileUpload.jsx`, and the existing Analytics and `WindowContext` integration. Touch backend code only if focused review finds a compatibility or metadata gap. Verify empty, loading, error, and long-name states, true search, distinct selection for identical names, a preserved draft, an unavailable saved source, and removal success and dependency conflict on fixtures. Preserve existing upload records and source relationships. Equal names alone are insufficient evidence for deleting or merging records. [Source workspace contract](../active/contracts/multiple_data_source_workspace.md) · [Analytics source contract](../active/contracts/analytics_workspace.md)

### Phase 3 — Replace Commands with a persistent banner menu

Use a full-width app header with a clear current destination and visible access to Data Hub, Upload data, and relevant destination actions. Give Workspace, Data Model, Analytics, and ML Studio consistent navigation and make Data Preview visibly contextual to an active dataset. Consolidate overlapping controls so each has a clear home. Less-used actions can use a focused overflow menu when space is limited. The default desktop experience should no longer require expanding a general Commands dropdown for primary navigation. Preserve product styling, themes, existing access to AI Chat, keyboard focus, and the usable content area.

**Files and acceptance.** Start with `MenuBar.jsx`, `MenuBar.css`, `SideBar.jsx`, and the shell layout in `App.jsx` and `App.css`. Verify primary navigation and commands at wide and narrow widths and preserve existing navigation aliases, current destination, chart drafts, and window behavior. Keep visual polish bounded to the shell and Data Hub surfaces in this plan.

## How this supports the business model

| Screen | What someone does there |
| --- | --- |
| **Data Hub** | Find, import, and open sources. Later, discover published data products next to clearly identified source datasets. |
| **Data Model** | Define how data sets relate. The existing source canvas stays the entry point for this work and is the natural place to grow shared identities and definitions later. |
| **Analytics** | Work with a dataset or a model and, later, consume published products in shared investigations. |
| **Data Preview** | Inspect the rows of the currently active dataset. |

Make the distinction visible in the navigation and source details. This rebuild creates the front door and a clean route into the existing Data Model. Future shared business entities, cross-project evidence integration, and published-product lifecycle still need their own data contracts and authorization. [Three-project platform strategy](../active/future/codex/three_project_data_platform_review.md)

## Engineering verification and control return

- Run focused React tests for new shell actions, catalog selection and removal states, and existing `AnalyticsShell` and `WindowContext` behavior. Use `npm --prefix frontend/frontend test -- --watchAll=false --runInBand` with targeted paths, then `npm --prefix frontend/frontend run build`.
- If backend behavior changes, run the targeted cases in `tests/test_source_workspace_context.py`, `tests/test_analytics_query.py`, and any catalog API tests required by the changed contract. Compile changed Python modules and use fixture datasets for mutation checks.
- Run `python .codex/hooks/ci_harness_check.py`, the active-gate validator, and `git diff --check` when activating or changing a gate or handoff.
- Codex implements and verifies one bounded phase at a time. Verify the relevant backend contract and focused frontend behavior before advancing the active gate. The user owns final browser acceptance.
