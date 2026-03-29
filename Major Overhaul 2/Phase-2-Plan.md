# Phase 2 Visual Refinement And BI Presentation Plan

## Intent
Phase 2 is the visual modernization pass that follows the Phase 1 interaction overhaul.

Phase 1 should establish the correct product model: one intelligent field system with a cleaner shell and a calmer default state. Phase 2 then improves how that system looks and feels so the application reads less like an accumulated prototype and more like a lightweight enterprise BI tool.

This phase is still additive and frontend-focused. It should not replace backend execution paths, chart logic contracts, KPI behavior, dashboard routing, or AI integrations.

## Product Direction For This Phase
The target is a more polished BI surface that feels modern, intentional, and operationally credible without abandoning the existing theme system.

The visual goal is not to imitate Power BI directly. It is to reach a similar level of confidence:

- cleaner chart presentation
- more disciplined spacing and hierarchy
- more consistent card language across fields, charts, and KPIs
- a more unified relationship between analysis surfaces and dashboard surfaces

## Planned Interaction Changes
Phase 2 is primarily visual, but it still includes controlled interaction polish.

### 1. Chart visual modernization
The current chart presentation should be simplified and modernized without replacing the charting stack.

Planned behavior:

- remove chart gridlines by default
- introduce subtle bar rounding and cleaner dataset presentation
- tighten legend, tooltip, and title hierarchy so charts feel less noisy
- enforce more consistent color selection through existing CSS variables or shared styling utilities instead of ad hoc hard-coded palettes
- preserve current export behavior and compatibility with the existing chart rendering path

Expected result:

- charts feel lighter and more deliberate
- analytical emphasis comes from data marks and labels rather than grid scaffolding
- chart visuals remain compatible with current semantic and raw routing behavior

### 2. UI modernization without changing the active theme system
The current theme direction is acceptable and should remain recognizable.

Planned behavior:

- improve spacing rhythm between panels, cards, controls, and section headers
- sharpen border treatment and reduce inconsistent radii or soft edges where the UI looks overly casual
- establish clearer typography hierarchy between titles, field labels, secondary metadata, and helper text
- use shadows more intentionally so the shell feels layered but not blurry or hobby-grade
- preserve theme variables and light/dark compatibility rather than introducing a brand new visual system

Expected result:

- the UI still feels like the same application
- the product looks more mature, consistent, and trustworthy

### 3. Field interaction polish
After Phase 1 unifies the field system, the field presentation itself should be refined.

Planned behavior:

- reduce badge overload and extra helper text in field cards
- simplify current metric-card and semantic-card treatments into a more compact field detail language
- improve selected, hovered, and dragged states so field interactions are readable without looking busy
- move closer to a clean BI-detail presentation where the field name, type, and intelligence state are visible but not over-explained
- keep quick actions available, but make them feel less like separate mini-tools attached to every row

Expected result:

- fields are easier to scan
- selection and discovery feel more confident
- intelligent fields feel integrated into the product instead of specially decorated

### 4. Dashboard and KPI visual consistency
KPI cards and charts should feel like they belong to the same product surface.

Planned behavior:

- align card spacing, border treatment, typography, and surface depth between dashboards and chart windows
- improve KPI readability so label, value, comparison state, and empty/loading states match the chart system more closely
- make the dashboard filter bar feel visually related to charts and KPI cards rather than like an unrelated overlay
- preserve the current dashboard logic and semantic resolution behavior

Expected result:

- dashboards look more coherent
- KPI cards feel like first-class BI widgets rather than isolated mini-panels

## Planned UI Behavior Changes

### Charts
- Charts default to a cleaner visual mode with no gridlines.
- Bar and column visuals should gain subtle rounding and better mark emphasis.
- Colors should map through shared styling rules that respect the application theme.

### Shell and panels
- Spacing, borders, shadows, and typography should become more consistent across the drawer, canvas windows, field lists, and dashboard surfaces.
- Visual density should be reduced without removing capability.

