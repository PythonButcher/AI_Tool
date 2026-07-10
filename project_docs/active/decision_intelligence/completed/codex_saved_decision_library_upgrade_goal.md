# Completed Reference - Codex Saved Decision Library Upgrade Goal

This completed reference is retained for historical context only. It is not the active Codex goal.

Goal: Build the Saved Decision Library Upgrade backend contract and implementation plan so immutable saved DecisionAssets expose stronger review metadata, provenance, optional filtering or comparison support, and export-from-snapshot behavior without treating saved assets as live data.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/decision_intelligence/active_gate/README.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, `project_docs/active/decision_intelligence/active_gate/phase_3_saved_decision_library_upgrade_plan.md`, and `project_docs/active/agent_council/outputs/next-implementation-cycle-priorities/2026-06-28-next-implementation-cycle-priorities-summary.md`.

Inspect the existing DecisionAsset backend service, API routes, frontend saved asset library code only as source context, and any existing saved-asset tests before planning edits. Do not edit frontend implementation files unless explicitly authorized in the session.

Use existing saved `decision_output`, `dataset_trust`, `source_refs`, `truth_boundary`, `readiness`, `export_sections`, and saved asset metadata first. Add only the minimum fields needed to make saved snapshots easier to review, filter, compare, and export while preserving immutable historical semantics.

Preserve product truth: saved assets are historical snapshots, not live data, final recommendations, predictions, simulations, optimizers, causal proof, autonomous decisions, or refreshed workspace state. Comparison, if implemented, is historical artifact comparison only.

Acceptance checks: saved assets expose stable review metadata; retrieval does not recompute the snapshot from current data; export uses saved artifact content; source refs and truth boundaries remain visible; existing AI Chat decision output, saved asset reopen, Evidence-To-Action next checks, and artifact inspection remain compatible. If frontend work is needed after backend verification, create a bounded Gemini or Antigravity handoff naming exact fields, target files, acceptance checks, build command, and manual browser checklist.

Verification commands: run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and focused backend tests touched by the work. If DecisionAsset service behavior changes, add or update tests proving immutable save/retrieve behavior, metadata shape, and export or comparison behavior when touched.
