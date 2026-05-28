# AI Hand-Off Map

This folder is only for active Codex-to-Gemini handoffs.

## Ownership

Codex owns backend truth, contracts, tests, architecture decisions, status documentation, cleanup planning, and final coordination.

Gemini owns frontend implementation, React/CSS, UI rendering, browser verification, and frontend build work unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Handoffs

Phase 4 Gemini AI Chat decision output rendering: `project_docs/active/ai_hand_off/phase_4_gemini_ai_chat_decision_output_rendering.md`

Codex has defined and verified the backend/contract truth for the AI Chat `decision_output` artifact. Gemini can now implement frontend rendering in the existing AI Chat results pane.

Active rollout: `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md`

## Completed Or Superseded Records

| Record | Location |
| --- | --- |
| Phase 2.5 segment rendering handoff | `project_docs/active/decision_intelligence/completed/phase_2_5_gemini_frontend_segment_dimensions.md` |
| Phase 3 correction and ranked evidence handoff | `project_docs/active/decision_intelligence/completed/phase_3_gemini_frontend_correction_and_ranked_evidence.md` |
| Superseded Phase 4 dataset handoff | `project_docs/archive/superseded_active_2026_05_24/phase_4_gemini_frontend_canonical_active_dataset.md` |

## Handoff Rule

When frontend work is needed, Codex must write a focused Gemini handoff that names the files to inspect, the backend truth, the acceptance behavior, the constraints, and the status-doc requirement.

Do not make Gemini infer backend truth from raw contracts. Do not let Gemini invent backend APIs or silently change product scope.

Previous full handoff README was preserved at `project_docs/archive/superseded_active_2026_05_24/ai_hand_off_README_pre_map_cleanup_2026_05_24.md`.
