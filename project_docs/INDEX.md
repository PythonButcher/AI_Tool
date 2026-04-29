# Project Docs Index

This folder is the canonical home for project planning, implementation, handoff, and review markdown.

## Default Scan Rule

Use `project_docs/active/` by default.

Do not scan `project_docs/archive/` unless:

- an active doc explicitly points there
- the user asks for historical context
- a current contradiction cannot be resolved from the active set

The archive exists to preserve context without burning tokens on old plans that no longer drive implementation.

## Folder Structure

`project_docs/active/`

- current rules
- current execution status
- active Decision Intelligence plans and handoffs
- active contracts
- active technical reviews
- reusable planning workflows, including the Agent Council debate framework

`project_docs/archive/`

- historical `ai_handoff` material
- older overhaul plans
- semantic-foundation planning history
- implementation notes that are no longer part of the default execution path

## Active Scan Order

Read these first for current Decision Intelligence work:

1. `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
2. `project_docs/active/status/decision_intelligence_execution_status.md`
3. `project_docs/active/decision_intelligence/decision_intelligence_v3_resume_handoff.md`
4. `project_docs/active/decision_intelligence/phase_4_5_ai_chat_decision_intelligence_plan.md`
5. the specific active handoff or contract that matches the task

## Current Active Documents

Rules:

- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

Status:

- `project_docs/active/status/decision_intelligence_execution_status.md`

Decision Intelligence:

- `project_docs/active/decision_intelligence/decision_intelligence_v3_resume_handoff.md`
- `project_docs/active/decision_intelligence/phase_3_5_decision_intake_rework.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_phase_4_backend_checkpoint.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_phase_4_execution_checklist.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_gemini_handoff_02_chat_decision_bridge.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_gemini_handoff_03_phase_3_5_prompt_first_intake.md`
- `project_docs/active/decision_intelligence/phase_4_5_ai_chat_decision_intelligence_plan.md`
- `project_docs/active/decision_intelligence/slice_2_5_gemini_frontend_handoff.md`
- `project_docs/active/decision_intelligence/slice_3_real_action_system_gemini_frontend_handoff.md`

Contracts and reviews:

- `project_docs/active/contracts/decision_objects.md`
- `project_docs/active/reviews/react_state_flow_review.md`

Planning workflows:

- `project_docs/active/agent_council/README.md`
- `project_docs/active/agent_council/agent_roles.md`
- `project_docs/active/agent_council/master_council_prompt.md`
- `project_docs/active/agent_council/council_output_schema.json`
- `project_docs/active/agent_council/sample_decision_intelligence_council_output.json`
- `project_docs/active/agent_council/validate_council_json.py`
- `project_docs/active/agent_council/app_wide_ui_flaws_gemini_handoff.md`
- `project_docs/active/agent_council/outputs/2026-04-28-app-wide-ui-flaws-gemini-council.json`
