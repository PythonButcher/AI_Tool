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

May 14, 2026 Phase 2 product-behavior review: user-exported PDFs from AI Chat and Decisions workspace showed Phase 2 semantic metadata is present in raw contracts, but the active decision frame is not reliable enough to mark the product behavior complete. The test prompt was: "How should we grow revenue next quarter using marketing_spend and discount_pct as controllable levers, segmented by region and channel, while keeping gross_margin_pct above 30% and return_rate_pct below 4%?" The result correctly routed to `decide`, created a workspace, mapped objective `revenue`, and exposed semantic metadata such as `decision_semantics`, `semantic_binding_confidence`, `semantic_binding_reason`, `semantic_role_source`, polarity, controllability, aliases, and warnings. However, `gross_margin_pct above 30%` was detected only in prompt matches and did not become an active guardrail; `return_rate_pct below 4%` became a guardrail but lost its threshold value (`value: null`); `region and channel` was inconsistent, with only `channel` shown in the preview segment while `region` appeared only in scoped context; and `channel mix` was incorrectly introduced as a controllable lever even though the prompt used channel as segmentation. Phase 2.5 semantic frame completion was created at `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md` and is scheduled after PDF export remediation is accepted.

May 14, 2026 next implementation plan correction: Phase 3 correction and ranked observational evidence remains planned, but is deferred until Phase 2.5 fixes prompt-first semantic frame extraction and guardrail threshold preservation.

May 14, 2026 PDF export acceptance correction: PDF export unification is not complete. Codex implemented a first shared PDF export layer at `frontend/frontend/src/utils/appPdfExport.js`, with feature adapters in `frontend/frontend/src/utils/pdfReportExport.js` and `frontend/frontend/src/utils/decisionPdfExport.js`, and normal Decision Intelligence PDFs no longer append raw contract JSON by default. However, user review found the Decisions workspace export still does not match the visible workspace window closely enough and remains too clunky as a review artifact. Active next work is PDF export remediation, focused first on Decisions workspace fidelity, then app-wide consistency. Phase 2.5 semantic frame completion resumes only after the PDF export work is accepted.

May 14, 2026 Decisions workspace export remediation continuation: Codex updated the shared DOM export path so feature adapters can pass capture-specific clone classes and clone preparation. The Decisions workspace export now passes a `decision-workspace-pdf-capture` class, expands the scrollable workspace in the cloned DOM, keeps the visible Analyze Workspace control in the capture, applies compact print-capture workspace CSS, and normalizes unsupported `color-mix()` / `color()` declarations in the cloned export DOM so `html2canvas` can capture the actual workspace instead of falling back to a rebuilt report. Browser verification exported a real Decisions workspace with visible analysis results to `decision_workspace_export_2026-05-14.pdf`; the PDF was a 3-page DOM capture preserving the visible header, status, prompt, reliability banner, scope summary, Success Objective, Strategic Levers, Guardrails, Scoped Context, assumptions, information gaps, readiness checklist, capability area, Analyze Workspace control, Workspace Analysis Summary, and Scoped Diagnostics. Normal PDFs still do not append raw contract JSON by default. This is implemented and awaiting user acceptance before Phase 2.5 resumes.

Slice 3 and Phase 4.5 Hardening are complete and verified.

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
- prompt-first reliability is grounded by the completed Phase 1 benchmark and Phase 2 semantic metadata, but May 14 PDF review showed the active prompt-first decision frame still needs Phase 2.5 completion before Phase 3. App-wide PDF export remediation is active first because the Decisions workspace PDF still does not match the visible workspace window closely enough for reliable review.

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
- App-wide PDF export remediation is active before Phase 2.5. The Decisions workspace PDF export must be formatted much closer to the visible workspace window before Phase 2.5 resumes. Phase 3 correction and ranked observational evidence is deferred until Phase 2.5 is complete.

## Active Workstreams

