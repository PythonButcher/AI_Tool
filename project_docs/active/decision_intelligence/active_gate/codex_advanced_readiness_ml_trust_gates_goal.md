# Codex Advanced Readiness And ML Trust Gates Goal

Goal: Build the Advanced Readiness and ML Trust Gates backend contract plan so AI Chat can explain whether prediction, optimization, causal analysis, and automated decisioning are supported, limited, blocked, or not evaluated without claiming unsupported advanced capabilities.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/decision_intelligence/active_gate/README.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, `project_docs/active/contracts/data_catalog_lineage.md`, `project_docs/active/decision_intelligence/active_gate/phase_4_advanced_readiness_ml_trust_gates_plan.md`, and `project_docs/active/agent_council/outputs/next-implementation-cycle-priorities/2026-06-28-next-implementation-cycle-priorities-summary.md`.

Inspect existing backend services, routes, and tests for Dataset Trust, semantic roles, governance readiness, ML or AutoML readiness, forecasting, unsupported capability gates, and AI Chat decision output assembly before planning edits. Do not edit frontend implementation files unless explicitly authorized in the session.

Use existing source-backed fields first. Define the smallest additive readiness contract that can report capability name, readiness state, reasons, evidence, missing requirements, and allowed next actions. Keep all advanced diagnostics observational and safety-gated.

Preserve product truth: readiness diagnostics are not predictions, recommendations, simulations, optimizers, causal proof, autonomous decisions, or model performance guarantees. They only explain whether the current data and system state are trustworthy enough to attempt a capability.

Acceptance checks: the contract identifies prediction, optimization, causal analysis, and automated decisioning readiness; blocked states explain missing requirements in plain language; supported or limited states cite source-backed evidence; existing AI Chat decision output, Dataset Trust, Evidence Board, Scenario Compare, exports, and saved DecisionAssets remain compatible. If frontend work is needed after backend verification, create a bounded Gemini or Antigravity handoff naming exact fields, target files, acceptance checks, build command, and manual browser checklist.

Verification commands: run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and focused backend tests touched by the work. If readiness or ML services change, add or update tests proving blocked and supported states are classified honestly.
