Goal: Give dark mode a jet-black foundation that transitions smoothly into graphite and deep blue-gray, with a restrained gloss on raised surfaces.

## User Outcome

A cohesive dark workspace with clear separation between the canvas, navigation, panels and controls.

## Scope

No executable implementation step is active. User feedback may open a bounded refinement to the shared dark palette or surface styling under `frontend/frontend/src/`. Preserve light mode and feature behavior.

## Contracts

- [AI Chat business workspace](../ai_chat/README.md)

## Acceptance

- Dark mode blends jet black into blue-gray using static gradients and subtle highlights.
- Text and action contrast remains readable, and CSS and MUI palettes agree.
- Chat, dialogs and detached windows follow the application theme.
- Preserve light mode and existing interactions.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/context/ThemeContext.test.jsx src/features/charts/ChartThemes.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, WAIT_FOR_USER. Codex resumes on specific feedback and records the authorized scope before editing. Visual acceptance stays in chat. Browser operations require a specific user request.
