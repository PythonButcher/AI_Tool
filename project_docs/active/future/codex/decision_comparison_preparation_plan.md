# Decision Comparison Preparation Plan

Status: Deferred and ready to promote after the current browser-acceptance gate closes.

Owner: Codex for backend truth, contracts, tests, architecture, documentation, and coordination. Gemini or Antigravity owns any later React or CSS implementation after a verified frontend gap and focused handoff.

Planning source: Release 3 in `project_docs/active/future/codex/ai_chat_decision_intelligence_user_outcome_audit_and_repair_plan.md`.

## Purpose

Give users a truthful way to compare at least two named alternatives against criteria and guardrails they control. Trade-offs must remain linked to active-data evidence, missing evidence must stay visible, and sensitivity cases must be described as direct adjustments rather than predictions or recommendations.

## Promotion Gate

This plan is preparation only. Do not move it into `project_docs/active/decision_intelligence/active_gate/` or begin implementation until the active status file records user browser acceptance of the current AI Chat clarification flow.

## First Codex Slice

Audit the existing comparison path before changing public payloads. Trace `decision_output.frame`, `decision_output.evidence_board`, `decision_output.scenario_compare`, `decision_output.advanced_readiness`, `decision_output.source_refs`, the workspace decision scope and constraints, the scenario-evaluation route, and current frontend readers. Classify which pieces already support named alternatives, user-controlled criteria, guardrails, evidence-linked trade-offs, and multiple direct-adjustment cases.

The audit must produce the smallest additive backend contract and test plan needed for a real comparison. It must explicitly separate user-entered judgments from observed evidence and must not invent weights, scores, forecasts, causal effects, optimized choices, or final recommendations.

## Likely Source Areas

Backend targets are `backend/decision_engine/chat_service.py`, `backend/services/decision_workspace_service.py`, `backend/services/decision_output_service.py`, `backend/services/scenario_service.py`, and `backend/routes/decision.py`. Focused regression targets are `tests/test_decision_chat_service.py`, `tests/test_decision_workspace_service.py`, and scenario-service or route tests selected by the source audit.

Read-only frontend tracing may inspect `frontend/frontend/src/features/ai/DecisionOutputReview.jsx`, `frontend/frontend/src/features/ai/DecisionCommandCenter.jsx`, `frontend/frontend/src/features/business/decision/ScenarioPreview.jsx`, and `frontend/frontend/src/features/business/decision/decisionApi.js`. Codex must not edit those frontend files without explicit user authorization.

## Boundaries

Preserve AI Chat as the primary surface, truthful dataset identity, conversational continuity, normal answers and charts, artifact inspection, exports, and immutable saved snapshots. Keep Scenario Compare sensitivity-only. Do not add prediction, optimization, simulation claims, causal proof, autonomous choice, hidden scoring, or a separate required Decisions-window flow.

## Proposed Acceptance

The promoted phase is complete only when users can define at least two named alternatives, control the criteria and guardrails used for comparison, see evidence and unknowns without fabricated scores, run more than one direct-adjustment sensitivity case, and trace each data-backed claim to the active dataset and source refs. Focused backend tests, contract documentation, required frontend build evidence, Codex source review, and user browser acceptance must pass.

## Prepared Goal

`project_docs/active/future/codex/codex_decision_comparison_goal.md`
