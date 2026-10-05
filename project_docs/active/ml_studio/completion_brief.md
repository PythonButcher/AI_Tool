Goal: Finish ML Studio end to end and give the entire studio a polished, theme-aligned UI makeover in one sustained Codex implementation effort.

## User Value And Authority

Deliver a capable local workspace that turns governed data into a deliberately selected model and useful outputs. Make the studio clearer, more engaging and easier to navigate. The user explicitly authorizes the receiving Codex chat to implement both backend and frontend. This is a Codex-owned completion effort with ordered verified steps, rather than a specialist frontend handoff. The sole execution entrypoint is project_docs/active/active_gate/README.md.

Read AGENTS.md, index, active README, status, phase authorization, sole gate, ML Studio roadmap and contract, frontend guardrail and harness guide. The current authorization includes Apply, later workflow stages and the full UI redesign. Historical narrow authorization records do not constrain this new assignment. This preparation chat edits documentation only; the receiving chat implements.

## Current Standing — Source Inspected 2026-10-04

| Surface | Present foundation | Remaining work |
| --- | --- | --- |
| Workspace/drafts | Saved experiment shell, scoped draft CRUD/delete/duplicate, conditional saves and workflow routes exist. | Preserve and retest save/retry/conflict/navigation as stages expand. |
| Data & Goal / Prepare Data | Governed snapshot selection, quality options and Stay/Open editor entry exist. Workflow unlocks these two stages only. | Complete preparation round trip and real readiness transitions. |
| Preparation | Persistent server-issued operations support begin/preview/cancel/apply and catalog reconciliation. ML editor is still read-only. | Integrate UI; prove lost-response, restart and commit recovery. |
| Configure | Legacy form constructs recipe identity/hash in the browser. | Exclusive column-role editing and server-bound assessment. |
| Training/evaluation | Durable runs/events/cancellation, evaluation/comparison/candidate and artifact integrity foundations exist for regression/classification. | Bind to saved workflow, separate development selection from final holdout, prove fitted artifact reload. |
| Later workflows | Nomination/final-evaluation/selection/export/prediction/summary additions are proposed. | Implement extensions and forecasting/clustering/anomalies across all stages. |
| Appearance | Shell combines theme variables and fixed gradients; shared app has light/dark tokens. | Cohesive whole-studio redesign of hierarchy, layout and evidence. |

This source review is not runtime verification. Historical test counts are not fresh results. Reuse working persistence and execution; distinguish implemented endpoints from proposed contracts.

## Source Map And Boundaries

Start with frontend/frontend/src/features/ml_studio/MLStudioShell.jsx, its CSS/tests; frontend/frontend/src/App.jsx; frontend/frontend/src/components/data_management/DataCleaningForm.jsx and tests; backend/routes/ml_studio.py; backend/ml_studio/contracts.py, repository.py, service.py, preparation.py, execution.py, evaluation.py and artifacts.py. Inspect backend/routes/manual_cleaning.py, backend/services/workspace_cleaning.py, workspace/dataset services and backend/db/backend_db.py only for relevant integration.

Read frontend/frontend/src/index.css and adjacent app shells for theme references. Split the large shell into focused feature components/hooks where useful. Add meaningful tests under tests/test_ml_studio*.py and the feature folder. Record necessary additional integration paths in authorization before mutation.

Use apply_patch, preserve unrelated changes, never touch GEMINI.md or discard work. Preserve AI Chat and ordinary Power Query. Local execution only; cloud training/deployment and Context Ledger/AI Chat publishing are excluded. Do not spawn agents without explicit applicable authorization. Browser operation needs a specific user request. Final browser acceptance stays in chat; never create a browser-acceptance file.

## Exact Starting API Boundary

Root: /api/ml-studio/v1. Preparation uses workspace_id query scope. Errors are {error: {code, message, remediation}}.

- GET /drafts/{experiment_id} returns draft, workflow_state and nullable preparation_context. Preserve GET-owned context when another response omits it.
- GET /drafts/{experiment_id}/preparation returns {snapshot_id, issues, fixes, preparation_context}. Supported fixes currently use remove_nulls. Absence of issues does not prove statistical readiness.
- Begin via POST /drafts/{experiment_id}/preparation with current If-Match, stable Idempotency-Key and exactly {snapshot_id, steps, issue_id, fix_id, return_stage}. Use server-issued fix parameters; return_stage is Prepare Data or Data & Goal.
- Store preparation.operation_id, experiment_id, workspace_id, snapshot_id, base_draft_revision, base_etag, recipe, status, result and return context. Recover through draft/operation GET.
- Preview posts exactly {action: "preview"} to /drafts/{experiment_id}/preparation/{operation_id}, returning {preparation, preview}. Display at most 100 sample rows and the full resulting row count.
- Cancel/apply post exactly {action: "cancel"} or {action: "apply"} with operation base_etag in If-Match; return {preparation, draft, workflow_state, preparation_context}. Confirm terminal outcome before closing. Retry the same operation after lost responses; never rerun committed cleaning.

