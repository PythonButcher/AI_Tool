# ML Studio Rebuild Plan

## Start Here

This file explains **what we will build and in what order**. It covers the whole ML Studio, not just Experiment Configuration.

For the current authorized action and owner, open the [active gate](../active_gate/README.md). For the first planned build step, go directly to [Step 1 — Design the complete workflow](#step-1--design-the-complete-workflow).

The numbered steps below are the build order. The six stages inside the finished app are a different thing: Data & Goal → Prepare Data → Configure → Train → Review Results → Use & Share.

## Build Order

Do one bounded assignment at a time. Each step can contain a backend assignment followed by a frontend assignment; it is not one large agent prompt. Review and check in after each meaningful visible result before advancing.

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

**What changes:** Define the six-stage layout, navigation rules, saved state, task differences, and when edits make results outdated. Audit reusable code, reconcile API contracts, and investigate the actual assessment request failure.

**What you will see:** A readable workspace/layout brief and stage-by-stage behavior description. This is design and contract work, not a changed application yet.

**Who does it:** Codex, after plan approval. No frontend implementation.

**Done when:** Every stage has inputs, actions, outputs, locked/error states, and a backend dependency. The first frontend assignment has clear boundaries and verified prerequisites.

## Step 2 — Build the workspace

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

### Existing Source: Reuse And Gaps

Source inspection informs this plan; it does not certify the current UI.

| Existing surface | Planning consequence |
| --- | --- |
| backend/ml_studio contracts, service, repository, execution, evaluation, and artifacts modules | Audit and reuse applicable foundations. Current task support is regression/classification; other tasks need new contracts and evaluation paths. |
| /api/ml-studio/v1 snapshot, experiment version, assessment, run/event/cancel, evaluation/evidence, comparison, and candidate routes | Useful foundations exist. Draft CRUD/list/duplicate and batch prediction/export were not found in this route surface; design and verify them before UI assignment. |
| Immutable versions, runs, candidates, and artifact metadata | These are not proof of resumable drafts or reloadable fitted-model exports. Verify persistence and artifact contents independently. |
| Current evaluation/comparison rules | Reconcile automatic winner selection, compatible comparisons, explicit nomination, and untouched final evaluation. |
| TopRibbon static stage array/active index and EvidenceInspector static truth presentation | A visible stage ribbon is not a functional workflow. Replace static stage selection with actual state and task-specific evidence. |
| Existing ML Studio contract introduction and later execution sections | Reconcile stale introductory scope with implemented asynchronous execution before extending the contract. |

Earlier backend test results do not establish that browser assessment submits the right payload, handles returned errors, or stays onscreen. Reproduce the actual request/state boundary during Step 1 and add focused regression coverage.

## Delivery Control And Definition Of Done

One active gate and one implementation handoff at a time. Frontend owner is not reassigned by this plan: Claude Code is an option the user raised, not an agent already dispatched. Codex owns backend, contracts, planning, and integration review; the chosen frontend owner owns React/CSS. No frontend edits by Codex are authorized here.

At each meaningful visible step, return changed files and focused verification evidence, then have Codex review before continuing. Check in with the user with what visibly changed and what remains. Do not batch the full rebuild into one frontend task. Follow repository restrictions on browser operation; browser acceptance remains in chat and belongs to the user.

Tests must cover successful transitions and blocked, stale, empty, cancelled, failed, and resumed states. Frontend evidence must distinguish source tests/builds from actual visual inspection. Backend readiness never equals frontend completion. Preserve user work, use safe patch edits, and stop on unexpected file shrinkage; never discard changes to make verification pass.

The rebuild is finished only when these stages form working, coherent journeys for all five supported tasks. A restyled canvas, passing build, or functioning configuration form alone is not completion.

