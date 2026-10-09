# ML Studio Contract And Evaluation Core

## Status

Phase 13 source-backed contract. The current draft workflow implements preparation, configuration, local training, explicit nomination, one-time final evaluation, deliberate selection, verified exports, prediction and local summaries for regression, classification, forecasting, clustering and anomaly detection. The older `ml_studio_contract_v1` experiment routes remain compatibility foundations for regression/classification; the draft UI uses the workflow routes described here.

The implemented sections below define current behavior; explicitly deferred interfaces remain proposals. External publishing and standalone `/recipes` are not implemented. Recipe issuance belongs to a draft preparation operation.

## Draft API — Current Backend Truth

`POST /api/ml-studio/v1/drafts` accepts editable draft fields and requires `workspace_id`. `GET /api/ml-studio/v1/drafts?workspace_id=...` returns up to 100 stable-order summaries for that workspace, including the current opaque `etag`. `GET /api/ml-studio/v1/drafts/{experiment_id}?workspace_id=...` returns `draft` and server-derived `workflow_state`.

`PATCH /api/ml-studio/v1/drafts/{experiment_id}?workspace_id=...` requires the raw opaque `etag` in `If-Match`; a successful save returns `draft` with incremented `draft_revision`, new `etag`, and `updated_at`, plus `workflow_state`. A stale or missing tag returns HTTP 409 with `draft_revision_conflict` and leaves the stored draft unchanged. `POST /api/ml-studio/v1/drafts/{experiment_id}/duplicate?workspace_id=...` returns a new draft identity with copied editable settings, reset active stage, and no copied assessment, run, completion, or selection. `GET /api/ml-studio/v1/drafts/{experiment_id}/workflow?workspace_id=...` returns `workflow_state`.

`DELETE /api/ml-studio/v1/drafts/{experiment_id}?workspace_id=...` requires the listed draft's `etag` in `If-Match` and returns 204. A stale or missing tag returns `draft_revision_conflict` (409); a draft outside the workspace or already deleted returns `draft_not_found` (404). An open preparation operation returns `draft_preparation_pending` (409). Deletion hides the saved draft from list, get, edit, and duplicate routes while retaining its server metadata, preparation history, immutable run records, and artifacts. It does not delete the governed dataset or workspace.

Only an existing workspace can be used in the application route. Drafts are scoped by `workspace_id`; a draft from another workspace returns 404. The server validates a referenced snapshot against the same workspace. Client recipe identity, assessment evidence, run status, raw rows, filesystem paths, and completion claims are rejected. All six stages are gated by server-owned preparation, assessment, run and selection evidence.

## Draft Preparation Operations — Implemented Backend Boundary

Preparation options derive missing-value warnings from the saved snapshot and inspect authoritative rows for full-row duplicates, surrounding text whitespace and numeric infinities. They include counts and explicit check coverage without requiring an immutable training specification. This is an initial quality view, not a complete statistical or domain assessment. Begin requires `If-Match`, `Idempotency-Key`, the draft workspace, server-issued snapshot identity, supported ordered cleaning steps, optional paired issue/fix references, and return stage `Prepare Data` or `Data & Goal`. The server issues a recipe and operation bound to the draft revision and current workspace. Only one open operation is permitted per draft; ordinary draft edits are rejected until cancellation or apply completes. Begin/cancel never mutate the saved draft or dataset.

An operation persists its recipe, base draft revision/ETag, experiment/workspace/snapshot identity, selected issue/fix, and return stage. Replaying the same start key and intent returns the same operation. Apply consumes stored steps and an operation identity, not browser rows, hashes, receipts, or replacement draft fields. Preview is read-only. Cancellation is terminal and preserves the saved draft; it is prohibited after a data commit that still needs draft reconciliation.

ML draft writes are serialized while apply runs. Catalog cleaning commits a durable receipt keyed by the server operation identity in the same transaction as workspace membership replacement. If the ML draft transaction fails after the catalog commit, the open operation remains recoverable; retry loads that receipt and completes reconciliation without running cleaning again. Newer external workspace changes prevent reconciliation and return a conflict; they never justify overwriting the current identity. Successful reconciliation creates a fresh snapshot, removes role references absent from its schema, invalidates assessment evidence, saves recipe identity, and restores the persisted return stage. Replaying a terminal operation returns its evidence plus the current draft without overwriting later edits.

HTTP root: `/api/ml-studio/v1`. All operations use `workspace_id` query scope and the existing `{error: {code, message, remediation}}` error envelope.

