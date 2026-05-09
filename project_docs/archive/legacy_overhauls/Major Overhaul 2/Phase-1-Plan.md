> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 1: Unified Field System and Shell Correction

## Intent
Phase 1 focuses on the structural and interaction-model shift from a "Dataset + Semantic Layer" split to a "Single Intelligent Field System." The primary goal is to hide the technical distinction between raw data and business logic from the user, while preserving the existing backend execution paths. This phase also addresses critical layout issues in the sidebar and drawer system.

## Product Direction
- **Unified Experience**: Users should browse a single field catalog.
- **Hidden Complexity**: The distinction between "Raw" and "Semantic" is an implementation detail (routing), not a user-facing category.
- **Intelligent Defaults**: The system automatically chooses the best execution path based on the field type.
- **Calm Canvas**: The application starts in a neutral state to reduce initial cognitive load.

## Planned Interaction Changes

### 1. Unified Field Explorer
The `FieldsPanel` will be refactored to remove the "Raw" vs "Business" tab split.
- **Single List**: All fields (raw columns and semantic objects) will coexist in a single searchable list.
- **Intelligent Grouping**: Fields will be grouped by their functional role:
  - **Measures**: Numeric raw columns and semantic metrics.
  - **Dimensions**: Categorical raw columns and semantic dimensions.
  - **Time**: Temporal raw columns.
  - **Calculated**: User-defined or complex inferred fields.
- **Metadata Refinement**: Semantic fields will be distinguished by subtle icons or "Intelligent" labels rather than being in a separate tab.

### 2. Removal of "Semantic Layer" UI Concept
- **Language Shift**: References to "Semantic Layer" or "Business Definitions" in the primary workflow will be replaced with "Calculated Fields" or "Field Intelligence."
- **Workflow Integration**: The "Business" tab in the left rail will be renamed or integrated into a "Field Management" flow that feels like part of the core data exploration.

### 3. Adaptive Drawer and Sidebar
The slide-out drawer (`SideBar.jsx` / `SideBar.css`) will be redesigned for better content safety.
- **Dynamic Sizing**: The drawer will use `min-content` or flexible widths to prevent label truncation.
- **Overflow Handling**: Improved internal scrolling and padding to ensure all controls (especially in `FieldsPanel` and editors) are accessible.
- **Alignment**: Ensure the drawer-to-canvas transition is seamless and doesn't overlap or obscure the main workspace.

### 4. Clean Application State
- **Empty Canvas**: On initial load or hard reset, no windows (Charts, KPI cards) will be open.
- **Intentional Launch**: Windows only appear as a direct result of user actions (drag-and-drop or clicking "Add").

### 5. Invisible Routing Logic
- **Drag Payload Preservation**: The `dnd-kit` payloads will continue to carry their `source` (raw vs semantic) to allow the `SmartChartWindow` to route requests correctly.
- **Automatic Mode Switching**: `SmartChartWindow` will automatically toggle its `dataSourceMode` based on the first field dropped into it, removing the manual toggle.

## Affected Components and Files

### Core Shell
- `frontend/frontend/src/components/layout/SideBar.jsx` & `.css`: Refactor drawer width and transition logic.
- `frontend/frontend/src/components/layout/CanvasContainer.jsx` & `.css`: Update layout constraints.
- `frontend/frontend/src/App.jsx`: Modify initial state and reset logic.

### Field Explorer
- `frontend/frontend/src/components/insights/FieldsPanel.jsx` & `.css`: 
  - Remove `FIELD_EXPLORER_TABS`.
  - Refactor `groupedItems` useMemo to merge raw and semantic fields.
  - Update `ANALYSIS_GROUP_META` for unified naming.
- `frontend/frontend/src/utils/semanticObjectUtils.js`: Ensure normalization supports unified listing.

### Interaction Logic
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`:
  - Hide the "Raw/Semantic" mode toggle in the toolbar.
  - Implement auto-mode detection on drop.
  - Update placeholder text to be source-agnostic.

## What is NOT Changing
- **Backend Architecture**: All API endpoints (`/api/semantic-metrics/resolve`, etc.) remain identical.
- **Semantic Resolver**: The logic for calculating business metrics is preserved.
- **Dataset Ingestion**: The raw data pipeline remains "Dataset-First."
- **Data Contracts**: The structure of the semantic model and normalized dataset rows remains the same.

## Risks and Edge Cases
- **Naming Collisions**: If a raw field has the same name as a semantic metric. *Strategy*: Use icons to distinguish and allow the semantic version to take precedence or show both with source indicators.
- **Payload Ambiguity**: Ensuring existing drop zones in Dashboards and Charts still recognize both payload types.
- **Performance**: Rendering a significantly larger unified list in the `FieldsPanel`. *Strategy*: Use React virtualization or optimized memoization if the field count exceeds ~200.
