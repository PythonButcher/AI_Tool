# AI Chat Decision Output Unification Rollout

> IMPLEMENTATION REFERENCE: This file preserves phase details, likely files, acceptance checks, and product constraints. It is not the current gate source. For current truth and next action, read `project_docs/active/status/decision_intelligence_execution_status.md`; if this file disagrees with status, the status file wins.

## Purpose

This is the implementation reference for Decision Intelligence.

The goal is to unite the work already built into one clear application flow. AI Chat stays the main work surface. Existing AI Chat outputs must remain: normal answers, charts, exploration results, workspace previews, artifact inspection, and PDF export. Decision Intelligence becomes a richer structured output in the AI Chat results pane, not a separate required dashboard and not a forced jump into the Decisions window.

The Decisions window is not deleted in this rollout. Its likely future role is secondary: saved decision library, fullscreen review, or historical asset viewer after the AI Chat output flow is working.

Shorter prior draft preserved at `project_docs/archive/superseded_active_2026_05_24/ai_chat_decision_output_unification_rollout_short_2026_05_24.md`.

## Product Flow

The target flow is:

User asks or frames work in AI Chat. AI Chat uses the active dataset or asks the user to connect/select data. The right-side results pane shows the active result: answer, chart, exploration artifact, or structured decision output. For decision work, the output pane shows Dataset Trust, Goal, Drivers, Limits, Breakdowns, Evidence, Decision Map, Scenario Compare, and Export. The user can correct or refine the decision through chat without being forced into another destination.

This plan should not create a second product beside AI Chat. It should turn the current chat, decision, semantic, evidence, scenario, and export work into one visible flow.

## Existing Foundation To Reuse

Do not rebuild these from scratch.

| Foundation | Current Files | How It Should Be Used |
| --- | --- | --- |
| AI Chat artifact shell | `frontend/frontend/src/features/ai/AIShell.jsx`, `AIShell.css` | Existing right-side results pane is the target surface. |
| Decision chat backend | `backend/decision_engine/chat_service.py`, `backend/routes/decision.py` | Existing `ask`, `explore`, `decide`, `draft_workspace`, `analyze_workspace`, and correction actions are the backend entry points. |
| Workspace drafting | `backend/services/decision_workspace_service.py` | Source of Goal, Drivers, Limits, Breakdowns, Assumptions, Unknowns, readiness, and semantic trace. |
| Correction loop | `DecisionWorkspaceService.correct_workspace`, decision chat `draft_workspace` correction path | Make corrections chat-native rather than separate-window-first. |
| Ranked evidence | `workspace_analysis.ranked_diagnostics` | Source for Evidence Board. |
| Semantic metadata | `decision_objects.md`, workspace refs, `SemanticRef.jsx` | Source for confidence, role explanations, warnings, and review needs. |
| Scenario preview | `backend/services/scenario_service.py`, `DecisionScenarioPreview` contract, `ScenarioPreview.jsx` | Source for bounded Scenario Compare. |
| Export | `frontend/frontend/src/utils/decisionPdfExport.js`, `appPdfExport.js` | Extend to export the AI Chat decision asset. |
| Current Decisions window | `DecisionPanel.jsx`, `DecisionWorkspaceView.jsx`, related decision components | Keep initially; later demote or repurpose after AI Chat flow works. |

## Non-Negotiables

Existing AI Chat `answer` and `chart` artifacts must keep working.

Do not remove or downgrade current charting, exploration, normal data questions, artifact inspection, or export behavior.

Do not add unsupported simulation, optimization, causal proof, autonomous decisions, prediction certainty, or final recommendations.

Do not make Codex edit frontend files unless the user explicitly authorizes Codex frontend edits in the current session.

Do not restart the old standalone Phase 4 dataset handoff. Dataset truth is now part of Dataset Trust in this rollout.

## Phase 1: Protect Current AI Chat Behavior

Purpose: establish regression guardrails before changing decision output.

Codex should inspect the current backend chat tests and add or adjust focused checks only if needed. The minimum protected behaviors are non-decision answer responses, chart responses, decide-mode workspace preview responses, action responses, artifact types, and export eligibility.

Likely Codex files:

`tests/test_decision_chat_service.py`

`tests/test_decision_reliability_benchmark.py`

`backend/decision_engine/chat_service.py`