### Fields
- Field rows and field cards should reveal meaning faster with fewer visual interruptions.
- Hover, selection, and drag states should be easier to interpret during exploratory work.

### KPI and dashboard surfaces
- KPI cards, dashboard filters, and chart containers should share a more consistent visual language.
- Existing interactions stay intact, but the surfaces should look more unified and easier to read.

## Expected Components And Files Affected
These are the expected primary touchpoints for Phase 2 implementation planning.

### Chart rendering and shared chart styling
- `frontend/frontend/src/features/charts/ChartComponent.jsx`
- `frontend/frontend/src/features/charts/ChartComponent.css`
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`
- `frontend/frontend/src/features/charts/SmartChartWindow.css`
- `frontend/frontend/src/features/charts/ChartToolbar.jsx`
- `frontend/frontend/src/utils/ChartStyles.jsx`

### Shared shell and surface polish
- `frontend/frontend/src/App.css`
- `frontend/frontend/src/components/layout/SideBar.css`
- `frontend/frontend/src/components/layout/CanvasContainer.css`
- `frontend/frontend/src/components/layout/WindowFrame.css`
- `frontend/frontend/src/index.css`

### Field system presentation polish
- `frontend/frontend/src/components/insights/FieldsPanel.jsx`
- `frontend/frontend/src/components/insights/FieldsPanel.css`
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.css`
- `frontend/frontend/src/features/semantic/SemanticMetricEditor.jsx`
- `frontend/frontend/src/features/semantic/SemanticMetricEditor.css`

### Dashboard and KPI presentation
- `frontend/frontend/src/features/dashboard/KpiCardWindow.jsx`
- `frontend/frontend/src/features/dashboard/KpiCardWindow.css`
- `frontend/frontend/src/features/dashboard/DashboardFilterBar.jsx`
- `frontend/frontend/src/features/dashboard/DashboardFilterBar.css`

## What Is Not Changing In Phase 2
Phase 2 must not turn into a functional rewrite.

The following remain in place:

- the dataset-first backend pipeline
- resolver-backed execution through `POST /api/semantic-metrics/resolve`
- fallback raw aggregation for direct dataset fields
- chart types and core chart rendering stack
- KPI card behavior and dashboard composition behavior
- AI workflow functionality
- existing theme variables and light/dark mode support
- export compatibility

This phase refines appearance and interaction polish after Phase 1. It does not change the application’s execution model.

## Risks And Edge Cases

### 1. Export and print readability after removing gridlines
Charts may look better on screen without gridlines, but export output still needs adequate readability. Phase 2 should verify that lighter chart styling remains legible when exported or viewed in presentation contexts.

### 2. Theme-token coverage
Some current chart and KPI surfaces still use hard-coded colors or typography choices. Moving to a cleaner, more consistent visual system may require additional use of existing CSS variables without redefining the full theme.

### 3. Dense field metadata
Reducing field-card noise is valuable, but the UI still needs to communicate important information such as:

- whether a field is calculated or inferred
- what role it typically plays
- whether it supports KPI or filter actions

The polish pass should remove clutter without hiding meaning.

### 4. Smaller KPI sizes and dashboard density
KPI cards often operate in constrained dashboard layouts. Improvements to typography and spacing must still work in compact card sizes without truncating values, comparison text, or loading states.

### 5. Consistency across raw-field and resolver-backed visuals
Both source-column charts and intelligent-field charts must look like they belong to the same visual system even though their data paths are different behind the scenes.

## Phase 2 Boundary
Phase 2 should stop at visual and interaction polish.

This phase should deliver:

- cleaner chart presentation
- more disciplined spacing, borders, and typography
- refined field interaction visuals
- stronger dashboard and KPI consistency

This phase should not introduce new backend concepts, replace charting libraries, remove semantic resolution, or redesign the dataset-first architecture established by earlier phases.
