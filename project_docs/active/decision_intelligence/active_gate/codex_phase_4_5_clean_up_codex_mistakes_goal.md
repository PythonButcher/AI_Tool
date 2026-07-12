# Codex Phase 4.5 Clean Up Codex Mistakes Goal

Goal: Complete Phase 4.5 - Clean Up Codex Mistakes by making active documentation and Advanced Readiness backend claims precise, source-backed, and internally consistent without expanding product scope.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/decision_intelligence/active_gate/README.md`, `project_docs/active/decision_intelligence/active_gate/phase_4_5_clean_up_codex_mistakes_plan.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, and `project_docs/active/contracts/data_catalog_lineage.md`.

Inspect `backend/services/advanced_readiness_service.py`, `backend/services/decision_output_service.py`, `backend/decision_engine/chat_service.py`, `backend/routes/decision.py`, `backend/routes/automl.py`, `backend/routes/ml_prep.py`, `backend/services/automl_logic.py`, `tests/test_advanced_readiness_service.py`, and the focused Decision Chat tests. Identify any Codex-authored contract state that is unreachable in the live product path or supported only by a direct fixture. Correct the implementation or narrow the contract so every displayed state is backed by a trusted runtime source.

Keep all readiness diagnostics observational and safety-gated. Do not implement prediction, optimization, simulation, causal proof, autonomous decisioning, or final recommendations. Do not change PDF/export behavior in this goal. Do not edit frontend implementation files or any `GEMINI.md` file.

Acceptance checks: active documentation names one Phase 4.5 gate; completed and rejected records do not appear as active work; live Advanced Readiness behavior matches its documented evidence sources; unreachable support claims are removed or connected to a trusted backend source; focused tests prove honest limited, blocked, not-evaluated, and any genuinely reachable supported behavior; existing AI Chat, Dataset Trust, Evidence Board, Scenario Compare, saved DecisionAssets, and exports remain compatible.

Run the smallest focused backend tests first, then the relevant Decision Chat and saved-asset regressions. Finish with `python C:/Users/18022/.codex/skills/project-doc-governance/scripts/audit_project_docs.py`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`.
