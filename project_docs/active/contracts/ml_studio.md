# ML Studio Contract And Evaluation Core

## Status

Phase 13 backend contract through the Gate 5 preparation boundary. This document defines framework-independent, versioned objects, preparation truth, evidence boundaries, durable experiment and run state, managed artifact integrity, and the identity-first API. It does not authorize asynchronous execution, model serving, frontend behavior, or deployment claims.

## Contract Version

Every public object uses `contract_version: "ml_studio_contract_v1"`. Objects are immutable after validation, reject unknown fields, and must serialize to finite JSON values. Missing required identity, contradictory task configuration, stale snapshot truth, NaN or infinite metrics, and unsafe error content are rejected.

## Dataset Snapshot Identity

`DatasetSnapshotIdentity` is the immutable reference for training input. It contains `snapshot_id`, `workspace_id`, `workspace_version`, ordered `source_ids`, ordered `relationship_ids`, ordered source fingerprints with schema versions, snapshot schema version, semantic-model version, passing governance result, transformation recipe hash, row count, aggregate column profile, creation time, and optional creating actor.

The source-fingerprint order must exactly match `source_ids`. The application service must compare workspace version and every source fingerprint with current authoritative server state before evaluation. A mismatch is stale and cannot run. Browser-supplied rows, aliases, paths, relationship definitions, or fingerprints never establish snapshot identity.

## Experiment Specification

`ExperimentSpecification` contains `experiment_id`, `specification_version`, user-confirmed `task_type`, target, numeric and categorical feature roles, excluded columns, split policy, candidate families, metric policy, resource limits, and three explicit random seeds.

Supported tasks are `regression` and `classification`. Regression candidates are `regularized_linear`, `random_forest`, and `hist_gradient_boosting`; classification candidates are `logistic`, `random_forest`, and `hist_gradient_boosting`. Candidate families cannot contradict the user-selected task. The target and excluded fields cannot enter the feature set. Stratification is classification-only. Time-ordered and grouped policies require their respective split column and reject unrelated split columns.

## Preparation Assessment And Transformation Recipe

`PreparationAssessment` is immutable server-issued readiness truth for one full `DatasetSnapshotIdentity`, one exact `ExperimentSpecification`, and one `TransformationRecipeLineage`. It contains `assessment_id`, timezone-aware `assessed_at`, `ready` or `blocked` state, ordered issues, ordered suggested fixes, and a deterministic `input_fingerprint`. The fingerprint covers the complete bound snapshot, specification, and recipe lineage, so changing any identity or content makes an earlier assessment stale.

`PreparationIssue` contains a stable `issue_id`, machine-readable code, `blocking`, `warning`, or `info` severity, a safe message, an optional affected field, and safe remediation. Assessment state must agree with its issues: any blocking issue produces `blocked`, and an assessment without blocking issues produces `ready`.

`SuggestedPreparationFix` contains a stable `fix_id`, an action type from the existing `ManualCleaningEngine`, ordered affected columns, finite JSON parameters, a safe reason, explicit `supported` or `unsupported` status, and an explanation. Unsupported fixes remain in the response and cannot be treated as applicable. These contracts describe proposed steps; they do not execute or duplicate cleaning behavior.

`TransformationRecipeLineage` contains `recipe_id`, `workspace_id`, `base_snapshot_id`, the base snapshot's transformation recipe hash, a positive recipe version, ordered `TransformationStep` objects, a canonical recipe hash, timezone-aware creation time, and an optional creating actor. Each step has a stable identity, an existing Power Query action type, ordered affected columns, and finite JSON parameters. The canonical hash covers the recipe identity, workspace, base snapshot and hash, version, and ordered steps. A supplied hash that does not match this content is rejected.

Preparation validation rejects unknown fields, duplicate issue, fix, or step identities, unsupported state or severity values, contradictory workspace/snapshot/recipe identities, specification columns absent from the snapshot schema, stale fingerprints, non-finite values, unsafe error text, raw dataset rows, and client filesystem paths. The preparation boundary never accepts browser rows, a browser-owned readiness flag, mutable Power Query state, or a path as readiness evidence.

## Run Specification

`RunSpecification` binds one run identity to an experiment specification version and full dataset snapshot identity. It also contains submission time, JSON-safe parameters, runtime environment strings, and a code revision. It is an execution request and reproducibility receipt, not a persisted lifecycle record or serialized estimator.

## Durable Experiment And Run Records

SQLite stores immutable experiment specifications under the composite identity `(experiment_id, specification_version)`. The first version is `1`; each later version must increase by exactly one. Existing versions cannot be replaced. Canonical JSON and its SHA-256 digest establish deterministic stored content.

