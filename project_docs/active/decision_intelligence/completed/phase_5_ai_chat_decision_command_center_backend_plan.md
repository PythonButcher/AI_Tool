# Phase 5 - AI Chat Decision Command Center Backend Plan

Completed reference. Current status and next focus live in `project_docs/active/status/decision_intelligence_execution_status.md`.

## Purpose

Make the active AI Chat `decision_output` feel like a coherent Decision Intelligence command center without creating a separate required Decisions-window flow or breaking existing AI Chat answers, charts, exploration, artifact inspection, saved DecisionAssets, or exports.

The backend contract decision is additive: the command-center state belongs at `decision_output.command_center`, not in a wrapper artifact. The existing `decision_output` artifact remains canonical because current AI Chat rendering, PDF export, artifact inspection, and saved-asset paths already route by `type: "decision_output"`. A wrapper would require frontend code to unwrap a second artifact shape before existing behavior could keep working.

## Current Gate

Status: backend implementation verified; frontend implementation handoff ready.

Backend target: `DecisionOutputService.compose` returns `command_center` in every `decision_output`. `DecisionAssetService` accepts `command_center` as part of the sanitized immutable snapshot contract. The artifact type, schema version, export sections, source refs, and truth boundary stay unchanged.

Frontend target: Gemini or Antigravity renders the command center inside the existing AI Chat `decision_output` review path after backend verification. Codex must not edit frontend implementation files unless explicitly authorized.

## Contract Shape

`decision_output.command_center` uses existing fields first: `frame`, `dataset_trust`, `readiness`, `evidence_board`, `decision_map`, `scenario_compare`, `advanced_gates`, `export_sections`, `source_refs`, and `truth_boundary`.

The only added command-center fields are `schema_version`, `surface`, `status`, `section_order`, `stale_state`, `rerun_state`, `allowed_next_checks`, `disabled_next_checks`, `export_readiness`, `limitations`, compact `source_refs`, and `truth_boundary`.

Allowed next checks are review or investigation controls, not recommendations or autonomous actions. Disabled checks must carry reasons, including unsupported simulation, optimization, autonomous decisioning, final recommendation, and live saved-asset refresh.

## Product Boundaries

The command center remains observational decision support. It must not present final recommendations, predictions, simulations, optimizers, causal proof, autonomous decisions, live saved-asset refresh, or unsupported ML behavior. Scenario Compare remains bounded direct adjustment only. Saved DecisionAssets remain immutable historical snapshots.

Export remains driven by curated `decision_output.export_sections`. The command center can report export readiness, but it must not become a raw export field dump.

## Acceptance Checks

The contract decision is documented in `project_docs/active/contracts/decision_objects.md`.

AI Chat decision prompt responses still append `decision_output` without changing answer, chart, exploration, artifact inspection, or export behavior.

Saved DecisionAssets can preserve a sanitized `command_center` when present, while immutable snapshot semantics remain intact.

Unsupported capability prompts and disabled command-center checks remain observational-only.

Frontend work has a bounded handoff naming exact fields, allowed actions, disabled states, acceptance checks, build command, and manual browser checklist.

## Verification

Verified commands:

`$env:PYTHONPATH='.codex_tmp_py\site-packages'; python -m unittest tests.test_decision_chat_service`

`$env:PYTHONPATH='.codex_tmp_py\site-packages'; python -m unittest tests.test_decision_asset_service`

`$env:PYTHONPATH='.codex_tmp_py\site-packages'; python -m unittest tests.test_decision_reliability_benchmark`

Final completion checks still require `python .codex/hooks/agent_harness_check.py` and `git diff --check` after documentation updates.
