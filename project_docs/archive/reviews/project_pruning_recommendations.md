# Archived Reference — Project Pruning Recommendations

This recommendation set belongs to a retired product direction and is not a current cleanup plan.

# Project Pruning Recommendations

Date: 2026-05-23

## Purpose

This document captures the current recommendation on whether AI_Tool should remove, demote, or rewrite low-value project material after the emergency compounding-results council.

The short answer is yes: the project should gut some junk, but through a controlled prune rather than a broad deletion pass.

## Immediate Low-Risk Cleanup

These tracked artifacts do not belong in source control and should be removed in the first cleanup pass:

`/.codex_tmp_exports/decision_workspace_export_2026-05-14.pdf`

`/.codex_tmp_exports/decision_workspace_export_page1.png`

`/.codex_tmp_exports/dom_decision_workspace_export_2026-05-14.pdf`

`/.codex_tmp_exports/dom_decision_workspace_export_page1.png`

`/database.db`

`/backend/database.db`

`/backend/db/database.db`

`/generated_docs/decision_intelligence_overview_2026-05-12.html`

`/backend_logs.txt`

`/logs.txt`

`/dev-test.txt`

`/python`

`/ComponentAndModuleIndex_ProjectMap.txt`

After removal, confirm `.gitignore` covers runtime exports, SQLite databases, generated docs, logs, scratch files, and temporary folders.

## Product Surfaces To Demote Or Rewrite

The largest cleanup need is not file size. It is product truthfulness and value. Several surfaces still use language or workflows that conflict with the new compounding-results direction.

The legacy recommendation flow should be reviewed first. `DecisionWorkspaceView.jsx` still renders legacy diagnostics as "Strategic Recommendations", and `DecisionRecommendations.jsx` describes "actionable recommendations" with "Expected Outcome." This should not remain prominent unless rewritten into bounded evidence, next-check actions, or scenario exploration. The current Decision Intelligence boundary is observational support, not final recommendation.

The Autopilot path should be demoted or rewritten. `backend/routes/autopilot.py` creates a "Business Recommendations" node and describes an auto-generated pipeline for recommendations. That risks sounding more capable and more valuable than the current system proves.

The ML and AutoML surfaces need a truthfulness review before remaining prominent. `MachineLearningPanel.jsx`, `AutoMLPanel.jsx`, `backend/routes/automl.py`, `backend/routes/ml_prep.py`, and related training services may be real code, but they should not distract from Decision Intelligence unless surfaced as readiness-gated workflows with clear validation, leakage, and prediction boundaries.

## Keep For Now

Do not gut the backend Decision Intelligence foundation. The chat contract, workspace service, correction loop, ranked diagnostics, semantic metadata, and benchmark tests are valuable. The problem is that they are not yet composed into an obvious user-facing result.

Keep `decision_brief_service.py`, `scenario_service.py`, `DecisionBrief.jsx`, and `ScenarioPreview.jsx` for now. They are likely outdated, but they are close to the new target. Rewrite them into Executive Decision Brief and bounded Scenario Compare rather than deleting them blindly.

## Documentation Cleanup

The active docs still route agents toward the old Phase 4 Canonical Active Dataset Contract path. After the user accepts the compounding council result, update the active docs so the next work is Outcome 1: Executive Decision Brief with Dataset Trust.

The old Phase 4 dataset handoff should be marked superseded, paused, or narrowed into a Dataset Trust Strip that supports visible decision outcomes. Dataset truth remains important, but it should no longer be the standalone next milestone.

## Recommended Order

First, remove tracked artifacts and scratch files.

Second, update active docs so future agents do not resume the old Phase 4 path.

Third, review and rewrite recommendation/autopilot/AutoML language so the app no longer overpromises.

Fourth, preserve useful backend foundations and compose them into the new visible workflow: Executive Decision Brief, Evidence Board, bounded Scenario Compare, and executive-ready export.

## Safety Rule

Do not delete frontend product code in the first pass unless the user explicitly authorizes frontend edits. Codex should document the prune targets, clean obvious tracked artifacts, update backend/docs where authorized, and create bounded Antigravity handoffs for frontend demotion or rewrite work.
