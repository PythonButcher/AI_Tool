# Phase 13 — AI Tool ML Studio

Status: Approved active roadmap. Only the gate named by `project_docs/active/active_gate/README.md` is authorized for implementation.

## Product Outcome

Create a first-class ML Studio inside AI Tool where developers can turn a governed workspace dataset into a reproducible machine-learning experiment, understand why a result is trustworthy or limited, compare runs, and preserve a reviewed candidate without needing to assemble a notebook or external MLOps stack.

The first release is intentionally focused on useful tabular machine learning: predict a number, predict a category, and discover segments. Forecasting, deep learning, production serving, automatic retraining, and Context Ledger integration remain outside the initial phase.

## Architecture Recommendation

Build ML Studio into the existing AI Tool application as a first-class destination, not as a standalone sub-application.

Machine learning depends directly on AI Tool's governed source identity, workspace version, active relationship model, semantic field roles, Power Query transformations, dataset readiness, and later Context Ledger lineage. A separate application would either duplicate those contracts or force an integration boundary through nearly every step of the workflow.

Keep implementation modular inside the existing backend. ML Studio should have its own route, application-service, domain-contract, repository, and artifact-storage boundaries, while consuming authoritative AI Tool dataset and workspace resolvers. This preserves portability without creating a second product shell.

Context Ledger must remain behind a future adapter boundary. The initial system records enough immutable identity and lineage to integrate later, but it must not import Context Ledger code, write Context Ledger records, or assume its schema without a separate architecture decision.

## Existing Foundation Worth Keeping

- `backend/routes/ml_prep.py` already exposes model definitions, readiness checks, structured issues, and cleaning suggestions.
- `frontend/frontend/src/components/data_management/MLPrepPanel.jsx` already turns readiness findings into Power Query fixes and provides the transition to training.
- `backend/services/model_training.py` already uses scikit-learn pipelines for imputation, scaling, one-hot encoding, regression, classification, and clustering.
- `backend/services/automl_logic.py` already compares a small, understandable candidate set, computes baselines and feature importance, creates a run ID, and labels evaluation limits.
- `backend/routes/automl.py` already enforces the dataset-governance gate before its training service is imported.
- `backend/services/ml_logic.py` provides anomaly detection with a deterministic fallback.
- The app already has durable data-source, workspace, relationship, semantic-model, governance, and workflow-run foundations that ML Studio can reuse.
- The frontend already has light and dark theme tokens, a destination rail, a canvas workspace, inspector-style panes, and draggable semantic objects.

These are prototype assets, not an approved production contract. They should be consolidated behind the new ML Studio boundary rather than extended independently.

## Findings That Block Promotion As-Is

### Evaluation integrity

- The custom supervised path fits and predicts on the same rows in `backend/services/model_training.py`, so its displayed regression and classification scores are training scores rather than evidence of generalization.
- AutoML chooses the winning candidate using the same holdout set whose metrics it reports. That makes the final comparison optimistic because the holdout participates in model selection.
- The ten-row runtime minimum is a technical floor, not an enterprise reliability standard. Readiness must account for task type, class counts, feature count, split feasibility, and confidence width.
- Random holdout is the only evaluation strategy. Time-ordered, grouped, and entity-aware data need explicit split policies to prevent leakage.

### Contract and governance integrity

- `POST /api/ml_prep/train` can be called without the server-side governance check enforced by `POST /api/automl/train`.
- The readiness rules reject categorical supervised features even though the training pipeline can one-hot encode them. The preparation contract and execution contract therefore disagree.
- Both routes accept full datasets from browser state. Canonical training should resolve server-owned source and workspace identities, versions, relationships, and transformation snapshots.
- Frontend ML readiness resets when uploaded or full data changes, but not when cleaned data changes, so a previously ready state can outlive a cleaning mutation.

### Lifecycle and operational integrity