| Method and path | Exact input | Success (200) |
| --- | --- | --- |
| `GET /drafts/{experiment_id}/preparation` | `workspace_id` query | `{snapshot_id, issues, fixes, preparation_context, row_count, columns, checks, not_checked, data_preview}`; empty issues/fixes are valid. |
| `POST /drafts/{experiment_id}/preparation` | `workspace_id`; `If-Match` current draft ETag; `Idempotency-Key` (1–256 characters); JSON exactly `{snapshot_id, steps, issue_id, fix_id, return_stage}` | `{preparation}`; repeated identical start key/intent returns the same operation, including its terminal outcome. |
| `GET /drafts/{experiment_id}/preparation/{operation_id}` | `workspace_id` | `{preparation}` for this experiment/workspace only. |
| `POST /drafts/{experiment_id}/preparation/{operation_id}` | `workspace_id`; JSON exactly `{action: "preview"}` | `{preparation, preview}`; preview uses the workspace-cleaning response contract. |
| Same POST | `workspace_id`; `If-Match` operation `base_etag`; JSON exactly `{action: "apply"}` or `{action: "cancel"}` | `{preparation, draft, workflow_state, preparation_context}`. |

Start `steps` contain at most 100 entries with `type` and optional object `params`. Step, recipe, and operation identities are server-issued. Parameters are finite, path-free bounded JSON. `issue_id` and `fix_id` are both null for manual preparation, or a matching pair from current options. `return_stage` is exactly `Data & Goal` or `Prepare Data`. Other fields, caller recipe hashes/identities, raw rows, client readiness, and supplied receipts are rejected.

`preparation` contains `operation_id`, `experiment_id`, `workspace_id`, `base_draft_revision`, `base_etag`, `snapshot_id`, `workspace_version`, `source_id`, nullable `issue_id` and `fix_id`, `return_stage`, full `recipe: TransformationRecipeLineage`, `status` (`open`, `applied`, or `cancelled`), and nullable `result`. Applied `result` is `{snapshot_id, receipt, draft_revision}` describing that operation's commit. Replay returns this immutable evidence alongside the current draft, which may have a newer revision. Open/cancelled `result` is null. `GET /drafts/{experiment_id}` adds nullable `preparation_context` so reload can find an open operation without a browser callback.

Each issue has `{issue_id, code, severity: "warning", field, count, message, remediation}`. Codes are `missing_values`, `duplicate_rows`, `whitespace` and `non_finite_values`; whole-dataset duplicates have a null field and count repeated rows beyond their first occurrence. Missing-value issues also include `logical_type` and `training_imputation_available` (false for forecasting, saved targets/time/group roles and wholly empty columns). This eligibility describes possible input handling; Configure remains authoritative for actual roles and readiness. Fixes have `{fix_id, issue_id, action_type, affected_columns, parameters, support_status: "supported", explanation}` and offer `remove_nulls`, `remove_duplicates` or `trim_whitespace`. Infinities require manual review rather than an invented repair.

`columns` contains `{name, logical_type}` entries; `data_preview` contains at most 20 server-owned source rows. `checks` lists checks actually run; unhashable nested data can omit duplicate checking. `not_checked` identifies domain/outlier/intended-type limitations. Missing counts are per column; they must not be summed to estimate rows lost. No absence-of-issues response asserts statistical readiness.

The UI groups findings, supports select-all and bulk missing-value choices with per-column overrides, and sends combined/manual recipes with null issue/fix references. Numeric constant replacements remain numeric. Choosing training handling or leaving a finding does not alter data or mark it repaired. Ordinary feature imputation stays in training partitions; target/time/series and task restrictions are assessed separately. The full editor reuses Power Query's transformation catalog, ribbon and step controls for adding/editing/reordering/removing supported steps. Whole-dataset learned filling is explicitly cautioned against for ML evaluation.

New editor sessions require a successful nonempty preview before Apply. Preview starts an immutable operation. Edit steps first cancels that operation; only confirmed cancellation reconciles the studio's open-operation lock, unlocks editing and clears the preview. The next preview uses a fresh idempotency key with the edited recipe. Lost begin/cancel responses keep controls locked and replay the same intent; a definitive rejected start permits editing or closing without retrying invalid steps. Resumed operations retain Apply for recovery of a potentially committed dataset even when preview is unavailable. Apply/Cancel return through the existing experiment reconciliation flow. Browser visual acceptance is separate from these behavior checks.

