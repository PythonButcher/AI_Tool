# Active Documentation Map

Give Codex and frontend agents a map, not a 1000 page instruction manual.

This file is the active navigation hub. If this file conflicts with an archived or completed document, this file wins.

## Read First

| Step | Read | Why |
| --- | --- | --- |
| 1 | `project_docs/active/status/ai_chat_execution_status.md` | Short current truth |
| 2 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` | Ownership boundary |
| 3 | `project_docs/active/contracts/decision_objects.md` | Contract reference when touching payloads |
| 4 | `project_docs/active/codex_harness_engineering.md` | Run efficiency for substantial Codex work |
| 5 | `project_docs/active/agent_harness/README.md` | Reusable harness, hooks, and future-project template |

## Current Direction

AI Chat is a BI-first NLP workspace. Grounded answers, semantic-model reasoning, tables, charts, conversational refinements, artifact inspection, and BI exports are the active product scope.

Decision Intelligence workspaces, decision frames, readiness and capability panels, command-center output, decision assets, Evidence Board, Decision Map, Scenario Compare, and Decision Output exports are not part of AI Chat. Their backend services may remain isolated for compatibility only.

Dataset identity and semantic truth remain required for every BI answer and chart.

## Active Areas

| Area | Location | Rule |
| --- | --- | --- |
| Status | `project_docs/active/status/` | Keep short; archive long history |
| Current status | `project_docs/active/status/ai_chat_execution_status.md` | Single current source of truth |
| Completed rollout history | `project_docs/archive/ai_chat_decision_output_unification_rollout_completed.md` | Historical reference only; do not use as the current plan |
| Completed plans | `project_docs/active/ai_chat/completed/` | Reference only |
| Contracts | `project_docs/active/contracts/` | Backend/frontend payload truth |
| Dashboard canvas state contract | `project_docs/active/contracts/dashboard_canvas_state.md` | Local-first dashboard canvas, layout, and sharing skeleton state |
| Dataset governance contract | `project_docs/active/contracts/data_catalog_lineage.md` | Readiness policy and enforcement truth |
| AI Chat active gate | `project_docs/active/ai_chat/active_gate/README.md` | The only active phase workspace |
| Deferred planning | `project_docs/active/future/README.md` | The one home for all deferred active-folder plans; not active until promoted |
| Agent harness | `project_docs/active/agent_harness/` | Reusable agent backbone, hooks, and validation |
| Handoffs | `project_docs/active/ai_hand_off/` | Active handoffs only |
| Reviews | `project_docs/active/reviews/` | Focused review docs |
| Archive | `project_docs/archive/` | Historical context only |

## Response Clarity Rule

Rollout plans must be written in plain language. Use short phase names, one purpose at a time, and direct acceptance checks. If a plan mentions a technical concept such as CDD, Decision Map, Dataset Trust, gates, or dashboard state, define it immediately.

## Prompt Goal Format

Every prompt written for Gemini, Antigravity, Codex in a future session, or another agent must start with `Goal:` and state the standalone outcome. It must then name target files, active docs, exact source or contract fields, acceptance checks, verification commands where relevant, and ownership constraints. Antigravity prompts follow this same format because Antigravity supports goals. Prompts stay forward-looking, directly executable, and free of code blocks.

By default, `Goal:` prompts belong in handoff files under `project_docs/active/ai_hand_off/`, not in the chat final response. The final response should link or name the handoff file so the receiving agent can read it through the auto-handoff flow. Paste the full prompt in chat only when the user explicitly asks for that output.

Decision Intelligence exception: Codex-owned current goals belong in `project_docs/active/decision_intelligence/active_gate/`. Use `project_docs/active/ai_hand_off/` only for active Gemini handoffs.
AI Chat exception: Antigravity-owned current goals belong in `project_docs/active/ai_chat/active_gate/`. When Antigravity needs backend work, it writes handoffs to Codex in `project_docs/active/ai_hand_off/`.

## Active-Gate Rule

AI Chat has one true active workspace: `project_docs/active/ai_chat/active_gate/`. Agents must not infer the next phase from `current/`, `completed/`, `future/`, archive files, or the mere existence of an old handoff. The active gate is the status file plus the active-gate README, and the ranking source must be named there when the gate comes from a council recommendation.

## Repair Handoff Clarity

When Codex finds a frontend-agent implementation is not complete, the active handoff must make the repair obvious. Put `REPAIR REQUIRED` near the top, name the exact source-level blocker in a short `Repair Blocker` section, and state the exact target files and acceptance checks. Do not bury the issue inside general goal text. The receiving agent should be able to open the handoff and immediately see what is wrong, where to fix it, and how to prove the repair.

## Orchestration Rule

For the overall project, Codex must facilitate, not only complete isolated implementation slices. Every wrap-up for backend work must say the current gate in plain language: complete end to end, blocked, or ready for frontend.

For the AI Chat UI rebuild, Antigravity facilitates the project and owns the active markdown docs. Codex takes direction from Antigravity via handoff files. Do not leave the user to decide whether backend work is needed. Antigravity should make that call from the active docs and verified evidence.

Do not create a frontend-agent handoff until Codex has confirmed a concrete frontend gap or the user explicitly asks for Gemini or Antigravity to implement frontend work. Backend-only completion should be recorded as backend-only completion, not phase completion.

When Codex determines Gemini or Antigravity needs work, Codex must create or update a handoff file containing the clean `Goal:` prompt. The user should not have to copy a prompt from chat into another agent.

Gemini frontend reviews must stay lightweight unless the user asks for deeper verification. Codex should use the active handoff, targeted source review, focused diff, and contract evidence before running expensive tools. A source-level blocker is enough to call `Not complete`; do not keep spending tokens on builds, browser automation, or broad scans after the blocker is clear.

Frontend builds are for inconclusive source review, missing or questionable Gemini build evidence, likely syntax/import failures, or explicit user requests. Browser/E2E checks are not the default review path; use them only when the gate depends on visible behavior and cheaper evidence is clean or insufficient.

Before starting, handing off, or closing a numbered phase, run `python .codex/hooks/agent_harness_check.py`. Its documentation-governance gate rejects a complete brief still kept in the current path, completed reference files under `current/`, and a current gate without a phase number. Use the `project-doc-governance` skill to repair any reported issue before continuing.

## Browser Acceptance Control

The user exclusively controls browser-level acceptance. Codex must not launch, navigate, automate, upload through, export from, or claim browser verification unless the user explicitly requests that specific browser action. Codex provides implementation, backend/API verification, build results, static review, and a concise manual browser checklist; the user performs and accepts visible browser behavior.

## Status File Discipline

The active status file is for current truth, the current gate, and the latest verified fact. It is not an implementation diary. When a phase is fully closed and verified, move detailed slice notes to `project_docs/archive/` and leave a short archive pointer in active status.

## Phase Wrap-Up Rule

When Codex wraps up a project phase or clears a phase gate, Codex must automatically create or update a handoff file containing the clean `Goal:` prompt for starting the next session when another agent or future session has work to do. The wrap-up summary may describe the phase just completed, but the handoff prompt must not recap prior phases, review history, implementation history, or who approved earlier work. It may include only the minimum prerequisite state needed to start safely, such as `backend contract is ready` or `active handoff exists`, then point to the current docs and name the next task. Do not include sentences like `Phase N is complete`, `Codex implemented`, `reviewed by`, or detailed verification history inside the handoff prompt.

Before sending a final response after substantial Decision Intelligence work, Codex must run this stop check: did this response clear a backend gate, clear a frontend gate, wrap a project phase, mark a goal complete, or identify Gemini or Antigravity as the next owner? If yes and a forward-looking prompt is required, store it in a handoff file and reference that file in the final response. A status summary without the required handoff file reference is incomplete.

## Current Active File

`project_docs/active/status/ai_chat_execution_status.md`

## Superseded Or Completed Records

| Record | Current Location |
| --- | --- |
| Full old active status | `project_docs/archive/superseded_active_2026_05_24/decision_intelligence_execution_status_full_2026_05_24.md` |
| Old Phase 4 dataset plan | `project_docs/archive/superseded_active_2026_05_24/next_focus_execution_plan_old_phase4_dataset_2026_05_24.md` |
| Old Phase 4 Gemini dataset handoff | `project_docs/archive/superseded_active_2026_05_24/phase_4_gemini_frontend_canonical_active_dataset.md` |

Previous full active README was preserved at `project_docs/archive/superseded_active_2026_05_24/active_README_pre_map_cleanup_2026_05_24.md`.
