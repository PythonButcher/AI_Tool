Goal: Complete ML Studio end to end for all five tasks and give the whole studio a polished UI makeover aligned with AI Tool's themes.

## User Outcome

Users can resume an experiment, prepare governed data, configure and train locally, deliberately select a model using trustworthy evidence, and optionally export artifacts or make predictions in an accessible, engaging workspace.

## Scope

**Current Step**: Step 6: Complete forecasting through all stages

**Target Files**: backend/ml_studio/, backend/routes/ml_studio.py, tests/test_ml_studio*.py, frontend/frontend/src/features/ml_studio/, frontend/frontend/src/components/data_management/DataCleaningForm.jsx and its tests, frontend/frontend/src/App.jsx. Record additional necessary integration paths in authorization before editing.

**Step Acceptance**: Forecasting supports numeric targets, time/frequency/horizon, optional series and declared future-known inputs. Rolling development evaluation and a reserved chronological final horizon compare candidates with naive/seasonal baselines. Selection, exports, forecast predictions and summaries preserve the forecast origin and horizon evidence.

**Step Verification**: Focused forecasting preparation/configuration, temporal leakage, rolling/final evaluation, reload/inference and UI tests, production build and documentation checks below.

**Next Step**: Complete clustering through all stages.

**Continuation Rule**: `CONTINUE`. The receiving Codex chat owns backend and frontend; verify meaningful steps and continue without routine approval pauses.

**Stop Condition**: Concrete blocker, user pause or verified engineering completion. User browser acceptance stays in chat; browser automation requires a specific user request.

- [x] **Step 1: Complete draft-bound preparation and recovery** — [COMPLETED]
- [x] **Step 2: Replace configuration and readiness assessment** — [COMPLETED]
- [x] **Step 3: Connect durable local training and recovery** — [COMPLETED]
- [x] **Step 4: Implement nomination, final evaluation and candidate selection** — [COMPLETED]
- [x] **Step 5: Implement verified exports and validated prediction** — [COMPLETED]
- [ ] **Step 6: Complete forecasting through all stages** — [IN PROGRESS]
- [ ] **Step 7: Complete clustering through all stages** — [PENDING]
- [ ] **Step 8: Complete anomaly detection through all stages** — [PENDING]
- [ ] **Step 9: Finish local summary and coherent UI makeover** — [PENDING]
- [ ] **Step 10: Verify integrated task journeys and regressions** — [PENDING]

## Contracts

- [Completion brief](../ml_studio/completion_brief.md): current standing, source map, exact preparation boundary, design direction and verification.
- [Roadmap](../ml_studio/README.md): six-stage experience and five-task product requirements.
- [ML Studio contract](../contracts/ml_studio.md): implement and test proposed extensions before frontend consumption.
- [Frontend guardrail](../rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md): the user's explicit authorization permits Codex frontend work for this gate.

## Acceptance

All five tasks form working six-stage journeys with durable state, safe preparation, valid evaluation, deliberate selection and usable supported outputs. UI uses existing theme tokens, strong hierarchy, responsive composition and accessible controls. No fabricated metrics, readiness, progress or inference. Preserve AI Chat and shared data-management behavior. External publishing remains deferred.

## Verification

- `python -m pytest tests/test_ml_studio_preparation.py tests/test_ml_studio_api.py tests/test_workspace_cleaning.py -q`
- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx src/components/data_management/DataCleaningForm.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

Use the brief's additional focused and integration suites as subsequent steps advance.

## Owner And Control Return

Owner: Codex in the receiving chat, authorized for backend and frontend. Keep gate/status aligned. Return a self-reviewed implementation with changed files, verification evidence, any concrete blockers and an explicit next owner. The user retains final browser acceptance.
