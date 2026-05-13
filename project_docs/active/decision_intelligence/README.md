# Decision Intelligence Documentation Map

This folder is organized so current work and completed records are no longer mixed together.

`current/` contains the active Decision Intelligence implementation plan and roadmap.

`completed/` contains completed Phase 3.5/4/4.5 plans, old checklists, and Gemini handoff records. Do not scan it by default.

## Current Truth

The current truth lives in `project_docs/active/status/decision_intelligence_execution_status.md`, not in older phase plans in this folder.

Phase 4.5 hardening, Phase 1 reliability foundation, and Phase 2 semantic role strengthening are complete as backend foundations. The next work is defined in `current/phase_3_correction_and_observational_evidence_plan.md`: deterministic decision-frame corrections and ranked observational evidence.

## Read These By Task

| Task | Read |
| --- | --- |
| Resume current Decision Intelligence work | `project_docs/active/status/decision_intelligence_execution_status.md`, then `current/phase_3_correction_and_observational_evidence_plan.md` |
| Review the council-derived roadmap | `current/next_focus_execution_plan.md` |
| Review completed prompt-first intake behavior | `completed/phase_3_5_decision_intake_rework.md` |
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
| `completed/phase_1_reliability_fields_gemini_handoff.md` | Completed Phase 1 reliability frontend handoff and review record. |
| `completed/phase_2_semantic_role_strengthening_plan.md` | Completed Phase 2 backend plan and acceptance record. |
| `completed/phase_2_semantic_role_strengthening_gemini_handoff.md` | Completed Phase 2 semantic frontend handoff record. |
| `completed/decision_intelligence_v3_phase_4_execution_checklist.md` | Historical checklist. Some unchecked items may be stale; active status wins. |

## Ownership Reminder

Codex owns backend logic, contracts, tests, architecture, reviews, and active Markdown coordination.

Gemini owns frontend implementation unless the user explicitly authorizes Codex to edit frontend files in the current session.
