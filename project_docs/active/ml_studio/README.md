# ML Studio — Complete Product Rebuild

This is the replacement product plan from the September 20 discovery discussion. It covers the entire ML Studio, not a configuration dialog repair. It is planned work, not a claim of implementation. The active gate controls execution; no frontend implementation handoff is active during plan review.

## Product Promise

Give developers a clear, capable local machine-learning workspace that takes a real problem from data to a deliberately selected model and usable outputs. Developers retain responsibility for cleaning data, choosing assumptions, and judging evidence. Rebuild the experience and its workflow; audit existing backend code for reuse rather than deleting working foundations.

## Agreed Direction

- One full developer control panel with a seamless Guidance on/off switch. Guidance changes explanations and assistance, never experiment state, available controls, or validation rules. No embedded AI assistant; AI Chat remains separate.
- Five problem types: predict a number, classify, forecast, find groups, and detect anomalies. Use plain-language labels alongside technical names.
- ML Studio and Power Query behave like connected parts of one workflow. Clicking a data issue offers “Would you like to open Power Query?” with Open and Stay actions, not automatic cleanup.
- Autosaved, resumable experiments with duplication. Local-machine execution only for this release.
- A cycle finishes with deliberate candidate selection. Exporting or sharing is useful but is not compulsory to finish.
- Match the app's visual language, with the information organization of Databricks and the crispness of Azure tools. No raw-ID-dominated sidebar, uneven panels, offscreen forms, unexplained locks, or empty decorative stages.
- Forward movement is gated by real prerequisites. Earlier stages stay accessible; changes clearly mark affected later work stale without erasing historical evidence.

Provisional decisions, subject to later refinement: start with a small suggested, editable model set; require an explicit Train action; offer reusable artifacts and batch predictions; prepare a locally reviewable ML Cycle Summary for eventual Context Ledger and AI Chat integration. These are useful defaults, not invented user approvals of detailed APIs or integrations.

## The Six Product Stages

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

## Workspace And Interaction Design

Use a stable top area for experiment name, save state, stages, and Guidance toggle. A compact collapsible context rail shows friendly dataset names, versions, dimensions, and lineage; technical IDs belong in details with copy actions. The main workspace gives the current stage most of the width. Guidance is contextual explanation beside the relevant control or in a collapsible panel, not a chatbot. Evidence appears where it is useful instead of occupying a permanent empty column. A compact expandable run dock keeps real running work visible while the developer inspects other stages.

Define shared spacing, typography, button hierarchy, form widths, table behavior, focus treatment, loading, empty, failure, and success states before polishing individual stages. Check layout at 1440×900, 1024×768, and 390×844, as well as keyboard navigation and zoom. Wide data tables may scroll within their own region; the page must not shove core controls offscreen. Keep the app's supported theme behavior consistent.

Replace the old multiple-select configuration form with a searchable column-role editor. Each column has one exclusive role: task-appropriate target, numeric input, categorical input, ignored, time, or group. Suggested roles are clearly labeled and editable. Choosing a target removes it from inputs automatically. Show types, relevant issues, and a readable configuration summary. Do not use a confirmation checkbox as a substitute for correct role validation.

## Persistence, Power Query, And Safe Changes

Separate an editable, possibly incomplete draft from immutable configurations submitted for training. Autosave needs visible saving/saved/error states, conflict handling, and a flush before navigation or training. Reopening restores the experiment and stage; duplication copies settings and lineage but does not pretend copied runs are newly completed.

The Power Query round trip carries experiment, data, issue, and return-stage context. The developer decides whether to apply transformations. On return, refresh server-owned data identity and schema, reconcile changed or removed columns, rerun affected checks, and return to the same experiment. Cancelling preserves the draft. Do not silently substitute a new dataset into an old result.

