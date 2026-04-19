# Decision Intelligence V3 Resume Handoff

## Status Decision

Decision Intelligence V2 is closed **as it currently stands**.

This does **not** mean the vision is finished.

It means:

- the V2 branch/workstream stops here
- the current UI and product state become the baseline we carry forward
- all unfinished Decision Intelligence work now moves to **V3**

## Why This File Exists

Codex and Gemini both need one explicit instruction:

- do not continue treating V2 as the active implementation target
- treat V2 as the frozen handoff baseline
- resume all remaining Decision Intelligence work under V3

## What V2 Means Now

V2 should now be interpreted as:

- a completed checkpoint
- a partial product state
- a useful but incomplete shell for the larger Decision Intelligence direction

V2 is **not** the final expression of:

- decision UX quality
- chat-to-workspace clarity
- simulation and trade-off execution
- final layout polish
- final product coherence

## What V3 Owns

V3 is where the project should pick back up and finish the remaining work.

That includes:

- UI straightening and product coherence
- finishing the Decision Intelligence experience that still feels incomplete
- clarifying the relationship between chat, workspace, and decision flows
- completing the real simulation and trade-off architecture when approved
- tightening placeholders, truth alignment, and user trust
- resolving any remaining contract gaps between backend and frontend

## Current Backend V3 Checkpoint

The backend now supports:

- `POST /api/decision/workspaces` for scoped workspace creation
- additive prompt-first drafting through `POST /api/decision/workspaces` using `intake_mode: "prompt_first"` and `decision_intake`
- Phase 3.6 current-intake hardening so prompts with a goal, multiple levers, and a guardrail are split into separate drafting clauses before objective/lever/constraint selection
- `POST /api/decision/workspaces/analyze` for workspace-native observational diagnostics

Immediate cleanup handoff:

- `ai_handoff/ui_overhaul/decision_intelligence_v3_gemini_handoff_01_workspace_analysis_continuation.md`

For the current Gemini task, stop there.

Do not mix the cleanup handoff with later Phase 4 work in the same execution prompt.

Separate Phase 4 planning files:

- `ai_handoff/ui_overhaul/decision_intelligence_v3_gemini_handoff_02_chat_decision_bridge.md`
- `ai_handoff/phase_docs/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`

Required pre-Phase-4 plan:

- `ai_handoff/ui_overhaul/phase_3_5_decision_intake_rework.md`
- `ai_handoff/ui_overhaul/decision_intelligence_v3_gemini_handoff_03_phase_3_5_prompt_first_intake.md`

Important truth rule:

- the analysis endpoint is descriptive and scope-grounded
- it does **not** mean simulation, trade-off execution, or goal-seeking is complete
- any reused legacy signals must remain filtered, additive, and clearly secondary to the scoped workspace

## Immediate Priority

The current immediate product priority is:

1. complete the workspace-analysis cleanup if anything is still open
2. keep hardening the Decision Intelligence intake under V3 Phase 3.6 until prompt-first drafting is reliable on real prompts

The intake path still matters more than moving straight into chat.

Current Phase 3.6 truth:

- the frontend intake exists, but real prompt failures surfaced after rollout
- backend hardening is now in place for the most important failure mode: goal metric vs lever metric confusion
- the exact prompt `How should we grow revenue next quarter using discount rate and marketing spend changes by region without hurting gross margin?` is now covered by backend regression tests and should draft:
  - objective: `Revenue`
  - lever candidates: `Discount Rate`, `Marketing Spend`, `Region mix`
  - guardrail: `Gross Margin %`

Phase 4 chat-first work is important, but it should be started in a separate step with a separate prompt.

## Rules For Codex

Codex should treat V3 as the active workstream.

Codex owns:

- backend logic
- contracts
- architecture
- review
- markdown coordination and handoff maintenance

Codex does **not** own frontend changes for this initiative unless the user explicitly re-authorizes that in the current session.

## Rules For Gemini

Gemini should also treat V3 as the active workstream.

Gemini owns:

- frontend implementation
- layout cleanup
- UI straightening
- product polish
- truthful presentation of unfinished Decision Intelligence capabilities

Gemini should not keep describing the current work as "finishing V2."

The correct framing is:

- V2 is closed
- V3 is the continuation and completion path

## How To Read Older V2 Docs

Older V2 files remain useful as historical context, constraints, and implementation record.

They should now be read as:

- reference material
- not the active project label
- not the active completion target

If a V2 doc conflicts with this file, this file wins.

## Required Resume Order For The Next Branch

Read in this order:

1. `ai_handoff/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
2. `ai_handoff/ui_overhaul/ui_overhaul_execution_status.md`
3. `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`
4. the relevant historical V2 handoff or contract docs needed for the specific task

## One-Line Project Truth

Decision Intelligence V2 is done as-is; Decision Intelligence V3 is where the remaining work continues and gets finished.