Invalid/missing fields, unsafe/unsupported recipes, unknown issue/fix pairs, absent saved task/snapshot, and invalid actions return 400. Cross-workspace/experiment draft or operation retrieval returns 404. Revision mismatch, changed start intent, open-operation draft edits, stale snapshots, relationship preparation, wrong terminal action, pending committed-data reconciliation, and workspace changes after commit return 409 with their stable error codes. Governance blocking returns 422 at apply. Unknown errors retain safe `ml_studio_internal_error` (500). Retry begin with the same key/intent; retry apply with the same operation and base ETag. Preview after a committed-data/pending-draft failure is stale; retry Apply instead. If an external workspace mutation makes the committed receipt obsolete, reconciliation refuses to overwrite it; duplicate the draft and select a fresh snapshot while retaining the operation's commit evidence.

Persistence uses `ml_preparation_operations` in the ML repository and `workspace_preparation_commits` in the catalog. Only hashed start keys are stored. Catalog receipt insertion is atomic with source membership/version mutation; ML snapshot, reconciled draft, and terminal outcome commit in one ML transaction. These are separate databases with explicit recovery, not a cross-database atomicity claim. Relationship-backed preparation remains outside this boundary.

Verification: `tests/test_ml_studio_preparation.py` covers restart, conditional start, issue/fix validation, read-only preview, cancellation, save locking, concurrent apply, stale identity, durable commit recovery, role/evidence invalidation, and replay preserving newer edits. The focused preparation/draft/API/cleaning/workspace/persistence run on 2026-09-27 ran 82 tests with one platform-dependent skip; compilation and the provider-neutral CI harness passed.

### Preparation Frontend Integration — Implemented

The draft-bound editor opens after pending saves finish, sends the current ETag and a stable start key, previews at most 100 server-returned rows with the full result count, and confirms terminal cancel/apply before returning. Repeated actions retain operation identity after lost responses. Draft GET context survives responses that omit it. Reopened operations can resume even when options fail because a data commit awaits reconciliation. Apply refreshes the governed workspace and reopens the saved experiment; the ordinary editor retains its compatibility behavior. Focused editor and integrated shell tests cover these boundaries. Visual browser acceptance remains unverified and user-owned.

## Saved Configuration Assessment — Implemented

`POST /drafts/{experiment_id}/assessment?workspace_id=...` accepts exactly `{}` and requires the current `If-Match`. It reads saved roles, validation, metric, candidates and resources; validates the current server snapshot; and returns `{draft, workflow_state, assessment, preparation_context}`. No browser recipe hash, configuration identity, rows or readiness flag is accepted. The server commits an immutable configuration, its assessment, and the revised draft pointer in one SQLite transaction. Repeating the original ETag immediately after a lost successful response returns the same assessment; subsequent edits conflict.

`assessment` contains `assessment_id`, `assessed_at`, `bound_draft_revision`, `bound_etag`, `input_fingerprint`, `state` (`ready` or `blocked`), field-level `issues`, and `configuration`. The configuration has version `ml_studio_configuration_v1`, server-issued `configuration_id` and immutable `specification_version`, internal experiment identity, `draft_experiment_id`, workspace/snapshot/recipe bindings, saved input fingerprint and normalized settings. Header name, Guidance and stage navigation do not affect that fingerprint. Dependency edits preserve immutable evidence but mark it stale. Draft GET returns the assessment; `workflow_state.assessment_current` describes its binding to saved settings, not a guarantee that a subsequent external workspace mutation cannot occur.

Regression/classification settings use `validation: {strategy, holdout_fraction, folds, seed}`, `metric: {primary}`, `candidate: {families}`, and `resource: {max_rows, max_features, timeout_seconds}`. Supported strategies are random, stratified (classification), time_ordered, and grouped; the latter two require exactly one corresponding role. Selection metrics are RMSE/MAE or balanced accuracy/weighted F1. Candidate families are regularized_linear/random_forest or logistic/random_forest. Limits are 20–100000 rows, 1–200 features, 5–600 seconds and 2–5 development folds. Feature imputation is declared as training-only; missing targets block readiness. Task-specific forecasting, clustering and anomaly settings are defined below.

Configure is available after Data & Goal. The searchable exclusive-role editor autosaves through the conditional draft writer, flushes before navigation/assessment and displays server findings. Training requires a current ready assessment. Configuration source and API tests cover durable reload, concurrent/lost-response assessment, stale evidence, scope, invalid settings, save ordering and frontend retry/navigation behavior. Changing task resets task-specific validation, metrics and candidates unless the same request supplies replacements; roles remain explicit and are revalidated.

