# Phase 4 - Advanced Readiness And ML Trust Gates Plan

## Purpose

Make the app honest and useful about advanced Decision Intelligence capabilities before any prediction, optimization, causal, or automated decisioning surface can be trusted. This phase should turn scattered readiness signals into clear diagnostics that explain what is supported, what is blocked, and what evidence or data quality would be required next.

## Current Gate

Status: active; Codex contract and backend source review happen first.

Planning source: `project_docs/active/agent_council/outputs/next-implementation-cycle-priorities/2026-06-28-next-implementation-cycle-priorities-summary.md` ranks Advanced Readiness And ML Trust Gates after the completed product-experience and saved-library slices.

Backend readiness target: inspect current Dataset Trust, semantic role, ML, AutoML, forecasting, governance readiness, and unsupported capability gates. Define the smallest additive contract that can report readiness for prediction, optimization, causal analysis, and automated decisioning without enabling unsupported claims.

Frontend readiness target: no frontend implementation starts until Codex verifies source-backed contract readiness and creates a focused frontend-agent handoff if a UI change is needed.

Completion target: documented readiness contract, focused backend implementation or source-backed plan, tests for supported and blocked readiness states, preserved observational-only boundaries, and a bounded frontend handoff only if the backend contract is ready.

## Product Boundaries

This phase must not implement prediction, optimization, simulation, causal proof, autonomous decisions, or final recommendations. It only explains whether the current data, semantics, evidence, model state, and governance signals are sufficient for those advanced capabilities.

Blocked or unsupported states should be useful, not vague. They should say what is missing in plain language, such as target variable absence, weak semantic roles, insufficient history, missing counterfactual structure, low data quality, unsupported model readiness, or governance restrictions.

Readiness gates must remain additive. Existing AI Chat answers, Decision Output Review, Dataset Trust, Evidence Board, Scenario Compare, exports, and saved DecisionAssets should keep working.

## Acceptance Checks

The backend exposes a stable readiness shape for advanced capabilities with clear states such as supported, limited, blocked, or not evaluated.

Readiness diagnostics name the capability being evaluated, the reason for the state, the evidence behind it, and the next safe action or missing requirement.

The contract does not present diagnostics as predictions, recommendations, simulations, optimizers, causal proof, or autonomous decisions.

Focused tests cover at least one supported or limited state and at least one blocked state for advanced readiness.

If frontend work is needed, the handoff names exact fields, target files, acceptance checks, build command, and manual browser checklist.

## Verification

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and focused backend tests touched by the implementation. If ML or readiness services change, add or update tests that prove blocked states remain honest and supported states cite source-backed evidence.
