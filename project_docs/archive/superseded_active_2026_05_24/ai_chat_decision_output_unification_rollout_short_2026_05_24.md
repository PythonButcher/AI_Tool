# AI Chat Decision Output Unification Rollout

## Purpose

Unite the work already built into one clear application flow.

AI Chat should stay the main work surface. Its existing outputs must remain: normal answers, charts, exploration results, workspace previews, artifact inspection, and PDF export. Decision Intelligence should become a richer structured output in the AI Chat results pane, not a separate required dashboard or a forced jump into the Decisions window.

The Decisions window is not deleted. Its likely future role is secondary: saved decision library, fullscreen review, or historical asset viewer after the AI Chat output flow is clear.

## Product Flow

The intended user flow is:

Ask or frame work in AI Chat. The chat uses the active dataset or asks the user to connect/select one. The output pane shows the active result: answer, chart, exploration artifact, or structured decision output. For decision work, the output pane shows Dataset Trust, the decision frame, evidence, map, scenario comparison, and export. The user can correct or refine the decision through chat without being forced into another window.

## Phase 1: Protect AI Chat

Keep current AI Chat behavior working before adding richer decision output.

Normal data answers, charting, explore mode, decide mode, artifact inspection, and export are not optional side features. They are part of the product and must not be broken or demoted while Decision Intelligence is improved.

Codex owns the regression expectations and backend contract checks. Gemini owns frontend verification when UI work begins.

Acceptance: existing `answer` and `chart` artifacts still render, inspect, and export after decision-output work starts.

## Phase 2: Add Dataset Trust To Chat Output

Bring the old dataset-truth phase into the AI Chat output flow.

Dataset Trust means the output tells the user what data powered the result: dataset name, source, row count, column count, cleaned or transformed state when known, semantic readiness, and stale or override state when relevant.

This should appear for AI Chat decision output first, then extend to other result types where useful.

Acceptance: when AI Chat returns an answer, chart, or decision output, the user can tell which dataset was used.

## Phase 3: Define A Unified Decision Output Artifact

Codex defines a backend-owned artifact that AI Chat can render in the output pane.

This artifact should reuse existing backend work instead of replacing it. It should compose the current workspace draft, readiness, semantic bindings, correction state, ranked diagnostics, scenario preview, dataset summary, and export sections into one clean output.

The artifact should use business-facing names: Goal, Drivers, Limits, Breakdowns, Assumptions, Unknowns, Evidence, Scenario Compare, and Dataset Trust. Contract-level terms can remain in details where useful.

Acceptance: AI Chat can return a structured decision output artifact without breaking existing `answer`, `chart`, `workspace_preview`, or `workspace_analysis_summary` artifacts.

## Phase 4: Render The Decision Output In AI Chat

Gemini renders the new decision output in the existing AI Chat results pane.

The output pane should remain multi-purpose. It should handle data answers, charts, exploration results, and decision outputs. Decision Intelligence becomes one rich artifact family inside AI Chat, not a takeover of the entire chat system.

Acceptance: a user asks a decision question and sees a structured decision output on the right side of AI Chat without being forced into the Decisions window.

## Phase 5: Make Corrections Chat-Native

Use the correction work already built to let the user refine the decision through chat.

Examples: "Use revenue as the goal," "Gross margin is the limit," "Break this down by region and channel," or "Remove discount as a driver." The decision output should update in place and preserve session state.

Acceptance: a correction through AI Chat updates the active decision output and keeps backend readiness, allowed actions, and semantic trace consistent.

## Phase 6: Turn Ranked Diagnostics Into Evidence Board

The backend already returns ranked observational evidence. The UI should present it as an Evidence Board instead of raw diagnostics.

The Evidence Board should answer what the data supports, what is weak, what is missing, and what remains only observational. It must not imply final recommendations, optimization, simulation, or causal proof.

Acceptance: the user can understand the evidence without reading backend contract language.

## Phase 7: Add Decision Map Inside The Output

The Decision Map is a visual explanation of the current decision structure and evidence coverage.

It should show Goal, Drivers, Limits, Breakdowns, Evidence, Assumptions, Unknowns, Dataset, and Scenario inputs. It is not a causal diagram yet. Causal Decision Diagrams should stay gated until the app can represent causal direction, assumptions, validation, and unsupported simulation boundaries clearly.

Acceptance: the map helps users understand the decision frame and evidence coverage without implying causality.

## Phase 8: Fold Scenario Compare Into The Same Output

Scenario Compare should use the existing scenario service as bounded sensitivity analysis.

It should show direct adjustments and assumptions clearly. It should not be framed as a forecast, optimizer, causal simulation, or final recommendation.

Acceptance: the user can compare a simple driver adjustment from the AI Chat output pane and understand the assumptions.

## Phase 9: Redefine The Decisions Window

Only after the AI Chat output flow works should the Decisions window change.

The Decisions window should become secondary: saved decision asset library, fullscreen review mode, historical asset viewer, or advanced review surface. It should not be the required continuation path after AI Chat.

Acceptance: the core decision flow can be completed inside AI Chat, with Decisions available as an optional expansion or library.

## Phase 10: Prune Or Rewrite Conflicting Pieces

After the replacement path exists, clean up surfaces that fight the unified flow.

Likely rewrite or demote candidates include legacy "Strategic Recommendations," `DecisionRecommendations.jsx` wording, backend recommendation fields such as `optimize` and `expected_outcome`, prominent Autopilot, the Autopilot "Business Recommendations" node, AutoML as a primary Decision Intelligence surface, generic workflow nodes that compete with decision output, raw contract-heavy display sections, and tracked generated artifacts.

Acceptance: prominent app surfaces no longer imply final recommendations, unsupported optimization, autonomous decisions, prediction certainty, or causal proof.

## Phase 11: Export The AI Chat Decision Asset

Export should work from the AI Chat decision output.

The exported artifact should include Executive Brief, Dataset Trust, Goal, Drivers, Limits, Breakdowns, Evidence Board, Decision Map summary, Scenario Compare, Assumptions, Unknowns, and the observational truth boundary.

Acceptance: the export reads like a shareable decision asset, not a raw workspace dump.

## Ownership

Codex owns backend truth, contracts, tests, architecture, documentation, cleanup planning, and review.

Gemini owns frontend implementation unless the user explicitly authorizes Codex frontend edits in the current session.

## Deferred

Do not implement causal CDD, Monte Carlo, prediction, optimization, autonomous decisioning, or final recommendations in this rollout. These belong behind Advanced Gates until the backend can support them honestly.
