# Decision Intelligence Execution Status

## Purpose

This file is the current execution-status index for Decision Intelligence work.

It replaces the old scattered handoff lookup pattern with a smaller active set under `project_docs/active/`.

## Scan Rule

Default to scanning `project_docs/active/`.

Do not scan `project_docs/archive/` unless an active document points there or historical context is explicitly needed.

## Codex Guardrail

Before Codex edits frontend files for this initiative, re-read:

- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

## Current Status Snapshot

## Current Coordination Checkpoint

May 9, 2026 Phase 1 reliability foundation completion: Codex added a repeatable Decision Intelligence benchmark suite with 20 prompt fixtures and grading checks for extraction, readiness, allowed and disabled actions, unsupported capability requests, and forbidden claims. Backend decision workspace and chat responses now include additive `decision_readiness`, `readiness_state`, `structural_readiness`, `blocked_state`, `allowed_next_actions`, `capability_state`, `unsupported_capabilities`, and `not_ready_for_recommendation` fields while preserving existing endpoint names, artifact types, action IDs, and compatibility fields. Gemini completed frontend consumption of those fields, including object-path normalization, response-level state preservation, and capability merging for requested unsupported capabilities. `ml_logic.py` now has a deterministic pandas-only anomaly fallback when scikit-learn is unavailable, because the current pinned requirements do not include scikit-learn.

May 10, 2026 Phase 2 semantic role strengthening backend slice: Codex added additive `decision_semantics` metadata to finalized semantic metrics and dimensions, including objective, lever, guardrail, segment, comparison, temporal, aliases, business terms, polarity, controllability, conservative confidence, confidence reasons, and unresolved role-review reasons. Metric and dimension refs now echo this metadata when available. Prompt-first Decision Workspace drafting now carries `semantic_binding_confidence`, `semantic_binding_reason`, `semantic_role_source`, `semantic_role_warnings`, and `drafting.prompt_matches.unresolved_mappings` so weak or ambiguous semantic matches are visible instead of silently treated as certain. The resolver remains backward-compatible with older semantic models and still allows strong prompt evidence to resolve with warnings when role metadata is imperfect.

May 11, 2026 Phase 2 semantic role strengthening frontend slice: Gemini integrated `SemanticRef` component across AI Shell and Decisions workspace, surfacing role metadata, confidence, trace reasons, warnings, unresolved mappings, and readable fallback labels for flattened workspace fields. Codex review confirmed the objective fallback regression is fixed and the frontend build compiles. Minor Gemini-owned cleanup remains: compact semantic refs should visibly surface role metadata, and modified frontend files should pass `git diff --check`.

May 14, 2026 Phase 2 product-behavior review: AI Chat and Decisions workspace review artifacts showed Phase 2 semantic metadata is present in raw contracts, but the active decision frame was not reliable enough to mark the product behavior complete. The test prompt was: "How should we grow revenue next quarter using marketing_spend and discount_pct as controllable levers, segmented by region and channel, while keeping gross_margin_pct above 30% and return_rate_pct below 4%?" The result correctly routed to `decide`, created a workspace, mapped objective `revenue`, and exposed semantic metadata such as `decision_semantics`, `semantic_binding_confidence`, `semantic_binding_reason`, `semantic_role_source`, polarity, controllability, aliases, and warnings. However, `gross_margin_pct above 30%` was detected only in prompt matches and did not become an active guardrail; `return_rate_pct below 4%` became a guardrail but lost its threshold value (`value: null`); `region and channel` was inconsistent, with only `channel` shown in the preview segment while `region` appeared only in scoped context; and `channel mix` was incorrectly introduced as a controllable lever even though the prompt used channel as segmentation. Phase 2.5 semantic frame completion was created at `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md`.

May 14, 2026 next implementation plan correction: Phase 3 correction and ranked observational evidence remains planned. Phase 2.5 resolved the prompt-first semantic frame extraction and guardrail threshold preservation blockers, so Phase 3 is now the next backend-first slice when the user explicitly starts it.

May 16, 2026 Phase 2.5 Semantic Frame Completion backend verification: Codex implemented role-aware prompt-first drafting in `backend/services/decision_workspace_service.py`. The active decision frame now carries additive `decision_scope.segment_dimensions`, keeps segment clauses out of lever extraction unless the prompt explicitly asks to change or shift a mix, parses multiple guardrails from a single clause, preserves numeric percentage thresholds with `value_status`, blocks analysis readiness when a required threshold is unparsed, and keeps Phase 2 semantic trace fields on active objective, lever, segment, and guardrail bindings. `backend/decision_engine/chat_service.py` now builds workspace previews from active segment dimensions before falling back to legacy dimension-backed levers. Focused tests cover the exact May 14 acceptance prompt plus nearby segmentation, explicit mix, unparsed-threshold, and chat-preview variants. Phase 2.5 is complete and verified on the backend. Phase 3 backend correction and ranked observational evidence is now also implemented and verified.