## Workflow Application Contract

### Draft And Workflow Objects

`ExperimentDraft` uses `contract_version: "ml_studio_workflow_v1"` and contains server-issued `experiment_id`, positive `draft_revision`, opaque `etag`, `name`, `guidance_enabled`, `active_stage`, `workspace_id`, nullable `snapshot_id`, nullable `task_type`, nullable `goal`, nullable recipe identity/version, exclusive `roles`, task-specific `validation`, `metric`, `candidate`, and `resource` settings, nullable latest assessment identity/fingerprint, and `updated_at`. The five task values are `regression`, `classification`, `forecasting`, `clustering`, and `anomaly_detection`. Incomplete drafts are valid; submitted configurations are separate immutable objects.

`roles` has nullable `target` plus ordered `numeric`, `categorical`, `ignored`, `time`, and `group` column lists. A column has at most one role. Target is required only for supervised and forecasting tasks; clustering has none; anomaly labels are optional evaluation truth and are not model inputs.

`WorkflowState` contains `experiment_id`, `draft_revision`, effective `active_stage`, six ordered stage records, `assessment_current`, `latest_run_id`, `selection_id`, `experiment_complete` and nullable `active_run`. Each stage has `stage`, `state` (`locked`, `available`, `active`, `complete`, `stale`), blocker/stale-reason code lists and nullable snapshot/configuration/run/selection references. Saved data/task completes Data & Goal; a current ready assessment completes Prepare Data and Configure; a current completed development run completes Train; a current selection completes Review Results and the cycle. The active stage displays active; changed dependencies mark affected evidence stale. Use & Share remains optional. The server owns these states.

Draft updates require `If-Match: <etag>`. A mismatch returns `draft_revision_conflict` with safe remediation and does not overwrite either revision. Save responses return the new revision, `etag`, save time, and recomputed workflow state. No draft accepts raw rows, filesystem paths, client-issued readiness, run status, or candidate-selection truth.

### Implemented Draft Training

`POST /drafts/{experiment_id}/runs?workspace_id=...` accepts exactly `{configuration_id}` with current `If-Match` and a stable `Idempotency-Key`. Submission verifies the ready assessment, snapshot, exclusive active run and draft revision atomically. Repeating the same key/configuration recovers the original run. A new key is required for a deliberate new run. `GET` lists at most 20 experiment-scoped runs; `GET /drafts/{experiment_id}/runs/{run_id}` returns `{run, events}`; `POST` to that item accepts exactly `{action: "cancel"}`.

Development runs use `run_purpose: development_comparison` and `ml_studio_development_v1` evidence. They reserve the holdout before fitting, fit preprocessing inside each development fold, compare against mean/majority baselines, and persist candidate fold metrics, spread and bounded residual/confusion evidence. They do not score the holdout or select a winner. Fitted development pipelines include immutable configuration and reserved row indices, are stored under server-owned names, and are hash-checked against registered metadata before reload. Browser retries preserve a submission key, poll real saved events and show cancellation/interruption/failure states. Restart recovery marks unfinished runs interrupted; a user can submit a new development run.

Local fitting uses a spawned process with deadline/cancellation termination, configured row/feature limits, a 128 MB resolved-data limit and a 64 MB total fitted-artifact limit. Regression supports regularized linear/random forest; classification supports logistic/random forest. Classification probabilities are not exposed without calibration evidence. Additional task implementations use the same persisted run lifecycle and decision boundary.

### Implemented Draft Review And Selection

All routes below require `workspace_id` query scope. `GET /drafts/{experiment_id}/review` supplies recent development runs plus runs referenced by saved nominations, nominations with their final run, selections, current input fingerprint and workflow state. The UI displays development means/spread, baselines, residual or confusion evidence and limitations before separate nomination, final-evaluation and selection actions.

`POST /drafts/{experiment_id}/nominations` requires `If-Match` and exactly `{run_id, family, nominator, intended_use}`. It binds a completed current development candidate to its verified fitted artifact. The server locks one nomination per experiment and dataset identity (source fingerprints, relationship lineage, transformation recipe and row count); changing model, features or split settings cannot unlock another holdout look. Same-decision retries return the original receipt; different nominations conflict.