`project_docs/active/contracts/decision_objects.md`

Likely Gemini files later, only after handoff:

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/utils/decisionPdfExport.js`

Implementation notes:

Codex should not start with UI changes. First confirm the existing artifact contract still distinguishes `answer`, `chart`, `workspace_preview`, and `workspace_analysis_summary`. If tests already prove this, record that in the next handoff instead of adding redundant tests.

Acceptance:

`answer` and `chart` artifacts still render through the existing AI Chat path.

`workspace_preview` and `workspace_analysis_summary` still exist for compatibility.

No backend contract rename breaks existing frontend artifact handling.

Suggested verification:

Run the smallest relevant backend chat tests first. If a change touches shared chat behavior, run `python -m unittest tests.test_decision_chat_service tests.test_decision_reliability_benchmark`.

## Phase 2: Add Dataset Trust To AI Chat Output

Purpose: bring dataset truth into the AI Chat result, starting with decision output and extending to answers/charts where practical.

Dataset Trust means a compact backend-owned summary of what data powered the output: dataset name, source, dataset ID where known, row count, column count, cleaned/transformed state when known, semantic readiness, and stale or override state when relevant.

Codex backend target:

Add a small additive `dataset_trust` object to decision chat responses and decision artifacts where the backend can know it. Do not block on perfect global frontend dataset architecture in the first slice.

Suggested contract shape:

| Field | Meaning |
| --- | --- |
| `dataset` | Existing Dataset Summary when available. |
| `source_label` | Business-facing source such as Active dataset, Uploaded data, Cleaned data, Inline payload, or Data Hub. |
| `row_count` | Row count used for the result. |
| `column_count` | Column count used for the result. |
| `semantic_ready` | Whether a semantic model was available enough for decision output. |
| `transform_state` | `cleaned`, `raw`, `transformed`, `unknown`, or similar conservative value. |
| `stale_state` | `current`, `possibly_stale`, `unknown`, or `not_applicable`. |
| `warnings` | Short caveats when source or freshness cannot be proven. |

Likely Codex files:

`backend/decision_engine/chat_service.py`

`backend/services/decision_support.py`

`backend/services/decision_workspace_service.py`

`backend/services/decision_pipeline_service.py`

`tests/test_decision_chat_service.py`

`tests/test_decision_workspace_service.py`

`project_docs/active/contracts/decision_objects.md`

Likely Gemini files later:

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/components/layout/CanvasContainer.jsx`

`frontend/frontend/src/App.jsx`

Implementation notes:

Do not attempt a full app-wide dataset refactor in this phase. Add backend truth where current payloads already carry dataset data. If frontend state cannot prove cleaned/transformed/stale state, return `unknown` with a warning instead of guessing.

Acceptance:

AI Chat decision output includes Dataset Trust.

Dataset Trust does not claim more certainty than the backend has.

Existing answer/chart artifacts are not broken.

Suggested verification:

Focused backend tests should check loaded dataset, missing dataset, and inline dataset payloads. If Codex adds only backend fields, do not run frontend build unless there is a generated handoff or frontend change.

## Phase 3: Define Unified Decision Output Artifact

Purpose: create one backend-owned artifact that can power the AI Chat decision output pane.

The artifact should compose existing workspace and analysis data into a display-ready decision asset. It should not force Gemini to reverse-engineer raw workspace internals.

Readiness gate:

Cleared by the Phase 2.5 cleanup for Phase 2. `PYTHONPATH=.codex_tmp_py\site-packages python -m unittest tests.test_decision_chat_service` now passes at 25/25. Phase 3 can start as a backend slice in the next Codex session.

The chart source decision for Phase 3 is to keep `source: "semantic_metric"` and `content.meta.source: "semantic_metric"` for charts produced by semantic metric analytics. Raw chart artifacts without an explicit content source may still fall back to `chart_engine`.

Recommended artifact type:

`decision_output`

Recommended artifact top-level shape:

| Field | Meaning |
| --- | --- |
| `type` | `decision_output` |
| `render_hint` | `decision_output` |
| `inspectable` | `true` |
| `title` | Business-facing title. |
| `summary` | Concise Executive Brief text. |
| `dataset_trust` | Dataset Trust object from Phase 2. |
| `frame` | Goal, Drivers, Limits, Breakdowns, Assumptions, Unknowns. |
| `readiness` | Existing `decision_readiness` adapted for display. |
| `correction_state` | Latest correction result/history summary when present. |
| `evidence_board` | Ranked observational evidence from `ranked_diagnostics`. |
| `decision_map` | Generated map nodes and edges when available. |
| `scenario_compare` | Bounded scenario preview when available. |
| `advanced_gates` | Unsupported or gated capabilities with reasons. |
| `export_sections` | Concise sections for PDF/export use. |
| `source_refs` | Trace refs back to workspace, analysis, signals, and scenario objects. |

Likely Codex files:

`backend/decision_engine/chat_service.py`

`backend/services/decision_workspace_service.py`

Potential new file: `backend/services/decision_output_service.py`

`backend/routes/decision.py`

`tests/test_decision_chat_service.py`

`tests/test_decision_phase_3_correction.py`

`project_docs/active/contracts/decision_objects.md`

Implementation notes:

Prefer a small composer service over bloating `chat_service.py` further. The composer can accept `workspace`, optional `workspace_analysis`, optional `correction_result`, `dataset_trust`, and optional `scenario_preview`, then return `decision_output`.

Keep `workspace_preview` and `workspace_analysis_summary` for compatibility during transition. Do not remove them in this phase.

Acceptance:

`handle_turn` can return `decision_output` for a decision prompt.

`handle_action` can return updated `decision_output` after `draft_workspace` correction or `analyze_workspace`.

Existing artifact types still work.

The output does not include unsupported final recommendation, optimization, simulation, or causal claims.

Suggested verification:

Add focused tests for complete decision prompt, incomplete decision prompt, analyze action, and correction action. Verify the artifact contains Dataset Trust, frame, readiness, and evidence board when analysis runs.

## Phase 4: Render Decision Output In AI Chat

Purpose: Gemini renders `decision_output` in the existing AI Chat results pane.

This phase is frontend-owned. Codex should create a focused handoff after Phase 3 backend contract is stable.