May 16, 2026 Phase 2.5 frontend handoff completion: Codex recreated `project_docs/active/ai_hand_off/` and wrote `project_docs/active/ai_hand_off/phase_2_5_gemini_frontend_segment_dimensions.md` because the opened Decisions workspace needed to render `decision_scope.segment_dimensions` as first-class active decision-frame information. Gemini completed that frontend slice. Codex remains the backend owner, application organizer, and final coordinator with the user.

Slice 3 and Phase 4.5 Hardening are complete and verified.

May 20, 2026 PDF Export Refactoring: Gemini performed a comprehensive audit and refactoring of the PDF export pipeline to eliminate all "fuzzy" low-quality DOM-capture snapshots.
- **`AIReporter.jsx` & `pdfReportExport.js`**: Refactored to remove all DOM node dependencies and force procedural generation.
- **`AIShell.jsx` (AI Chat)**: Deprecated `sourceElement` passing in `handleExportArtifactPdf`, ensuring all chat artifacts (Results, Charts, Workspace Previews) are exported via high-quality procedural mapping.
- **`DecisionWorkspaceView.jsx` & `DataStoryPanel.jsx`**: Removed DOM refs and `sourceElement` triggers.
- **`decisionPdfExport.js`**: Completely deprecated `exportElementToPdf` and the `sourceElement` fallback. The utility now exclusively uses `exportStructuredPdf` to map complex workspace states to crisp, searchable PDF structures.
- **Result**: Unified, robust, and reusable high-fidelity PDF tool now enforced across the entire application.

May 21, 2026 Sidebar Data Ingestion Integration: Gemini migrated the data source intake UI (Upload, API, DB, and Hub) from floating ribbon-inline panels to a permanent, high-density sidebar system within `DataPane`.
- **Integrated Sidebar Tabs**: Added a tab system to `DataPane` (Catalog vs Connect), allowing users to switch between field exploration and new data connections within the same "flush" vertical space.
- **Enterprise Card Navigation**: Implemented a "Sources" landing view within the sidebar using professional cards for Local File, API, SQL Warehouse, and Data Hub.
- **Auto-Stacking Forms**: Refactored forms to automatically stack vertically when inside the sidebar, ensuring they are "neat, tight, and flush" with the application frame regardless of screen width.
- **Unified Handlers**: Lifted sidebar tab state to `App.jsx`, allowing `MenuBar` ribbon buttons to remotely trigger the sidebar and switch to the ingestion tab for a seamless cross-component workflow.

May 21, 2026 Integrated Source Panels Refactoring: Gemini refactored the data source intake surfaces (Upload, API, Database, and Hub) to eliminate redundant shells and achieve a unified, integrated "panel-only" UI.
- **Centralized Panel Shell**: Updated `MenuBar.jsx` and `MenuBar.css` to handle the primary inline-panel container, providing a single header, badge system, and close button for all data sources.
- **Redundancy Removal**: Stripped internal headers, backgrounds, and duplicate "minimize" logic from `FileUpload.jsx`, `APiDataForm.jsx`, `DatabaseConnectForm.jsx`, and `DataHubWindow.jsx`.
- **Modernized Aesthetics**: Applied a high-density professional style across all source surfaces, using `var(--bg-primary)` for content and `var(--bg-secondary)` for headers/inputs to prevent the "two-tone" cheesy look. Improved grid layouts and typography for a cleaner, unified user experience.

May 21, 2026 Modal UI Refactoring: Gemini refactored the Upload, Database, and API connection modal windows to meet enterprise standards.
- **Design Tokens**: Standardized to 4px border-radius (sharper corners), 520px consistent max-width, and 32px (var(--space-5)) uniform padding across all data intake surfaces.
- **Typography**: Unified the heading hierarchy, removing oversized disparate styles and standardizing on a professional eyebrow/heading structure.
- **Alignment**: Fixed cramped action icons (Minimize, Help, Close) in `FileUpload.jsx` and added identical header actions to `DatabaseConnectForm.jsx` and `ApiDataForm.jsx` for UI consistency.
- **Responsive Behavior**: Ensured all modal containers are responsive with `width: 100%` and `max-width: 520px`.
- **Code Health**: Updated `MenuBar.jsx` to pass `onClose` handlers uniformly and introduced `isMinimized` states for improved workspace management.

