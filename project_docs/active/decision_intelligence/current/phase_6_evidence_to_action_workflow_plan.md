# Phase 6 - Evidence-To-Action Workflow Plan

## Purpose

Connect the existing Evidence Board, Decision Map, Decision Graph actions, charting, and Scenario Compare into user-approved next checks inside the AI Chat Decision Intelligence flow.

This phase should make evidence useful without turning it into final recommendations. The user should be able to choose evidence, inspect what checks are available, understand why other checks are disabled, and run only supported observational follow-up actions.

## Current Gate

Status: active; Codex backend contract and source review should happen first.

Backend readiness target: identify which action semantics already exist in `decision_output.command_center`, `decision_graph`, AI Chat actions, and Scenario Compare. Add only the minimum backend contract or service changes needed to expose next-check state, enabled or disabled reasons, source refs, and truth boundaries.

Frontend readiness target: no frontend implementation starts until Codex verifies backend contract readiness and creates a focused frontend-agent handoff if needed.

Completion target: documented contract decision, focused backend tests for enabled and disabled next checks, preserved observational-only boundaries, and a bounded frontend handoff only if source review confirms a real frontend gap.

## Product Boundaries

Evidence-To-Action means user-approved follow-up checks. It does not mean final recommendations, predictions, simulations, optimizers, causal proof, autonomous decisions, or unsupported ML behavior.

Scenario Compare remains bounded direct adjustment only. User hypothesis edges remain visually and contractually separate from observed associations. Saved DecisionAssets remain immutable historical snapshots.

## Acceptance Checks

The backend contract names supported next checks and disabled states without requiring frontend inference.

Evidence Board items and Decision Map or Decision Graph items can expose breakdown, monitor, explain evidence, explain missing data, and bounded Scenario Compare availability only when the source state supports them.

Scenario Compare is disabled for unsupported cases such as unvalidated user hypotheses or missing metric targets, with clear backend reasons.

AI Chat answers, charts, exploration, artifact inspection, decision output rendering, saved DecisionAssets, and exports remain compatible.

Focused backend tests pass for graph actions, chat decision output behavior when touched, and unsupported capability truthfulness.

## Verification

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and focused backend tests touched by the implementation. If graph action behavior changes, run `python -m unittest tests.test_decision_graph_service`. If chat or `decision_output` behavior changes, run `python -m unittest tests.test_decision_chat_service`.
