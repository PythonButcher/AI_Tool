# AI Hand-Off Map

This folder is only for active Codex-to-frontend-agent handoffs.

## Ownership

Codex owns backend truth, contracts, tests, architecture decisions, status documentation, cleanup planning, and final coordination.

Gemini or Antigravity owns frontend implementation, React/CSS, UI rendering, browser verification, and frontend build work unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Handoffs And Goal Prompts

Active frontend-agent handoff: none.

The completed Saved Decision Library compact rehaul handoff is retained at `project_docs/active/decision_intelligence/completed/antigravity_saved_decision_library_metadata_filters_handoff.md` as a reference only. The active Decision Intelligence gate is Codex-owned and does not have a frontend-agent handoff yet.

Codex-owned current goals live in `project_docs/active/decision_intelligence/active_gate/`, not in this handoff folder. Current active gate: `project_docs/active/decision_intelligence/active_gate/README.md`.

Deferred dashboard handoffs are retained under `project_docs/active/decision_intelligence/future/` and must not be executed until the active status file and `project_docs/active/decision_intelligence/active_gate/README.md` promote them.

Completed handoffs are retained under `project_docs/active/decision_intelligence/completed/` as reference only. Completed examples include `project_docs/active/decision_intelligence/completed/antigravity_saved_decision_library_metadata_filters_handoff.md`, `project_docs/active/decision_intelligence/completed/phase_3_antigravity_charting_slicer_ui_handoff.md`, `project_docs/active/decision_intelligence/completed/phase_5_gemini_ai_chat_decision_command_center.md`, `project_docs/active/decision_intelligence/completed/antigravity_chart_color_picker_handoff.md`, `project_docs/active/decision_intelligence/completed/codex_evidence_to_action_workflow_goal.md`, and `project_docs/active/decision_intelligence/completed/antigravity_evidence_to_action_workflow_handoff.md`.

Current truth: `project_docs/active/status/decision_intelligence_execution_status.md`

## Handoff Rule

When frontend work is needed, Codex must write a focused frontend-agent handoff that names the files to inspect, the backend truth, the acceptance behavior, the constraints, and the status-doc requirement.

The handoff file is the automation surface. Each active handoff must contain one clear `Goal:` prompt near the top so Antigravity's `auto-handoff-execution` skill can read the file and execute the task without the user copying a prompt from chat.

If the handoff is for a failed or incomplete frontend-agent implementation, it must be visibly labeled `REPAIR REQUIRED` near the top. Add a short `Repair Blocker` section that names the exact source file, broken assumption, expected contract behavior, and verification command. Keep the repair label and blocker separate from background context so Antigravity does not miss it.

When Codex opens or updates an active frontend handoff, the final response should name or link the handoff file and tell the user which agent owns the next step. Do not paste the full `Goal:` prompt in chat unless the user explicitly asks for it.

Do not make the frontend agent infer backend truth from raw contracts. Do not let the frontend agent invent backend APIs or silently change product scope.

## Task Sizing and Decomposition

Codex is responsible for decomposing frontend work before handing it off. A frontend handoff must be one independently reviewable slice: a small set of related files, one visible behavior, one API or state boundary, and a short acceptance list. It must not combine a new UI surface, persistence integration, state migration, export behavior, and broad regression validation in one request.

If a request needs more than one independently reviewable slice, Codex must write the dependency order and issue only the first slice. The frontend agent must stop before beginning an oversized or ambiguous request, report the blocking scope, and request a breakdown. The frontend agent must not silently delegate, broaden scope, or declare a multi-slice task complete without that communication.

Previous full handoff README was preserved at `project_docs/archive/superseded_active_2026_05_24/ai_hand_off_README_pre_map_cleanup_2026_05_24.md`.
