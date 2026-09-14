Goal: Establish one leakage-safe ML Studio contract and evaluation core for reproducible regression and classification experiments.

## User Outcome

A developer can rely on ML Studio evaluation results that keep model selection separate from final testing, compare every candidate with a baseline, retain exact dataset and experiment identity, and explain when a run is invalid or too weak to trust.

## Scope

Work only on the backend contract and evaluation foundation described by Gate 1 in `project_docs/active/ml_studio/README.md`.

Create the public contract as `ml_studio.md` in `project_docs/active/contracts/` and add a focused, framework-independent package under `backend/ml_studio/`. Define JSON-compatible versioned objects for dataset snapshot identity, experiment specifications, run specifications, evaluation results, reviewed-candidate references, and structured errors.

Implement regression and classification evaluation only. Use a compact candidate library: a regularized linear or logistic baseline candidate, random forest, and histogram gradient boosting. A user-selected task type remains authoritative; do not silently reinterpret the target.

Partition an untouched final holdout before candidate work begins. Perform preprocessing, feature selection, and candidate comparison only inside the remaining development data through deterministic cross-validation. Refit the selected candidate on development data and evaluate it once on the final holdout. Support random, stratified, time-ordered, and grouped split policies with explicit validation.

Return task-appropriate baseline and candidate metrics, fold distributions, final-holdout metrics, warnings, split evidence, structural leakage findings, feature-influence method and limitations, environment/reproducibility fields, and an explicit truth boundary. Treat row minimums as split-feasibility decisions rather than a universal ten-row promise.

Add focused tests under `tests/` that prove the contract and evaluation boundary. Existing `/api/ml_prep/*` and `/api/automl/*` behavior remains a compatibility surface in this gate; do not route it through the new core yet.

Do not add or modify frontend files, Flask routes, persistence, asynchronous execution, model artifact storage, prediction serving, clustering, forecasting, deep learning, arbitrary Python execution, MLflow, Context Ledger integration, authentication, or deployment behavior.

## Contracts

Use `ml_studio_contract_v1` for new public objects.

The dataset snapshot identity must include `snapshot_id`, `workspace_id`, `workspace_version`, ordered `source_ids`, ordered `relationship_ids`, source fingerprints, schema version, semantic-model version, governance result, transformation recipe hash, row count, column profile, and creation metadata. Gate 1 may receive a resolved dataframe internally for evaluation tests, but browser-supplied rows and filesystem paths are never authoritative snapshot identity.

The experiment specification must include `experiment_id`, specification version, task type, target, feature roles, excluded columns, split policy, optional time or group column, candidate families, metric policy, resource limits, and random-seed policy.

The evaluation result must separate `selection_evidence` from `final_holdout_evidence`. It must name the baseline, fold metrics, selected candidate, final metrics, warnings, limitations, leakage findings, dataset snapshot identity, experiment-specification version, library/runtime versions, and truth boundary.

Structured errors must contain stable `code`, `message`, and safe `remediation` fields without tracebacks, filesystem paths, serialized estimators, secrets, or raw data samples.

Use `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, and `project_docs/active/contracts/data_catalog_lineage.md` as existing identity and governance boundaries. The new core must not import Flask or `backend/utils/global_state.py`.

## Acceptance

Focused tests prove:

- contract objects reject missing, contradictory, stale, or non-JSON-safe fields;
- target and final-holdout rows cannot enter preprocessing, feature selection, tuning, or candidate selection;
- random and stratified splits are deterministic and preserve valid class representation;
- time-ordered splits never train on observations after their evaluation observations;
- grouped splits keep each group wholly on one side of a split;
- model selection uses development cross-validation only, followed by one final-holdout evaluation;
- regression and classification results include suitable naive baselines and cannot claim success from raw accuracy or fit alone;
- insufficient rows, class imbalance that prevents splitting, missing group/time fields, constant targets, target leakage, duplicate cross-split rows, and unusable features return stable blocked results or errors;
- feature influence is labeled non-causal and every result carries reproducibility and truth-boundary metadata;
- the new package has no Flask, process-global state, client-path, persistence, Context Ledger, or frontend dependency.

Existing governance/readiness tests remain stable. The changed-file list stays inside `backend/ml_studio/`, focused ML Studio tests, the new `ml_studio.md` contract in `project_docs/active/contracts/`, and required gate/status documentation.

## Verification

Run:

- `python -m unittest tests.test_ml_studio_contracts tests.test_ml_studio_evaluation`
- `python -m unittest tests.test_data_catalog_lineage tests.test_advanced_readiness_service`
- `python -m py_compile` for every changed Python module
- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`
- `git diff --name-only`

## Owner And Control Return

Codex owns the contract, backend architecture, evaluation implementation, tests, documentation, and acceptance decision. No implementation delegate or frontend agent is active.

After acceptance, Codex replaces this gate with the durable experiments-and-runs backend gate from the roadmap. Antigravity remains blocked until Codex verifies the identity-first ML Studio API and creates one bounded frontend handoff.
