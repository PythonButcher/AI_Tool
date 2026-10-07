Goal: Preserve ML Studio's header and workflow contracts until the user supplies the next implementation direction.

## User Outcome

Users can identify the studio and the current experiment context at a glance in a compact, readable header.

## Scope

No implementation mutation is pending. Preserve `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `StudioDesign.css` and the existing workflow boundaries.

Concrete user feedback in chat determines any next repair. Define its observable behavior, target files and focused verification here, and align status and authorization before implementing it. Do not infer additional scope or dispatch a specialist handoff.

## Contracts

- [ML Studio contract](../contracts/ml_studio.md): implemented interfaces, identities, evaluation boundaries and supported limitations.
- [Roadmap](../ml_studio/README.md): durable six-stage and five-task product requirements.
- [Frontend guardrail](../rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md): ownership and the explicit Codex authorization boundary.

## Acceptance

Any next change must preserve the coherent brand grouping, centered icon alignment, title/context hierarchy, theme tokens and accessible save/navigation controls. Maintain the server-owned workflow identities and distinguish automated evidence from user visual acceptance.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, with `WAIT_FOR_USER`. Codex acts on concrete user direction and updates this gate before implementation. Browser acceptance remains in chat and browser operation requires a specific user request. Run the verification commands only for a relevant change.
