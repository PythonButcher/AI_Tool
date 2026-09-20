# ML Studio Aggressive Overhaul — Step 1

REPAIR REQUIRED

Goal: Repair Step 1 so its visible guidance advances in the correct direction and its tests prove every required dataset and role-reconciliation behavior without React update warnings.

## Repair Blocker

The returned guidance state is backward: it displays “Assess readiness” while the form is ready to assess, then displays “Ready to Assess” only after the assessment is already ready and Start Run is the next action. The focused suite also omits the required object-shaped dataset, visible dataset-summary, all-direction role reconciliation, and disjoint experiment-payload tests, while emitting multiple “not wrapped in act” warnings.

## Visible Checkpoint Outcome

When this checkpoint returns, the existing visible dataset and role-safe controls remain, and the guidance moves forward correctly: choose target, choose features, confirm roles, ready to assess, assessing, resolve readiness issues when blocked, or ready to start a run after a successful assessment.

## This Checkpoint Only

Target files:

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css`

Use the stylesheet for the connected-dataset treatment, live guidance, and clear valid/incomplete states. Do not redesign the entire form or introduce the future role-editor component in this checkpoint.

**Required Change Coverage**: all target files

**Maximum Diff Lines**: 520

**Inline Styles**: forbidden

Do not create the future role-editor component, replace controls, remove confirmation, redesign the form, expand Start Run, add polling or cancellation, or edit outside these three targets. Do not create scratch files. Never use bulk rewrite scripts, shell redirection, `git checkout`, `git restore`, or reset.

## Required Behavior

1. Replace the current `unmetRequirements` shortcut with an explicit presentation state derived from configuration and preparation status.
2. Before assessment, show “Ready to assess” only when target, at least one feature, and confirmation are complete.
3. During assessment, show an assessing state. After a ready assessment, show that the dataset is ready and Start Run is next. After a blocked assessment, direct the user to the rendered readiness issues. Do not send the user backward.
4. Preserve normalized columns, connected-dataset summary, mutually exclusive roles, preparation behavior, and Start Run behavior without expanding their scope.
5. Add the missing evidence tests. Use accessible queries and properly await asynchronous UI updates so the focused command emits no “not wrapped in act” warnings.

## Acceptance Evidence

- A JSON `data_preview` test proves real columns appear and the connected dataset label plus row/column counts render.
- Focused tests prove target, numeric, categorical, and excluded changes reconcile in every direction.
- The experiment request test asserts that Target, Numeric, Categorical, and Excluded values are pairwise disjoint.
- Guidance tests cover each forward state: choose target, choose features, confirm, ready to assess, assessing, blocked, and ready to start.
- The focused suite passes with zero “not wrapped in act” warnings. The existing dependency-level ReactDOMTestUtils deprecation is not part of this repair.

## Verification And Mandatory Check-In

- `npm --prefix frontend/frontend test -- --watchAll=false MLStudioShell.test.jsx`
- `git diff --check`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff ml_studio_shell.md --summary "Aggressive Overhaul Step 1 guidance and evidence repair verified"`

Return the exact changed files and command results, then stop. Do not begin Step 2. Codex must review and issue the next handoff.