Define an explicit dependency map before implementation: changes to data, recipe, or task invalidate affected readiness and later results; changes to roles, split, models, or training limits invalidate the relevant run configuration. Changing names, panel sizes, or Guidance does not. Preserve old runs and candidate evidence against their original immutable versions, labeled as historical. Warn before edits that affect an active run and never mutate its submitted configuration.

## Task-Specific Behavior

All five tasks are part of the complete rebuild. Deliver the supervised end-to-end path first, then integrate the remaining tasks through the same six stages.

| Task | Required distinctions |
| --- | --- |
| Regression | Numeric target, suitable split, simple baseline, error metrics and residual evidence; numeric predictions. |
| Classification | Class target, suitable stratification, imbalance-aware metrics, confusion evidence, and probabilities only when supported and validated. |
| Forecasting | Time column, frequency, horizon, optional series keys, and inputs available at prediction time; chronological/rolling validation and naive or seasonal baseline. Never default to random splitting. |
| Clustering | No target; explicit scaling and distance assumptions, cluster profiles and stability evidence. Do not present supervised accuracy; new-row assignment only when supported. |
| Anomaly detection | Detector and threshold controls, score distribution and stability, optional labels for labeled evaluation. Flags mean unusual observations, not confirmed errors. |

## Training, Candidate Selection, And Outputs

Local training must expose bounded concurrency, resource/time limits, meaningful backend stages, cancellation, retry behavior, and restart recovery. Do not invent percentage progress or conceal a failed run behind a generic spinner.

Use development validation for comparison and nomination. Keep final holdout evidence separate so repeated model selection does not leak test information. Resolve the existing backend's automatic CV-based selection with the requested explicit nomination and final candidate-selection flow before frontend implementation. A selected candidate must reference its exact configuration, data, usable artifacts, evaluation, and limitations; selection is not a deployment claim.

Provisional outputs are the fitted model and preprocessing pipeline, input schema, evaluation report, model card, reproducibility manifest, and a Python inference example. Prove artifacts can be reloaded for inference before promising export. Batch prediction must validate schema and show actionable errors. Confidence or uncertainty is task/model dependent and must not be fabricated.

Prepare a local ML Cycle Summary containing the problem, lineage, configuration, chosen candidate, metrics, limitations, and artifact references. Preview and export are useful initially. Context Ledger and AI Chat publishing need explicit adapter contracts and user action in a later approved integration; do not show dead or pretend-connected publish controls.

## Existing Source: Reuse And Gaps

Source inspection informs this plan; it does not certify the current UI.

| Existing surface | Planning consequence |
| --- | --- |
| backend/ml_studio contracts, service, repository, execution, evaluation, and artifacts modules | Audit and reuse applicable foundations. Current task support is regression/classification; other tasks need new contracts and evaluation paths. |
| /api/ml-studio/v1 snapshot, experiment version, assessment, run/event/cancel, evaluation/evidence, comparison, and candidate routes | Useful foundations exist. Draft CRUD/list/duplicate and batch prediction/export were not found in this route surface; design and verify them before UI assignment. |
| Immutable versions, runs, candidates, and artifact metadata | These are not proof of resumable drafts or reloadable fitted-model exports. Verify persistence and artifact contents independently. |
| Current evaluation/comparison rules | Reconcile automatic winner selection, compatible comparisons, explicit nomination, and untouched final evaluation. |
| TopRibbon static stage array/active index and EvidenceInspector static truth presentation | A visible stage ribbon is not a functional workflow. Replace static stage selection with actual state and task-specific evidence. |
| Existing ML Studio contract introduction and later execution sections | Reconcile stale introductory scope with implemented asynchronous execution before extending the contract. |

Earlier backend test results do not establish that browser assessment submits the right payload, handles returned errors, or stays onscreen. Reproduce the actual request/state boundary during the first implementation checkpoint and add focused regression coverage.

## Ordered Delivery Checkpoints

Each row is a product outcome, not one oversized agent prompt. Codex splits it into one atomic backend/contract step or one bounded frontend handoff at a time. Complete and review each before activating the next. Keep this sequence authoritative so later stages are not forgotten.