- The selected model is held only in process-global memory. It disappears on restart, has no durable run record, and is not safe for concurrent users.
- No consumer uses `get_trained_model`; there is no stable prediction, model-version, archive, or promotion contract.
- The custom and AutoML services duplicate problem definitions, preprocessing, metrics, and response concepts.
- Direct ML test coverage is effectively absent. Current tests prove governance blocking and readiness messaging, not model correctness, leakage protection, run persistence, or API contracts.
- The ML window is not a navigation destination. It becomes visible only after the user enters Power Query, runs ML Prep, and selects Train Model, which explains why the capability appears unavailable.

## Experience Concept — Experiment Workbench

The product label should be **ML Studio**, with **Experiment Workbench** as the primary working surface. It should look native to AI Tool: black or white canvas, slate structural surfaces, electric-blue focus, restrained green/amber/red evidence states, and the existing typography and spacing tokens. Avoid a disconnected purple-gradient AI aesthetic.

The experience uses five coordinated regions:

1. **Run Ribbon** — a persistent, ordered path across the top: Data Snapshot → Goal → Features → Validation → Candidates → Evidence → Candidate. It communicates progress without becoming a free-form node graph.
2. **Asset Rail** — the left pane shows the authoritative workspace, selected source graph, Power Query recipe, target, feature roles, row count, schema version, and readiness. Dataset identity stays visible throughout the experiment.
3. **Experiment Canvas** — the center combines guided cards with direct manipulation. Developers choose an intent such as Predict a Number, Predict a Category, or Discover Segments, then configure only the decisions that materially affect validity.
4. **Evidence Inspector** — the right pane explains the selected stage or result: leakage findings, split rationale, warnings, metric definitions, baseline delta, feature influence, error slices, and limitations.
5. **Run Dock** — a bottom strip shows queued, running, failed, and completed runs and allows two to four runs to be pinned for comparison without leaving the workspace.

### Distinctive interactions

- **Metric landscape, not a leaderboard:** show baseline-relative performance, cross-validation distribution, final holdout result, and uncertainty together. A model cannot win from one large number.
- **Failure atlas:** let users select poor-performing cohorts or confusion-matrix cells and immediately inspect the affected rows and feature distributions.
- **Why this candidate:** summarize performance, stability, complexity, latency estimate, and known failure slices in one evidence-backed panel.
- **Reproducibility receipt:** every run exposes its dataset fingerprint, workspace version, transformation recipe hash, feature schema, split policy, random seed, library versions, parameters, code revision, and artifact hashes.
- **Guided and developer views:** the same experiment can switch between guided controls and a read-only generated Python/API recipe. The recipe is an export of the governed configuration, not a second source of truth.
- **Visible truth boundary:** use explicit states such as Draft, Evaluated, Reviewed Candidate, and Rejected. Do not label a model Production or Deployed during this phase.

## Core Contracts To Define Before UI Implementation

### Dataset snapshot

An immutable training input containing `snapshot_id`, `workspace_id`, `workspace_version`, ordered `source_ids`, ordered `relationship_ids`, source fingerprints, schema version, semantic-model version, governance result, Power Query recipe and hash, row count, column profile, created time, and creating actor when identity becomes available.

The server resolves rows from these identities. Raw browser-supplied rows remain a temporary compatibility path only and cannot produce a reviewable candidate.

### Experiment specification

An immutable versioned configuration containing `experiment_id`, `task_type`, optional target, feature roles, excluded columns, split strategy, group or time column when applicable, candidate families, metric policy, resource limits, and random-seed policy.

Task type is proposed from data but confirmed by the user. The system must not silently reinterpret a numeric category as regression or a continuous target as classification.

### Run

A durable asynchronous execution containing `run_id`, experiment/specification version, snapshot identity, lifecycle status, timestamps, progress stages, cancellation state, parameters, environment manifest, warning and failure codes, evaluation result, and artifact references.

### Evaluation result

A task-aware record containing baseline metrics, cross-validation fold results, untouched final-holdout metrics, confidence intervals where supportable, class or target profile, calibration when relevant, confusion matrix or residual summaries, subgroup and error slices, feature influence with method and limitations, leakage findings, and an explicit truth boundary.

