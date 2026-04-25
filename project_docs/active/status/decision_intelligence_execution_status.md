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

- **SLICE 1 COMPLETE; SLICE 2 BACKEND REWORK COMPLETE**

Truth:

- this is the current product-improvement phase
- Slice 1 (Frontend Fidelity) is complete: mode legibility, action priority/tooltips, and metadata-driven artifact rendering are live and contract-aligned.
- Slice 2 backend rework is complete based on live chat testing: new full decision prompts now replace stale draft workspaces, weak shared metric tokens no longer pull unrelated metrics into levers, and protected metrics draft as hard guardrails.
- regression coverage now replays realistic chat sequences where revenue, stockout-risk, discount-rate, segment, and guardrail prompts are asked back-to-back.
- AI chat backend review/hardening now also covers typed decision follow-ups (`Show blockers`, `Analyze workspace`) and prevents stale chart output preference from overriding later full analytic questions.
- frontend Slice 2 work has not been started in this pass.

## Active Workstreams

- [x] Prompt-first intake hardening for real decision prompts
- [x] Phase 4 backend decision chat contract
- [x] Slice 1 backend mode/state normalization
- [x] Slice 1 frontend fidelity (Mode legibility, Action fidelity, Artifact metadata, Rendering precision)
- [~] Phase 4.5 AI chat decision-intelligence enhancement

## What Is Actually Implemented Today

- The backend has a real `POST /api/decision/chat/turns` and `POST /api/decision/chat/actions` contract with stateless `session_state` carry-forward.
- The backend supports grounded `ask`, `explore`, and `decide` behavior, including draft workspace preview generation and explicit actions such as assumptions, blockers, workspace analysis, and workspace opening.
- Slice 1 backend hardening is now in place: `session_state` carries explicit `mode_context`, `action_state`, `decision_state`, normalized analytics state, and stable available-action metadata.
- Chat artifacts now expose stable rendering metadata such as `artifact_id`, `render_hint`, `inspectable`, `default_view`, `source`, and `mode` so the frontend no longer has to infer those behaviors from shape alone.
- Prompt-first workspace drafting and workspace analysis already exist as real deterministic backend paths.
- The frontend already has the destination-based shell, Decision Intelligence workspace flow, AI destination shell, inspector-style result pane behavior, and bounded chart rendering.
- The current Gemini Slice 1 pass fixed the stale mode-reason problem, restored raw analytics answer artifacts, and resolved the `workspace_analysis_summary` rendering defect for assumptions and blockers.
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
- `project_docs/active/contracts/decision_objects.md`
- `project_docs/active/reviews/react_state_flow_review.md`

## One-Line Status Truth

Decision Intelligence is past the invention stage and into hardening: the backend contract is real, the shell exists, and Phase 4.5 is now about turning that into a reliable chat-first decision product.
