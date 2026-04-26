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

Slice 2.5 is complete.

Live UI verification passed for the `marketing spend by channel / gross margin` prompt: the decision kickoff renders the expected objective, horizon, levers, segment, guardrail, readiness meaning, truthfulness note, and `Analyze workspace` next action. Clicking `Analyze workspace` returns grounded observational analysis rather than a recommendation, simulation, optimizer, or final decision.

Follow-up note for later frontend polish: the inspector detail pane for workspace analysis is still sparse (`Analysis finalized.`), even though the chat result contains the useful observational summary. Treat that as a future artifact-detail rendering improvement, not a Slice 2.5 blocker.

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

- **BACKEND COMPLETE; FRONTEND SLICE 1 HARDENING COMPLETE**

Truth:

- the backend decision engine and chat contract are real
- `ask`, `explore`, and `decide` are implemented server-side
- the frontend now has full Slice 1 legibility and metadata integration, including the fix for assumption/blocker rendering.

### Phase 4.5 AI Chat Decision Intelligence

Status:

- **SLICE 1 COMPLETE; SLICE 2.5 COMPLETE**

Truth:

- this is the current product-improvement phase
- Slice 1 (Frontend Fidelity) is complete: mode legibility, action priority/tooltips, and metadata-driven artifact rendering are live.
- Slice 2.5 (Decision-Readable Drafts) is complete: backend preview enrichment, frontend object-payload mapping, build verification, and live UI verification have all passed.
- the UI clearly distinguishes between structural readiness for analysis and final recommendations.

## Active Workstreams

- [~] Prompt-first intake hardening for real decision prompts
- [x] Phase 4 backend decision chat contract
- [x] Slice 1 backend mode/state normalization
- [x] Slice 1 frontend fidelity (Mode legibility, Action fidelity, Artifact metadata, Rendering precision)
- [x] Slice 2.5 backend decision-readable draft responses
- [x] Slice 2.5 frontend rendering for decision-readable draft responses
- [~] Phase 4.5 AI chat decision-intelligence enhancement

## What Is Actually Implemented Today

- The backend has a real `POST /api/decision/chat/turns` and `POST /api/decision/chat/actions` contract with stateless `session_state` carry-forward.
- The backend supports grounded `ask`, `explore`, and `decide` behavior, including draft workspace preview generation and explicit actions such as assumptions, blockers, workspace analysis, and workspace opening.
- Slice 1 backend hardening is now in place: `session_state` carries explicit `mode_context`, `action_state`, `decision_state`, normalized analytics state, and stable available-action metadata.
- Chat artifacts now expose stable rendering metadata such as `artifact_id`, `render_hint`, `inspectable`, `default_view`, `source`, and `mode` so the frontend no longer has to infer those behaviors from shape alone.
- Slice 2.5 backend enrichment is live: draft workspace previews include object-based fields for `decision_kickoff`, `objective_metric`, `levers`, `segment_dimensions`, `guardrails`, and `recommended_next_action`.
- The frontend `workspace_preview` renderer correctly maps these object-based fields to UI elements.
- Prompt-first workspace drafting and workspace analysis already exist as real deterministic backend paths.
- The current Gemini Slice 1 & 2.5 passes fixed stale mode-reasons, restored raw analytics answers, resolved `workspace_analysis_summary` rendering defects, and implemented the kickoff-style preview with correct payload mapping for object-based fields.
- The product is no longer blocked on backend invention. The main risk is experience quality: intake reliability on real prompts, and handoff clarity.

## Canonical Resume Order

1. `project_docs/INDEX.md`
2. `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
3. `project_docs/active/status/decision_intelligence_execution_status.md`
4. `project_docs/active/decision_intelligence/decision_intelligence_v3_resume_handoff.md`
5. `project_docs/active/decision_intelligence/phase_4_5_ai_chat_decision_intelligence_plan.md`
6. the specific active handoff, checklist, or contract needed for the task

## Current Active Files

- `project_docs/active/decision_intelligence/decision_intelligence_v3_resume_handoff.md`
- `project_docs/active/decision_intelligence/phase_3_5_decision_intake_rework.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_phase_4_backend_checkpoint.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_phase_4_execution_checklist.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_gemini_handoff_02_chat_decision_bridge.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_gemini_handoff_03_phase_3_5_prompt_first_intake.md`
- `project_docs/active/decision_intelligence/phase_4_5_ai_chat_decision_intelligence_plan.md`
- `project_docs/active/decision_intelligence/slice_2_5_gemini_frontend_handoff.md`
- `project_docs/active/contracts/decision_objects.md`
- `project_docs/active/reviews/react_state_flow_review.md`

## One-Line Status Truth

Decision Intelligence is past the invention stage and into hardening: the backend contract is real, the shell exists, and Phase 4.5 is now about turning that into a reliable chat-first decision product.