Likely Gemini files:

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/features/ai/AIShell.css`

`frontend/frontend/src/features/business/decision/SemanticRef.jsx`

`frontend/frontend/src/features/business/decision/DecisionSignals.jsx`

`frontend/frontend/src/features/business/decision/ScenarioPreview.jsx`

`frontend/frontend/src/utils/decisionPdfExport.js`

Implementation notes:

Gemini should add a renderer for `decision_output`. It should not replace the existing renderers for `answer`, `chart`, `workspace_preview`, or `workspace_analysis_summary`.

The right-side results pane should remain multi-purpose. Decision output is one rich artifact family, not a takeover of AI Chat.

`decision_output` is inspectable in Phase 4. PDF export for `decision_output` is deferred to Phase 11 unless a dedicated export adapter is implemented earlier.

Suggested visible layout:

Executive Brief at top.

Dataset Trust near the brief.

Decision Frame with Goal, Drivers, Limits, Breakdowns, Assumptions, Unknowns.

Evidence Board from ranked diagnostics.

Decision Map when available.

Scenario Compare when available.

Advanced Gates and Export.

Acceptance:

A decision prompt in AI Chat opens a structured decision output in the right-side results pane.

Existing answer and chart prompts still produce their existing result behavior.

The UI does not force the user into the Decisions window to continue.

Suggested verification:

Gemini should run `npm --prefix frontend\frontend run build`, `git diff --check`, and one focused browser flow covering a normal chart/answer and a decision prompt.

## Phase 5: Make Corrections Chat-Native

Purpose: let users refine the active decision output through AI Chat.

The backend already has deterministic correction actions. This phase connects that capability to the new output artifact and the chat interaction model.

Example user corrections:

`Use revenue as the goal.`

`Gross margin is the limit.`

`Break this down by region and channel.`

`Remove discount as a driver.`

`Marketing spend is controllable, but channel is only a breakdown.`

Codex backend target:

Ensure correction action responses return updated `decision_output`, not only `workspace_preview`.

Likely Codex files:

`backend/decision_engine/chat_service.py`

`backend/services/decision_workspace_service.py`

`backend/services/decision_output_service.py` if added

`tests/test_decision_phase_3_correction.py`

`tests/test_decision_chat_service.py`

Likely Gemini files:

`AIShell.jsx`

Any new `DecisionOutput` component Gemini creates

Implementation notes:

Do not parse arbitrary free-form correction into unsafe workspace mutations. Use existing explicit correction payload semantics where possible. If typed natural-language correction needs a backend parser, implement conservatively and fail with a clarification request when the target is ambiguous.

Acceptance:

Correction updates the visible decision output in AI Chat.

Readiness, allowed actions, semantic trace, and latest correction summary update together.

The corrected state is used by follow-up `analyze_workspace`.

Suggested verification:

Backend correction tests should prove state carry-forward. Frontend browser flow should apply or mock one correction and verify the result pane updates.

## Phase 6: Convert Ranked Diagnostics Into Evidence Board

Purpose: make existing ranked diagnostics understandable as decision evidence.

The Evidence Board is a presentation model over `workspace_analysis.ranked_diagnostics`. It should explain what evidence exists, which part of the decision frame it covers, evidence strength, data sufficiency, and limitations.

Codex backend target:

Add display-ready `evidence_board` to `decision_output`. It can be a normalized view of `ranked_diagnostics`.

Suggested `evidence_board` item fields:

| Field | Meaning |
| --- | --- |
| `rank` | Evidence order by diagnostic relevance. |
| `title` | Human-readable evidence headline. |
| `summary` | Business-facing explanation. |
| `covers` | Goal, Driver, Limit, Breakdown, or Context refs covered by the evidence. |
| `strength` | `strong`, `moderate`, `weak`, or `insufficient`. |
| `data_sufficiency` | Existing sufficiency summary. |
| `limitations` | Plain-language caveats. |
| `source_diagnostic_id` | Trace back to ranked diagnostic. |

Likely files:

`backend/services/decision_output_service.py`

`backend/services/decision_workspace_service.py`

`tests/test_decision_phase_3_correction.py`

`project_docs/active/contracts/decision_objects.md`

Implementation notes:

Evidence Board is not a recommendation list. It must keep the observational-only boundary visible.

Acceptance:

Analyzed decision output includes Evidence Board items.

Each item has a limitation or boundary note when evidence is weak, insufficient, or observational-only.

No item is labeled as final advice or optimized action.

## Phase 7: Build The Decision Graph Builder

Purpose: turn the old compact Decision Map idea into a real user-guided analysis surface.

Decision Graph Builder means the user can select variables or nodes, choose how relationships should be inspected, and review measurable graph edges with evidence strength, data sufficiency, limitations, and clear reliability labels. It is not a static exported image and not a causal proof engine.

The full builder should likely live as its own work surface near Automation because graph construction needs room for a variable tray, canvas, filters, and an inspector. AI Chat should remain the launch and explanation layer: it can suggest a graph, open the builder, and summarize graph results inside `decision_output`, but it should not become the entire graph-building UI.

Package choice is intentionally open. Gemini/Antigravity may reuse `@xyflow/react` if it remains the best fit, or choose another legitimate, stable, better-looking graph package after inspecting current frontend dependencies and integration risk. The chosen package must support interactive nodes, edges, custom styling, selection, fit-to-view, and future expandability without destabilizing existing AI Chat behavior.

Reliability boundary:

Edges must be explicitly labeled by evidence type. `observed_association` means the backend found a measurable relationship in the dataset. `coverage` means evidence covers a decision variable. `user_hypothesis` means the user proposed a directional relationship. None of these are causal proof. Future causal analysis stays behind Advanced Gates until backend support exists.

### Phase 7.1: Graph Data And Analysis Foundation

Purpose: create the backend-owned Decision Graph contract and enough analysis to return cold, inspectable results from selected variables.

Codex backend target:

Add a `decision_graph` contract that is separate from the legacy compact `decision_output.decision_map`. The graph request should accept selected variables, selected evidence items when relevant, optional filters or breakdowns, and a graph mode such as `evidence_coverage`, `observed_association`, or `mixed`.

The first useful backend graph should support:

| Capability | Meaning |
| --- | --- |
| Variable candidates | Backend returns eligible metrics and dimensions from the semantic model and active dataset. |
| User selection | Request includes selected metric IDs, dimension IDs, and optional evidence IDs. |
| Evidence coverage edges | Edges connect evidence items to the variables they cover. |
| Observed association edges | Edges connect selected variables when the backend can compute a conservative observed relationship. |
| Edge metrics | Edges carry relationship strength, direction when safe, row count or sample size, sufficiency status, and limitations. |
| Reliability labels | Every edge declares `relationship_type`, `evidence_basis`, and `causal_status: "not_causal_claim"` unless it is a user hypothesis, which must use `causal_status: "user_hypothesis_not_validated"`. |

Recommended first analysis methods:

| Variable pair | First-pass method |
| --- | --- |
| numeric to numeric | Correlation or monotonic association with row count and missingness. |
| categorical to numeric | Group difference summary with top group deltas and sample sizes. |
| categorical to categorical | Distribution association summary only if sample size is sufficient. |
| temporal to numeric | Observed trend or period comparison when a temporal dimension is available. |

Do not add regression, causal discovery, synthetic control, Monte Carlo, optimization, autonomous decisions, or final recommendations in this slice.

Likely Codex files:

`backend/services/decision_graph_service.py` if the implementation warrants a separate service.

`backend/services/decision_output_service.py` only for compact graph summary attachment.

`backend/routes/decision.py` if a new action or endpoint is needed.

`backend/decision_engine/chat_service.py` if AI Chat needs a graph action or artifact.

`tests/test_decision_chat_service.py`

Potential new tests such as `tests/test_decision_graph_service.py`.

`project_docs/active/contracts/decision_objects.md`

Acceptance:

The backend can return graph variable candidates for a loaded dataset and semantic model.

The backend can return a graph from user-selected variables.

Observed association edges include measurable evidence and data sufficiency.

Coverage edges connect Evidence Board items to selected decision variables.

Every edge has a reliability label and explicitly avoids causal proof, optimization, simulation, prediction certainty, or final advice.

Existing AI Chat answer, chart, workspace preview, workspace analysis summary, and `decision_output` rendering contracts remain compatible.

Suggested verification:

Run focused graph service tests first, then `python -m unittest tests.test_decision_chat_service tests.test_decision_reliability_benchmark`. If a new endpoint is added, include route tests for candidate discovery and graph build requests.

### Phase 7.2: Interactive Decision Graph Workspace

Purpose: build the user-facing graph construction surface after the Phase 7.1 backend contract is stable.

Gemini/Antigravity frontend target:

Create a dedicated Decision Graph workspace near Automation or in the same product region as workflow-building tools. AI Chat should provide a launch affordance and compact graph preview, but the full builder should have its own space.

Expected UI:

| Area | Purpose |
| --- | --- |
| Variable tray | Metrics, dimensions, Evidence Board items, and current decision-frame nodes that the user can select. |
| Graph canvas | Interactive nodes and edges with clear visual difference between observed associations, evidence coverage, missing evidence, and user hypotheses. |
| Inspector | Shows selected node or edge details: why it exists, relationship strength, data sufficiency, sample size, limitations, and source refs. |
| Controls | Graph mode, selected variables, filters, fit-to-view, layout reset, and save/open behavior. |
| AI Chat bridge | Chat can open the graph workspace and summarize selected graph results without hiding the full controls. |

Package choice:

Gemini should evaluate whether `@xyflow/react` is still the right dependency. It is acceptable to reuse it. It is also acceptable to choose another stable package if it is meaningfully better for this app. The handoff must document the choice, why it was chosen, and what integration risks were checked.

Likely Gemini files:

`frontend/frontend/src/App.jsx`

`frontend/frontend/src/components/layout/MenuBar.jsx` or the navigation component that owns the Automation icon region.

`frontend/frontend/src/features/ai/AIShell.jsx`

Potential new files under `frontend/frontend/src/features/business/decision/graph/`

Existing API helpers under `frontend/frontend/src/features/business/decision/decisionApi.js` or a new focused graph API helper.

Acceptance:

The user can open Decision Graph from the main workspace and from an AI Chat decision output.

The user can select variables and request graph generation.

The graph displays returned nodes and edges with readable labels and a useful inspector.

Observed associations, evidence coverage, missing evidence, and user hypotheses look visually distinct.

The UI does not imply causal proof, optimization, or final recommendations.

Existing AI Chat answer, chart, workspace preview, decision output, artifact inspection, and export behavior still work.

Required Antigravity handoff:

Codex must write a focused handoff after Phase 7.1 backend tests pass. The handoff must name the exact backend request and response shape, package constraints, files to inspect, visual acceptance checks, build command, browser checks, and status-doc update requirement. Do not ask Gemini to invent backend APIs.

### Phase 7.3: User Hypotheses And Graph-To-Action Flow

Purpose: let the user add or approve hypothesis edges and turn graph findings into follow-up analysis actions without pretending the app has proven causality.

Backend/frontend target:

Support user-created directional edges with explicit `relationship_type: "user_hypothesis"` and `causal_status: "user_hypothesis_not_validated"`. The app should let users select an edge and choose follow-up actions such as break down by a dimension, monitor the relationship, send to Scenario Compare when appropriate, or ask AI Chat to explain the evidence and missing data.

Expected capabilities:

| Capability | Meaning |
| --- | --- |
| Add hypothesis edge | User can connect selected nodes directionally as a stated assumption or hypothesis. |
| Validate readiness | Backend reports whether the data can even inspect the hypothesis observationally. |
| Convert to follow-up | User can request breakdowns, monitoring, scenario compare, or AI Chat explanation from a selected node or edge. |
| Save graph state | Graph selections and user hypotheses can be carried in session state or a saved decision asset. |

Acceptance:

User hypotheses are visually and contractually separate from observed associations.

The app can explain what evidence exists, what is missing, and what follow-up checks are available.

No user-created edge is rendered as causal proof.

Graph-to-action flows preserve the existing Decision Intelligence reliability boundary.

## Phase 8: Fold Scenario Compare Into Decision Output

Purpose: make bounded scenario comparison part of the same AI Chat decision output.

Scenario Compare should use existing scenario service behavior as direct adjustment/sensitivity analysis. It is not a forecast, optimizer, simulation, or causal model.

Codex backend target:

Normalize existing `DecisionScenarioPreview` into `decision_output.scenario_compare`.

Suggested fields:

`status`, `summary`, `inputs`, `baseline`, `comparison`, `projections`, `assumptions`, `limitations`, `source_scenario_ids`

Likely Codex files:

`backend/services/scenario_service.py`

`backend/services/decision_pipeline_service.py`

`backend/services/decision_output_service.py`

`tests/test_decision_pipeline_service.py`

Likely Gemini files:

`ScenarioPreview.jsx`

AI Chat decision output renderer

Implementation notes:

If scenario data is unavailable, return a useful `not_applicable` object with reasons. Do not fabricate projections.

Acceptance:

Decision output shows scenario comparison when supported.

Scenario assumptions and limitations are visible.

The output says direct adjustment or sensitivity comparison, not forecast or causal simulation.

## Phase 9: Redefine The Decisions Window

Purpose: decide what role the existing Decisions window should play after AI Chat output works.

Architecture decision note:

`project_docs/active/decision_intelligence/current/decisions_window_future_role.md`

Do not start this before Phase 4 is usable. The Decisions window should not be removed first because it currently contains working frontend renderers and continuity behavior.

Likely options:

| Option | Meaning |
| --- | --- |
| Saved decision library | Decisions stores and reopens decision assets. |
| Fullscreen review | Decisions opens the current AI Chat decision output in a larger view. |
| Historical asset viewer | Decisions compares prior decision assets. |
| Advanced review | Decisions holds advanced gated analysis later. |

Codex target:

Write an architecture decision note or handoff after observing the AI Chat output implementation.

Gemini target:

Only after user approval, adjust navigation and Decisions-window behavior.

Acceptance:

The core decision flow can be completed inside AI Chat.

The Decisions window no longer acts as the required continuation path.

Existing useful decision renderers are not destroyed without replacement.

## Phase 10: Prune Or Rewrite Conflicting Pieces

Purpose: remove or demote surfaces that fight the unified flow.

Do this after the replacement path exists, except for obvious tracked scratch/generated artifacts.

Likely product-code candidates:

| Candidate | Likely Action | Reason |
| --- | --- | --- |
| `DecisionRecommendations.jsx` wording | Rewrite into Next Checks or Suggested Investigations | Current recommendation framing overpromises. |
| `recommendation_service.py` fields such as `optimize` and `expected_outcome` | Rewrite or wrap behind safer display fields | Conflicts with observational boundary. |
| `DecisionWorkspaceView.jsx` Strategic Recommendations section | Remove, demote, or rename | Makes old workspace view sound like final advice. |
| `backend/routes/autopilot.py` Business Recommendations node | Rename, gate, or demote | Competes with decision output and overpromises. |
| `AiAutopilot.jsx` prominence | Demote or gate | Separate automation path can confuse the main flow. |
| `AutoMLPanel.jsx`, `MachineLearningPanel.jsx` | Gate behind Advanced Analysis | Prediction-heavy surfaces need readiness and validation boundaries. |
| Generic workflow nodes | Keep as support tooling, not primary Decision Intelligence | Should not compete with AI Chat decision output. |
| Raw contract-heavy display sections | Rewrite into business-facing sections | Users need clear outputs, not contract inspection. |

Safe cleanup candidates from pruning review:

Tracked runtime exports, SQLite databases, generated docs, logs, scratch files, and zero-byte placeholder files should be removed only when the user authorizes cleanup. Confirm `.gitignore` coverage at the same time.

Acceptance:

Prominent app surfaces no longer imply final recommendations, unsupported optimization, autonomous decisions, prediction certainty, or causal proof.

No useful feature is removed before a replacement path exists or the user explicitly approves removal.

## Phase 11: Export The AI Chat Decision Asset

Purpose: make export prove the app is coherent.

Export should work from `decision_output` in AI Chat. The PDF should read like a shareable decision asset, not a raw workspace dump.

Codex backend target:

Ensure `decision_output.export_sections` contains concise sections for export. Frontend should not need to summarize raw internals.

Gemini/frontend target:

Extend `decisionPdfExport.js` to support `decision_output`.

Export sections should include:

Executive Brief.

Dataset Trust.

Goal, Drivers, Limits, Breakdowns.

Evidence Board.

Decision Map summary.

Scenario Compare.

Assumptions and Unknowns.

Truth boundary and limitations.

Acceptance:

The user can export the active AI Chat decision output.

The export is shareable and readable without opening the app.

The export avoids fake final recommendations, optimization, causal proof, and unsupported prediction claims.

## Current Gate Pointer

The current project gate lives in `project_docs/active/status/decision_intelligence_execution_status.md`.

Use this rollout file for implementation details, likely files, constraints, and acceptance checks only. Do not treat this file as proof that a phase is currently open or complete. If this file and the status file disagree, update this file or ignore it; the status file wins.

Completed foundation details remain here so future agents can understand how each slice was intended to be implemented:

1. Chat-native corrections append updated `decision_output`, carry corrected state into follow-up analysis, and preserve existing `answer`, `chart`, `workspace_preview`, and `workspace_analysis_summary` behavior.
2. Evidence Board normalizes `workspace_analysis.ranked_diagnostics` into display-ready `decision_output.evidence_board` items with strength, data sufficiency, limitations, and diagnostic trace.
3. Decision Graph backend and frontend work supports graph candidates, selected-variable graph generation, evidence coverage edges, observed association edges, user hypothesis edges, graph-to-action planning, and the observational reliability boundary.
4. Scenario Compare is folded into `decision_output.scenario_compare` as bounded direct adjustment or sensitivity comparison inside the AI Chat decision output.

Future frontend implementation work should use a fresh active handoff unless the user explicitly authorizes Codex frontend edits in the current session.

## Gemini Handoff Trigger

Future Gemini handoffs should be written only when these are true:

The backend contract or mock contract needed by the frontend is documented.

Representative backend route or service behavior is implemented and verified, or the handoff clearly says the real API is not ready and provides explicit JSON mocks.

Focused backend tests pass when backend behavior changed.

Codex has enough backend truth to prevent Gemini from inventing APIs, payload semantics, or reliability language.

The handoff names exact frontend files, visible behavior, backend request and response shape, acceptance checks, build command, browser check, and status-doc update requirement.

## Documentation Updates Required During Work

Keep active docs short.

Update `project_docs/active/status/decision_intelligence_execution_status.md` only with current facts: what changed, what passed, and what remains.

Update `project_docs/active/contracts/decision_objects.md` whenever payload shape changes.

Update `project_docs/active/ai_hand_off/README.md` only when a real active Gemini handoff exists.

Move completed handoffs out of active handoff space after review.

## Deferred

Do not implement causal CDD, Monte Carlo, prediction, optimization, autonomous decisioning, or final recommendations in this rollout. These belong behind Advanced Gates until the backend can support them honestly.
