# Phase 3 - Saved Decision Library Upgrade Plan

## Purpose

Make saved DecisionAssets more useful as immutable historical review objects. The Decisions window remains secondary; this work should improve finding, comparing, understanding, and exporting saved snapshots without presenting them as live data or final recommendations.

## Current Gate

Status: active; Codex contract and source review should happen first.

Planning source: `project_docs/active/agent_council/outputs/next-implementation-cycle-priorities/2026-06-28-next-implementation-cycle-priorities-summary.md` ranks Saved Decision Library Upgrade after AI Chat Decision Command Center and Evidence-To-Action Workflow. The detailed council record uses `phase-3-saved-decision-library-upgrade`.

Backend readiness target: inspect existing DecisionAsset persistence, retrieval, metadata, export, and snapshot safety behavior. Add only the minimum backend contract or service changes needed for stronger library metadata, filtering inputs, immutable snapshot comparison support, provenance display, and export from saved snapshots.

Frontend readiness target: no frontend implementation starts until Codex verifies backend contract readiness and creates a focused frontend-agent handoff if needed.

Completion target: documented contract decision, focused backend tests for saved-asset metadata and immutable snapshot behavior, preserved observational-only boundaries, and a bounded frontend handoff only if source review confirms a real frontend gap.

## Product Boundaries

Saved assets are historical snapshots. They must not be refreshed against live data, edited into new truth, presented as current dataset state, or framed as final recommendations, predictions, simulations, optimizers, causal proof, or autonomous decisions.

The saved library may support metadata, filtering, comparison, collections or tags, provenance, and export. Any comparison must read as historical snapshot comparison, not live A/B analysis or causal explanation.

## Acceptance Checks

The backend contract exposes stable saved-asset metadata such as title, dataset label, readiness state, truth boundary, created time, source refs, tags or collection fields if implemented, and optional graph state summary when safely available.

Saved-asset retrieval keeps immutable snapshot semantics and does not silently recompute Dataset Trust, evidence, scenario state, or command-center state from current live data.

Comparison support, if implemented in this slice, compares saved snapshots as stored historical artifacts and clearly preserves each asset's source refs, created time, Dataset Trust, and truth boundary.

Export from saved snapshots uses the saved artifact content and does not rebuild from current workspace state.

AI Chat answers, current decision output rendering, Evidence-To-Action next checks, artifact inspection, and existing saved DecisionAsset reopen behavior remain compatible.

## Verification

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and focused backend tests touched by the implementation. If DecisionAsset service behavior changes, add or update focused tests for save, retrieve, metadata, immutable snapshot boundaries, and export or comparison behavior when touched.
