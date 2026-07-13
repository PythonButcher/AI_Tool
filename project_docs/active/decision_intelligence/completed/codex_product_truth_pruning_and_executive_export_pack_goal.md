> COMPLETED REFERENCE — Implemented and verified on 2026-07-12. This record is historical and is not an active goal.

Goal: Audit and tighten backend-owned product-truth language and existing executive export behavior so every displayed claim is source-backed, observationally bounded, and compatible with current AI Chat and saved DecisionAsset contracts.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/decision_intelligence/active_gate/README.md`, `project_docs/active/decision_intelligence/active_gate/phase_5_product_truth_pruning_and_executive_export_pack_plan.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, and `project_docs/active/contracts/data_catalog_lineage.md`.

Inspect `backend/services/decision_output_service.py`, `backend/services/decision_asset_service.py`, `backend/services/recommendation_service.py`, `backend/routes/export.py`, `backend/routes/decision.py`, `backend/routes/autopilot.py`, `backend/routes/automl.py`, `backend/services/automl_logic.py`, and focused tests. Trace recommendation, strategic-advice, Autopilot, AutoML, readiness, and export language to its runtime source. Remove, narrow, or qualify claims that cannot be supported by trusted backend evidence.

Use existing `export_sections`, Dataset Trust, Evidence Board, Decision Map, Scenario Compare, Advanced Readiness, `source_refs`, and truth-boundary fields. Preserve routes, artifact types, saved snapshot semantics, and compatibility. Improve backend-owned export structure and labels only where that makes the existing evidence clearer to an executive reader.

Do not implement prediction, optimization, simulation, causal proof, autonomous decisioning, or final recommendations. Do not edit frontend implementation files or any `GEMINI.md` file. Create a focused frontend handoff only if source review or browser verification proves a bounded frontend gap.

Run the smallest focused backend tests first, then relevant Decision Chat, saved-asset, and export regressions. Finish with `python C:/Users/18022/.codex/skills/project-doc-governance/scripts/audit_project_docs.py`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`.
