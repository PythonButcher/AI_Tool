# ML Studio Product Roadmap And Requirements

## Start Here

This durable reference defines the whole ML Studio experience and its delivery rationale. All five local task workflows are engineering-complete; [status](../status/project_execution_status.md) owns verified delivery truth and the user retains final browser acceptance. The [contract](../contracts/ml_studio.md) defines exact implemented behavior and supported limits.

For the current authorized action and owner, open the [active gate](../active_gate/README.md). The sections below remain product requirements, not an instruction to restart their implementation.

The numbered steps below describe the delivery order. The six stages inside the app are a different thing: Data & Goal → Prepare Data → Configure → Train → Review Results → Use & Share.

## Build Order

The user's assignment authorized Codex backend, frontend and the whole-studio theme-aligned UI makeover. The [archived completion brief](../../archive/ml_studio_completion_brief_2026_10_05.md) preserves that starting scope and source review only. It does not govern new work; the sole active gate controls execution.

1. [Design the complete workflow](#step-1--design-the-complete-workflow)
2. [Build the workspace](#step-2--build-the-workspace)
3. [Save and resume experiments](#step-3--save-and-resume-experiments)
4. [Connect data preparation and Power Query](#step-4--connect-data-preparation-and-power-query)
5. [Replace Experiment Configuration](#step-5--replace-experiment-configuration)
6. [Make training work end to end](#step-6--make-training-work-end-to-end)
7. [Review results and choose a candidate](#step-7--review-results-and-choose-a-candidate)
8. [Export models and make predictions](#step-8--export-models-and-make-predictions)
9. [Complete forecasting](#step-9--complete-forecasting)
10. [Complete clustering](#step-10--complete-clustering)
11. [Complete anomaly detection](#step-11--complete-anomaly-detection)
12. [Prepare the cycle summary](#step-12--prepare-the-cycle-summary)
13. [Verify the whole ML Studio](#step-13--verify-the-whole-ml-studio)

## Step 1 — Design the complete workflow

**Design reference:** This blueprint was written before implementation. Its original design-only boundary does not describe the current application.

Step 1 is the implementation-neutral blueprint. It describes the whole product; it does not claim these behaviors exist in the application.

### Shared Workspace Layout

1. A fixed workspace header contains the experiment name, save state, Guidance toggle, and six-stage navigator. Guidance changes explanatory content only.
2. A collapsible context rail shows friendly dataset, version, size, and lineage summaries. Raw identifiers appear only in details with copy actions.
3. The main workspace owns the current stage. Evidence and guidance sit beside the relevant control or collapse below it on narrow screens; no permanently empty inspector is reserved.
4. A compact run dock remains available while a run is queued, running, cancelling, failed, interrupted, or complete. It shows backend states and events, never invented progress.
5. At 1440×900 and 1024×768 the stage workspace keeps the primary action visible without page-level horizontal scrolling. At 390×844 the rail and secondary panels collapse into labeled drawers; tables scroll inside their region. Keyboard order follows header → stages → main content → supporting panels → run dock.

### Workflow State Rules

- The server owns experiment identity, draft revision, data identity, immutable submitted configurations, run truth, evaluations, candidates, and artifacts. The browser owns only unsaved edits and presentation state.
- A stage is `locked`, `available`, `active`, `complete`, or `stale`. Locked stages expose missing prerequisites and a route to fix them. A stale stage preserves historical evidence and names the change that invalidated current progression.
- The persisted `active_stage` is the last developer-selected stage that is not locked. Reopening restores it; returning to an earlier stage does not invalidate anything until a dependency-bearing edit is saved.
- Draft autosave uses visible `saving`, `saved`, `save_error`, and `conflict` states. Navigation and training flush pending saves. A conflict preserves local edits and requires reload or duplicate; it never silently overwrites a newer revision.
- Guidance, experiment name, panel layout, and the viewed stage do not affect readiness. Data identity or recipe changes stale Prepare Data and everything after it. Task changes stale task-dependent preparation, configuration, and all later evidence. Role, split, metric, model, seed, or resource changes stale the assessment and later work. Submitted runs remain immutable and labeled historical.
- An active run keeps its submitted configuration and snapshot. Dependency-bearing edits warn that they affect only a later run; they never mutate or erase the active run.
- Candidate selection completes the ML cycle. Use & Share actions are optional. Duplication copies draft settings and lineage references but starts with no completed stages, runs, or selected candidate.

### Six-Stage Contract

| Stage | Inputs and primary actions | Output and unlock rule | Locked, stale, and failure behavior | Backend dependency |
| --- | --- | --- | --- | --- |
| 1. Data & Goal | Name the experiment; select a governed dataset; inspect schema/preview; choose predict a number, classify, forecast, find groups, or detect anomalies. | Saved draft with a current data reference and explicit task unlocks Prepare Data. | No usable governed data locks progression. A stale or changed dataset is shown before task configuration. | Required draft CRUD/list/duplicate plus existing server-resolved snapshot identity. Preview remains server-owned and bounded. |
| 2. Prepare Data | Review quality issues and task-relevant impact; choose Stay or open Power Query with experiment, issue, and return-stage context. | Current recipe lineage and preparation checks unlock Configure; warnings remain visible. | Apply refreshes data identity and reconciles columns; cancel preserves the draft. Blocking issues identify the resolving action. | Existing snapshot and preparation-assessment foundations; required persisted return context and server-issued recipe lineage. |
| 3. Configure | Assign exclusive column roles; choose task-aware validation, metric, candidates, seeds, and local limits; request assessment. | A ready assessment bound to the exact draft revision, snapshot, recipe, and immutable configuration unlocks Train. | Any bound-field change makes the assessment stale. Server errors retain edits and expose code, message, and remediation. | Existing immutable experiment version and assessment services, extended for all five tasks and server-owned recipe hashing. |
| 4. Train | Explicitly submit, observe events and limits, cancel, retry idempotently, or recover after restart. | A completed development-comparison run with usable evidence unlocks Review Results. | Queued/running/cancel-requested/completed/failed/cancelled/interrupted remain distinct. Failure and interruption retain configuration and offer a valid next action. | Existing durable run, event, cancellation, idempotency, executor, and restart-recovery foundations; required experiment-scoped queries and development-only run mode. |
| 5. Review Results | Compare candidates with baselines and limitations; nominate one from development evidence; run its one-time final evaluation; deliberately select the candidate. | Selected-candidate receipt bound to configuration, data, final evidence, limitations, and verified artifacts completes the cycle and unlocks Use & Share. | Incompatible runs cannot compare. Final evidence cannot rank alternatives. Stale drafts do not rewrite historical evaluations. | Existing evaluation/evidence/comparison and candidate records; required nomination and one-time final-evaluation boundary before selection. |
| 6. Use & Share | Inspect completion receipt; export supported artifacts/report/card/manifest/example; validate and run batch prediction; preview/export cycle summary. | Each optional action returns its own receipt or actionable schema error. | Unsupported uncertainty, assignment, or publishing controls are absent. Artifact verification failure blocks export/inference without changing cycle completion. | Required reloadable bundle, export, prediction, and summary contracts. Context Ledger and AI Chat publishing remain deferred. |

### Task Differences Across The Same Stages

| Task | Goal and configuration | Evaluation and outputs |
| --- | --- | --- |
| Regression | Numeric target; random, time, or group-aware validation as justified. | Mean baseline, RMSE/MAE/R² and residual evidence; numeric predictions. |
| Classification | Class target; stratification where feasible; imbalance-aware metric choice. | Majority baseline, balanced accuracy/weighted F1/accuracy, confusion evidence; probabilities only when calibrated and supported. |
| Forecasting | Numeric target, time column, frequency, horizon, optional series keys, and future-available inputs. | Chronological or rolling validation, naive/seasonal baseline, horizon-indexed forecast; never random split by default. |
| Clustering | No target; feature roles, scaling, distance assumptions, and cluster-count/model controls. | Cluster profiles, separation and stability evidence; no supervised accuracy; new-row assignment only when supported. |
| Anomaly detection | Feature roles, detector, threshold, and optional label solely for labeled evaluation. | Scores, threshold behavior, stability, and labeled metrics only when labels exist; flags mean unusual, not erroneous. |

### Backend Contract Boundary

The exact design-only additions are recorded in [the ML Studio contract](../contracts/ml_studio.md#workflow-application-contract--proposed). Existing source remains authoritative until each proposed contract is implemented and tested.

| Boundary | Reuse now | Required before its build step |
| --- | --- | --- |
| Identity and readiness | `DatasetSnapshotIdentity`, immutable experiment versions, `PreparationAssessment`, `/snapshots`, `/experiments`, `/preparation-assessments`. | Persisted `ExperimentDraft` and server-computed `WorkflowState`; server issues recipe hash and lineage from accepted steps. |
| Execution | Durable run repository, idempotent submission, executor, events, cancellation, restart recovery. | Draft/config binding, experiment-scoped listing, bounded limits in public state, and development-only comparison runs. |
| Evaluation and selection | Leakage-aware supervised evaluation, evidence, comparison, managed artifact metadata, reviewed candidate reference. | Explicit `CandidateNomination`, one-time `FinalEvaluation`, and `CandidateSelection`; current automatic winner plus immediate holdout evaluation must be split. |
| Outputs | Write-once verified artifact bytes and path-free metadata. | Reloadable model/preprocessor bundle, schema contract, export receipts, batch prediction, cycle summary, and task-specific output types. |
| Task coverage | Regression and classification only. | Forecasting, clustering, and anomaly contracts, evaluation, baselines, artifacts, and inference behavior. |

### Assessment Request Finding

The current React shell posts snapshot creation, an immutable experiment, and an assessment from one transient component. It calculates `canonical_recipe_hash` in the browser even though the backend re-computes it, and its component test mocks both Web Crypto and all three API responses. The Python API tests prove the backend accepts a correctly constructed recipe; the React test proves only request shape. No existing test submits the browser-generated recipe to the real Flask boundary or waits for refreshed dataset identity after Power Query. Therefore the reported assessment failure is not safely attributable to one backend rule from current evidence. The implementation contract removes the avoidable ambiguity: the client submits ordered steps and the server issues canonical recipe lineage, while an integration test must exercise the real request and stale-data error path before Step 5.

### Step 1 Acceptance And Handoff

Step 1 is complete when this blueprint and the proposed contract agree with current source, documentation checks pass, and no application code has changed. Step 2 remains separately authorized work. Its first eligible owner is the frontend owner for only the shared frame—header, six-stage navigation, context rail, Guidance region, and run dock—using existing identity/run reads and honest locked placeholders. Draft persistence, Power Query integration, configuration replacement, training changes, results, and outputs stay out of that first assignment.

## Step 2 — Build the workspace

**Status:** Authorized through the bounded shared-workspace frontend handoff. Later steps remain inactive.

**What changes:** Implement the shared layout, stage navigation, compact dataset context, Guidance area, and expandable training dock.

**What you will see:** A consistent, responsive ML Studio frame with clear locked and empty states—not an oversized configuration window.

**Who does it:** Frontend owner after Step 1; Codex reviews.

**Done when:** The shared layout meets the sizing, keyboard, theme, and overflow requirements below. Unconnected stages are honestly labeled; the frame is not called a working ML cycle.

## Step 3 — Save and resume experiments

**What changes:** Add experiment creation, autosave, reopen, duplication, and save-error recovery. Connect Guidance on/off to the same experiment state.

**What you will see:** An experiment home and clear saving/saved/error feedback. Switching Guidance does not reset your work.

**Who does it:** Codex builds and verifies persistence/API behavior, then the frontend owner connects it.

**Done when:** Reopening restores the draft and stage; duplication does not copy completed status; save conflicts and failures preserve work.

## Step 4 — Connect data preparation and Power Query

**Authorization:** The 2026-10-04 completion assignment authorizes Codex backend and frontend work, including preview, cancel, apply and the UI makeover. Verify backend readiness before UI integration.

### Source-backed prerequisites

`backend/routes/ml_studio.py` provides server-resolved snapshots, immutable preparation assessments, and draft-bound preparation operations. `backend/ml_studio/preparation.py` issues server-owned recipes and persistent return context without requiring a training specification. Missing-value warnings and supported row-removal fixes derive from the current draft snapshot; this quality view is not a complete statistical assessment. Draft workflow still unlocks only Data & Goal and Prepare Data.

`backend/routes/manual_cleaning.py` preserves global-state `/api/manual_cleaning` for compatibility and implements `/api/data-workspaces/{workspace_id}/manual-cleaning` for governed preparation. The workspace endpoint validates version/primary-source identity, returns at most 100 preview rows, and atomically commits an isolated derived source with a server-issued identity/schema receipt. Workspaces containing relationships are explicitly unsupported. The cleaning gate passed 46 focused backend tests on 2026-09-27; draft-bound recipes and return state remain prerequisites for UI integration.

`frontend/frontend/src/features/ml_studio/MLStudioShell.jsx` renders Data & Goal and a read-only Prepare Data options view with affected-column labels. The view has no preparation mutation controls. The configuration form still constructs recipe identity/hash in the browser and uses an in-memory cleaning callback; these paths do not consume draft preparation operations. The Prepare Data/Power Query return path is a separate assignment.

### Ordered bounded work

1. **Workspace-safe cleaning boundary — Codex, backend gate verified.** Implemented explicit workspace/version and primary-source validation, bounded preview, immutable derived source storage, atomic membership replacement, and server-issued apply receipts. Focused tests prove identity rejection, preview/discard isolation, commit-race cleanup, and receipt/schema agreement with reloaded ML Studio workspace truth. Relationship-backed preparation requires its own commit design and is rejected by this boundary.
2. **Draft preparation and return state — Codex, backend gate verified.** Server-issued recipe lineage and persistent operations bind experiment, workspace, revision, snapshot, issue/fix, and return stage. Start is conditionally idempotent; open operations block ordinary draft edits. Catalog receipts support restart recovery without duplicate cleaning. Apply refreshes snapshot/schema, removes absent role fields, invalidates assessment evidence, and restores return stage. Preview/cancel preserve the saved draft. The expanded backend run executed 82 tests with one symbolic-link permission skip.
3. **Data & Goal — Antigravity after backend review.** One handoff for governed dataset/schema/preview, explicit problem selection, and saving the draft's data/goal fields. Regression and classification have execution foundations; forecasting, clustering, and anomaly detection must be labeled unavailable until their execution prerequisites exist. No training or configuration replacement in this handoff.
4. **Prepare Data — Antigravity after backend review.** The read-only options view uses server-issued issues, supported fixes, and open-operation context. Show each affected column in that view, then assign the separate Stay/Open Power Query and apply/cancel return path after Codex reviews the repair. Use exact verified fields from the backend contract and test workspace switches, stale responses, failed saves, retry, and unmount behavior in the applicable slice.

The Stay/Open choice uses a focused dialog and returns from the read-only editor to an enabled issue action. The active gate now assigns Codex the full preparation round trip, including preview/cancel/apply and reconciliation. Proposed fields/endpoints remain labeled proposed until implemented; compatibility services retain their existing contracts.

### Verification plan

For the first backend assignment, use `tests/test_ml_studio_api.py`, `tests/test_source_workspace_context.py`, and focused cleaning-boundary tests selected when the workspace commit contract is fixed. Verify stale identity, cross-workspace isolation, bounded preview, apply receipts, and cancellation separately. Run Python compilation for changed modules and `git diff --check`. Frontend assignments each require their focused tests and production build. Preparation itself runs documentation validators only and does not claim runtime verification.

**What changes:** Build Data & Goal and Prepare Data: dataset preview, five understandable problem choices, quality issues, and the Power Query round trip.

**What you will see:** Useful data context and issue explanations. Clicking an issue offers Open Power Query or Stay, with a clear return to ML Studio.

**Who does it:** Codex verifies data and return-context contracts, then the frontend owner implements the interaction.

**Done when:** Applying changes refreshes schema and readiness; cancellation preserves the draft. Removed columns are reconciled. Tasks awaiting execution support are labeled unavailable.

## Step 5 — Replace Experiment Configuration

**What changes:** Build exclusive column roles, task-aware splits and metrics, editable model choices, resource limits, and server readiness assessment.

**What you will see:** A searchable role editor and a clear configuration summary instead of conflicting multiple-select lists and a confirmation checkbox.

**Who does it:** Codex verifies readiness rules and payloads, then the frontend owner replaces the form.

**Done when:** A target cannot also be an input. Valid current settings assess successfully; invalid or stale settings show actionable errors. Progression unlocks only for the assessed version.

## Step 6 — Make training work end to end

**What changes:** Connect explicit launch, actual progress, cancellation, retry, and restart recovery to local execution.

**What you will see:** Training that visibly runs, finishes, fails, or cancels—with an understandable next action.

**Who does it:** Codex proves execution behavior first, then the frontend owner builds the controls.

**Done when:** Run state matches the backend, limits are enforced, failures are recoverable, and progress is never fabricated.

## Step 7 — Review results and choose a candidate

**What changes:** Connect baselines, development comparisons, candidate nomination, separate final evaluation, and deliberate selection.

**What you will see:** Understandable results, limitations, and a receipt identifying the model you selected.

**Who does it:** Codex verifies evaluation and selection integrity, then the frontend owner builds results.

**Done when:** Complete regression and classification journeys reach candidate selection with traceable evidence. Final holdout data is not reused to tune the winner.

## Step 8 — Export models and make predictions

**What changes:** Add reloadable model/preprocessing artifacts, schema-checked batch predictions, reports, and an inference example.

**What you will see:** Useful downloads and predictions, with explanations when inputs are incompatible.

**Who does it:** Codex proves artifact reload and inference, then the frontend owner connects outputs.

**Done when:** An exported artifact can actually run inference; invalid inputs receive actionable errors. Uncertainty is shown only when supported and valid.

## Step 9 — Complete forecasting

**What changes:** Extend all six stages for time columns, frequency, horizon, series, chronological validation, and forecast outputs.

**What you will see:** A forecasting workflow—not regression relabeled as forecasting.

**Who does it:** Codex builds task-specific contracts and execution, then the frontend owner integrates them.

**Done when:** A forecast cycle compares against a suitable baseline using time-aware evaluation and produces horizon-specific outputs.

## Step 10 — Complete clustering

**What changes:** Extend all six stages for targetless grouping, scaling, distance assumptions, cluster profiles, and stability.

**What you will see:** A grouping workflow with understandable cluster evidence instead of supervised accuracy.

**Who does it:** Codex builds task-specific contracts and execution, then the frontend owner integrates them.

**Done when:** A clustering cycle reaches selection and supported outputs; new-row assignment is offered only when the model supports it.

## Step 11 — Complete anomaly detection

**What changes:** Extend all six stages for detector choices, scores, thresholds, and optional labeled evaluation.

**What you will see:** An unusual-observation workflow with clear threshold and score interpretation.

**Who does it:** Codex builds task-specific contracts and execution, then the frontend owner integrates them.

**Done when:** An anomaly cycle reaches selection and outputs. Flags are not presented as confirmed errors, and labeled metrics require actual labels.

## Step 12 — Prepare the cycle summary

**What changes:** Add local summary preview/export and define the future Context Ledger and AI Chat integration boundary.

**What you will see:** A reusable account of the goal, data, selected model, evidence, limitations, and artifacts.

**Who does it:** Codex defines the summary contract, then the frontend owner builds preview/export.

**Done when:** The summary matches the completed cycle. External publishing stays deferred until separately approved and implemented; no pretend-connected buttons.

## Step 13 — Verify the whole ML Studio

**What changes:** Check all five task journeys together, including resumption, backward edits, stale results, Power Query, failures, and consistent layout. Remove obsolete reachable UI only after replacement proof.

**What you will see:** One coherent product whose stages lead somewhere, not a collection of isolated panels.

**Who does it:** Codex leads integration review; the user retains final browser acceptance in chat.

**Done when:** End-to-end evidence covers all five tasks and required recovery states. Builds and backend tests are not passed off as visual or product acceptance.

## Product Requirements

The following requirements apply throughout the build. They explain the details behind the steps, not additional assignments.

### Product Promise

Give developers a clear, capable local machine-learning workspace that takes a real problem from data to a deliberately selected model and usable outputs. Developers retain responsibility for cleaning data, choosing assumptions, and judging evidence. Rebuild the experience and its workflow; audit existing backend code for reuse rather than deleting working foundations.

### Agreed Direction

- One full developer control panel with a seamless Guidance on/off switch. Guidance changes explanations and assistance, never experiment state, available controls, or validation rules. No embedded AI assistant; AI Chat remains separate.
- Five problem types: predict a number, classify, forecast, find groups, and detect anomalies. Use plain-language labels alongside technical names.
- ML Studio and Power Query behave like connected parts of one workflow. Clicking a data issue offers “Would you like to open Power Query?” with Open and Stay actions, not automatic cleanup.
- Autosaved, resumable experiments with duplication. Local-machine execution only for this release.
- A cycle finishes with deliberate candidate selection. Exporting or sharing is useful but is not compulsory to finish.
- Match the app's visual language, with the information organization of Databricks and the crispness of Azure tools. No raw-ID-dominated sidebar, uneven panels, offscreen forms, unexplained locks, or empty decorative stages.
- Forward movement is gated by real prerequisites. Earlier stages stay accessible; changes clearly mark affected later work stale without erasing historical evidence.

Provisional decisions, subject to later refinement: start with a small suggested, editable model set; require an explicit Train action; offer reusable artifacts and batch predictions; prepare a locally reviewable ML Cycle Summary for eventual Context Ledger and AI Chat integration. These are useful defaults, not invented user approvals of detailed APIs or integrations.

### The Six Product Stages

These are product navigation stages, not implementation assignments.

| Stage | What the developer does | What unlocks the next stage |
| --- | --- | --- |
| 1. Data & Goal | Name the experiment, select data, inspect a readable preview, describe the problem, and choose the task type. | A valid data reference and explicit task choice. |
| 2. Prepare Data | Inspect quality issues, understand their impact, and optionally open Power Query to fix them. | Required data checks pass; unresolved warnings remain visible. Configuration-specific checks happen in Configure. |
| 3. Configure | Set task-appropriate column roles, validation strategy, success metric, model choices, and local resource limits. | Server assessment accepts the exact current configuration and data version. |
| 4. Train | Start training, see actual progress and resource limits, cancel, or recover from failures. | A completed run supplies usable evaluation evidence. Failed or cancelled work offers a clear recovery path. |
| 5. Review Results | Compare development results to baselines, inspect limitations, nominate a candidate, review final evaluation, and deliberately select it. | A valid candidate is selected with its evidence and intended-use notes. |
| 6. Use & Share | View the completion receipt, export supported artifacts, make validated predictions, and prepare a cycle summary. | The cycle is complete at candidate selection; outputs are explicit optional actions, not hidden completion requirements. |

Navigation reflects persisted workflow state, not a hard-coded active tab. Every locked stage explains what is missing and links back to the action that resolves it. Returning to a completed stage does not itself invalidate anything.

### Workspace And Interaction Design

Use a stable top area for experiment name, save state, stages, and Guidance toggle. A compact collapsible context rail shows friendly dataset names, versions, dimensions, and lineage; technical IDs belong in details with copy actions. The main workspace gives the current stage most of the width. Guidance is contextual explanation beside the relevant control or in a collapsible panel, not a chatbot. Evidence appears where it is useful instead of occupying a permanent empty column. A compact expandable run dock keeps real running work visible while the developer inspects other stages.

Define shared spacing, typography, button hierarchy, form widths, table behavior, focus treatment, loading, empty, failure, and success states before polishing individual stages. Check layout at 1440×900, 1024×768, and 390×844, as well as keyboard navigation and zoom. Wide data tables may scroll within their own region; the page must not shove core controls offscreen. Keep the app's supported theme behavior consistent.

Replace the old multiple-select configuration form with a searchable column-role editor. Each column has one exclusive role: task-appropriate target, numeric input, categorical input, ignored, time, or group. Suggested roles are clearly labeled and editable. Choosing a target removes it from inputs automatically. Show types, relevant issues, and a readable configuration summary. Do not use a confirmation checkbox as a substitute for correct role validation.

### Persistence, Power Query, And Safe Changes

Separate an editable, possibly incomplete draft from immutable configurations submitted for training. Autosave needs visible saving/saved/error states, conflict handling, and a flush before navigation or training. Reopening restores the experiment and stage; duplication copies settings and lineage but does not pretend copied runs are newly completed.

The Power Query round trip carries experiment, data, issue, and return-stage context. The developer decides whether to apply transformations. On return, refresh server-owned data identity and schema, reconcile changed or removed columns, rerun affected checks, and return to the same experiment. Cancelling preserves the draft. Do not silently substitute a new dataset into an old result.

Define an explicit dependency map before implementation: changes to data, recipe, or task invalidate affected readiness and later results; changes to roles, split, models, or training limits invalidate the relevant run configuration. Changing names, panel sizes, or Guidance does not. Preserve old runs and candidate evidence against their original immutable versions, labeled as historical. Warn before edits that affect an active run and never mutate its submitted configuration.

### Task-Specific Behavior

All five tasks are part of the complete rebuild. Deliver the supervised end-to-end path first, then integrate the remaining tasks through the same six stages.

| Task | Required distinctions |
| --- | --- |
| Regression | Numeric target, suitable split, simple baseline, error metrics and residual evidence; numeric predictions. |
| Classification | Class target, suitable stratification, imbalance-aware metrics, confusion evidence, and probabilities only when supported and validated. |
| Forecasting | Time column, frequency, horizon, optional series keys, and inputs available at prediction time; chronological/rolling validation and naive or seasonal baseline. Never default to random splitting. |
| Clustering | No target; explicit scaling and distance assumptions, cluster profiles and stability evidence. Do not present supervised accuracy; new-row assignment only when supported. |
| Anomaly detection | Detector and threshold controls, score distribution and stability, optional labels for labeled evaluation. Flags mean unusual observations, not confirmed errors. |

### Training, Candidate Selection, And Outputs

Local training must expose bounded concurrency, resource/time limits, meaningful backend stages, cancellation, retry behavior, and restart recovery. Do not invent percentage progress or conceal a failed run behind a generic spinner.

Use development validation for comparison and nomination. Keep final holdout evidence separate so repeated model selection does not leak test information. Resolve the existing backend's automatic CV-based selection with the requested explicit nomination and final candidate-selection flow before frontend implementation. A selected candidate must reference its exact configuration, data, usable artifacts, evaluation, and limitations; selection is not a deployment claim.

Provisional outputs are the fitted model and preprocessing pipeline, input schema, evaluation report, model card, reproducibility manifest, and a Python inference example. Prove artifacts can be reloaded for inference before promising export. Batch prediction must validate schema and show actionable errors. Confidence or uncertainty is task/model dependent and must not be fabricated.

Prepare a local ML Cycle Summary containing the problem, lineage, configuration, chosen candidate, metrics, limitations, and artifact references. Preview and export are useful initially. Context Ledger and AI Chat publishing need explicit adapter contracts and user action in a later approved integration; do not show dead or pretend-connected publish controls.

### Original Source Review: Reuse And Gaps

The following table preserves the planning baseline, before the five-task implementation. It is not current capability or remaining-work status; consult the implemented contract and execution status for those.

| Existing surface | Planning consequence |
| --- | --- |
| backend/ml_studio contracts, service, repository, execution, evaluation, and artifacts modules | At planning time, regression/classification foundations needed expansion to the other tasks and their evaluation paths. |
| /api/ml-studio/v1 snapshot, draft CRUD/delete/duplicate/workflow, preparation, experiment version, assessment, run/event/cancel, evaluation/evidence, comparison, and candidate routes | Useful foundations exist, including resumable drafts. Nomination, final evaluation, selection, batch prediction/export and summary extensions still require implementation and verification. |
| Immutable versions, runs, candidates, and artifact metadata | These are not proof of resumable drafts or reloadable fitted-model exports. Verify persistence and artifact contents independently. |
| Current evaluation/comparison rules | Reconcile automatic winner selection, compatible comparisons, explicit nomination, and untouched final evaluation. |
| TopRibbon static stage array/active index and EvidenceInspector static truth presentation | A visible stage ribbon is not a functional workflow. Replace static stage selection with actual state and task-specific evidence. |
| Existing ML Studio contract introduction and later execution sections | Reconcile stale introductory scope with implemented asynchronous execution before extending the contract. |

Earlier backend test results do not establish that browser assessment submits the right payload, handles returned errors, or stays onscreen. Reproduce the actual request/state boundary during Step 1 and add focused regression coverage.

## Delivery Control And Definition Of Done

One active gate governs executable work. The user's 2026-10-04 assignment explicitly authorized Codex backend and frontend implementation, including React/CSS and the complete UI makeover. No specialist agent is dispatched by this document. Engineering delivery is recorded in status; final browser acceptance remains separate.

At each meaningful step Codex verifies and self-reviews the change, keeps gate/status aligned and continues through the authorized scope. Share concise progress updates without routine permission pauses. This is a full-stack completion effort with ordered steps, not an oversized specialist frontend handoff. Follow repository restrictions on browser operation; browser acceptance remains in chat and belongs to the user.

Tests must cover successful transitions and blocked, stale, empty, cancelled, failed, and resumed states. Frontend evidence must distinguish source tests/builds from actual visual inspection. Backend readiness never equals frontend completion. Preserve user work, use safe patch edits, and stop on unexpected file shrinkage; never discard changes to make verification pass.

The rebuild is finished only when these stages form working, coherent journeys for all five supported tasks. A restyled canvas, passing build, or functioning configuration form alone is not completion.