### Candidate record

A reviewed reference to one immutable run and model artifact. It records review status, reviewer, notes, intended use, prohibited use, training-data lineage, evaluation summary, compatibility schema, and artifact hash. Candidate status does not authorize deployment.

### Errors

Use structured errors with stable codes, clear developer messages, safe details, and remediation actions. Never return estimator tracebacks, filesystem paths, serialized objects, secrets, or raw data samples in an error.

## Proposed Delivery Order

### Gate 1 — Contract And Evaluation Integrity

**Owner:** Codex.

Define the five contracts above, add a single ML Studio application service, consolidate duplicated training behavior, and establish leakage-safe evaluation. Support regression and classification first. Use preprocessing pipelines fit only on training folds, inner cross-validation for candidate selection, and one untouched final holdout for reporting. Add random/stratified, time-ordered, and grouped split policies with deterministic tests.

Acceptance requires direct tests proving that test rows never influence preprocessing or selection, the final holdout is untouched until candidate selection finishes, baselines are present, invalid task/split configurations fail safely, and existing dataset governance remains enforced.

### Gate 2 — Durable Experiments And Runs

**Owner:** Codex.

Add local SQLite metadata persistence plus a managed, server-owned artifact directory. Store experiment versions, immutable run manifests, metrics, warnings, and hashes. Persist model artifacts only from trusted server-created pipelines; never deserialize a client upload. Reuse the existing workflow-run lifecycle patterns for status, events, cancellation, atomic writes, and restart recovery where practical.

Acceptance requires concurrent-run isolation, restart-safe status, immutable completed runs, idempotent submissions, bounded resources, safe artifact paths, and deterministic serialization.

### Gate 3 — Identity-First ML Studio API

**Owner:** Codex.

Expose versioned routes for dataset snapshots, experiments, runs, run events, cancellation, comparisons, evaluation details, and candidate review. Canonical requests carry workspace/source identity and version fields rather than full datasets. Keep legacy ML routes available only through a documented compatibility boundary until the new UI no longer depends on them.

Acceptance requires endpoint contract tests, stale-workspace rejection, governance blocking, source-lineage retention, stable errors, no client filesystem paths, and no process-global model ownership.

### Gate 4 — ML Studio Shell

**Owner:** Antigravity after Codex verifies Gate 3 and creates one bounded handoff.

Add ML Studio as a first-class destination in the existing application rail. Build the native empty, no-dataset, blocked, ready, loading, and error states; the Run Ribbon; Asset Rail; blank Experiment Canvas; Evidence Inspector; and Run Dock. Do not implement training controls in this gate.

Acceptance requires native light/dark theming, keyboard navigation, reduced-motion support, responsive minimum sizing, clear dataset identity, and no regression to Workspace, Data Model, Explore, Dashboards, or AI Suite.

### Gate 5 — Power Query Gateway And Guided Experiment Builder

**Owners:** Codex for snapshot/recipe contracts, then Antigravity for one bounded UI handoff.

Replace the fragile readiness flag with a server-issued preparation assessment bound to the exact dataset snapshot and experiment specification. Power Query can apply a suggested fix, preview it, save the resulting transformation recipe, and choose **Use in ML Studio**. ML Studio can return to Power Query without losing experiment intent.

Acceptance requires stale-readiness invalidation, recipe lineage, reversible navigation, unsupported-fix handling, user confirmation of target and feature roles, and no duplicated cleaning engine.

### Gate 6 — Run Observatory And Comparison

**Owners:** Codex for comparison/evidence APIs, then Antigravity for the UI.

Execute asynchronous runs and render live stage progress, the metric landscape, baseline comparison, failure atlas, run comparison, and Why This Candidate evidence. Add clustering only after its validation contract is defined separately from supervised metrics.

Acceptance requires truthful live status, cancellation, failure recovery, two-to-four-run comparison, task-appropriate metrics, accessible charts plus tabular equivalents, and clear handling of missing or statistically weak evidence.

