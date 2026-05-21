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

May 16, 2026 Phase 2.5 Semantic Frame Completion backend verification: Codex implemented role-aware prompt-first drafting in `backend/services/decision_workspace_service.py`. The active decision frame now carries additive `decision_scope.segment_dimensions`, keeps segment clauses out of lever extraction unless the prompt explicitly asks to change or shift a mix, parses multiple guardrails from a single clause, preserves numeric percentage thresholds with `value_status`, blocks analysis readiness when a required threshold is unparsed, and keeps Phase 2 semantic trace fields on active objective, lever, segment, and guardrail bindings. `backend/decision_engine/chat_service.py` now builds workspace previews from active segment dimensions before falling back to legacy dimension-backed levers. Focused tests cover the exact May 14 acceptance prompt plus nearby segmentation, explicit mix, unparsed-threshold, and chat-preview variants. Phase 2.5 is complete and verified on the backend; Phase 3 remains deferred and has not been started.

May 16, 2026 Phase 2.5 frontend handoff completion: Codex recreated `project_docs/active/ai_hand_off/` and wrote `project_docs/active/ai_hand_off/phase_2_5_gemini_frontend_segment_dimensions.md` because the opened Decisions workspace needed to render `decision_scope.segment_dimensions` as first-class active decision-frame information. Gemini completed that frontend slice. Codex remains the backend owner, application organizer, and final coordinator with the user.

Slice 3 and Phase 4.5 Hardening are complete and verified.

May 20, 2026 PDF Export Refactoring: Gemini deprecated the low-quality DOM-capture fallback in the analytical reporting pipeline. `AIReporter.jsx` was refactored to remove `reportExportRef` and its associated DOM node dependency. `pdfReportExport.js` was updated to remove the `exportElementToPdf` import and the conditional logic that triggered DOM-based PDF generation. The `generateAnalyticalPdfReport` function now exclusively uses the high-quality procedural `exportStructuredPdf` pipeline while retaining `captureVisibleChartImages()` to correctly handle canvas-based visualizations.

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
- prompt-first reliability is grounded by the completed Phase 1 benchmark and Phase 2 semantic metadata. Phase 2.5 backend completion now fixes the May 14 active-frame defects for objective, levers, guardrails, segments, threshold preservation, and readiness semantics. Phase 3 remains deferred and has not been started.

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
- Phase 2.5 semantic frame completion is complete and verified on the backend and frontend. The opened Decisions workspace renders segment dimensions as first-class decision-frame information. Phase 3 correction and ranked observational evidence is deferred until the user explicitly starts the next slice.

## Active Workstreams

- [x] Council-derived next-focus execution plan created at `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md`
- [x] Phase 1 Decision Intelligence reliability foundation implemented and verified (Object-path, state-preservation, and capability-merging fixes applied)
- [x] Phase 2 semantic role strengthening product completion through Phase 2.5: backend and Gemini frontend work are verified for opened workspace segment rendering
- [x] Phase 2.5 semantic frame completion backend slice: implemented and verified; clear objective, lever, guardrail, segment, and threshold terms survive into the active workspace frame
- [x] Phase 2.5 Gemini frontend segment-dimensions slice: complete; verified with build and browser-flow check
- [ ] Phase 3 correction and ranked observational evidence backend slice: ready to start when the user explicitly starts the next slice
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

## What Is Actually Implemented Today

- **Phase 1 Reliability Foundation**: Backend reliability fields, benchmark fixtures, grading checks, and frontend rendering integration are complete.
- **Phase 2 Semantic Role Strengthening**: Metadata plumbing is implemented, and Phase 2.5 completes the backend active-frame behavior for the May 14 acceptance prompt.
  - **Backend Foundation**: Semantic model finalization adds additive decision-aware role metadata for metrics and dimensions. Decision Workspace prompt-first drafting can surface confidence, reasons, warnings, and unresolved mappings for ambiguous or weak matches.
  - **Behavior Gap Found May 14**: The exact real-dataset test prompt dropped `gross_margin_pct above 30%` from active guardrails, lost the `4%` threshold on `return_rate_pct`, treated only `channel` as the active preview segment while `region` appeared only in scoped context, and introduced `channel mix` as a lever even though the prompt used channel as segmentation.
  - **Frontend State**: `SemanticRef` component integration exists, but frontend rendering cannot compensate for an incorrect active backend frame.
