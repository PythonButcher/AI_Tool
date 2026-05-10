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

May 9, 2026 next implementation plan: Phase 2 semantic role strengthening is now the active next Codex slice at `project_docs/active/decision_intelligence/current/phase_2_semantic_role_strengthening_plan.md`.

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

The frontend build is stable and passing.

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

- **OPEN THROUGH SEMANTIC ROLE PLAN**

Truth:

- the prompt-first intake flow exists
- backend hardening already covers the key objective-versus-lever parsing failure mode
- prompt-first reliability is now grounded by the completed Phase 1 benchmark and will be strengthened through `project_docs/active/decision_intelligence/current/phase_2_semantic_role_strengthening_plan.md`

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
- Phase 2 semantic role strengthening is the next active implementation plan.

## Active Workstreams

- [x] Council-derived next-focus execution plan created at `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md`
- [x] Phase 1 Decision Intelligence reliability foundation implemented and verified (Object-path, state-preservation, and capability-merging fixes applied)
- [ ] Phase 2 semantic role strengthening: add decision-aware semantic roles, confidence, aliases, polarity, controllability, and unresolved mapping details
- [~] Prompt-first intake reliability for real decision prompts, now tracked through the next-focus execution plan
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

- **Frontend Build**: `npm --prefix frontend\frontend run build` executed and passed successfully on May 9, 2026.
- **Git Compliance**: `git diff --check` executed and verified a clean codebase with no trailing whitespace on May 9, 2026.
- **Capability Merging Check**: Code review confirmed that `AIShell.jsx` now correctly merges `unsupported_requested_capabilities` from both artifact and response sources, fixing the shadowing bug identified during review.
- **Logic Check**: Verified that the "Observational Reliability Boundary" banner and "Analysis Ready" status are correctly driven by backend fields in both AI Shell and Decisions workspace.
- **Unsupported Prompt Verification**: Verified that simulation and optimization prompts correctly surface prompt-specific requested unsupported status using normalized and merged capability state.
- **Phase 1 Reliability Benchmark**: `tests.test_decision_reliability_benchmark` (Python backend) passed, verifying the contract that the frontend now consumes.
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
- `project_docs/active/decision_intelligence/current/phase_2_semantic_role_strengthening_plan.md`
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

The council concluded that the next application focus should be measurable Decision Intelligence reliability before broad feature expansion. The highest-priority reliability foundation is now complete. The active follow-on priority is semantic role strengthening, then decision-frame correction, ranked observational evidence, canonical active dataset alignment, ML readiness diagnostics, and future simulation/trade-off contract design.

### Previous Council Run

An app-wide UI flaws council has been run for a Gemini cleanup handoff before additional feature work.

Council artifact:

- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/2026-04-28-gemini-council.json`

Gemini handoff:

- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/gemini_handoff.md`

The council concluded that the first Gemini slice should focus on UI correctness and trust: AI chat action state, chat-to-Decisions continuity, truthful capability language, draft and analysis inspectability, inert AI shell surfaces, semantic definition recovery, accessibility, and focused verification. It should not add features or start with a broad shell rewrite.

## One-Line Status Truth

Decision Intelligence Phase 1 reliability foundation is complete. The active next slice is Phase 2 semantic role strengthening.
