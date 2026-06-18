# Project Agent Map

Give agents a map, not a long instruction manual.

## Start Here

| Need | Read |
| --- | --- |
| Start any project task | `project_docs/INDEX.md` |
| Understand current truth and scan rules | `project_docs/active/README.md` |
| Work efficiently with agents | `project_docs/active/agent_harness/README.md` |
| Run project-specific checks | Replace with this project's build, test, lint, and validation commands |

## Ownership

State who owns backend, frontend, design, data, deployment, documentation, and review. If different agents own different areas, make the boundary explicit.

## Working Rules

Agents must read the active Markdown path before making project decisions.

Agents must make scoped changes and preserve existing behavior unless the user explicitly asks for broader refactoring.

Agents must verify changes with the narrowest reliable command before calling work complete.

Agents must report blockers and incomplete verification honestly.

## Do Not Do This

List the few actions that must never happen in this project, such as editing generated files, changing secrets, deleting user data, or modifying another agent's protected instruction file.

## Done Means

Define the acceptance check for this project: tests, build, lint, browser verification, contract validation, documentation check, or deployment smoke test.
