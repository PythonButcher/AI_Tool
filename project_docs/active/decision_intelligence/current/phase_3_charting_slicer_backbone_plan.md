# Phase 3 - Charting And Slicer Backbone Plan

## Summary

Improve charting without a full rewrite. Keep Chart.js, the current semantic metric resolver, the deterministic NLP chart engine, and existing AI Chat artifacts. The main change is to introduce one shared chart model and one shared slicer model so standalone chart windows, dashboard charts, KPI cards, and AI Chat charts behave consistently.

The dashboard becomes the durable chart workspace, tentatively named Chart Studio or Dashboard. Users can create charts there, pin charts into it from Explore and AI Chat, and use obvious slicers instead of hidden filter controls. Persistence is local-first through browser storage, with a versioned state shape that can later support backend-saved dashboards.

## Current Gate

Status: backend contract ready; frontend implementation is not complete and is assigned to Antigravity/UI implementation.

Backend readiness target: backend contract ready for deterministic `content.chartSpec` on AI Chat chart artifacts, with tests proving the additive contract does not break existing chart payloads.

Frontend readiness target: Antigravity implements the React/CSS dashboard and charting UI. Codex must not edit frontend files unless the user explicitly authorizes Codex frontend edits in a future session.

Completion target: backend tests, Antigravity frontend build/browser verification, `git diff --check`, and `python .codex/hooks/agent_harness_check.py` pass. Browser acceptance remains user-controlled.

## Key Changes

Define a shared frontend `ChartSpec` and `SlicerSpec` contract. A chart spec includes chart type, title, source mode, raw field mapping or semantic metric/grouping, aggregation, sort/limit, local slicers, inherited dashboard slicers, and pin metadata. Existing AI Chat chart fields remain compatible: `chartType`, `chartData`, `fieldsUsed`, `filtersApplied`, and `meta`.

Use intersection logic for slicer conflicts. Dashboard slicers and chart-local slicers are combined with `AND` semantics. If both filter the same field, the effective result is the overlap; if there is no overlap, the chart renders a clear empty state explaining the conflicting slicers instead of silently dropping one.

Replace the current dashboard filter bar with a clear slicer system. The dashboard rail shows active slicer chips, row-count impact, Clear controls, and a visible Slicers button. The slicer drawer supports date ranges, categorical multi-select, numeric ranges, and searchable values. Dashboard slicers apply to all pinned charts and KPIs; chart-local slicers apply only to one chart.

Use an explicit Apply model for slicer edits. The slicer drawer keeps draft selections while open, then applies them on Apply. Clear and Remove can update immediately because they are deliberate actions. This avoids semantic resolver query spam and gives users a predictable review step before expensive chart refreshes.

Refactor chart windows around a shared chart shell. `SmartChartWindow` keeps raw and semantic modes, but gains a slicer drawer, pin-to-dashboard action, duplicate action, and a compact status strip showing source, row count, active slicer count, and metric/dimension bindings.

Rework AI Chat charting so every chart artifact can become a workspace object. The chart inspector adds actions for Pin to Dashboard, Open as Chart Window, Add Slicer, Compare Segment, Top/Bottom, Change Chart Type, and Explain This Chart. Frontend actions operate directly when `chartSpec` is valid; natural-language refinements still go through AI Chat.

## Backend And Contract Work

Add optional `content.chartSpec` to AI Chat chart artifacts. The backend must build this deterministically from interpreted fields, semantic metric results, filters, chart type, grouping, aggregation, and dataset trust. Do not rely on unconstrained LLM output to produce the persisted chart spec.

If any future LLM-assisted chart planning is introduced, validate its output against a strict backend JSON schema before returning it. Invalid or partial LLM chart specs should be ignored or downgraded to a normal chart artifact with no pin action, not passed through to the frontend.

Map `SlicerSpec` cleanly to existing resolver filters: date range becomes `gte` and `lte`, category selection becomes `eq` or `in`, numeric range becomes `gte` and `lte`, and supported text matching becomes `contains`. Backend tests should prove dashboard plus local slicers combine as an intersection.

## Storage And Migration

Create a versioned local storage key such as `chartStudioDashboard:v1`. On first load, read the old `businessMonitoringDashboard` key if the new key is missing, normalize it into the v1 shape, save the v1 key, and leave the old key untouched as a rollback backup.

Do not delete or rewrite old local storage during the rollout. If v1 parsing fails, fall back to the old key and show an empty-but-safe dashboard only if both shapes are invalid.

Pinned charts should persist locally with their chart spec, slicer specs, layout state, and source metadata. Backend persistence is out of scope for this slice.

## Test Plan

Run backend regression tests for chart and chat contracts: `python -m unittest tests.test_decision_chat_service tests.test_data_catalog_lineage`.

Antigravity should add focused frontend tests or utility checks for chart spec normalization, slicer conflict intersection, draft-versus-applied slicer state, dashboard storage migration, and pinning from AI Chat chart specs.

Run `npm --prefix frontend\frontend run build`, `git diff --check`, and `python .codex/hooks/agent_harness_check.py`.

Manual browser acceptance should cover creating raw and semantic charts, applying dashboard slicers, applying chart-local slicers, resolving slicer conflicts, pinning from Explore, pinning from AI Chat, and reloading to confirm v1 local persistence.

## Assumptions

Local-first persistence is the chosen default.

This is not a complete charting rewrite. The plan preserves current rendering and backend engines while replacing the fragmented chart/dashboard state model.

Codex owns backend contract, tests, architecture, and handoff coordination. Antigravity owns React/CSS implementation for this charting UI work unless the user explicitly authorizes Codex frontend edits in a future session.
