Goal: Preserve ML Studio's preparation and configuration interactions until the user supplies concrete next direction.

## User Outcome

Users see what the preparation check found and can deliberately open Configure through a prominent next-step action.

## Scope

No application mutation is pending. Preserve `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `ConfigurationStage.jsx`, `StudioDesign.css` and their preparation/configuration tests.

Concrete user feedback determines any next repair. Define its behavior, targets and verification here and align status/authorization before implementation. A separate configuration proposal and runtime uploads do not authorize agent work or data changes through this gate.

## Contracts

- [ML Studio contract](../contracts/ml_studio.md): implemented interfaces, identities, evaluation boundaries and supported limitations.
- [Roadmap](../ml_studio/README.md): durable six-stage and five-task product requirements.
- [Frontend guardrail](../rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md): ownership and the explicit Codex authorization boundary.

## Acceptance

Any next change must preserve the centered preparation result, guarded Configure action, readable role table and explicit assessment controls. Keep backend readiness authoritative, preserve unsaved edits and retain task-specific settings. Do not equate a missing-value check with training readiness or automated checks with user visual acceptance.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testPathPattern '(features/ml_studio/.*test|components/data_management/DataCleaningForm.test)'`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, with `WAIT_FOR_USER`. Codex acts on concrete user direction and updates this gate before implementation. Browser acceptance remains in chat; browser operation requires a specific user request. Run verification commands only for a relevant change.
