# Phase 1 Unified Field System And Workflow Shell Plan

## Intent
Phase 1 is a controlled UI and interaction-model overhaul that moves the product away from a visible `dataset + semantic layer` split and toward a single intelligent field system.

The purpose of this phase is not to replace the existing backend architecture. It is to change how the frontend presents fields, workflows, and layout so users experience one analysis surface instead of choosing between raw and business concepts.

This phase should be executed before visual polish work. The main goal is structural correction:

- unify field discovery
- remove `Semantic Layer` as a primary UI concept
- fix the left-rail drawer behavior and layout constraints
- reset the default application state so the canvas starts clean
- preserve all existing routing behavior behind the scenes

## Product Direction For This Phase
The application should now behave as if it has one shared field system:

- some fields are direct source columns
- some fields are calculated or inferred
- all of them are presented together as usable fields

Users should not have to decide whether they are using `raw` fields or `business` fields before they can explore data, build charts, create KPI cards, or assemble dashboards.

The semantic resolver remains the backend execution path for calculated business logic, but that distinction becomes implementation detail rather than workflow language.

## Planned Interaction Changes

### 1. Unified field system in the explorer
The existing field explorer currently exposes a visible split between `Raw Fields` and `Business Fields`. That split should be removed from the primary interaction model.

Planned behavior:

- replace the current tab split with one unified field list
- reorganize items under user-facing groups such as `Measures`, `Dimensions`, `Calculated Fields`, and `Time` where appropriate
- rename semantic metrics into field language so they read as intelligent measures rather than a second system
- allow search, drag-and-drop, and quick actions to operate across one combined list
- keep field metadata useful, but reduce obvious source-language that tells users they are switching systems

Expected result:

- users browse one field catalog
- some fields may show subtle intelligence indicators such as `Calculated`, `Inferred`, or `Custom`
- the UI explains field usefulness without exposing backend architecture

### 2. Removal of `Semantic Layer` as a visible workflow concept
The current `Business` workflow and `Semantic Layer` language should no longer sit at the center of the user experience.

Planned behavior:

- remove `Semantic Layer` terminology from the main field exploration flow
- remove or rename `Business` entry points that frame the feature as a separate layer
- reposition metric management as field editing or calculated field management
- update editor copy so users are editing a field definition, not entering a separate semantic subsystem
- treat inferred and custom logic as field intelligence states, not separate object families in the shell

Expected result:

- users still benefit from resolver-backed definitions
- users do not mentally model the product as having a raw mode and a semantic mode
- semantic objects become intelligent fields inside a single analysis environment

### 3. Slide-out drawer and sidebar positioning correction
The workflow drawer currently uses rigid width constraints that can truncate labels, compress controls, and feel visually disconnected from the canvas.

Planned behavior:

- redesign drawer sizing so it responds to content density instead of relying on a single narrow width
- improve width constraints, internal spacing, and overflow rules so long labels and action rows do not clip
- align the drawer edge and canvas relationship more deliberately so the shell feels intentional rather than layered on top
- make the drawer degrade gracefully at smaller widths through stacking, wrapping, or section compaction instead of clipping
- ensure embedded panels such as the field explorer and field editor can scroll internally without hiding important controls

Expected result:

- the left rail remains the main workflow anchor
- the drawer feels like a stable analysis surface
- content remains readable on smaller laptop widths

### 4. Clean initial application state
The application should stop opening analysis surfaces too aggressively on load or reset.

Planned behavior:

- no floating windows open by default on a clean application load
- no chart windows, workflow outputs, or preview windows should appear unless the user opened them
- the canvas should begin empty and readable
- reset flows should return to that same calm default state
- persisted local window state should not recreate a cluttered first impression after reset

Expected result:

- the user lands on a clean workspace
- the rail and canvas communicate where to begin
- the product feels deliberate rather than pre-populated

### 5. Preserve drag-and-drop with invisible routing
The drag-and-drop model is still a strong interaction pattern and should remain intact.

Planned behavior:

- preserve existing drag contracts for source columns and intelligent fields
- keep automatic routing behavior:
  - calculated or inferred fields continue to resolve through `POST /api/semantic-metrics/resolve`
  - direct source columns continue to use dataset aggregation
- keep charting, KPI cards, and dashboard composition compatible with the current routing behavior
- hide the routing distinction from the user so they only think in terms of using fields

Expected result:

- users drag fields exactly as before
- the system chooses the correct execution path automatically
- no new routing toggle, mode switch, or semantic/explore split is introduced

## Planned UI Behavior Changes

### Field discovery
- The field explorer becomes a single searchable field system instead of a tabbed raw-versus-business chooser.
- Measures, dimensions, time fields, and calculated fields are grouped for readability, but all live in one explorer.
- Field cards should communicate purpose and intelligence level without overwhelming the user with badges or backend terminology.

