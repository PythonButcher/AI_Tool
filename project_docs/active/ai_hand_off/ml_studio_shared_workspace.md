# ML Studio Run Progress Evidence — Antigravity Frontend Handoff

REPAIR REQUIRED

Goal: Prove that the recent-runs table preserves server-returned progress text for every durable run status.

## Dispatch State

READY FOR ANTIGRAVITY. Execute this bounded repair now and return through the governed status command.

## Repair Blocker

`frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx` (line 625) supplies `processing` only for the `running` fixture, while the parameterized assertion at line 640 checks only the status label. The active acceptance gate requires evidence that both returned status and returned `progress_stage` text are rendered without fabricated progress.

## Target Files And Mutation Boundary

- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx` — preserve the existing returned diff; do not edit.
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css` — preserve the existing returned diff; do not edit.

**Required Change Coverage**: `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`

**Maximum Diff Lines**: 900

**Inline Styles**: forbidden

Do not modify production JSX or CSS, backend files, contracts, status, authorization, the active gate, or any `GEMINI.md` file. The production files are listed only because their already-returned changes remain in the shared working tree and must be preserved.

## Required Change

- Keep all seven statuses: `queued`, `running`, `cancel_requested`, `completed`, `failed`, `cancelled`, and `interrupted`.
- Extend each parameterized case with an explicit, distinctive `progress_stage`, pass it through the mock API fixture, and assert the rendered row contains both that exact stage and the exact status.
- Do not add polling, percentages, client-derived progress, snapshots, or unrelated refactoring.

## Acceptance

- One focused parameterized test proves all seven status strings are rendered exactly as returned.
- The same cases prove every explicit server-returned progress-stage string is rendered exactly as returned.
- Use a different progress-stage string for each case so the progress assertion cannot pass by matching status text or another row field.
- Scope both assertions to the same rendered run row so unrelated page text cannot satisfy the test.
- Use exact-text assertions for the returned status and progress stage; do not rely on broad case-insensitive regular expressions.
- Existing production behavior and API calls remain unchanged.

## Verification And Return

Run:

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff ml_studio_shared_workspace.md --summary "Run status and progress-stage coverage completed; focused tests and build passed."`

Return the exact changed-file list and command results, then stop for Codex review.
 