- [x] Council-derived next-focus execution plan created at `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md`
- [x] Phase 1 Decision Intelligence reliability foundation implemented and verified (Object-path, state-preservation, and capability-merging fixes applied)
- [~] Phase 2 semantic role strengthening product completion: semantic metadata plumbing is implemented, but active prompt-first frame behavior is not complete because guardrails, thresholds, and segmentation can be dropped or misclassified
- [~] App-wide PDF export remediation: first shared export layer exists and normal PDFs no longer append raw JSON by default, but Decisions workspace export fidelity is not accepted because it does not yet match the visible workspace window closely enough
- [ ] Phase 2.5 semantic frame completion backend slice: next after PDF export acceptance; fix prompt-first role extraction so clear objective, lever, guardrail, segment, and threshold terms survive into the active workspace frame
- [ ] Phase 3 correction and ranked observational evidence backend slice: deferred until Phase 2.5 is complete
- [~] Prompt-first intake reliability for real decision prompts, now tracked through Phase 2.5 semantic frame completion
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
- **Phase 2 Semantic Role Strengthening**: Metadata plumbing is implemented, but product behavior is not complete.
  - **Backend Foundation**: Semantic model finalization adds additive decision-aware role metadata for metrics and dimensions. Decision Workspace prompt-first drafting can surface confidence, reasons, warnings, and unresolved mappings for ambiguous or weak matches.
  - **Behavior Gap Found May 14**: The exact real-dataset test prompt dropped `gross_margin_pct above 30%` from active guardrails, lost the `4%` threshold on `return_rate_pct`, treated only `channel` as the active preview segment while `region` appeared only in scoped context, and introduced `channel mix` as a lever even though the prompt used channel as segmentation.
  - **Frontend State**: `SemanticRef` component integration and PDF export exist, but frontend rendering cannot compensate for an incorrect active backend frame.
- **Phase 2.5 Semantic Frame Completion**: Next backend plan after PDF export acceptance, created at `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md`.
  - **Backend Goal**: Fix prompt-first role extraction so the active workspace frame preserves clearly stated objectives, levers, guardrails, segments, and threshold values.
  - **Acceptance Prompt**: `How should we grow revenue next quarter using marketing_spend and discount_pct as controllable levers, segmented by region and channel, while keeping gross_margin_pct above 30% and return_rate_pct below 4%?`
  - **Required Active Frame**: objective `revenue`; levers `marketing_spend` and `discount_pct`; segments `region` and `channel`; guardrails `gross_margin_pct above 30%` and `return_rate_pct below 4%`; no false `channel mix` lever; no null guardrail threshold values.
- **App-Wide PDF Export Remediation**: Active before Phase 2.5.
  - **Shared Layer**: `frontend/frontend/src/utils/appPdfExport.js` exists and owns common PDF chrome, footer, text sanitization, chart capture, DOM-region capture, and structured fallback rendering.
  - **Adapters**: `pdfReportExport.js` and `decisionPdfExport.js` route analytical reports, Data Story, file export, workflow reports, AI Chat artifacts, and Decisions workspace exports through the shared layer.
  - **Behavior**: Normal Decision Intelligence PDFs no longer append raw contract JSON by default.
  - **Current Gap**: The Decisions workspace export has been remediated to use a DOM capture that is much closer to the visible workspace, including visible analysis results, but the work remains pending user acceptance before the active next path changes back to Phase 2.5.
  - **Sequencing**: PDF export remediation remains active, then Phase 2.5 semantic frame completion resumes.