`POST /drafts/{experiment_id}/nominations/{nomination_id}/final-evaluation` accepts `{}` and creates or returns one durable final run. Only the nominated hash-verified pipeline scores its reserved rows; it does not refit or rank models. `ml_studio_final_evaluation_v1` binds nomination/configuration/dataset with candidate and baseline metrics, bounded task evidence, holdout count, limitations and `evaluated_once: true`. Completed results are reused. If no result committed, cancellation/failure/restart recovery may retry the same immutable final run and candidate. The flag means one committed evaluation, not a promise that an interrupted calculation never restarts.

`POST /drafts/{experiment_id}/selections` requires `If-Match` and exactly `{nomination_id, reviewed_by, intended_use, prohibited_use}`. Selection requires current draft/data evidence, a completed final evaluation and the verified model. `ml_studio_selection_v1` records the selected family/task, lineage, run/configuration references, artifact, review notes, experiment name, saved problem statement and timestamp, plus task-specific inference context. Repeating the decision recovers its immutable receipt. Dependency edits retain historical evidence and mark selection stale. This receipt completes the local cycle; exports and prediction are optional.

### Implemented Selected Outputs

`GET /drafts/{experiment_id}/selections/{selection_id}?workspace_id=...` returns the scoped selection, saved configuration, current/stale flag, content-derived `InferenceSchema`, supported export descriptors, latest 20 prediction receipts and local `MLCycleSummary`. Historical exports/evidence stay readable; new predictions require current selected settings and snapshot truth.

`POST .../exports` accepts `{}` and prepares eight verified outputs: fitted pipeline (`model.joblib`), fitted preprocessor, inference schema, evaluation report JSON, model card Markdown, reproducibility manifest, portable Python CSV inference example and cycle-summary JSON. `GET .../exports/{kind}` permits only listed kinds, checks exact bytes against registered hashes, and downloads with a path-free filename and hash header. Binary artifacts are server-produced; clients cannot upload estimators or paths. The pipeline includes preprocessing; the example normalizes categorical inputs and uses recorded library versions. External publishing is absent.

`POST .../batch-predictions` requires `Idempotency-Key` and exactly `{input_schema_version, rows}` or `{input_schema_version, csv_text}`. Input is bounded to 2 MB and 1–10000 rows. UTF-8 CSV headers must be unique. Required columns must match exactly; numeric fields allow finite numbers/null, categorical fields bounded strings/null. Missing values use development-fitted median/mode; unknown categories use the fitted encoder's ignore policy. Errors return safe rule counts without echoing raw values. Classification emits class labels, with no probability claim.

Prediction reloads the selected hash-verified model in a bounded local process and saves `ml_studio_prediction_receipt_v1` with selection/configuration/schema/input hash, model hash, row count, at most 100 preview outputs and a verified CSV artifact. Same-key/same-input retries recover the receipt; different input conflicts. `GET .../batch-predictions/{prediction_id}/download` verifies the saved output and scopes it to this selection. Text outputs are escaped against spreadsheet formula interpretation. `ml_studio_cycle_summary_v1` binds the exact selection, intended/prohibited uses, configuration, dataset/recipe lineage, development/final evidence and limitations; preview and export use the same summary.

### Evaluation And Selection Objects

`CandidateNomination` binds one completed development-comparison run, candidate family, immutable configuration version, snapshot, nominator, intended-use notes, and timestamp. It contains no final-holdout result.

`FinalEvaluation` binds one nomination to one server-enforced, single-use final holdout. It contains the nominated family, configuration/run/snapshot identities, candidate and baseline metrics, task-specific evidence, holdout row count, limitations and `evaluated_once: true`; it cannot compare or rank other candidates. Split evidence remains in the linked development evaluation.

`CandidateSelection` binds the nomination, final evaluation, exact configuration and data identity, reviewer decision, intended and prohibited uses, verified reloadable artifact set, and selection time. It is the cycle-completion receipt, not deployment approval.

`InferenceSchema` defines ordered required input fields, logical types, category handling, null policy, and task-specific output fields. Every column must be supplied; nullable feature values use fitted imputation. `BatchPredictionReceipt` binds a selected candidate, artifact hashes, input-schema version, row count, output artifact, warnings, and time. Invalid rows return bounded field-level issue counts and examples of rules, never raw values.

`MLCycleSummary` contains the problem statement, lineage references, immutable configuration, selected candidate, development and final evidence, limitations, artifact references, and creation time. Initial behavior is local preview/export only; it has no Context Ledger or AI Chat publish state.

### Workflow Route Index

