# Phase 5 Codex Prompt: Business Monitoring

Use this prompt for the next implementation phase.

```md
You are working in `C:\Users\18022\Desktop\AI_Tool`.

This repository already completed the semantic BI foundation through Phase 4:

- Phase 1 established the semantic model layer.
- Phase 2 added the centralized metric resolver and `POST /api/semantic-metrics/resolve`.
- Phase 3 integrated semantic charting into the frontend.
- Phase 4 made semantic metrics and dimensions first-class analysis objects in the UI.

Your task is to implement **Phase 5: Business Monitoring**.

## Core Objective

Add the first real dashboarding workflow so a business user can answer:

**"How is my business doing right now?"**

This phase should move the product from exploration-only behavior toward daily monitoring behavior.

## Most Important Capabilities

Implement these in this order:

1. **KPI cards**
2. **Dashboard canvas**
3. **Global dashboard filters**

These features must build directly on the existing semantic layer and metric resolver.

## Architectural Rules

Follow these constraints strictly:

- Keep all existing dataset-first workflows working exactly as they do now.
- Reuse the centralized metric resolver instead of adding new aggregation logic.
- Integrate with the existing chart/window system rather than creating a separate visualization stack.
- Keep semantic and raw column workflows compatible.
- Treat this phase as additive and low-risk, just like the previous phases.

Do **not** replace:

- raw-field chart creation
- existing floating chart windows
- current upload / cleaning / filtering flows
- current semantic chart behavior

## Required Outcome

After this phase, when a user loads a dataset, they should be able to build a simple BI dashboard that contains:

- KPI cards driven by semantic metrics
- existing charts living beside KPI cards
- shared dashboard-level filters that update all dashboard items together

The dashboard must be reopenable later through persisted configuration.

## Implementation Priorities

### 1. KPI cards first

Implement a dedicated KPI card UI component that:

- displays a semantic metric as a large formatted value
- shows the metric label and optional helper text
- uses the existing semantic metric resolver endpoint for data
- can optionally display comparison/change information versus a previous period
- supports dashboard-global filters

Important:

- KPI cards should be business-metric-first, not raw-column-first.
- Prefer semantic metrics as the primary configuration path.
- If comparison logic is added, do not add a second aggregation engine.
- If previous-period comparison is supported, compute it by making another resolver call with shifted time filters when a valid dashboard time filter exists.
- If no valid temporal filter exists, comparison can be omitted gracefully.

### 2. Dashboard canvas

Add a stable dashboard layout surface where KPI cards and charts can coexist.

Use the current canvas/window architecture as the base:

- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/context/WindowContext.jsx`
- `frontend/frontend/src/components/layout/WindowFrame.jsx`
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`

The dashboard canvas should:

- allow multiple KPI cards and charts to exist together in one saved arrangement
- preserve item layout and sizing
- feel like a monitoring surface, not just temporary floating exploration windows
- still reuse the current window/layout behavior where practical

You may introduce a dashboard-specific state structure if needed, but do not break the current chart window system.

### 3. Global dashboard filters

Add dashboard-level filter state that can be applied to all dashboard items at once.

Minimum useful support:

- date range filter
- one or more dimension filters such as region/category

Important:

- Global filters are orchestration state, not a new metric engine.
- Each KPI card or dashboard chart should resolve data by passing the dashboard filters into the existing resolver request.
- Use the existing resolver filter contract where possible.
- Prefer additive filter helpers/utilities over invasive rewrites.

## Persistence

Dashboard configuration must be persisted so the user can reopen the same monitoring view later.

Persist at least:

- dashboard name or identifier
- dashboard item definitions
- layout positions and sizes
- KPI card semantic metric config
- chart config
- dashboard-global filters

For this phase, lightweight frontend persistence such as `localStorage` is acceptable if no existing backend persistence model is already appropriate. Do not introduce unnecessary backend storage complexity unless it clearly fits the current architecture.

## Suggested Frontend Direction

You do not have to follow this exact file plan, but the implementation should likely involve these areas:

- `frontend/frontend/src/context/WindowContext.jsx`
  - extend shared state so dashboard items can be stored/persisted
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
  - render a dashboard surface and dashboard items
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`
  - allow semantic charts to participate in dashboard mode with shared filters
- `frontend/frontend/src/context/DataContext.jsx`
  - keep dashboard data resolution compatible with active dataset / semantic model state
- `frontend/frontend/src/utils/semanticChartUtils.js`
  - reuse or extend semantic formatting helpers
- new dashboard/KPI component files
  - for example under `frontend/frontend/src/features/dashboard/` or a similar location

There is already a `KPI` chart role entry in:

- `frontend/frontend/src/utils/chartRoleConfig.jsx`

Use it only if it helps. Do not force KPI cards into the normal chart rendering path if a dedicated KPI component is cleaner.

## Suggested Backend Direction

Prefer to reuse the current backend exactly where possible:

- `backend/services/metric_resolver.py`
- `backend/routes/semantic_metrics.py`

Only extend backend behavior if truly needed for compatibility or filter support.

Do not introduce a parallel KPI aggregation route unless there is a strong technical reason.

## Scope Boundaries

This phase should **not** try to do everything a full BI product would do.

Do not add:

- alerts
- subscriptions
- scheduled reports
- AI narration
- complex drill-through workflows
- multi-page dashboard management
- heavy backend persistence systems unless required

Keep the phase focused on first-useful business monitoring.

## Acceptance Criteria

The implementation is successful if all of the following are true:

1. A user can create at least one KPI card from a semantic metric.
2. A KPI card resolves its value through the centralized semantic metric resolver.
3. A user can place multiple KPI cards and charts into a stable dashboard arrangement.
4. Dashboard-global filters update every dashboard item together.
5. Existing raw-field and semantic chart workflows continue to work.
6. Dashboard configuration persists and can be reopened later.
7. The implementation remains additive and does not remove the current exploratory UX.

## Documentation Requirement

Document the phase in the `Semantic Info` folder with a new markdown file:

- `Semantic Info/Phase 5 Business Monitoring.md`

That document should match the style of earlier phase docs and explain:

- what Phase 5 introduced
- how KPI cards work
- how dashboard canvas/layout works
- how global filters interact with the resolver
- what files changed
- how backward compatibility was preserved
- validation performed
- remaining limitations

## Validation

At minimum:

- run the relevant frontend build
- run any lightweight validation you can for touched backend/frontend code
- report any limitations if something cannot be fully executed in this environment

## Working Style

- Inspect the current code before changing it.
- Make focused additive edits.
- Reuse existing structures where practical.
- Prefer small, composable helpers over large rewrites.
- Keep the UX coherent with the current app rather than introducing an entirely different product shell.
```

## Notes

This prompt is intentionally scoped so Phase 5 establishes the first usable monitoring workflow without overreaching into alerts, reporting, or AI explanation features.
