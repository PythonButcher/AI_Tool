Goal: Connect ML Studio Data & Goal to governed data and conditionally saved experiment intent.

## User Outcome

A developer can inspect the selected governed dataset's schema and bounded preview, choose a supported problem type, save a goal, and continue using server-derived workflow state.

## Scope

**Current Step**: Step 1: Implement the bounded Data & Goal frontend handoff

**Target Files**: `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`, and stage-specific rules in `frontend/frontend/src/features/ml_studio/MLStudioShell.css`.

**Step Acceptance**: Implement `project_docs/active/ai_hand_off/ml_studio_data_goal.md` using verified snapshot, bounded preview, and conditional draft-save contracts. Preserve controls and prove every named asynchronous acceptance assertion.

**Step Verification**: Focused shell tests, production build, whitespace check, and the governed handoff return command.

**Next Step**: Codex reviews the returned source and named assertion evidence before selecting the next bounded assignment.

**Continuation Rule**: `WAIT_FOR_AGENT`.

**Stop Condition**: Antigravity returns after this handoff. Do not implement preparation/Power Query, training, configuration replacement, or general autosave changes.

- [ ] **Step 1: Implement the bounded Data & Goal frontend handoff** — [IN PROGRESS]
- [ ] **Step 2: Review Data & Goal source and acceptance evidence** — [PENDING]

## Contracts

- `project_docs/active/ai_hand_off/ml_studio_data_goal.md`
- `project_docs/active/contracts/ml_studio.md` — Snapshot, Draft API, and Workspace-Safe Cleaning
- `project_docs/active/ml_studio/README.md` — Step 4 assignment order

## Acceptance

The stage uses server-owned schema/preview and exact governed identity. Saving persists snapshot, supported task, and goal with the current ETag. Only a successful response advances workflow. Show all five problem choices with truthful execution availability. Preserve errors/local edits and suppress stale responses across workspace/version/experiment changes. Open preparation operations prevent ordinary draft edits. Relationship-backed previews remain explicitly unavailable.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_data_goal.md --summary "Report named assertions, changed files, and test/build results"`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Current owner: Antigravity. Control return: `WAIT_FOR_AGENT` under the bounded handoff, then Codex integration review. Codex owns backend/contracts/documentation and may not implement frontend in this session.
