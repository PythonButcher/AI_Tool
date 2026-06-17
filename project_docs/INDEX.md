# AI_Tool Documentation Map

Give Codex and Gemini a map, not a 1000 page instruction manual.

This is the top-level routing file. Use it to find the smallest current document needed for the task. Do not scan every Markdown file.

## First Reads

| Order | File | Why |
| --- | --- | --- |
| 1 | `project_docs/active/README.md` | Active navigation and scan rules |
| 2 | `project_docs/active/status/decision_intelligence_execution_status.md` | Short current truth |
| 3 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` | Codex/Gemini ownership |

## Current Work Map

| Need | Read |
| --- | --- |
| Check concise current status | `project_docs/active/status/decision_intelligence_execution_status.md` |
| Review Decision Intelligence implementation details | `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` |
| Implement current AI Chat emergency overhaul | `project_docs/active/decision_intelligence/current/ai_chat_emergency_overhaul_action_plan.md` |
| Work on backend/frontend contracts | `project_docs/active/contracts/decision_objects.md` |
| Prepare or review Gemini handoffs | `project_docs/active/ai_hand_off/README.md` |
| Keep Codex runs efficient | `project_docs/active/codex_harness_engineering.md` |
| Improve or reuse the agent harness | `project_docs/active/agent_harness/README.md` |
| Review cleanup/pruning candidates | `project_docs/active/reviews/project_pruning_recommendations.md` |
| Run Agent Council workflow | `project_docs/active/agent_council/README.md` |
| Find old status or superseded plans | `project_docs/archive/superseded_active_2026_05_24/` |

## Current Product Truth

Decision Intelligence V3 is active.

AI Chat is now the intended primary work surface for Decision Intelligence. Existing AI Chat behavior must remain: normal answers, charts, exploration, decide mode, artifact inspection, and exports.

Decision Intelligence should become a structured output in the AI Chat results pane. The Decisions window should become secondary later, likely as a saved decision library, fullscreen review, or historical asset viewer.

The old standalone Phase 4 Canonical Active Dataset handoff is superseded. Dataset truth remains required, but it should be implemented as Dataset Trust inside the unified AI Chat decision output flow.

## Ownership

| Agent | Owns |
| --- | --- |
| Codex | Backend truth, contracts, tests, architecture, docs, cleanup planning, review, and project gate facilitation |
| Gemini | Frontend implementation, React/CSS, browser verification, frontend status updates |

Codex must not edit frontend files unless the user explicitly authorizes Codex frontend edits in the current session.

Codex must make the current project gate explicit after substantial Decision Intelligence work. Say whether the phase is complete end to end, backend-only complete, frontend verification needed, Gemini handoff needed, blocked, or ready for the next phase. Do not make the user infer who acts next.

## Do Not Do This

Do not scan `project_docs/archive/` unless this map or the user asks for historical context.

Do not treat archived or completed files as active plans.

Do not restart the old standalone Phase 4 dataset handoff.

Do not build a separate dashboard project before unifying the current AI Chat output flow.

Previous full index was preserved at `project_docs/archive/superseded_active_2026_05_24/INDEX_pre_map_cleanup_2026_05_24.md`.
