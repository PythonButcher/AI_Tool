# App-Wide PDF Export Unification Plan

## Purpose

The app needs one accurate, polished PDF export system used consistently across features. The first Decision Intelligence PDF export was useful for debugging, but it did not match the content visible in the AI Chat and Decisions workspace windows. It produced a clunky report with too much raw contract JSON, poor visual hierarchy, and a different reading experience from the actual UI.

This plan makes PDF export the active next implementation slice before Phase 2.5 semantic frame completion.

## Current Status

Status: active next Codex implementation slice.

The user explicitly wants this branch before Phase 2.5 because accurate exports make it much easier to share AI Chat, Decisions workspace, and other app results for review without screenshots. Phase 2.5 semantic frame completion remains next after this PDF export work is complete.

## Product Goal

PDF export should feel like a faithful, polished print/export version of what the user is looking at in the app. It should not be a lossy debug dump unless the user explicitly asks for a debug export.

The exported PDF should match the visible feature content as closely as practical: same title, same section order, same cards or table structure, same labels, same selected result, same user-facing text, same semantic badges where visible, same chart or workspace result, and same current state. It should be compact, readable, visually aligned with the app, and reliable enough to use as the primary review artifact.

## Why This Comes Before Phase 2.5

The May 14 Decision Intelligence review depended on exported PDFs. The export did reveal backend frame problems, but the PDF itself was too sloppy and too different from the UI. Before continuing semantic frame reliability work, the app needs a trustworthy export layer so future reviews can compare exact UI output, exact workspace state, and exact generated evidence without relying on screenshots.

## Scope

This is app-wide export work, not only Decision Intelligence.

Unify or replace the existing PDF export paths so the app does not have separate inconsistent implementations for charts, Data Story, AI Chat, Decisions, workflow reports, and file export.

Relevant starting files include:

`frontend/frontend/src/utils/pdfReportExport.js`

`frontend/frontend/src/utils/decisionPdfExport.js`

`frontend/frontend/src/features/charts/ChartToolbar.jsx`

`frontend/frontend/src/components/insights/DataStoryPanel.jsx`

`frontend/frontend/src/components/data_management/FileExport.jsx`

`frontend/frontend/src/features/workflow/AIReporter.jsx`

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/features/ai/AIShell.css`

`frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`

`frontend/frontend/src/features/business/decision/DecisionWorkspace.css`

Search the frontend for all `jsPDF`, `html2canvas`, `Export PDF`, `Export as PDF`, `generateAnalyticalPdfReport`, and `generateDecisionWorkspacePdf` usage before changing behavior.

## Required Behavior

The export should be accurate to the window or result being exported. For AI Chat, exporting a workspace preview should export the visible workspace preview content, not an invented report. Exporting an Explore answer should export the visible answer card/table/chart. Exporting the active inspector result should export that inspector result. For Decisions workspace, exporting should match the current workspace view and include the visible analysis section if it is present.

The export should use one shared app-wide export utility or framework with feature-specific adapters only where needed. Do not keep three unrelated PDF generation styles unless there is a documented reason.

Raw JSON should not be included in the normal PDF by default. If raw contract details are useful, add a clearly named debug export option or an appendix mode. Normal export should prioritize the visible product result.

The generated PDF should have a clean header, useful title, generated timestamp, page footer, consistent margins, compact spacing, and no giant debug blobs. It should avoid orphaned labels, excessive whitespace, broken long IDs, repeated boilerplate, and 10-page exports for one compact workspace preview.

Icons should be cleaner than the old Data Story toolbar, consistent with the app's existing icon system, and accessible with clear `aria-label` values.

## Suggested Technical Direction

Prefer a shared export utility that can capture a known DOM region or render from a shared declarative export model. The important constraint is fidelity: the normal PDF should match what the user sees.

For visual features, DOM capture or print-oriented HTML rendering may be more appropriate than manually reconstructing every field with `jsPDF.text`. If using `html2canvas`, handle scaling, background colors, scrollable regions, long content, and multipage splitting carefully. If using a print/HTML route, make sure it works in the current React app and does not require a backend service.

For charts, preserve the rendered chart image and its visible title/toolbar context. For Data Story, preserve the current story/charts layout. For AI Chat and Decisions, preserve the visible artifact/workspace sections and semantic tags. If a feature has hidden state that matters, include it only when it is user-facing or explicitly selected for export.

## Acceptance Criteria

The app has one primary PDF export system used by all current PDF export entry points or a documented adapter layer that still produces consistent output.

The Data Story PDF export remains available and looks at least as polished as before.

Chart PDF export remains available and preserves the visible chart, title, and context.

AI Chat exports are available for relevant results and match the visible result card or inspector content.

Decisions workspace export matches the visible workspace content and visible analysis content when present.

Normal PDFs do not include raw JSON dumps by default.

Exports are compact and visually usable for review. A typical Decision Workspace preview should not become an 11-page debug document unless a debug export path is explicitly selected.

Icon buttons have clear labels/tooltips and do not clutter the UI.

`npm --prefix frontend\frontend run build` passes.

Run `git diff --check` on touched files.

If practical, use browser or Playwright verification to export at least one AI Chat result and one Decisions workspace result and inspect that the generated PDF corresponds to visible content.

## Non-Goals

Do not implement new Decision Intelligence semantics in this branch.

Do not start Phase 2.5 semantic frame completion in this branch.

Do not add simulation, optimization, autonomous decisioning, or final recommendation language.

Do not redesign the entire app shell. Keep the work focused on accurate, reusable PDF export.

## Documentation Updates Required

When complete, update:

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/INDEX.md` and `project_docs/active/README.md` if the active next implementation path changes back to Phase 2.5

Any export utility notes if a reusable export API is introduced

## Start Prompt

Start by reading AGENTS.md, project_docs/INDEX.md, project_docs/active/README.md, project_docs/active/status/decision_intelligence_execution_status.md, and project_docs/active/pdf_export_unification_plan.md. Implement app-wide PDF export unification before Phase 2.5. The export to PDF must accurately match the visible decision, chat, chart, story, or report content being exported; the first Decision Intelligence export was too clunky and did not match the window. Build one shared, polished export system or a clearly documented shared adapter layer used by all current PDF export entry points. Normal PDFs should not dump raw JSON by default; they should be compact, visually aligned with the app, accessible, and smooth. Preserve existing export entry points for charts, Data Story, AI Chat relevant artifacts, Decisions workspace, workflow reports, and file export where applicable. Use clean icon buttons with labels/tooltips. Verify with npm --prefix frontend\frontend run build and git diff --check on touched files. Do not implement Phase 2.5 semantic frame fixes in this branch.
