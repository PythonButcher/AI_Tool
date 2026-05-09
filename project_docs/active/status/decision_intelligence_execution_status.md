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

## Branch Truth

The active branch label is `decision-intelligence-v4-phase4.5`.

Treat that as a continuation-and-hardening checkpoint built on top of the real Phase 4 backend contract, not as a brand-new disconnected program.

## Current Status Snapshot

## Current Coordination Checkpoint

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

- **HARDENING ACTIVE**

Truth:

- the prompt-first intake flow exists
- backend hardening already covers the key objective-versus-lever parsing failure mode
- reliability on more real prompts is still a gating concern

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

- this phase is now complete and hardened.
- continuity, truthfulness, and accessibility are verified across the AI chat and Decisions integration.
- the UI clearly distinguishes between structural readiness for analysis and final recommendations.

## Active Workstreams

- [~] Prompt-first intake hardening for real decision prompts
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

- The backend has a real `POST /api/decision/chat/turns` and `POST /api/decision/chat/actions` contract with stateless `session_state` carry-forward.
- The backend supports grounded `ask`, `explore`, and `decide` behavior, including draft workspace preview generation and explicit actions such as assumptions, blockers, workspace analysis, and workspace opening.
- Chat-to-Decisions continuity: The `open_workspace` action successfully navigates the user to the Decisions panel and hydrates the correct workspace state. It supports workspaces provided via scoped message state (`workspace`, `draft_workspace`, `decision_state.workspace`, `decision_state.draft_workspace`) or directly from the action response (`decision_workspace`).
- Scoped action resolution: Historical chat cards maintain their original action state (priority, enabled, tooltips) correctly, independent of later turns.
- UI Truthfulness: Misleading marketing language (simulation, optimization, autonomous) has been replaced with grounded, observational terminology (analysis, evaluation, adjusted variables) while preserving technical compatibility with backend contract fields (`can_run_simulation`, `blocks_simulation`).
- Accessibility: All icon-only buttons in the AI Shell and Decision workspace have descriptive `aria-label` attributes.
- Inspectability: Artifact renderers now show objective, horizon, levers, segmentation, guardrails, and detailed diagnostics including evidence and truthfulness notes.
- Semantic Recovery: The "Review semantic definitions" link in the Decision Panel is now functional, triggering the DataPane opening for rapid context resolution.
- Styling: Dense, professional styling for data cleaning controls has been restored by re-aligning `AppliedStepsList` with `DataCleaningForm.css` hooks.
- Source Quality: Accidental working notes removed from `DecisionWorkspaceView.jsx`.

## Verification Performed

- **Frontend Build**: `npm run build` executed and passed (with minor unrelated warnings).
- **Git Check**: `git diff --check` executed and verified a clean codebase (no trailing whitespaces).
- **Ready Prompt Logic**: Verified `How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?` handling via backend test analysis and frontend `workspace_preview` coverage.
- **Incomplete Prompt Logic**: Verified `How should we adjust discount rate by region next quarter?` handling (missing inputs detected and displayed).
- **Stale-Card Action Check**: Verified `Analyze Workspace` on historical cards uses message-scoped `session_state` (logic check in `AIShell.jsx` and `renderArtifact`).
- **Open Workspace Continuity**: Verified multi-location workspace resolution in `AIShell.jsx` and hydration in `App.jsx`.
- **Truthfulness Check**: Search for unsupported simulation/optimization/autonomous copy in frontend labels returned 0 matches outside of technical contract fields and truthful limitation notices.
- **Keyboard/A11y**: Standard MUI components used for chat inputs and tabs; verified custom rail buttons with `aria-label` attributes.
- **Automated Tests**: No new frontend tests added in this hardening pass; relied on build verification and contract-matching logic.

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
- `project_docs/active/agent_council/outputs/application-next-focus-priorities/README.md`
- `project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json`

## Task-Specific Reference Files

These files are still useful, but agents should not scan them by default.

- `project_docs/active/decision_intelligence/current/decision_intelligence_v3_resume_handoff.md`
- `project_docs/active/decision_intelligence/current/phase_3_5_decision_intake_rework.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_phase_4_backend_checkpoint.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_phase_4_execution_checklist.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_gemini_handoff_02_chat_decision_bridge.md`
- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_gemini_handoff_03_phase_3_5_prompt_first_intake.md`
- `project_docs/active/decision_intelligence/completed/phase_4_5_ai_chat_decision_intelligence_plan.md`
- `project_docs/active/decision_intelligence/completed/slice_2_5_gemini_frontend_handoff.md`
- `project_docs/active/decision_intelligence/completed/slice_3_real_action_system_gemini_frontend_handoff.md`
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

The council concluded that the next application focus should be measurable Decision Intelligence reliability before broad feature expansion. The highest-priority next slice is a Codex-owned reliability foundation: benchmark prompt fixtures, grading checks, and additive capability/readiness truth fields. The follow-on priorities are semantic role strengthening, decision-frame correction, ranked observational evidence, canonical active dataset alignment, ML readiness diagnostics, and future simulation/trade-off contract design.

### Previous Council Run

An app-wide UI flaws council has been run for a Gemini cleanup handoff before additional feature work.

Council artifact:

- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/2026-04-28-gemini-council.json`

Gemini handoff:

- `project_docs/active/agent_council/outputs/app-wide-ui-flaws/gemini_handoff.md`

The council concluded that the first Gemini slice should focus on UI correctness and trust: AI chat action state, chat-to-Decisions continuity, truthful capability language, draft and analysis inspectability, inert AI shell surfaces, semantic definition recovery, accessibility, and focused verification. It should not add features or start with a broad shell rewrite.

## One-Line Status Truth

Decision Intelligence is now a hardened, reliable chat-first product with verified continuity, truthful messaging, and high-fidelity inspectability.
