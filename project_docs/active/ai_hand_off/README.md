# AI Hand-Off Map

This folder is only for active Codex-to-Gemini handoffs.

## Ownership

Codex owns backend truth, contracts, tests, architecture decisions, status documentation, cleanup planning, and final coordination.

Gemini owns frontend implementation, React/CSS, UI rendering, browser verification, and frontend build work unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Handoffs

No active Gemini handoff is open.

Current truth: `project_docs/active/status/decision_intelligence_execution_status.md`

Recently completed handoff:

`project_docs/active/decision_intelligence/completed/phase_7_3_gemini_user_hypotheses_graph_to_action.md`

## Handoff Rule

When frontend work is needed, Codex must write a focused Gemini handoff that names the files to inspect, the backend truth, the acceptance behavior, the constraints, and the status-doc requirement.

When Codex opens or updates an active Gemini handoff, Codex must also give the user a clean paste-ready Gemini prompt in the final response for that turn.

Do not make Gemini infer backend truth from raw contracts. Do not let Gemini invent backend APIs or silently change product scope.

Previous full handoff README was preserved at `project_docs/archive/superseded_active_2026_05_24/ai_hand_off_README_pre_map_cleanup_2026_05_24.md`.
