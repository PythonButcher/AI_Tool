# Project Documentation Index

This is the top-level documentation entry point for AI_Tool.

Agents must use this file as a routing map, not as permission to scan every Markdown file. The goal is to read the smallest set of current documents needed for the task.

## Required First Reads

| Order | File | Purpose |
| --- | --- | --- |
| 1 | `project_docs/active/README.md` | Main navigation hub and current scan rules. |
| 2 | `project_docs/active/status/decision_intelligence_execution_status.md` | Current project truth and implementation status. |
| 3 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` | Codex/Gemini ownership boundary. |

After those files, read only the task-specific document listed below.

## Current Work Path

| Need | Read |
| --- | --- |
| Review the latest completed implementation plan | `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md` |
| Keep Codex implementation runs efficient | `project_docs/active/codex_harness_engineering.md` |
| Review the council-derived roadmap | `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md` |
| Choose the next implementation slice | `project_docs/active/agent_council/outputs/application-next-focus-priorities/README.md` |
| Inspect the full latest council recommendation | `project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json` |
| Work on decision object contracts | `project_docs/active/contracts/decision_objects.md` |
| Work inside Decision Intelligence docs | `project_docs/active/decision_intelligence/README.md` first, then only the named file under `current/` or `completed/` |
| Review frontend state architecture | `project_docs/active/reviews/react_state_flow_review.md` |
| Review active Codex/Gemini handoffs | `project_docs/active/ai_hand_off/README.md` |
| Run or modify Agent Council workflow | `project_docs/active/agent_council/README.md` |

## Current Project Truth

Decision Intelligence V3 is active. V2 is closed as-is and lives as historical context.

Phase 4.5 AI Chat Decision Intelligence hardening is complete. The product now has real chat-to-decision continuity, scoped action behavior, truthful observational-analysis language, and verified frontend hardening.

The next work is not broad frontend polish and not new simulation or optimization. Phase 1 reliability foundation is complete. Phase 2 semantic metadata plumbing is implemented. Phase 2.5 backend semantic frame completion and Gemini frontend segment rendering are complete and verified for the May 14 acceptance prompt. The Gemini handoff at `project_docs/active/ai_hand_off/phase_2_5_gemini_frontend_segment_dimensions.md` is now a completed record, not an active implementation request. Phase 3 correction and ranked observational evidence remains deferred until the user explicitly starts the next slice. Frontend implementation remains Gemini-owned unless the user explicitly authorizes Codex frontend edits in the current session.

## Folder Map

| Folder | Meaning | Default Scan Rule |
| --- | --- | --- |
| `project_docs/active/status/` | Current execution truth. | Read first. |
| `project_docs/active/codex_harness_engineering.md` | Codex-specific run efficiency, tool-output, and verification rules. | Read for substantial Codex repo work. |
| `project_docs/active/rules/` | Standing rules and ownership boundaries. | Read when scope or frontend ownership matters. |
| `project_docs/active/contracts/` | Backend/frontend contract references. | Read when changing or reviewing response shapes. |
| `project_docs/active/ai_hand_off/` | Active Codex/Gemini handoffs. | Read when frontend work moves from Codex backend truth to Gemini implementation. |
| `project_docs/active/decision_intelligence/` | Decision Intelligence navigation, current docs, and completed handoffs. | Read its README first; use `current/` for active docs and `completed/` only for reference. |
| `project_docs/active/agent_council/` | Reusable council workflow and live planning outputs. | Read only for planning or next-focus decisions. |
| `project_docs/active/reviews/` | Focused technical reviews. | Read only when touching the reviewed area. |
| `project_docs/archive/` | Historical material. | Do not scan unless explicitly needed. |

## Do Not Do This

Do not scan `project_docs/archive/` for normal work.

Do not scan every file under `project_docs/active/decision_intelligence/`.

Do not treat old handoffs as current tasks unless the active status or user names them.

Do not treat old checklist unchecked boxes as current blockers if the active status says the work is complete.

Do not let frontend work drift to Codex unless the user explicitly authorizes Codex frontend edits in the current session.