| Order | Outcome and visible evidence | Ownership and prerequisite |
| --- | --- | --- |
| 1 | Whole-product design and state blueprint: six-stage map, task differences, invalidation rules, component/layout brief, source reuse audit, and corrected API contracts. Reproduce the current assessment failure boundary. | Codex; after replacement-plan review. No UI implementation. |
| 2 | Coherent workspace foundation: responsive stage navigation, compact context, Guidance surface, run dock, clear locks and empty states. No claim that unconnected stages work. | Frontend owner after state/layout contracts; one visible surface at a time. |
| 3 | Experiment home and continuity: create, autosave, reopen, duplicate, recover save errors, and toggle Guidance without losing work. | Codex persistence/API first, then bounded frontend wiring. |
| 4 | Data & Goal plus Prepare Data: meaningful preview, five clear problem choices, quality issues, and a real Power Query return path. Unavailable task execution is labeled until its backend is ready. | Codex data/round-trip contract first, then frontend. |
| 5 | Configure: replace the old form with exclusive roles and task-aware validation, metrics, models, and limits. Assess the real current draft and show actionable server errors. | Codex readiness contracts/tests first, then frontend. |
| 6 | Train: real launch, progress, cancellation, failure recovery, and restart behavior. | Codex execution proof first, then frontend run controls. |
| 7 | Review Results and candidate completion: baselines, valid comparison, nomination, final evaluation, and selected-candidate receipt. Demonstrate complete regression and classification cycles. | Codex evaluation/selection integrity first, then frontend results. |
| 8 | Use & Share: reloadable artifacts, schema-checked batch predictions, downloads, and usable inference example. | Codex artifact/inference proof first, then frontend outputs. |
| 9 | Forecasting across all six stages, including time-aware configuration, baseline, backtesting, and horizon outputs. | Codex task contract/execution first, then frontend integration. |
| 10 | Clustering across all six stages, with targetless controls and honest cluster evidence. | Codex task contract/execution first, then frontend integration. |
| 11 | Anomaly detection across all six stages, including threshold review and honest scoring outputs. | Codex task contract/execution first, then frontend integration. |
| 12 | Local ML Cycle Summary preview/export and documented future Ledger/AI Chat boundary. | Codex summary contract first, then frontend; external publishing remains deferred. |
| 13 | Whole-product integration: verify all five task journeys, resumption, invalidation, Power Query, failure recovery, accessibility, and layout consistency. Remove obsolete reachable UI after replacement proof. | Codex integration review; user retains final browser acceptance in chat. |

## Delivery Control And Definition Of Done

One active gate and one implementation handoff at a time. Frontend owner is not reassigned by this plan: Claude Code is an option the user raised, not an agent already dispatched. Codex owns backend, contracts, planning, and integration review; the chosen frontend owner owns React/CSS. No frontend edits by Codex are authorized here.

At each meaningful visible checkpoint, return changed files and focused verification evidence, then have Codex review before continuing. Check in with the user with what visibly changed and what remains. Do not batch the full rebuild into one frontend task. Follow repository restrictions on browser operation; browser acceptance remains in chat and belongs to the user.

Tests must cover successful transitions and blocked, stale, empty, cancelled, failed, and resumed states. Frontend evidence must distinguish source tests/builds from actual visual inspection. Backend readiness never equals frontend completion. Preserve user work, use safe patch edits, and stop on unexpected file shrinkage; never discard changes to make verification pass.

The rebuild is finished only when these stages form working, coherent journeys for all five supported tasks. A restyled canvas, passing build, or functioning configuration form alone is not completion.

## Current Control

Replacement plan is ready for user review. No implementation is newly activated and the narrow configuration-shell handoff is retired. After review, Codex activates checkpoint 1 with a standalone design/backend gate, then prepares only the first backend-ready frontend assignment.