May 22, 2026 Phase 3 Correction And Ranked Observational Evidence backend slice: Codex implemented deterministic backend decision-frame corrections and ranked observational workspace diagnostics without changing endpoint names, existing action IDs, artifact types, readiness fields, or the observational-analysis-only boundary. `backend/services/decision_workspace_service.py` now supports explicit corrections for objective metric, objective direction, time horizon, lever binding, lever controllability, guardrail binding, guardrail condition, segment dimension, and removal of unsafe mappings. Corrections recompute scoped context, assumptions, unknowns, readiness, allowed next actions, and additive correction trace/history. `backend/decision_engine/chat_service.py` applies correction payloads through the existing `draft_workspace` action path and preserves corrected session state. Workspace analysis now returns additive `ranked_diagnostics` with evidence rank, relevance score, evidence strength, semantic coverage, data sufficiency, limitations, and `observational_boundary: "observational_analysis_only"`. Focused Phase 3 tests were added in `tests/test_decision_phase_3_correction.py`.

May 8, 2026 documentation navigation update: the documentation entry path has been simplified. Agents should start with `project_docs/INDEX.md`, then `project_docs/active/README.md`, then this status file and the frontend guardrail. Decision Intelligence docs are now physically organized into `project_docs/active/decision_intelligence/current/` and `project_docs/active/decision_intelligence/completed/` so agents do not bulk scan completed work by default.

April 30, 2026 UI tooling update: Codex corrected AI Chat pop-out behavior to use a real browser popup window through `window.open`, then portals the AI Chat React surface into that popup. The app-level minimize control in the popup now flushes the main app's minimized-window state before closing the popup, so AI Chat returns to the existing minimized dock instead of disappearing. If the popup is closed through browser chrome, AI Chat restores back into the main app instead of disappearing. Other app windows remain contained by the normal canvas/window system. The shared minimize control now exposes the correct `Minimize` accessibility label. Browser smoke verification confirmed popup minimize closes the popup and adds `AI Chat` to the main app dock.

The application has been hardened against UI flaws:
- Decision actions are now scoped to the specific message context, ensuring historical turns remain accurate.
- Chat-to-Decisions continuity is live: the `open_workspace` action successfully navigates the user to the Decisions destination and hydrates the workspace using any valid scoped draft location (top-level or nested).
- The UI has been scrubbed of misleading "simulation" and "optimization" language, replaced with truthful "observational analysis" while preserving backend contract compatibility.
- Accessibility labels have been added to icon-only controls across the AI Shell and Decision Panel.
- Specialized renderers for `workspace_preview` and `workspace_analysis_summary` provide deep inspectability into objectives, levers, and diagnostics.
- Source code has been polished: accidental working notes removed from `DecisionWorkspaceView.jsx`.
- Dense styling for data cleaning controls has been restored.

The frontend build compiles. Minor Gemini-owned Phase 2 frontend cleanup remains tracked in this status file.

### V2

Status:

- **CLOSED AS-IS**

Meaning:

- V2 is a frozen historical baseline
- V2 docs live in `project_docs/archive/`
- V2 is not the default resume path

### V3

Status:

- **ACTIVE CONTINUATION PATH**

Meaning:

- V3 remains the product line that carries Decision Intelligence forward
- the current product truth is defined by the active docs in this folder

### Phase 3.6 Prompt-First Intake

Status:

- **OPEN THROUGH PHASE 3 CORRECTION PLAN**

Truth:

- the prompt-first intake flow exists
- backend hardening already covers the key objective-versus-lever parsing failure mode
- prompt-first reliability is grounded by the completed Phase 1 benchmark, Phase 2 semantic metadata, and Phase 2.5 active-frame completion. Phase 3 backend correction and ranked observational evidence, along with the Gemini frontend rendering for these fields, are complete and verified as of May 22, 2026.

### Phase 4 Chat Contract

Status:

- **BACKEND COMPLETE; FRONTEND HARDENING COMPLETE**

Truth:

- the backend decision engine and chat contract are real
- `ask`, `explore`, and `decide` are implemented server-side
- the frontend has full fidelity, including scoped action handling and continuity.

### Phase 4.5 AI Chat Decision Intelligence

Status:

- **SLICE 1 COMPLETE; SLICE 2.5 COMPLETE; SLICE 3 COMPLETE; HARDENING COMPLETE**

Truth:

- backend Phase 1 reliability fields and tests are complete.
- frontend Phase 1 reliability integration is complete and verified.
- The UI correctly normalizes and merges reliability fields, ensuring that capability boundaries and requested unsupported features are surfaced truthfully.
- State preservation and context propagation issues have been resolved.
- Phase 2.5 semantic frame completion is complete and verified on the backend and frontend. Phase 3 backend correction actions and ranked observational evidence are implemented and verified. Gemini frontend rendering for these fields is complete and verified as of May 22, 2026, including contract alignment, final style property cleanup, and documentation consistency.