- **Phase 3 Correction And Ranked Observational Evidence**: Plan exists at `project_docs/active/decision_intelligence/current/phase_3_correction_and_observational_evidence_plan.md`, but it is deferred until Phase 2.5 is complete.
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
- **May 14 PDF Export Build Verification**: `npm --prefix frontend\frontend run build` compiled successfully after the first shared PDF export implementation, with the existing warning set.
- **May 14 Decisions Export Remediation Build Verification**: `npm --prefix frontend\frontend run build` compiled successfully after the Decisions workspace DOM-capture remediation, with the existing warning set.
- **May 14 Decisions Export Browser Verification**: Browser automation uploaded a small revenue fixture, created a Decisions workspace from the Phase 2.5 acceptance prompt, ran Analyze Workspace, and exported the Decisions workspace PDF. The visible workspace text included the expected workspace hierarchy and visible analysis regions, including `Workspace Analysis Summary` and `Scoped Diagnostics`. The generated PDF saved as `.codex_tmp_exports/dom_decision_workspace_export_2026-05-14.pdf` was verified as a valid PDF and visually inspected through Chromium's PDF viewer screenshot; it used the DOM-captured workspace styling rather than the prior structured fallback report. The browser run also confirmed the DOM export no longer logs `PDF DOM export failed` for unsupported `color-mix()` parsing.
- **May 14 PDF Export Smoke Verification**: The frontend opened successfully at `http://localhost:3000` after the export changes. Browser smoke confirmed the app shell rendered. `git diff --check` reported no whitespace errors on touched files, only Git line-ending notices.
- **Phase 2 Frontend Integration Verification**: Verified that fallback labels for `objective_metric`, `levers`, `segment_dimensions`, and `guardrails` are preserved using flattened fields (`strings`, `label`, `binding_label`, `metric`, `dimension_id`, `field`) when nested refs are missing. Unresolved mappings in `workspace_preview` now build descriptive labels from type, term, reason, and candidates. May 14 PDF review showed frontend/export visibility is now sufficient to diagnose backend frame defects, but the active backend frame remains wrong for the real acceptance prompt.
- **May 14 PDF Review**: User exported `decision_ai_result_2026-05-14.pdf` and `decision_workspace_export_2026-05-14.pdf`. Codex extracted text from both PDFs and confirmed the decision routed to `decide`, semantic metadata exists, but the active frame omitted `gross_margin_pct` as a guardrail, lost the `return_rate_pct` threshold value, handled `region` and `channel` inconsistently as segments, and created an unwanted `channel mix` lever.
- **May 14 Export Quality Review**: User clarified that the PDF export must exactly match the decision or chat content where practical. Normal export should be same-as-window, app-wide, visually smooth, compact, and accurate; it should not be a sloppy debug report. Codex implemented the first shared export layer and removed default raw JSON appendices from normal Decision Intelligence PDFs, but the Decisions workspace export remains incomplete because it does not yet match the visible workspace results closely enough.
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
- `project_docs/active/pdf_export_unification_plan.md`
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

The council concluded that the next application focus should be measurable Decision Intelligence reliability before broad feature expansion. The highest-priority reliability foundation is complete, and semantic role metadata exists, but May 14 review showed prompt-first semantic frame behavior still needs Phase 2.5 completion before the ranked Phase 3 work. The user then moved app-wide PDF export remediation ahead of Phase 2.5 so review artifacts can accurately match visible app content. The first shared export implementation is not accepted yet because Decisions workspace PDF output still does not match the visible workspace window closely enough. The sequence is PDF export remediation, then Phase 2.5, then decision-frame correction and ranked observational evidence, then canonical active dataset alignment, ML readiness diagnostics, and future simulation/trade-off contract design.

### Previous Council Run

An app-wide UI flaws council has been run for a Gemini cleanup handoff before additional feature work.

Council artifact:

- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/2026-04-28-gemini-council.json`

Gemini handoff:

- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/gemini_handoff.md`

The council concluded that the first Gemini slice should focus on UI correctness and trust: AI chat action state, chat-to-Decisions continuity, truthful capability language, draft and analysis inspectability, inert AI shell surfaces, semantic definition recovery, accessibility, and focused verification. It should not add features or start with a broad shell rewrite.

## One-Line Status Truth

PDF export remediation is active, focused first on Decisions workspace window-fidelity; Phase 2.5 semantic frame completion resumes after PDF export acceptance.
