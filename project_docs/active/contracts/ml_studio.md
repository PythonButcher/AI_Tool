# ML Studio Contract And Evaluation Core

## Status

Phase 13 Gate 1 backend contract. This document defines framework-independent, versioned objects and evidence boundaries. It does not authorize routes, persistence, asynchronous execution, model serving, frontend behavior, or deployment claims.

## Contract Version

Every public object uses `contract_version: "ml_studio_contract_v1"`. Objects are immutable after validation, reject unknown fields, and must serialize to finite JSON values. Missing required identity, contradictory task configuration, stale snapshot truth, NaN or infinite metrics, and unsafe error content are rejected.

## Dataset Snapshot Identity

`DatasetSnapshotIdentity` is the immutable reference for training input. It contains `snapshot_id`, `workspace_id`, `workspace_version`, ordered `source_ids`, ordered `relationship_ids`, ordered source fingerprints with schema versions, snapshot schema version, semantic-model version, passing governance result, transformation recipe hash, row count, aggregate column profile, creation time, and optional creating actor.

The source-fingerprint order must exactly match `source_ids`. The application service must compare workspace version and every source fingerprint with current authoritative server state before evaluation. A mismatch is stale and cannot run. Browser-supplied rows, aliases, paths, relationship definitions, or fingerprints never establish snapshot identity.

## Experiment Specification

`ExperimentSpecification` contains `experiment_id`, `specification_version`, user-confirmed `task_type`, target, numeric and categorical feature roles, excluded columns, split policy, candidate families, metric policy, resource limits, and three explicit random seeds.

Supported tasks are `regression` and `classification`. Regression candidates are `regularized_linear`, `random_forest`, and `hist_gradient_boosting`; classification candidates are `logistic`, `random_forest`, and `hist_gradient_boosting`. Candidate families cannot contradict the user-selected task. The target and excluded fields cannot enter the feature set. Stratification is classification-only. Time-ordered and grouped policies require their respective split column and reject unrelated split columns.

## Run Specification

`RunSpecification` binds one run identity to an experiment specification version and full dataset snapshot identity. It also contains submission time, JSON-safe parameters, runtime environment strings, and a code revision. It is an execution request and reproducibility receipt, not a persisted lifecycle record or serialized estimator.

## Evaluation Result

`EvaluationResult` keeps development selection evidence and final-holdout evidence in separate required fields.

`selection_evidence` contains the naive baseline, baseline fold metrics, candidate fold distributions and means, selected candidate, and development row count. Candidate selection may use only this evidence.

`final_holdout_evidence` contains metrics for the already selected candidate and baseline, holdout row count, and `evaluated_once: true`. Its candidate must exactly match the development selection. The holdout cannot be reused for candidate ranking.

Every result also carries task type, dataset snapshot identity, experiment/specification identity, warnings, limitations, structural leakage findings, feature influence, runtime versions, seeds, and a truth boundary. Feature influence is always `causal: false` and must state limitations. The truth boundary is `evaluated_experiment`; it cannot claim production readiness, deployment, or causality.

`split_evidence` carries row-identity hashes and counts for the development/final boundary and every cross-validation fold. It records zero row overlap plus the applicable temporal-order or group-isolation invariant without exposing raw row values.

## Reviewed Candidate Reference

`ReviewedCandidateReference` points to an immutable run, specification version, snapshot, and server-created artifact hash. It records review status, reviewer, time, intended use, and prohibited uses. It contains no estimator or artifact bytes and does not authorize deployment.

## Structured Errors

`StructuredError` contains only stable `code`, developer-readable `message`, and safe `remediation`. Tracebacks, filesystem paths, private keys, serialized estimators, secrets, and raw data samples are outside this object and must not cross the public boundary.

## Evaluation Boundary

The evaluation service must partition the final holdout before any candidate work. Preprocessing and model fitting occur inside development cross-validation folds. Candidate selection uses development evidence only. The selected candidate is refit on all development rows and evaluated exactly once on the final holdout.

Random and stratified policies are deterministic. Time-ordered folds never train after their validation observations. Grouped policies never place one group on both sides of a split. Invalid or statistically infeasible configurations return stable structured errors or blocked evaluation results.

## Dependency Boundary

`backend/ml_studio/` must not import Flask, `backend/utils/global_state.py`, persistence repositories, Context Ledger, frontend code, filesystem dataset paths, or model-serving code. Dataset rows arrive only after a trusted server-side resolver has validated the snapshot identity and governance state.
