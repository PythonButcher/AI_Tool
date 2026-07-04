# AI Hand-Off Map

This folder is only for active Codex-to-frontend-agent handoffs.

## Ownership

Codex owns backend truth, contracts, tests, architecture decisions, status documentation, cleanup planning, and final coordination.

Gemini or Antigravity owns frontend implementation, React/CSS, UI rendering, browser verification, and frontend build work unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Handoffs And Goal Prompts

`phase_4_antigravity_dashboard_canvas_layout_and_sharing_skeleton.md` - Antigravity owns the Phase 4 dashboard canvas layout and sharing skeleton implementation.

`antigravity_chart_color_picker_handoff.md` - Documentation complete; Antigravity owns the frontend-only chart color picker browser acceptance path.

`codex_evidence_to_action_workflow_goal.md` - Codex owns the Evidence-To-Action Workflow backend contract and tests first.

Completed handoffs are retained under `project_docs/active/decision_intelligence/completed/` as reference only. Completed examples include `project_docs/active/decision_intelligence/completed/phase_3_antigravity_charting_slicer_ui_handoff.md` and `project_docs/active/decision_intelligence/completed/phase_5_gemini_ai_chat_decision_command_center.md`.

Current truth: `project_docs/active/status/decision_intelligence_execution_status.md`

## Handoff Rule

When frontend work is needed, Codex must write a focused frontend-agent handoff that names the files to inspect, the backend truth, the acceptance behavior, the constraints, and the status-doc requirement.

The handoff file is the automation surface. Each active handoff must contain one clear `Goal:` prompt near the top so Antigravity's `auto-handoff-execution` skill can read the file and execute the task without the user copying a prompt from chat.

When Codex opens or updates an active frontend handoff, the final response should name or link the handoff file and tell the user which agent owns the next step. Do not paste the full `Goal:` prompt in chat unless the user explicitly asks for it.

Do not make the frontend agent infer backend truth from raw contracts. Do not let the frontend agent invent backend APIs or silently change product scope.

## Task Sizing and Decomposition

Codex is responsible for decomposing frontend work before handing it off. A frontend handoff must be one independently reviewable slice: a small set of related files, one visible behavior, one API or state boundary, and a short acceptance list. It must not combine a new UI surface, persistence integration, state migration, export behavior, and broad regression validation in one request.

If a request needs more than one independently reviewable slice, Codex must write the dependency order and issue only the first slice. The frontend agent must stop before beginning an oversized or ambiguous request, report the blocking scope, and request a breakdown. The frontend agent must not silently delegate, broaden scope, or declare a multi-slice task complete without that communication.

Previous full handoff README was preserved at `project_docs/archive/superseded_active_2026_05_24/ai_hand_off_README_pre_map_cleanup_2026_05_24.md`.
