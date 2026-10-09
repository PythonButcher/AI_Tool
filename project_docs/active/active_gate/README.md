Goal: Preserve governed bulk data preparation and editable Power Query recipes while awaiting concrete user direction.

## User Outcome

Prepare Data presents grouped findings with counts and clear choices. Users can preview and apply several fixes together or open the full transformation controls, then return to the correct experiment and continue configuring it.

## Scope

No application mutation is pending. Preserve the ML Studio preparation components, shared transformation controls, server quality evidence and draft-bound preparation lifecycle.

Concrete user feedback determines the next repair. Define its behavior, target files and proportionate verification here and align status/authorization before implementation. Runtime datasets and deferred proposals do not independently authorize work.

## Contracts

- [ML Studio contract](../contracts/ml_studio.md): implemented interfaces, identities, evaluation boundaries and supported limitations.
- [Roadmap](../ml_studio/README.md): durable six-stage and five-task product requirements.
- [Frontend guardrail](../rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md): ownership and the explicit Codex authorization boundary.

## Acceptance

- Multiple issue groups and multi-column fixes are visible without repeated dialogs.
- A combined preview shows the real row impact before Apply; dismissal never means repaired.
- Users can add, edit, remove and reorder supported transformations, including after a preview, without losing recovery or allowing stale Apply.
- Returning from Apply refreshes dataset identity and findings; Cancel preserves data. Reload can resume an open operation.
- Preserve focus, loading/error states, duplicate submission guards, task settings and responsive theme styling. Keep training-derived imputation inside training partitions. Do not claim unimplemented statistical or domain checks.

## Verification

- `python -m unittest tests.test_ml_studio_preparation tests.test_workspace_cleaning -q`
- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testPathPattern '(features/ml_studio/.*test|components/data_management/.*test)'`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, with `WAIT_FOR_USER`. Codex acts on concrete user direction and updates this gate before implementation. Browser acceptance stays in chat; browser operation requires a specific request. Run verification commands only for a relevant change.
