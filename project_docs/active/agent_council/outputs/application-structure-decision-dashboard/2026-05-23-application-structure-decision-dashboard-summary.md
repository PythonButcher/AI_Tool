# Application Structure Decision Dashboard Council Summary

Date: 2026-05-23

## Core Conclusion

The council recommended changing AI_Tool from a broad AI toolbox with Decision Intelligence pieces into a practical Decision Intelligence builder dashboard.

The main experience should help users build and update decision assets, not inspect internal contracts. The application should still use strong semantic concepts such as goals, drivers, outcomes, limits, breakdowns, evidence, scenarios, assumptions, and readiness, but those concepts should become practical controls and visible outputs.

The council agreed that the product should be direct, useful, and down to earth. Technical terms should be available when they clarify the result, but they should not dominate the first screen.

## Proposed Main Structure

The council's strongest recommendation is a primary Decision Dashboard powered by a backend-owned `DecisionDashboardState`.

The dashboard should bring together:

Brief: a concise executive decision summary.

Controls: editable goals, drivers, limits, breakdowns, assumptions, filters, and scenario inputs.

Dataset Trust: compact dataset name, source, row count, column count, transform state, and stale-result status.

Evidence Board: ranked observational evidence with quantified signals and limitations.

Decision Map: a visual model of declared relationships and evidence coverage.

Scenario Compare: bounded sensitivity comparisons, not causal forecasts.

Advanced Gates: locked or gated areas for CDD, Monte Carlo, prediction, optimization, and final recommendations.

Export: a share-ready decision asset, not a raw internal report.

## Decision Map And CDD

The council agreed not to lead with causal CDD yet.

The near-term visual model should be called a Decision Map. It can show declared relationships and observational evidence coverage using nodes such as Goal, Driver, Limit, Breakdown, Evidence, Assumption, Unknown, Dataset, and Scenario.

Edges should be labeled honestly as declared relationship, observed association, constraint, breakdown, assumption, or missing evidence. They should not imply causal proof.

CDD should become a later gated advanced mode only when the app can explicitly capture causal direction, assumptions, confidence, validation notes, and unsupported simulation boundaries.

## Product Language

The council recommended translating internal terminology into practical business language:

Objective becomes Goal.

Lever becomes Driver or What You Can Change.

Guardrail becomes Limit.

Segment becomes Breakdown.

Recommendation becomes Next Check or Suggested Investigation.

Readiness becomes Can Run or Needs Fix.

Technical terms should remain available in details, tooltips, contracts, and exports where useful, but the main dashboard should not read like an internal schema.

## Surfaces To Demote Or Rewrite

The council warned that old product surfaces could undermine the new direction.

Legacy Strategic Recommendations should be renamed, demoted, or rewritten into Next Checks or Suggested Investigations.

Autopilot should not stay prominent unless it produces a concrete decision asset. Otherwise, it should be hidden, renamed, or gated.

AutoML and prediction-heavy surfaces should move behind Advanced Gates unless the app can clearly communicate validation, leakage, target suitability, and prediction boundaries.

Generic workflow nodes should not compete with the Decision Dashboard as the main product experience.

## Recommended Implementation Order

First, reset active docs so the old Phase 4 Canonical Active Dataset path is no longer the default next work.

Second, have Codex define the `DecisionDashboardState` backend contract. This should include frame summary, dataset trust, brief, controls, evidence summary, map, scenario preview, advanced gates, stale state, and export sections.

Third, have Codex define the Decision Map contract with typed nodes and non-causal edge labels.

Fourth, create a focused Gemini handoff for the Decision Dashboard frontend shell after the backend contract is stable.

Fifth, prune or rewrite old overpromising surfaces and make export a first-class decision asset.

## Acceptance Standard

No unit of work should be considered complete just because fields exist, tests pass, docs are updated, or a renderer shows raw data.

Completion requires a visible result that is obvious, useful, direct, truthful, and exportable where appropriate.

The first meaningful acceptance flow should let a user change a driver, limit, assumption, breakdown, or scenario input and see the dashboard mark stale state or rerun the engine so the brief, evidence, map, and scenario comparison update.

## Main Risk

The biggest risk is building another visually dense surface that still behaves like a contract viewer. The dashboard must not become a wall of labels.

The second biggest risk is overclaiming with CDD, predictions, optimization, or recommendations before the backend can truthfully support those capabilities.

The council's answer is to make the dashboard practical now, keep causal and predictive work gated, and turn old overpromising surfaces into supporting tools only if they serve the new Decision Intelligence flow.
