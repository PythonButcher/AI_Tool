# Archived Reference — React State Flow Review

This source review is historical and must be revalidated against current frontend state before reuse.

# React State Flow Review

Scope reviewed: `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src`

Reviewer source: `react_state_flow_reviewer` (`C:\Users\18022\Desktop\AI_Tool\.codex\agents\react_state_flow_reviewer.toml`)

## Overall assessment

The app currently mixes three different state patterns:

- dataset state in `DataContext`
- window/chart/dashboard state in `WindowContext`
- a large amount of UI and legacy chart state in `App.jsx`

That split is workable in principle, but the current implementation has drifted. There are now multiple conflicting sources of truth for both dataset selection and window/chart behavior, plus an outright provider duplication. The result is high coupling, hidden behavior differences between screens, and a few broken or stale pathways.

## State ownership map

- `DataContext`
  - Owns dataset lifecycle: `uploadedData`, `fullData`, `cleanedData`, `filteredData`, semantic model state, pipeline report flags.
  - Primary files: `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\context\DataContext.jsx`, `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\data_management\DataFilterPanel.jsx`, `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\data_management\DataCleaningForm.jsx`

- `WindowContext`
  - Owns window registry, chart list, dashboard item list, persisted layout/content state.
  - Primary file: `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\context\WindowContext.jsx`

- `App.jsx`
  - Owns a large shell-level state surface: workflow toggles, preview visibility, AI surfaces, storyboard state, menu height, chart selection remnants.
  - Primary file: `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx`

- `CanvasContainer`
  - Renders most windows using `WindowContext`, but still depends on a wide prop surface from `App`.
  - Primary file: `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\layout\CanvasContainer.jsx`

- `SmartChartWindow` and `KpiCardWindow`
  - Resolve semantic output locally from context-backed state plus per-item config.
  - Primary files: `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\charts\SmartChartWindow.jsx`, `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\dashboard\KpiCardWindow.jsx`

## Findings

### 1. Duplicate `WindowProvider` instances create split state and make window behavior fragile

Severity: High

- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\index.js:11`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\index.js:12`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:586`

`WindowProvider` is mounted once in `index.js` and again inside `App`. Any component tree movement across that boundary will silently switch to a different window store. Even where the outer provider is currently mostly unused, the duplication makes persistence, debugging, and future refactors unsafe because the app no longer has a single authoritative window/dashboard state container.

### 2. The inspector path is broken by prop/interface drift

Severity: High

- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\layout\CanvasContainer.jsx:26`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\layout\CanvasContainer.jsx:309`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\layout\DataPane.jsx:10`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:513`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:569`

`CanvasContainer` still expects `onInspectItem` and calls it from `handleFocus`, while `DataPane` expects `inspectorSelection` to drive `PropertiesPanel`. The current `App.jsx` no longer passes either prop. Instead it passes unrelated props to `DataPane` that the component does not consume. That means the properties inspector has no valid selection flow and is effectively disconnected from the canvas.

### 3. Dataset state has multiple competing source-of-truth paths

Severity: High

- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\context\DataContext.jsx:43`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\context\DataContext.jsx:270`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\data_management\DataFilterPanel.jsx:65`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\layout\CanvasContainer.jsx:100`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\ai\AIChat.jsx:158`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\workflow\AiWorkflowLab.jsx:93`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\insights\DataStoryPanel.jsx:30`

`DataContext` defines the active dataset order as `filteredData ?? cleanedData ?? fullData ?? uploadedData`, but several feature components bypass that rule and choose their own fallback order. Examples:

- `CanvasContainer` feeds charts and stories with `cleanedData || uploadedData`
- `AIChat` uses `cleanedData` then `fullData`
- `AiWorkflowLab` uses `cleanedData || fullData || uploadedData.preview`
- `DataFilterPanel` derives field metadata from `uploadedData` but applies rules against `fullData`

After filtering or cleaning, different parts of the UI can therefore render or analyze different datasets at the same time.

### 4. `App.jsx` still owns legacy chart/window state that no longer matches the context-driven architecture

Severity: Medium

- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:83`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:99`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:170`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:266`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:415`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:523`

`App.jsx` still owns `chartMapping`, `chartData`, `selectedChartType`, and `showChartWindow`, and `handleDragEnd` still falls back to updating `chartMapping` directly when a drop does not target a context-managed chart. But the actual chart windows are created and updated through `WindowContext`. This leaves dead or partially dead state in the shell and increases the chance that a drag/drop or chart-selection change updates the wrong layer.

### 5. `CanvasContainer` is overloaded as a prop broker instead of consuming stable state slices directly

Severity: Medium

- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:513`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\layout\CanvasContainer.jsx:24`

`CanvasContainer` receives a very large prop surface for preview state, AI windows, workflow state, story state, raw viewer state, chart state, and machine learning state. At the same time, it also reads `DataContext` and `WindowContext` directly. That mixed ownership model makes it difficult to tell whether a given behavior should be changed in `App`, in `CanvasContainer`, or in context, and it guarantees more interface drift over time.

### 6. Storyboard persistence uses two unrelated state channels

Severity: Medium

- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:105`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\App.jsx:480`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\layout\CanvasContainer.jsx:644`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\insights\DataStoryPanel.jsx:17`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\components\insights\DataStoryPanel.jsx:58`

`App` tracks `storyData` and pushes it down through `CanvasContainer`, but `DataStoryPanel` persists its own story into `WindowContext` content state and does not consume `storyData` as its primary source. This is a clear case of duplicated ownership for the same concept, and it makes restore/reopen behavior harder to reason about.

### 7. Workflow orchestration leaks through `window.*` globals and custom DOM events

Severity: Medium

- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\workflow\AiWorkflowLab.jsx:141`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\workflow\AiWorkflowLab.jsx:147`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\workflow\AiWorkflowLab.jsx:163`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\workflow\AiWorkflowLab.jsx:188`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\ai\AiAutopilot.jsx:36`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\ai\AiAutopilot.jsx:90`
- `C:\Users\18022\Desktop\AI_Tool\frontend\frontend\src\features\ai\AiAutopilot.jsx:133`

`AiAutopilot` and `AiWorkflowLab` coordinate through `window.importWorkflowSpec`, `window.runAIPipeline`, and a custom `autopilot-workflow-ready` event. That bypasses React ownership entirely and creates timing dependencies on mount order. The workflow state exists in React, but control moves through the global window object.

## Recommendations

1. Remove the inner `WindowProvider` from `App.jsx` and keep a single provider instance at the app root.
2. Reconnect the inspector flow explicitly: restore a single `inspectorSelection` owner in `App`, pass `onInspectItem` into `CanvasContainer`, and pass `inspectorSelection` into `DataPane`.
3. Define one canonical active-dataset selector and make all read paths consume it. Components should stop manually choosing between `cleanedData`, `fullData`, `uploadedData`, and `filteredData`.
4. Delete or migrate the legacy chart state in `App.jsx` (`chartMapping`, `chartData`, `selectedChartType`, `showChartWindow`) so all chart creation and updates happen through `WindowContext`.
5. Split shell/UI state from feature state. `App` should keep only global shell concerns, while feature-specific visibility and content state should move either into feature contexts or into the owning window components.