- **Phase 2.5 Semantic Frame Completion**: Complete and verified backend-first plan, created at `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md`.
  - **Backend Result**: Prompt-first role extraction now preserves clearly stated objectives, levers, guardrails, segments, and threshold values in the active workspace frame.
  - **Acceptance Prompt**: `How should we grow revenue next quarter using marketing_spend and discount_pct as controllable levers, segmented by region and channel, while keeping gross_margin_pct above 30% and return_rate_pct below 4%?`
  - **Required Active Frame**: objective `revenue`; levers `marketing_spend` and `discount_pct`; segments `region` and `channel`; guardrails `gross_margin_pct above 30%` and `return_rate_pct below 4%`; no false `channel mix` lever; no null guardrail threshold values.
  - **Contract Addition**: `decision_scope.segment_dimensions` carries active segment bindings, and guardrail conditions may include additive `value_status` to distinguish parsed, qualitative, and unparsed thresholds.
  - **Frontend Handoff**: Phase 2.5 frontend is complete; the opened Decisions workspace renders `decision_scope.segment_dimensions` as first-class decision-frame information. Verified with build and browser-flow check.
- **Phase 3 Correction And Ranked Observational Evidence**: Plan exists at `project_docs/active/decision_intelligence/current/phase_3_correction_and_observational_evidence_plan.md`. It is the next backend-first slice and should begin when the user explicitly starts it.
- **Phase 1 Reliability Foundation (Frontend)**: The UI now fully supports the backend reliability contract with correct object-path normalization, state preservation, and cross-level capability merging.
  - **Reliability Boundaries**: Clear visual banners and notes communicating the "observational analysis only" constraint.
  - **Capability Matrices**: A structured display of allowed vs. unsupported capabilities (Simulation, Optimization, etc.).
  - **Unsupported Requested Capabilities**: Prompt-specific detection of requested but unsupported capabilities is functional, correctly merging artifact-level capability matrices with response-level requested unsupported lists to prevent data shadowing.
  - **Dynamic Action Readiness**: Analyze workspace and other actions respect backend-owned blocked_state and allowed_next_actions.
  - **Normalization & Preservation**: Frontend correctly derives readiness and capability status by preserving top-level response metadata and merging it during artifact rendering.
- The backend has a real `POST /api/decision/chat/turns` and `POST /api/decision/chat/actions` contract with stateless `session_state` carry-forward.
- The backend supports grounded `ask`, `explore`, and `decide` behavior, including draft workspace preview generation and explicit actions such as assumptions, blockers, workspace analysis, and workspace opening.
- Chat-to-Decisions continuity: The `open_workspace` action successfully navigates the user to the Decisions destination and hydrates the correct workspace state.
- Scoped action resolution: Historical chat cards maintain their original action state correctly.
- UI Truthfulness: Misleading marketing language (simulation, optimization, autonomous) has been replaced with grounded, observational terminology.
- Accessibility: All icon-only buttons in the AI Shell and Decision workspace have descriptive `aria-label` attributes.
- Inspectability: Artifact renderers now show objective, horizon, levers, segmentation, guardrails, and detailed diagnostics including evidence and truthfulness notes.
- Semantic Recovery: The "Review semantic definitions" link in the Decision Panel is functional.
- Styling: Dense, professional styling for data cleaning controls has been restored.

## Verification Performed

