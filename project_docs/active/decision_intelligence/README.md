# Decision Intelligence Documentation Map

This folder is organized so current work and completed records are no longer mixed together.

`current/` contains active or still-relevant Decision Intelligence context.

`completed/` contains completed Phase 4/4.5 plans, old checklists, and Gemini handoff records. Do not scan it by default.

## Current Truth

The current truth lives in `project_docs/active/status/decision_intelligence_execution_status.md`, not in older phase plans in this folder.

Phase 4.5 hardening is complete. The next work is the Decision Intelligence reliability foundation: benchmark prompt fixtures, grading checks, additive capability/readiness fields, then semantic role strengthening.

## Read These By Task

| Task | Read |
| --- | --- |
| Resume current Decision Intelligence work | `project_docs/active/status/decision_intelligence_execution_status.md`, then `project_docs/active/agent_council/outputs/application-next-focus-priorities/README.md` |
| Understand why V3 exists | `current/decision_intelligence_v3_resume_handoff.md` |
| Work on prompt-first intake behavior | `current/phase_3_5_decision_intake_rework.md` |
| Work on the completed chat backend contract | `completed/decision_intelligence_v3_phase_4_backend_checkpoint.md`, `completed/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md` |
| Review old Phase 4 completion details | `completed/decision_intelligence_v3_phase_4_execution_checklist.md` |
| Prepare or review a completed Gemini frontend handoff | the specific file in `completed/` named by the current task |
| Understand completed Phase 4.5 intent | `completed/phase_4_5_ai_chat_decision_intelligence_plan.md` |

## Completed Or Reference-Only Files

The files below are useful records but should not be scanned by default:

| File | Status |
| --- | --- |
| `completed/decision_intelligence_v3_gemini_handoff_02_chat_decision_bridge.md` | Completed frontend handoff record. |
| `completed/decision_intelligence_v3_gemini_handoff_03_phase_3_5_prompt_first_intake.md` | Completed or historical prompt-first frontend handoff context. |
| `completed/slice_2_5_gemini_frontend_handoff.md` | Completed Slice 2.5 frontend handoff record. |
| `completed/slice_3_real_action_system_gemini_frontend_handoff.md` | Completed Slice 3 frontend handoff record. |
| `completed/decision_intelligence_v3_phase_4_execution_checklist.md` | Historical checklist. Some unchecked items may be stale; active status wins. |

## Ownership Reminder

Codex owns backend logic, contracts, tests, architecture, reviews, and active Markdown coordination.

Gemini owns frontend implementation unless the user explicitly authorizes Codex to edit frontend files in the current session.
