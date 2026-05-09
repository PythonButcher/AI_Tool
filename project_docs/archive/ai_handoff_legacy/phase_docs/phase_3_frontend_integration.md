> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 3 Frontend Integration - Decision Intelligence

## Overview
Phase 3 integrates the backend Decision Intelligence Layer into the React frontend. It introduces a comprehensive "Decision Intelligence" view that summarizes findings, evidence, and actionable recommendations.

## What Was Built

### 1. Decision Feature Folder (`src/features/business/decision`)
- **`DecisionPanel.jsx`**: The main orchestration component for decision results.
- **`DecisionBrief.jsx`**: Summary view (brief, themes, and KPI cards).
- **`DecisionSignals.jsx`**: Ranked signal list with severity indicators and expandable evidence.
- **`DecisionRecommendations.jsx`**: Actionable cards with primary actions that launch charts.
- **`ScenarioPreview.jsx`**: "What-if" projections using the ready-state scenario preview.
- **`decisionApi.js`**: Service layer for the `POST /api/decision/run` endpoint.

### 2. UI Integration
- **SideBar (Intelligence Drawer)**: Added "Run Decision Intelligence" button as a primary action.
- **App.jsx**: State management for the `decisionBundle` and orchestration logic.
- **CanvasContainer.jsx**: Integrated the `DecisionPanel` into the multi-window canvas system as a `WindowFrame`.

## How the Decision Bundle is Used
- **Brief**: Drives the headline and key summary cards.
- **Signals**: Ordered by the backend `importance_score` and styled by `severity`.
- **Recommendations**: Each card maps its `actions` array to buttons.
- **Action Launching**: When a recommendation action is clicked, it calls `handleDecisionAction` in `App.jsx`, which uses `addChart` to launch a semantic chart using the `metric_id` and `group_by` provided by the backend.

## Integration with Existing UI
- **Zero Breakage**: Existing semantic modelling and charting remain untouched.
- **Reuse**: The decision system reuses the `WindowFrame` component for its main view and the `addChart` logic for recommendation actions.
- **Context-Aware**: The decision run automatically uses the currently active dataset and its semantic model ID.

## Key Assumptions Made
- Assumed `group_by` in recommendation payloads should use the first element if an array is passed, to stay compatible with the current `SmartChartWindow`.
- Assumed `status === 'ready'` is the trigger to display the Scenario Preview section.
- Assumed `dataset_ref` should use the `datahub` source for internal datasets.
