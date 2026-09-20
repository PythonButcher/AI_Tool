Goal: Replace the overflowing Experiment Configuration frame with a contained, responsive, polished workspace shell while preserving its current field behavior for the next checkpoint.

REPAIR REQUIRED

## Repair Blocker

The current canvas vertically centers an expanding form inside an overflow-hidden application body. At shorter viewports the configuration and assessment results extend off screen, while the oversized white card and repeated identity information make the surface feel unfinished.

## Visible Checkpoint Outcome

Opening ML Studio shows a deliberate configuration workspace that starts at the top of the available canvas, stays within its width, scrolls internally when necessary, keeps the main action reachable, and remains readable at narrow widths. This checkpoint changes the frame and layout only; the role controls are replaced in the next handoff.

## Exact Scope

Target files:

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`

**Required Change Coverage**: all target files

**Maximum Diff Lines**: 650

**Inline Styles**: forbidden

Do not replace the multi-select controls, remove confirmation, change preparation payloads, change Start Run behavior, add polling or cancellation, create new components, edit backend files, or touch project documentation. Do not create scratch files or use bulk rewrites, shell redirection, `git checkout`, `git restore`, or reset.

## Required Layout

- Make the center column and experiment canvas establish a bounded height and internal vertical scroll instead of pushing content outside the application surface.
- Top-align the workspace. Remove viewport-dependent vertical centering for the active configuration form.
- Replace the generic floating card treatment with a clear configuration workspace header, compact dataset context, and a distinct content body. Avoid repeating raw workspace IDs as the dominant title.
- Keep configuration actions and assessment results inside the same scrollable surface. The Assess action must remain reachable without the entire application moving off screen.
- At narrow widths, use one readable column with no horizontal scrolling or clipped controls. At wide widths, constrain line length and use available space without creating a tiny centered card.
- Use the existing theme variables, visible keyboard focus, reduced-motion behavior, and no inline styles.

## Acceptance Evidence

- Focused tests prove the configuration workspace renders one named header, dataset context, content region, action region, and assessment-results region without duplicating internal identity as the main heading.
- Existing dataset normalization, role reconciliation, guidance, preparation, and Start Run tests continue to pass.
- The production build passes and the diff remains inside the three targets and declared budget.

## Verification And Mandatory Check-In

- `npm --prefix frontend/frontend test -- --watchAll=false MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff ml_studio_shell.md --summary "Configuration shell containment and responsive layout verified"`

Return exact changed files and command results, then stop. Do not begin the role-editor checkpoint.
