> REJECTED REFERENCE: The user rejected this proposed gate on 2026-07-11 because it incorrectly made PDF/export work a Phase 4 blocker. It is archived and must not be executed.

# Codex Advanced Readiness System Repair Goal

Goal: Make Advanced Readiness and Decision Output export trustworthy end to end by connecting live model evidence, completing the backend export contract, and defining a verifiable PDF repair boundary before frontend work resumes.

Rejected audit reference: `project_docs/archive/rejected_advanced_readiness_system_audit_2026_07_11.md`.

Inspect `backend/services/advanced_readiness_service.py`, `backend/services/decision_output_service.py`, `backend/decision_engine/chat_service.py`, `backend/routes/decision.py`, `backend/routes/automl.py`, `backend/routes/ml_prep.py`, `backend/services/automl_logic.py`, `backend/services/decision_asset_service.py`, and their focused tests. Define a trusted model-evaluation bridge that proves dataset and target identity before prediction can be `supported`. If the current model state cannot prove that identity, keep prediction `limited` and remove any unreachable product claim rather than trusting caller-supplied model metadata.

Extend `decision_output.export_sections` with backend-owned Advanced Readiness content and include the same truth in saved DecisionAsset export responses. Tighten export readiness so required section completeness is checked instead of treating any non-empty section list as ready. Preserve existing Decision Output, Dataset Trust, Evidence Board, Decision Map, Scenario Compare, saved assets, and observational-only boundaries.

Add focused tests proving that a real trusted model result can affect the live Decision Chat response only when dataset and target evidence match; mismatched or absent model evidence remains limited or blocked. Add tests for the required Advanced Readiness export section, saved-export preservation, and stricter export readiness. Run the full focused Decision Intelligence backend suite, `python .codex/hooks/agent_harness_check.py`, the project documentation audit, and `git diff --check`.

Do not edit frontend implementation files. After the backend contract is verified, create one bounded Antigravity handoff for `frontend/frontend/src/utils/appPdfExport.js`, `frontend/frontend/src/utils/decisionPdfExport.js`, and only the minimum calling files needed to fix label wrapping, duplicate fallbacks, Advanced Readiness rendering, and PDF regression coverage. The handoff must require a production build and rendered-PDF inspection before browser acceptance resumes.