| Method and path | Contract |
| --- | --- |
| `POST /drafts`, `GET /drafts?workspace_id=...` | Create an incomplete draft; list resumable draft summaries for one authorized workspace. |
| `GET /drafts/{experiment_id}`, `PATCH /drafts/{experiment_id}` | Return or conditionally update a draft plus server-derived workflow state. |
| `POST /drafts/{experiment_id}/duplicate` | Copy editable settings and lineage references into a new identity without copying runs, completion, or selection. |
| `POST /drafts/{experiment_id}/preparation` | Begin draft-bound recipe/operation issuance; standalone `/recipes` is deferred. |
| `GET /drafts/{experiment_id}/workflow` | Return `WorkflowState`; useful after run events, Power Query return, or conflict recovery. |
| `POST /drafts/{experiment_id}/assessment` | Assess saved settings and persist immutable configuration. |
| `GET/POST /drafts/{experiment_id}/runs` | List scoped development runs or submit the assessed configuration. |
| `GET /drafts/{experiment_id}/review` | Return development evidence, nominations, final runs and selections. |
| `POST /drafts/{experiment_id}/nominations` | Nominate without touching the reserved final rows. |
| `POST /drafts/{experiment_id}/nominations/{nomination_id}/final-evaluation` | Submit/recover the one final evaluation. |
| `POST /drafts/{experiment_id}/selections` | Save a deliberate selection with reviewed evidence. |
| `GET /drafts/{experiment_id}/selections/{selection_id}` | Return selection, configuration, schema, export descriptors, prediction receipts and local summary. |
| `POST /drafts/{experiment_id}/selections/{selection_id}/exports` | Prepare supported outputs; GET its `/{kind}` downloads a verified artifact. |
| `POST /drafts/{experiment_id}/selections/{selection_id}/batch-predictions` | Validate and score; GET its `/{prediction_id}/download` retrieves saved CSV. |

Workflow routes require workspace query scope and use the public `{code, message, remediation}` error shape. Prediction schema errors may add a bounded `validation_issues` list beside the error. All list endpoints are bounded and identity-scoped. Artifact and prediction routes never accept serialized estimators or client filesystem paths.

## Compatibility Core Contract Version

The compatibility core objects in the following sections use `contract_version: "ml_studio_contract_v1"`. Draft workflow objects use their separately named versions above. Core objects are immutable after validation, reject unknown fields, and serialize to finite JSON values. Missing identities, contradictory configuration, stale snapshot truth, NaN/infinite metrics and unsafe error content are rejected.

## Dataset Snapshot Identity

`DatasetSnapshotIdentity` is the immutable reference for training input. It contains `snapshot_id`, `workspace_id`, `workspace_version`, ordered `source_ids`, ordered `relationship_ids`, ordered source fingerprints with schema versions, snapshot schema version, semantic-model version, passing governance result, transformation recipe hash, row count, aggregate column profile, creation time, and optional creating actor.

The source-fingerprint order must exactly match `source_ids`. The application service must compare workspace version and every source fingerprint with current authoritative server state before evaluation. A mismatch is stale and cannot run. Browser-supplied rows, aliases, paths, relationship definitions, or fingerprints never establish snapshot identity.

## Compatibility Experiment Specification

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

## Compatibility Evaluation Result

`EvaluationResult` keeps development selection evidence and final-holdout evidence in separate required fields.

`selection_evidence` contains the naive baseline, baseline fold metrics, candidate fold distributions and means, selected candidate, and development row count. Candidate selection may use only this evidence.

`final_holdout_evidence` contains metrics for the already selected candidate and baseline, holdout row count, and `evaluated_once: true`. Its candidate must exactly match the development selection. The holdout cannot be reused for candidate ranking.

Every result also carries task type, dataset snapshot identity, experiment/specification identity, warnings, limitations, structural leakage findings, feature influence, runtime versions, seeds, and a truth boundary. Feature influence is always `causal: false` and must state limitations. The truth boundary is `evaluated_experiment`; it cannot claim production readiness, deployment, or causality.

`split_evidence` carries row-identity hashes and counts for the development/final boundary and every cross-validation fold. It records zero row overlap plus the applicable temporal-order or group-isolation invariant without exposing raw row values.

`failure_slices` contains bounded aggregate holdout error cohorts for the Failure Atlas. Numeric features use quartile or missingness labels; categorical features use frequency-relative or missingness labels. Slice identities, counts, task-appropriate error values, overall error, and delta are returned without raw rows, observed values, category labels, or row identities.