- **Frontend Build**: `npm --prefix frontend\frontend run build` executed and compiled successfully on May 11, 2026, with existing warnings.
- **Phase 2 Frontend Integration Verification**: Verified that fallback labels for `objective_metric`, `levers`, `segment_dimensions`, and `guardrails` are preserved using flattened fields (`strings`, `label`, `binding_label`, `metric`, `dimension_id`, `field`) when nested refs are missing. Unresolved mappings in `workspace_preview` now build descriptive labels from type, term, reason, and candidates. May 16 Phase 2.5 backend verification fixed the real acceptance prompt defects.
- **May 14 Review**: Codex confirmed the decision routed to `decide`, semantic metadata exists, but the active frame omitted `gross_margin_pct` as a guardrail, lost the `return_rate_pct` threshold value, handled `region` and `channel` inconsistently as segments, and created an unwanted `channel mix` lever.
- **May 16 Phase 2.5 Frontend Verification**: `npm --prefix frontend\frontend run build` executed and compiled successfully. `git diff --check` is clean. `DecisionWorkspaceView.jsx` and `DecisionWorkspace.css` were updated to render `decision_scope.segment_dimensions` as first-class decision-frame information. Guardrail rendering was hardened to handle `value_status: "unparsed"` thresholds, ensuring unparsed numeric limits are surfaced as needing review rather than appearing as empty valid values. Browser verification against the May 14 acceptance prompt ("How should we grow revenue next quarter using marketing_spend and discount_pct as controllable levers, segmented by region and channel, while keeping gross_margin_pct above 30% and return_rate_pct below 4%?") confirms that the opened Decisions workspace visibly shows objective `revenue`, levers `marketing_spend` and `discount_pct`, segments `region` and `channel`, and guardrails `gross_margin_pct` and `return_rate_pct` with their respective thresholds. No false `channel mix` lever is present. Phase 2.5 frontend is complete.
- **May 16 Phase 2.5 Backend Verification**: Bundled Python runtime passed `python -m unittest tests.test_semantic_role_strengthening`, `python -m unittest tests.test_decision_workspace_service`, and `python -m unittest tests.test_decision_reliability_benchmark`. The local system Python command `python -m unittest tests.test_decision_workspace_service` remains blocked because that interpreter cannot import `pandas`. The optional bundled-runtime chat-service target `python -m unittest tests.test_decision_chat_service` remains blocked because `flask` is not installed in that runtime. Phase 2.5 backend is complete.
- **Git Compliance**: `git diff --check` executed and verified a clean codebase with no trailing whitespace on May 9, 2026.
- **Capability Merging Check**: Code review confirmed that `AIShell.jsx` now correctly merges `unsupported_requested_capabilities` from both artifact and response sources, fixing the shadowing bug identified during review.
- **Logic Check**: Verified that the "Observational Reliability Boundary" banner and "Analysis Ready" status are correctly driven by backend fields in both AI Shell and Decisions workspace.
- **Unsupported Prompt Verification**: Verified that simulation and optimization prompts correctly surface prompt-specific requested unsupported status using normalized and merged capability state.
- **Phase 1 Reliability Benchmark**: `tests.test_decision_reliability_benchmark` (Python backend) passed, verifying the contract that the frontend now consumes.
- **Phase 2 Semantic Role Tests**: `tests.test_semantic_role_strengthening` passed on May 10, 2026 using the bundled Python runtime at `C:\Users\18022\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.
- **Phase 2 Workspace Regression**: `tests.test_decision_workspace_service` passed on May 10, 2026 using the bundled Python runtime.
- **Phase 2 Reliability Regression**: `tests.test_decision_reliability_benchmark` passed on May 10, 2026 using the bundled Python runtime.
- **Local Python Caveat**: Plain `python -m unittest` under `C:\Program Files\Python311\python.exe` is currently blocked because the sandboxed interpreter cannot import dependencies that pip reports under the user-site package directory, including `pandas` and `dateutil`. `tests.test_decision_chat_service` is also blocked under the bundled runtime because Flask dependencies are not fully visible there (`flask`/`werkzeug` path issue). The backend semantic and workspace behavior was verified with the bundled Python runtime instead.
- **Stale-Card Action Check**: Verified that action handling in `AIShell.jsx` uses message-scoped `session_state`.
- **Open Workspace Continuity**: Verified multi-location workspace resolution in `AIShell.jsx`.

## Canonical Resume Order

1. `project_docs/INDEX.md`
2. `project_docs/active/README.md`
3. `project_docs/active/status/decision_intelligence_execution_status.md`
4. `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
5. the task-specific file named by the navigation docs