### Field editing
- Metric editing evolves into field editing or calculated field editing.
- Inferred and custom definitions remain supported, but the editing surface should be framed around field behavior, not semantic system management.

### Workflow shell
- The left workflow rail remains, but drawer layout behavior becomes more adaptive and content-safe.
- Drawers should feel docked to the shell rather than like narrow overlays that happen to slide out.

### Canvas state
- Initial load and reset return the app to an empty, focused canvas.
- Windows, charts, drawers, and workflows should open intentionally from user action rather than by default.

## Expected Components And Files Affected
These are the expected primary frontend touchpoints for Phase 1 planning. This list is intentionally concrete so later implementation can be scoped cleanly.

### Primary shell and state management
- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/App.css`
- `frontend/frontend/src/components/layout/SideBar.jsx`
- `frontend/frontend/src/components/layout/SideBar.css`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.css`
- `frontend/frontend/src/context/WindowContext.jsx`

### Unified field system surfaces
- `frontend/frontend/src/components/insights/FieldsPanel.jsx`
- `frontend/frontend/src/components/insights/FieldsPanel.css`
- `frontend/frontend/src/utils/semanticObjectUtils.js`
- `frontend/frontend/src/utils/semanticModelUtils.js`
- `frontend/frontend/src/context/DataContext.jsx`

### Field intelligence and editing surfaces
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.css`
- `frontend/frontend/src/features/semantic/SemanticMetricEditor.jsx`
- `frontend/frontend/src/features/semantic/SemanticMetricEditor.css`

### Visualization and dashboard integration surfaces that must remain compatible
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`
- `frontend/frontend/src/features/charts/SmartChartWindow.css`
- `frontend/frontend/src/features/dashboard/KpiCardWindow.jsx`
- `frontend/frontend/src/features/dashboard/KpiCardWindow.css`
- `frontend/frontend/src/features/dashboard/DashboardFilterBar.jsx`
- `frontend/frontend/src/features/dashboard/DashboardFilterBar.css`

### Backend contracts that remain in place and must continue to be consumed
- `backend/routes/semantic_metrics.py`
- `backend/services/metric_resolver.py`
- `backend/routes/semantic_model.py`

These backend files are listed as integration dependencies, not rewrite targets.

## What Is Not Changing In Phase 1
This phase is explicitly not a backend rewrite.

The following remain in place:

- dataset-first ingestion and normalization
- the centralized semantic resolver at `POST /api/semantic-metrics/resolve`
- raw dataset aggregation for direct source fields
- existing chart rendering stack
- existing KPI card capability
- existing dashboard capability
- existing AI flows and workflow outputs
- existing drag-and-drop foundation and routing contracts
- additive semantic model behavior in the backend

This phase changes presentation and interaction model, not the execution architecture.

## Risks And Edge Cases

### 1. Backward compatibility risk in drag payload handling
The current drag-and-drop system already distinguishes source fields and semantic objects. Unifying the explorer must not break those payload contracts or any drop targets already used by charts, KPI cards, dashboards, and workflow windows.

### 2. Copy and labeling risk during the rename away from semantic language
Removing `Semantic Layer` wording from the UI is straightforward, but the replacement labels must remain accurate. Terms such as `Calculated Field`, `Inferred Field`, and `Measure` need to be consistent across the explorer, chart builders, KPI cards, and editor surfaces.

### 3. Smaller-screen drawer behavior
The current drawer already shows constraint problems on narrower widths. Any Phase 1 refactor needs explicit handling for:

- long field names
- quick action rows with multiple buttons
- embedded editors or filters inside the drawer
- laptop-width layouts where the drawer and canvas compete for space

### 4. Empty or low-semantic datasets
Some datasets may infer few or no intelligent fields. The unified explorer still needs to feel coherent when only source columns are available, without exposing missing-system language or making the user feel like part of the product failed.

### 5. Persisted local state and reset behavior
`WindowContext.jsx` and local storage currently preserve dashboard and window state. Phase 1 needs a clear reset/default-state rule so a deliberate reset can always return the app to a clean canvas without breaking legitimate persistence elsewhere.

### 6. Existing workflow naming
The product currently uses labels such as `Business`, `Business Definitions`, and `semantic` across shell copy. Removing those from primary workflows will create transitional risk unless the naming model is updated consistently in field explorer text, chart empty states, KPI prompts, and dashboard filters.

## Phase 1 Boundary
Phase 1 should stop once the interaction model is structurally correct.

That means this phase should deliver:

- one intelligent field explorer
- no primary raw-versus-business split in the UI
- corrected drawer behavior
- calm initial canvas behavior
- preserved invisible routing

This phase should not attempt full visual restyling, chart polish, or dashboard aesthetic modernization. Those belong in Phase 2 after the structural model is stable.
