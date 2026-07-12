> COMPLETED REFERENCE: This Codex goal belongs to the wrapped Phase 4 work and is not an active prompt.

# Codex Advanced Readiness And ML Trust Gates Goal

Goal: Build the Advanced Readiness and ML Trust Gates backend contract plan so AI Chat can explain whether prediction, optimization, causal analysis, and automated decisioning are supported, limited, blocked, or not evaluated without claiming unsupported advanced capabilities.

Historical plan reference: `project_docs/active/decision_intelligence/completed/phase_4_advanced_readiness_ml_trust_gates_plan.md`.

Inspect existing backend services, routes, and tests for Dataset Trust, semantic roles, governance readiness, ML or AutoML readiness, forecasting, unsupported capability gates, and AI Chat decision output assembly before planning edits. Do not edit frontend implementation files unless explicitly authorized in the session.

Use existing source-backed fields first. Define the smallest additive readiness contract that can report capability name, readiness state, reasons, evidence, missing requirements, and allowed next actions. Keep all advanced diagnostics observational and safety-gated.

Preserve product truth: readiness diagnostics are not predictions, recommendations, simulations, optimizers, causal proof, autonomous decisions, or model performance guarantees. They only explain whether the current data and system state are trustworthy enough to attempt a capability.

Acceptance checks: the contract identifies prediction, optimization, causal analysis, and automated decisioning readiness; blocked states explain missing requirements in plain language; supported or limited states cite source-backed evidence; existing AI Chat decision output, Dataset Trust, Evidence Board, Scenario Compare, exports, and saved DecisionAssets remain compatible. If frontend work is needed after backend verification, create a bounded Gemini or Antigravity handoff naming exact fields, target files, acceptance checks, build command, and manual browser checklist.

Verification commands: run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and focused backend tests touched by the work. If readiness or ML services change, add or update tests proving blocked and supported states are classified honestly.