A durable run stores the complete `RunSpecification`, submission fingerprint, lifecycle state, progress stage, timestamps, bounded warnings, structured failure, final evaluation result, and artifact metadata. Public repository responses expose the immutable run specification and lifecycle data but never the idempotency hash, database path, artifact path, or artifact bytes.

Every submission requires one explicit idempotency key. Only its SHA-256 digest is stored. Reusing a key for the identical canonical run specification returns the existing run; reusing it across a different run, experiment version, or snapshot is a conflict. Run creation and idempotency enforcement occur in one immediate SQLite transaction.

Valid states are `queued`, `running`, `cancel_requested`, `completed`, `failed`, `cancelled`, and `interrupted`. Queued cancellation is immediately terminal. Running cancellation is cooperative through `cancel_requested`, followed by `cancelled`. A completed run requires matching `EvaluationResult` evidence, and a failed run requires `StructuredError`. Terminal records cannot transition again. Startup recovery moves every non-terminal run to `interrupted` and records `restart_recovery`; it never claims that interrupted work succeeded.

Repository JSON is finite and size-bounded. Warnings are bounded strings, event reads are capped, and SQLite foreign keys isolate runs from missing experiment versions. Repository errors cross the boundary only as stable `StructuredError` fields.

## Managed Artifact Boundary

`ManagedArtifactStore` owns one configured server directory. It accepts only explicit `server_created: true` byte content, provides no deserialization API, and rejects client-originated content at the storage boundary. Artifact size and media type are validated before writing.

Run identities and artifact names are bounded. Absolute paths, separators, traversal, unsafe managed entries, root symlinks, and run-directory symlink escapes are rejected. Cleanup validates the run identity, refuses links and nested entries, and cannot traverse outside the managed root.

Each artifact and its metadata sidecar are written through flushed temporary files while an exclusive lock is held. Artifacts are write-once. Metadata contains only `run_id`, name, `sha256`, byte size, media type, and timezone-aware creation time. Verification re-hashes stored bytes and rejects missing, malformed, size-mismatched, identity-mismatched, or tampered artifacts. SQLite stores the same path-free metadata under `(run_id, name)` and never stores artifact bytes.

## Identity-First API

The versioned API root is `/api/ml-studio/v1`. Every response uses one named object or collection. Public errors contain exactly `code`, `message`, and `remediation`. Unknown failures return the stable `ml_studio_internal_error` boundary without a traceback or implementation detail.

| Method and path | Request identity | Response |
| --- | --- | --- |
| `POST /snapshots` | `workspace_id`, `workspace_version`, ordered `source_ids`, ordered `relationship_ids` | Server-resolved `snapshot` |
| `GET /snapshots/{snapshot_id}` | Server-issued snapshot identity | Immutable `snapshot` |
| `POST /preparation-assessments` | Stored `snapshot_id`, stored experiment identity/version, and validated transformation-recipe lineage | Server-issued immutable `assessment` |
| `POST /experiments` | Complete `ExperimentSpecification` | Immutable `experiment` version |
| `GET /experiments/{experiment_id}/versions` | Experiment identity | Ordered `experiments` |
| `POST /runs` | Experiment/version, `snapshot_id`, parameters, environment, code revision, and `Idempotency-Key` header | Durable `run` and `created` flag |
| `GET /runs` | Optional bounded `limit` | Durable `runs` |
| `GET /runs/{run_id}` | Run identity | Durable `run` with path-free artifact metadata |
| `GET /runs/{run_id}/events` | Run identity and optional bounded `limit` | Ordered lifecycle `events` |
| `POST /runs/{run_id}/cancel` | Run identity | Updated durable `run` |
| `GET /runs/{run_id}/evaluation` | Completed run identity | Immutable `evaluation` |
| `GET /runs/{run_id}/evidence` | Completed run identity | UI-ready `evidence` with metric landscape, strength reasons, aggregate failure atlas, and Why This Candidate truth |
| `POST /runs/compare` | Two to four ordered `run_ids` | Compatible evidence-only `comparison` |
| `POST /candidates` | Completed `run_id`, registered artifact hash, review decision, reviewer, and use boundaries | Server-issued immutable `candidate` |
| `GET /candidates/{candidate_id}` | Candidate identity | Immutable `candidate` |