## Active Workstreams

- [x] Council-derived next-focus execution plan created at `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md`
- [x] Phase 1 Decision Intelligence reliability foundation implemented and verified (Object-path, state-preservation, and capability-merging fixes applied)
- [x] Phase 2 semantic role strengthening product completion through Phase 2.5: backend and Gemini frontend work are verified for opened workspace segment rendering
- [x] Phase 2.5 semantic frame completion backend slice: implemented and verified; clear objective, lever, guardrail, segment, and threshold terms survive into the active workspace frame
- [x] Phase 2.5 Gemini frontend segment-dimensions slice: complete; verified with build and browser-flow check
- [x] Phase 3 correction and ranked observational evidence frontend final cleanup: complete; contract shape is corrected, invalid plain React style shorthands (mb, mt, ml) are replaced with valid CSS, build passes, and documentation is synchronized as of May 22, 2026
- [x] Prompt-first intake reliability for the May 14 acceptance prompt: backend and frontend verified in opened Decisions workspace
- [x] Phase 4 backend decision chat contract
- [x] Slice 1 backend mode/state normalization
- [x] Slice 1 frontend fidelity (Mode legibility, Action fidelity, Artifact metadata, Rendering precision)
- [x] Slice 2.5 backend decision-readable draft responses
- [x] Slice 2.5 frontend rendering for decision-readable draft responses
- [x] Slice 3 backend real action system contract
- [x] Slice 3 frontend real action rendering
- [x] Phase 4.5 AI chat decision-intelligence enhancement
- [x] Agent Council planning workflow added under `project_docs/active/agent_council/`
- [ ] Phase 4 Canonical Active Dataset Contract: active next; align dataset truth across AI Chat, Decisions, charts, dashboards, workflows, filters, cleaning, uploads, and semantic model consumers without reopening the completed historical Phase 4 chat-contract work

## What Is Actually Implemented Today

- **Phase 1 Reliability Foundation**: Backend reliability fields, benchmark fixtures, grading checks, and frontend rendering integration are complete.
- **Phase 2 Semantic Role Strengthening**: Metadata plumbing is implemented, and Phase 2.5 completes the backend active-frame behavior for the May 14 acceptance prompt.
- **Phase 2.5 Semantic Frame Completion**: Complete and verified backend-first plan.
- **Phase 3 Correction And Ranked Observational Evidence**: Backend and frontend slices are complete. Existing endpoint names, action IDs, artifact types, readiness fields, and observational-analysis-only boundary are preserved. Corrections are explicit and deterministic. Analysis responses now include additive ranked observational diagnostics.
- **Phase 4 Canonical Active Dataset Contract**: Active next roadmap item. This should establish one visible and contract-backed active dataset source of truth, plus clear override behavior, across the major app surfaces. It is separate from the completed historical Phase 4 chat-contract work.
- **Phase 1 Reliability Foundation (Frontend)**: The UI now fully supports the backend reliability contract.
- The backend has a real `POST /api/decision/chat/turns` and `POST /api/decision/chat/actions` contract.
- The backend supports grounded `ask`, `explore`, and `decide` behavior.
- Chat-to-Decisions continuity: The `open_workspace` action successfully navigates the user.
- UI Truthfulness: Misleading marketing language has been replaced.
- Accessibility: All icon-only buttons have descriptive `aria-label` attributes.
- Inspectability: Artifact renderers now show all Phase 3 fields.

## Verification Performed

- **May 22 Phase 3 Frontend Verification**: `npm --prefix frontend\frontend run build` executed and compiled successfully. `git diff --check` is clean. `AIShell.jsx` and `DecisionWorkspaceView.jsx` were updated to render additive correction results and high-fidelity `RankedEvidenceCard` components with comprehensive `semantic_coverage` details. All invalid plain React style shorthands (`mb`, `mt`, `ml`) were replaced with valid CSS properties.
- **Git Compliance**: `git diff --check` verified a clean codebase on May 22, 2026.

## Canonical Resume Order

1. `project_docs/INDEX.md`
2. `project_docs/active/README.md`
3. `project_docs/active/status/decision_intelligence_execution_status.md`
4. `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
5. the task-specific file named by the navigation docs

## One-Line Status Truth

Phase 3 backend deterministic correction actions and ranked observational evidence are complete and verified; the active next roadmap item is Phase 4 Canonical Active Dataset Contract.