ML Studio must never call global /api/manual_cleaning. Cancel preserves draft/dataset. Apply consumes stored steps, refreshes snapshot/schema, reconciles role references and invalidates assessments. Preserve ordinary editor behavior. Relationship-backed preparation is currently unsupported: show an actionable limitation rather than silently flattening data or inventing a commit contract.

## Continuous Execution

Follow the sole gate's ten steps: preparation/recovery; configuration/readiness; training; nomination/final evaluation/selection; exports/prediction; forecasting; clustering; anomalies; summary/UI consistency; integrated verification. Build shared visual primitives as stages develop rather than postponing design until a cosmetic final pass.

For each step inspect its contract/source, patch the smallest meaningful behavior, prove it with focused tests, update implemented/proposed contract truth, and advance gate/status together. Continue without routine permission requests or ending after one slice. Stop only for a concrete blocker, user pause or engineering completion. Resume the same gate after context compaction. Do not reduce quality or claim guaranteed completion to fit a single response.

Server state owns experiment_id, draft_revision, etag, snapshot/recipe/configuration identities, assessments, workflow states, runs, evaluations, selections and artifacts. Browser state owns unsaved edits and presentation. Implement proposed CandidateNomination, FinalEvaluation, CandidateSelection, InferenceSchema and summary schemas with durable bindings before frontend consumption. Keep Guidance explanatory only and preserve locked/available/active/complete/stale state semantics. Dependency edits invalidate current evidence while preserving historical immutable runs.

## Whole-Studio UI Makeover

Make every stage feel deliberate, useful and visually engaging while belonging to AI Tool. Use shared light/dark surfaces, typography, blue/green accents, borders and focus tokens. Improve hierarchy, spacing, restrained depth, useful icons, contextual highlights and evidence displays. Avoid a wall of identical cards, raw-ID-heavy panels, excessive gradients or decoration unrelated to the app.

Create a confident experiment header with name/save state, meaningful stage navigation, collapsible dataset context, spacious focused forms, readable tables/charts and an expandable dock driven by real run events. Put technical IDs in details with copy actions. Give empty/loading/error/conflict/stale/cancelled/success states useful explanations and next actions. Provide labels, keyboard focus, clear contrast and reduced-motion support. Guidance is contextual explanation, not an embedded chatbot.

Configuration uses a searchable exclusive role editor with types/issues and a readable summary. Results use baselines, task-appropriate plots, limitations and deliberate selection. Keep primary actions accessible at 1440×900, 1024×768 and 390×844; wide tables scroll inside their region. Do not rewrite global theme styling merely to restyle ML Studio. Distinguish source/build evidence from visual inspection and never claim unseen layouts were browser verified.

## Scientific And Product Completion

All five tasks must form real journeys through Data & Goal → Prepare Data → Configure → Train → Review Results → Use & Share. Candidate selection completes the cycle; exports are optional. Dead controls or a static stage ribbon are not implementation.

Fit preprocessing only on training partitions. Development evidence drives comparison/nomination; final holdout evaluation happens once for the nomination and cannot rank alternatives. Regression/classification require suitable baselines, imbalance-aware metrics and supported probability semantics. Forecasting requires chronological/rolling validation, horizon/frequency/series handling and naive/seasonal baselines. Clustering requires targetless roles, scaling/distance assumptions, profiles and stability evidence. Anomalies require scores/thresholds; labeled metrics require actual labels and flags mean unusual, not confirmed errors.

Prove local limits, cancellation, restart recovery and idempotent retries. Artifacts must reload for inference with schema validation, integrity checks and path-free receipts. Never accept client serialized estimators or filesystem paths. Provide supported model/preprocessor exports, schema, report, model card, reproducibility manifest and inference example. Local cycle summary matches the selected model, lineage, evidence and limitations.

Tests must cover workspace switches/unmount/stale responses, navigation during saves, queued edits, failed save retry, conflicts, duplicate submission, open-operation reload, lost responses and apply reconciliation. Preserve deletion/duplication, Guidance, issue actions and normal editor controls. Add deterministic real-service/API journeys for every task with blocked/stale/cancelled/failed/resumed cases; mocked frontend success responses alone are insufficient.

## Verification And Return

Use focused suites as behavior changes:
- python -m pytest tests/test_ml_studio_preparation.py tests/test_ml_studio_api.py tests/test_workspace_cleaning.py -q
- python -m pytest tests/test_ml_studio_contracts.py tests/test_ml_studio_drafts.py tests/test_ml_studio_preparation.py tests/test_ml_studio_persistence.py tests/test_ml_studio_execution.py tests/test_ml_studio_evaluation.py tests/test_ml_studio_api.py -q at final integration, plus new task/inference suites.
- npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx src/components/data_management/DataCleaningForm.test.jsx plus any new feature test files.
- npm --prefix frontend/frontend run build
- Compile changed Python modules.
- python .codex/hooks/agent_harness_check.py
- python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .
- git diff --check

Use hook tests/CI if authority or hook behavior changes. Do not run the retired project-doc audit. Report actual results and separate existing failures from introduced failures.

Return implemented capabilities, UI changes, focused/integrated verification, unresolved blockers and precise next owner. Update docs with verified facts. A facelift, passing build or backend-only success is not completion. User browser acceptance remains separate.