### Gate 7 — Reviewed Candidates And Developer Export

**Owners:** Codex for registry/export contracts, then Antigravity for the review UI.

Allow a user to mark an evaluated run as a Reviewed Candidate, reject it, or leave it experimental. Produce a model card and reproducibility bundle containing the run manifest, metrics, limitations, schema, environment, and generated Python/API recipe. Do not add online serving or automatic deployment.

Acceptance requires immutable candidate lineage, audit-ready review metadata, artifact-integrity checks, safe export, and exact replay against the preserved snapshot where the local data remains available.

### Gate 8 — Enterprise Hardening And Context Ledger Port

**Owner:** Codex, with frontend work only if a verified UI gap remains.

Add authorization hooks, quotas, concurrency and memory limits, retention policy, dependency and artifact scanning, structured audit events, observability, migration tests, accessibility verification, and performance benchmarks. Define—but do not connect—a Context Ledger port for future run, lineage, review, and candidate events.

Acceptance requires threat modeling, failure-injection tests, multi-user isolation tests once identity exists, bounded large-dataset behavior, dependency audit evidence, and a separate user-approved architecture decision before any Context Ledger adapter is implemented.

## Initial Algorithm Boundary

The first release should deliberately use a compact, explainable candidate library:

- Regression: regularized linear baseline, random forest, and histogram gradient boosting.
- Classification: logistic baseline, random forest, and histogram gradient boosting.
- Clustering, after the supervised flow is sound: K-means plus explicit scaling, stability checks, and silhouette diagnostics.

Do not add dozens of estimators, arbitrary Python execution, uploaded pickles, GPU training, neural networks, or opaque hyperparameter searches. Better evaluation and evidence are more valuable than a larger algorithm menu.

## Quality And Safety Policy

- Every result compares against a simple baseline.
- Preprocessing, feature selection, and tuning occur inside training folds.
- Candidate selection and final evaluation use separate evidence.
- Time and entity structure are explicit split inputs, never inferred and ignored.
- Class imbalance, missing targets, duplicate rows, high-cardinality identifiers, target leakage, and post-outcome fields produce visible findings.
- Feature importance is labeled as model influence, never causal importance.
- Sensitive-attribute analysis is opt-in and explicit; the system never guesses protected classes from names or values.
- Reproducibility metadata is required for every completed run.
- A successful run is an evaluated experiment, not a deployment recommendation.

## Activation And Sequencing

**Phase 13 — Machine Learning Studio Foundation** is active with Gate 1 as the sole executable gate and Codex as the owner. No frontend handoff exists. Antigravity must not begin until Codex verifies the backend contracts and representative evaluation behavior required by the first frontend surface.

Later gates remain roadmap context only. Finishing one gate does not authorize the next; Codex must review the evidence, update current status, and replace the sole active gate before work continues.

## External Design Evidence

- Scikit-learn's official guidance recommends pipelines and strict train/test separation to prevent inconsistent preprocessing and data leakage: https://scikit-learn.org/stable/common_pitfalls.html
- MLflow organizes work as experiments, runs, models, parameters, metrics, artifacts, and dataset inputs, providing a useful vocabulary for a portable internal contract: https://mlflow.org/docs/latest/ml/tracking
- Azure Machine Learning Designer demonstrates the value of reusable pipeline components, visible inputs and outputs, drafts, jobs, and experiment history: https://learn.microsoft.com/en-us/azure/machine-learning/concept-designer?view=azureml-api-2
- Vertex ML Metadata emphasizes parameters, artifacts, lineage, repeatability, debugging, and downstream governance: https://cloud.google.com/vertex-ai/docs/ml-metadata/introduction
- NIST AI RMF frames trustworthy lifecycle work through Govern, Map, Measure, and Manage; ML Studio should make those concerns continuous rather than a final checklist: https://airc.nist.gov/airmf-resources/airmf/5-sec-core/

