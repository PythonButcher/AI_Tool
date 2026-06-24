# AI Hand-Off Map

This folder is only for active Codex-to-Gemini handoffs.

## Ownership

Codex owns backend truth, contracts, tests, architecture decisions, status documentation, cleanup planning, and final coordination.

Gemini owns frontend implementation, React/CSS, UI rendering, browser verification, and frontend build work unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Handoffs

None.

Completed handoffs are retained under `project_docs/active/decision_intelligence/completed/` as reference only.

Current truth: `project_docs/active/status/decision_intelligence_execution_status.md`

## Handoff Rule

When frontend work is needed, Codex must write a focused Gemini handoff that names the files to inspect, the backend truth, the acceptance behavior, the constraints, and the status-doc requirement.

When Codex opens or updates an active Gemini handoff, Codex must also give the user a clean paste-ready Gemini prompt in the final response for that turn.

Do not make Gemini infer backend truth from raw contracts. Do not let Gemini invent backend APIs or silently change product scope.

## Task Sizing and Decomposition

Codex is responsible for decomposing frontend work before handing it to Gemini. A Gemini handoff must be one independently reviewable slice: a small set of related files, one visible behavior, one API or state boundary, and a short acceptance list. It must not combine a new UI surface, persistence integration, state migration, export behavior, and broad regression validation in one request.

If a request needs more than one independently reviewable slice, Codex must write the dependency order and issue only the first slice. Gemini must stop before beginning an oversized or ambiguous request, report the blocking scope, and request a breakdown. Gemini must not silently delegate, broaden scope, or declare a multi-slice task complete without that communication.

Previous full handoff README was preserved at `project_docs/archive/superseded_active_2026_05_24/ai_hand_off_README_pre_map_cleanup_2026_05_24.md`.