## Current Navigation And Truth Files

- `project_docs/active/README.md`
- `project_docs/active/status/decision_intelligence_execution_status.md`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `project_docs/active/decision_intelligence/README.md`
- `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md`
- `project_docs/active/decision_intelligence/current/phase_3_correction_and_observational_evidence_plan.md`
- `project_docs/active/decision_intelligence/completed/phase_2_semantic_role_strengthening_plan.md`
- `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md`
- `project_docs/active/agent_council/outputs/application-next-focus-priorities/README.md`
- `project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json`

## Task-Specific Reference Files

These files are still useful, but agents should not scan them by default.

- `project_docs/active/decision_intelligence/completed/phase_3_5_decision_intake_rework.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_phase_4_backend_checkpoint.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_phase_4_execution_checklist.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_gemini_handoff_02_chat_decision_bridge.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_gemini_handoff_03_phase_3_5_prompt_first_intake.md`
- `project_docs/active/decision_intelligence/completed/phase_4_5_ai_chat_decision_intelligence_plan.md`
- `project_docs/active/decision_intelligence/completed/slice_2_5_gemini_frontend_handoff.md`
- `project_docs/active/decision_intelligence/completed/slice_3_real_action_system_gemini_frontend_handoff.md`
- `project_docs/active/decision_intelligence/completed/phase_1_reliability_fields_gemini_handoff.md`
- `project_docs/active/contracts/decision_objects.md`
- `project_docs/active/reviews/react_state_flow_review.md`
- `project_docs/active/agent_council/README.md`
- `project_docs/active/agent_council/outputs/README.md`
- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/README.md`
- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/gemini_handoff.md`

## Planning Support

The Agent Council workflow is available for future planning debates that need multiple AI perspectives, explicit disagreement, reconciliation, and a structured JSON output for downstream analysis.

Start with:

- `project_docs/active/agent_council/README.md`
- `project_docs/active/agent_council/master_council_prompt.md`
- `project_docs/active/agent_council/council_output_schema.json`

This workflow is documentation and handoff support only. It does not alter frontend behavior, backend behavior, API contracts, or Decision Intelligence runtime capability.

### Latest Council Run

An application next-focus priorities council has been run to rank what the product should focus on after Phase 4.5 hardening and the app-wide UI flaw cleanup.

Council artifact:

- `project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json`

The council concluded that the next application focus should be measurable Decision Intelligence reliability before broad feature expansion. The highest-priority reliability foundation is complete, semantic role metadata exists, and Phase 2.5 backend and frontend completion now fixes the May 14 prompt-first semantic frame defects. Phase 3 correction and ranked observational evidence is the next slice when the user explicitly starts it, followed by canonical active dataset alignment, ML readiness diagnostics, and future simulation/trade-off contract design.

### Previous Council Run

An app-wide UI flaws council has been run for a Gemini cleanup handoff before additional feature work.

Council artifact:

- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/2026-04-28-gemini-council.json`

Gemini handoff:

- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/gemini_handoff.md`

The council concluded that the first Gemini slice should focus on UI correctness and trust: AI chat action state, chat-to-Decisions continuity, truthful capability language, draft and analysis inspectability, inert AI shell surfaces, semantic definition recovery, accessibility, and focused verification. It should not add features or start with a broad shell rewrite.

## One-Line Status Truth

Phase 2.5 backend and frontend segment-dimensions integration are complete/verified; Phase 3 remains deferred and has not been started.
