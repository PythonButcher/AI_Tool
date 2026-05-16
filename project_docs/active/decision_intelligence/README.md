# Decision Intelligence Documentation Map

This folder is organized so current work and completed records are no longer mixed together.

`current/` contains the active Decision Intelligence implementation plan and roadmap.

`completed/` contains completed Phase 3.5/4/4.5 plans, old checklists, and Gemini handoff records. Do not scan it by default.

## Current Truth

The current truth lives in `project_docs/active/status/decision_intelligence_execution_status.md`, not in older phase plans in this folder.

Phase 4.5 hardening and Phase 1 reliability foundation are complete. Phase 2 semantic metadata plumbing is implemented. App-wide PDF export remediation is accepted. Phase 2.5 backend semantic frame completion is complete and verified. The active next work is Gemini frontend rendering for `decision_scope.segment_dimensions`, tracked at `project_docs/active/ai_hand_off/phase_2_5_gemini_frontend_segment_dimensions.md`. Phase 3 correction and ranked observational evidence is deferred until Phase 2.5 frontend review is accepted and the user explicitly starts Phase 3.

## Read These By Task

| Task | Read |
| --- | --- |
| Resume current project work | `project_docs/active/status/decision_intelligence_execution_status.md`, then `project_docs/active/ai_hand_off/README.md` |
| Run active Gemini frontend handoff | `project_docs/active/ai_hand_off/phase_2_5_gemini_frontend_segment_dimensions.md` |
| Review Phase 2.5 backend plan | `current/phase_2_5_semantic_frame_completion_plan.md` |
| Review the deferred Phase 3 plan | `current/phase_3_correction_and_observational_evidence_plan.md` |
| Review the council-derived roadmap | `current/next_focus_execution_plan.md` |
| Review completed prompt-first intake behavior | `completed/phase_3_5_decision_intake_rework.md` |
| Work on the completed chat backend contract | `completed/decision_intelligence_v3_phase_4_backend_checkpoint.md`, `completed/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md` |
| Review old Phase 4 completion details | `completed/decision_intelligence_v3_phase_4_execution_checklist.md` |
| Prepare or review active Gemini frontend handoff | `project_docs/active/ai_hand_off/README.md` |
| Review completed Gemini frontend handoff | the specific file in `completed/` named by the current task |
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

Codex owns backend logic, contracts, tests, architecture, reviews, application organization, and active Markdown coordination. Codex has final coordination say, with the user reviewing Codex work for acceptance.

Gemini owns frontend implementation unless the user explicitly authorizes Codex to edit frontend files in the current session.