Snapshot creation never accepts rows, fingerprints, schema, governance evidence, semantic-model content, transformation recipes, relationship definitions, or paths from the client. An injected trusted resolver derives those fields from the current server-owned workspace and active Data Model. Snapshot creation rejects a mismatched workspace version or ordered source/relationship identity, blocked governance, and empty datasets. Run submission reloads the stored snapshot and re-resolves current server truth; a changed workspace version, source fingerprint, relationship order, semantic-model hash, transformation-recipe hash, or governance state makes the snapshot stale.

Preparation assessment creation accepts exactly a stored `snapshot_id`, stored experiment identity and version, and validated transformation-recipe lineage. The service reloads both immutable stored contracts, re-resolves current server snapshot truth, validates that the recipe starts from that snapshot and its recipe hash, derives ordered issues and fixes from the server-owned column profile, and issues the assessment identity, time, state, and input fingerprint. Browser rows, paths, local readiness, client issue lists, and client assessment state are rejected.

The server issues snapshot, run, and candidate identities. Run retries are idempotent on caller-controlled intent, excluding the server-issued run ID and submission timestamp. The raw idempotency key is never stored or returned. Comparisons require completed runs from the same experiment version, snapshot, and task type. Candidate review requires a completed evaluated run, registered path-free artifact metadata, and a fresh managed-storage hash verification.

Run comparison preserves the caller's order and projects each run through the same metric landscape, evidence-strength, aggregate Failure Atlas, and Why This Candidate view. Its metric matrix aligns development distributions and final-holdout evidence by metric. Comparison is evidence-only: it never names a winner from repeated final-holdout observations, and its decision boundary explicitly prohibits treating that comparison as deployment approval or a new candidate-selection step.

## Evaluation Result

`EvaluationResult` keeps development selection evidence and final-holdout evidence in separate required fields.

`selection_evidence` contains the naive baseline, baseline fold metrics, candidate fold distributions and means, selected candidate, and development row count. Candidate selection may use only this evidence.

`final_holdout_evidence` contains metrics for the already selected candidate and baseline, holdout row count, and `evaluated_once: true`. Its candidate must exactly match the development selection. The holdout cannot be reused for candidate ranking.

Every result also carries task type, dataset snapshot identity, experiment/specification identity, warnings, limitations, structural leakage findings, feature influence, runtime versions, seeds, and a truth boundary. Feature influence is always `causal: false` and must state limitations. The truth boundary is `evaluated_experiment`; it cannot claim production readiness, deployment, or causality.

`split_evidence` carries row-identity hashes and counts for the development/final boundary and every cross-validation fold. It records zero row overlap plus the applicable temporal-order or group-isolation invariant without exposing raw row values.

`failure_slices` contains bounded aggregate holdout error cohorts for the Failure Atlas. Numeric features use quartile or missingness labels; categorical features use frequency-relative or missingness labels. Slice identities, counts, task-appropriate error values, overall error, and delta are returned without raw rows, observed values, category labels, or row identities.

The evidence view derives a task-appropriate metric landscape from immutable selection and final-holdout evidence. Favorable baseline-relative deltas are positive for both minimized and maximized metrics. It reports explicit weak-evidence reason codes for small development samples, small holdouts, fewer than three folds, missing reported metrics, and evaluation warnings. Why This Candidate names the selected family, primary metric, development and final baseline deltas, non-causal feature influence, limitations, warnings, and the truth boundary. Missing evidence remains unavailable; it is never synthesized.

## Reviewed Candidate Reference

`ReviewedCandidateReference` points to an immutable run, specification version, snapshot, and server-created artifact hash. It records review status, reviewer, time, intended use, and prohibited uses. It contains no estimator or artifact bytes and does not authorize deployment.

## Structured Errors

`StructuredError` contains only stable `code`, developer-readable `message`, and safe `remediation`. Tracebacks, filesystem paths, private keys, serialized estimators, secrets, and raw data samples are outside this object and must not cross the public boundary.

## Evaluation Boundary

The evaluation service must partition the final holdout before any candidate work. Preprocessing and model fitting occur inside development cross-validation folds. Candidate selection uses development evidence only. The selected candidate is refit on all development rows and evaluated exactly once on the final holdout.

Random and stratified policies are deterministic. Time-ordered folds never train after their validation observations. Grouped policies never place one group on both sides of a split. Invalid or statistically infeasible configurations return stable structured errors or blocked evaluation results.

## Dependency Boundary

`backend/ml_studio/contracts.py` and `backend/ml_studio/evaluation.py` must not import Flask, persistence code, `backend/utils/global_state.py`, Context Ledger, frontend code, filesystem dataset paths, or model-serving code. The ML Studio repository and artifact modules remain framework-independent and must not import application repositories or dataset storage. Dataset rows arrive only after a trusted server-side resolver has validated the snapshot identity and governance state.