The evidence view derives a task-appropriate metric landscape from immutable selection and final-holdout evidence. Favorable baseline-relative deltas are positive for both minimized and maximized metrics. It reports explicit weak-evidence reason codes for small development samples, small holdouts, fewer than three folds, missing reported metrics, and evaluation warnings. Why This Candidate names the selected family, primary metric, development and final baseline deltas, non-causal feature influence, limitations, warnings, and the truth boundary. Missing evidence remains unavailable; it is never synthesized.

## Reviewed Candidate Reference

`ReviewedCandidateReference` points to an immutable run, specification version, snapshot, and server-created artifact hash. It records review status, reviewer, time, intended use, and prohibited uses. It contains no estimator or artifact bytes and does not authorize deployment.

## Workspace-Safe Cleaning — Implemented Backend Boundary

`POST /api/data-workspaces/{workspace_id}/manual-cleaning` accepts exactly `workspace_version` (positive integer), `source_id` (current primary source), `steps` (at most 100 supported engine steps, each containing `type` and optional object `params`), and `preview_only` (boolean). It resolves catalog data and governance from the server. Client rows, schema, paths, and extra request fields are rejected. `/api/manual_cleaning` retains its compatibility behavior and is not the ML Studio preparation endpoint.

The response contains `committed`, `workspace_id`, `workspace_version`, `preview` (at most 100 records), `row_count`, ordered `schema` entries (`name`, `position`, `data_type`, `nullable`), `governance_readiness`, and `receipt`. Preview performs no durable writes and returns `receipt: null`; cancellation is discarding a preview without issuing apply. Full cleaned rows are never returned by this endpoint.

Preview adds `input_row_count`, `removed_row_count` and `added_row_count`; the latter two are nonnegative net differences from the original row count, not sums of finding counts. Governed recipes validate column references against each intermediate schema and reject missing references, empty required selections and colliding renames. Numeric filter thresholds entered as text are compared numerically. Legacy global cleaning keeps its compatibility behavior.

Apply writes a new server-managed typed JSON table source and atomically replaces the primary source membership in the same workspace, advancing its version. The original source remains available and unchanged for other catalog/workspace consumers. The resulting source schema version advances from the base source version. Workspace memberships outside the primary source are retained. Workspaces containing any relationship, including inactive modeling drafts, return `preparation_relationships_unsupported` instead of silently altering join semantics.

An apply receipt contains `receipt_id`, `workspace_id`, `workspace_version`, `base_workspace_version`, `base_source_id`, `source_id`, `content_fingerprint`, `schema_version`, `schema`, `row_count`, and `committed_at`. Identity, schema, and content describe the persisted representation consumed by the ML Studio workspace resolver. Standalone workspace-cleaning receipts are response evidence rather than a lookup resource; retrying that standalone route with the base version conflicts. Draft preparation operations use a server-only operation key to persist the receipt atomically in the catalog, enabling the recovery contract above. Clients cannot supply that key to the workspace-cleaning HTTP endpoint.

Errors contain `error.code` and `error.message` with safe messages. Missing workspace returns 404. Stale workspace/source identity, foreign or non-primary source, and relationship-backed preparation return 409. Governance blocking returns 422. Invalid request/steps, cleaning failure, and empty apply results return 400. Unexpected commit failure returns safe `preparation_unavailable` with 500; callers must reload identity before retrying. The transactional commit rechecks workspace version, primary identity, source fingerprint, and relationship absence. Failed staging/commit removes its newly allocated file.

Verified by `tests/test_workspace_cleaning.py`, `tests/test_source_workspace_context.py`, and `tests/test_ml_studio_api.py` (46 focused tests on 2026-09-27). Runtime verification uses `PYTHONPATH=.codex_tmp_py;.codex_tmp_py/site-packages` with the repository-local dependency bundle. This compatibility-root preparation boundary is separate from the versioned ML Studio object envelope.

## Implemented Forecasting Workflow

Draft configuration supports `forecasting` with a numeric target, exactly one time role, an optional single group role used as series identity, and optional explicitly future-known numeric/categorical inputs. Validation uses `rolling_origin`, `frequency` (`h`, `D`, `W-MON`, `MS`), `horizon` and `lags` (1–48), `season_length` (1–366), folds (2–5) and a seed. Readiness rejects insufficient total history; execution checks each series for sufficient history and a unique regular time grid. Candidates are `lagged_ridge` and `lagged_forest`, judged by RMSE or MAE against last-observation and seasonal-naive baselines.

