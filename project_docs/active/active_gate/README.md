Goal: Establish one leakage-safe ML Studio contract and evaluation core for reproducible regression and classification experiments.

## User Outcome

A developer can rely on ML Studio evaluation results that keep model selection separate from final testing, compare every candidate with a baseline, retain exact dataset and experiment identity, and explain when a run is invalid or too weak to trust.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

This gate is review-only until the user explicitly instructs Codex to begin Phase 13 implementation. No source or contract mutation is authorized by the restored gate alone.

After authorization, work only on the backend contract and evaluation foundation described by Gate 1 in `project_docs/active/ml_studio/README.md`.

Create `project_docs/active/contracts/ml_studio.md` and a focused, framework-independent package under `backend/ml_studio/`. Define JSON-compatible versioned objects for dataset snapshot identity, experiment specifications, run specifications, evaluation results, reviewed-candidate references, and structured errors.

Implement regression and classification evaluation only. Use a compact candidate library: a regularized linear or logistic baseline candidate, random forest, and histogram gradient boosting. A user-selected task type remains authoritative.

Partition an untouched final holdout before candidate work. Perform preprocessing, feature selection, and candidate comparison only inside development data through deterministic cross-validation. Refit the selected candidate on development data and evaluate it once on the final holdout. Support random, stratified, time-ordered, and grouped split policies with explicit validation.

Return task-appropriate baseline and candidate metrics, fold distributions, final-holdout metrics, warnings, split evidence, structural leakage findings, feature-influence method and limitations, environment and reproducibility fields, and an explicit truth boundary.

Do not modify frontend files, Flask routes, persistence, asynchronous execution, model artifact storage, prediction serving, clustering, forecasting, deep learning, arbitrary Python execution, MLflow, Context Ledger integration, authentication, or deployment behavior.

## Contracts

Use `ml_studio_contract_v1` for new public objects.

Dataset snapshot identity includes `snapshot_id`, `workspace_id`, `workspace_version`, ordered `source_ids`, ordered `relationship_ids`, source fingerprints, schema version, semantic-model version, governance result, transformation recipe hash, row count, column profile, and creation metadata. Browser-supplied rows and filesystem paths are never authoritative snapshot identity.

Experiment specifications include `experiment_id`, specification version, task type, target, feature roles, excluded columns, split policy, optional time or group column, candidate families, metric policy, resource limits, and random-seed policy.

Evaluation results separate `selection_evidence` from `final_holdout_evidence` and name the baseline, fold metrics, selected candidate, final metrics, warnings, limitations, leakage findings, dataset identity, specification version, runtime versions, and truth boundary.

Structured errors contain stable `code`, `message`, and safe `remediation` fields without tracebacks, filesystem paths, serialized estimators, secrets, or raw data samples.

Use `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, and `project_docs/active/contracts/data_catalog_lineage.md` as existing identity and governance boundaries. The new core must not import Flask or `backend/utils/global_state.py`.

## Acceptance

- Contract objects reject missing, contradictory, stale, or non-JSON-safe fields.
- Target and final-holdout rows cannot enter preprocessing, feature selection, tuning, or candidate selection.
- Random and stratified splits are deterministic and preserve valid class representation.
- Time-ordered splits never train on observations after evaluation observations.
- Grouped splits keep each group wholly on one side of a split.
- Model selection uses development cross-validation only, followed by one final-holdout evaluation.
- Regression and classification include suitable naive baselines and cannot claim success from raw accuracy or fit alone.
- Invalid data and split states return stable blocked results or structured errors.
- Feature influence is labeled non-causal and every result carries reproducibility and truth-boundary metadata.
- The new package has no Flask, process-global state, client-path, persistence, Context Ledger, or frontend dependency.

Existing governance and readiness tests remain stable. Changed files stay inside `backend/ml_studio/`, focused ML Studio tests, `project_docs/active/contracts/ml_studio.md`, and required gate/status control files.

## Verification

- `python -m unittest tests.test_ml_studio_contracts tests.test_ml_studio_evaluation`
- `python -m unittest tests.test_data_catalog_lineage tests.test_advanced_readiness_service`
- `python -m py_compile` for every changed Python module
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`
- `git diff --name-only`

## Owner And Control Return

The user owns authorization to begin. After explicit authorization, Codex owns the contract, backend architecture, evaluation implementation, tests, documentation, and acceptance decision. Antigravity remains blocked until Codex verifies the identity-first ML Studio API and creates one bounded frontend handoff.
