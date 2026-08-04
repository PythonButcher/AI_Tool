# AI_Tool Documentation Map

Give Codex and frontend agents a map, not a 1000 page instruction manual.

This is the top-level routing file. Use it to find the smallest current document needed for the task. Do not scan every Markdown file.

## First Reads

| Order | File | Why |
| --- | --- | --- |
| 1 | `project_docs/active/README.md` | Active navigation and scan rules |
| 2 | `project_docs/active/status/project_execution_status.md` | Short current truth |
| 3 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` | Codex/Antigravity ownership |

## Current Work Map

| Need | Read |
| --- | --- |
| Check concise current status | `project_docs/active/status/project_execution_status.md` |
| Work on the current project gate | `project_docs/active/active_gate/README.md` |
| Review the active data and backend roadmap | `project_docs/active/data_sources/multiple_data_sources_implementation_plan.md` |
| Review completed AI Chat rollout history | `project_docs/archive/ai_chat_decision_output_unification_rollout_completed.md` only when historical context is needed |
| Work on backend/frontend contracts | `project_docs/active/contracts/decision_objects.md` |
| Work on multiple-source workspace contracts | `project_docs/active/contracts/multiple_data_source_workspace.md` |
| Work on governed source relationships | `project_docs/active/contracts/multiple_data_source_relationships.md` |
| Work on dashboard canvas local state | `project_docs/active/contracts/dashboard_canvas_state.md` |
| Work on dataset governance and lineage | `project_docs/active/contracts/data_catalog_lineage.md` |
| Prepare or review frontend-agent handoffs | `project_docs/active/ai_hand_off/README.md` |
| Review deferred planning | `project_docs/active/future/README.md` |
| Keep Codex runs efficient | `project_docs/active/codex_harness_engineering.md` |
| Improve or reuse the agent harness | `project_docs/active/agent_harness/README.md` |
| Run Agent Council workflow | `project_docs/active/agent_council/README.md` |
| Find old status or superseded plans | `project_docs/archive/superseded_active_2026_05_24/` |

## Current Product Truth

AI Chat is a BI-first NLP workspace. Existing grounded answers, semantic-model reasoning, tables, charts, conversational exploration, artifact inspection, and BI exports must remain.

Decision Intelligence output has been removed from the AI Chat product path. Isolated backend services remain for compatibility only and must not be treated as active UI scope.

## Ownership

| Agent | Owns |
| --- | --- |
| Codex | Lead Orchestrator. Owns roadmap, active gates, backend truth and implementation, contracts, tests, architecture, documentation, handoff scope, integration review, and next-owner decisions. |
| Antigravity | Primary UI implementer. Owns scoped React/CSS and browser-visible behavior assigned by a Codex-authored handoff, with bounded creative freedom inside the verified contract and product design system. |
| User | Owns product direction and final browser-level acceptance. |

Codex must not edit frontend files unless the user explicitly authorizes Codex frontend edits in the current session.

Codex manages the current gate for the broader AI Tool and AI Chat. After substantial work, Codex states whether backend work, an Antigravity UI handoff, Codex integration review, or user verification is required next. Do not make the user infer who acts next.

## Do Not Do This

Do not scan `project_docs/archive/` unless this map or the user asks for historical context.

Do not treat archived or completed files as active plans.

Do not restart the old standalone Phase 4 dataset handoff.

Do not reconnect Decision Intelligence output to AI Chat without explicit user approval and a new active plan.

Previous full index was preserved at `project_docs/archive/superseded_active_2026_05_24/INDEX_pre_map_cleanup_2026_05_24.md`.