Development fitting excludes each series' final horizon, fits preprocessing at every rolling origin and recursively predicts target lags without future target access. Final evaluation scores only the nominated model. Its immutable inference artifact refreshes observed history after scoring without refitting model coefficients; `selection.inference_context` and `inference_schema.forecast` record the resulting origins. Prediction accepts exactly one consecutive configured horizon per supplied known series, with required time/series fields and declared inputs. The schema supplies `template_csv`; output columns include `input_row`, `prediction`, `time`, `series`, `horizon`. Nine exports include the standalone `forecast-runtime.py`. Intervals and predictions for unseen series are unsupported and are explicitly described as such.

## Implemented Clustering Workflow

Clustering requires no target and at least one numeric/categorical feature. `candidate` contains `families` (`kmeans`, `mini_batch_kmeans`) and `cluster_count` (2–12). Selection metrics are `silhouette` and `stability_ari`, both maximized. Numeric scaling and categorical encoding are fitted inside each training partition. Random, time-ordered and grouped validation reserve a final partition before fitting. The one-cluster training-mean baseline reports distortion; silhouette and stability are unavailable for this trivial reference.

Each candidate records validation-fold silhouette (sample capped at 1000), mean squared distance to its assigned center, and adjusted Rand agreement with a model refitted on a seeded 80% training subsample. Undefined scores remain null with valid-fold counts. Profiles show development-fit counts, up to 12 numeric means and eight categorical modes; final profiles use only reserved rows assigned by the nominated development model. Cluster IDs are arbitrary, geometry depends on chosen features and scaling, and no supervised accuracy is claimed. Eight standard exports reload for new-row assignment. Inference schema output is integer `cluster`; prediction receipts include `input_row` and `cluster`.

## Implemented Anomaly Detection Workflow

Anomaly detection requires features and accepts an optional numeric 0/1 evaluation label through the target role; that column is never a model input. `candidate` contains `families` (`isolation_forest`, `local_outlier_factor`), `contamination` (0.005–0.3, a training quantile setting), and `neighbors` (5–100, bounded by training sample size). Isolation forest uses at most 256 rows per tree. Local outlier factor uses novelty scoring for held-out/new rows and supports at most 20000 training rows. Scaling and imputation remain training-only.

The fitted threshold is the upper training-score quantile with ties left unflagged; predictions flag `score > threshold`. LOF threshold calibration uses its fitted negative outlier factors, not the novelty interface on its training rows. Development comparison reports score-rank stability under a seeded 80% training subsample, flag Jaccard agreement, flag fraction and bounded histograms/threshold evidence. Optional labels add ROC AUC, precision and recall only where defined; undefined values are null. Selection defaults to `score_stability`; `roc_auc` requires both labels. The reference flags no observations. Stability and low flag counts do not establish detection accuracy.

Final evaluation scores the nominated detector and saved threshold once. `selection.inference_context` and schema `detector` expose the exact threshold, expected fraction, training count and flag rule. Prediction input excludes labels; output contains `input_row`, finite `score`, boolean `is_unusual`. Nine exports include the fitted estimator/threshold dictionary and `anomaly-runtime.py`; the included Python example reproduces scores and flags outside app code. Scores are uncalibrated and model-specific; flags mean unusual observations requiring review, not confirmed errors.

## Structured Errors

`StructuredError` contains only stable `code`, developer-readable `message`, and safe `remediation`. Tracebacks, filesystem paths, private keys, serialized estimators, secrets, and raw data samples are outside this object and must not cross the public boundary.

## Evaluation Boundary

The evaluation service partitions the final holdout before any candidate work. Preprocessing and model fitting occur inside development cross-validation folds. Comparison and nomination use development evidence only. Candidate pipelines are refit on development rows, then only the nominated pipeline receives a committed final holdout evaluation. The explicit selection receipt records the user's decision after reviewing that result; the final holdout cannot rank alternatives.

Random and stratified policies are deterministic. Time-ordered folds never train after their validation observations. Grouped policies never place one group on both sides of a split. Invalid or statistically infeasible configurations return stable structured errors or blocked evaluation results.

## Dependency Boundary

`backend/ml_studio/contracts.py` and `backend/ml_studio/evaluation.py` must not import Flask, persistence code, `backend/utils/global_state.py`, Context Ledger, frontend code, filesystem dataset paths, or model-serving code. The ML Studio repository and artifact modules remain framework-independent and must not import application repositories or dataset storage. Dataset rows arrive only after a trusted server-side resolver has validated the snapshot identity and governance state.
