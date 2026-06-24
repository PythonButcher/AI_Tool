# Application Next Focus Priorities Council Topic

## Purpose

This folder contains the Agent Council artifacts for deciding what AI_Tool should focus on next after the Phase 4.5 Decision Intelligence hardening and the app-wide UI flaw cleanup.

This topic is intentionally broader than the previous UI flaws council. It evaluates backend, frontend, semantic model, machine learning readiness, Decision Intelligence reliability, data workflow, testing, contracts, and product coherence. The goal is a ranked implementation direction, not a narrow Gemini cleanup pass.

## Status

Council run completed and saved.

## Artifacts

Council JSON:

`project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json`

Current Decision Intelligence source of truth:

`project_docs/active/status/decision_intelligence_execution_status.md`

Decision Intelligence implementation reference:

`project_docs/archive/ai_chat_decision_output_unification_rollout_completed.md`

## Validation

Run this from the repository root:

`python project_docs/active/agent_council/validate_council_json.py project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json`

## Topic Boundary

This council ranks the next application focus areas from most critical to least critical. It does not implement runtime behavior, frontend UI, backend endpoints, machine learning features, or contract changes.

The council concluded that measurable Decision Intelligence reliability should come before ambitious new features. The highest-priority prompt benchmark and capability/readiness foundation is now complete. The active follow-on direction is semantic model strengthening, then decision correction, observational evidence, active dataset state alignment, ML readiness, and future simulation architecture design.

This differs from `project_docs/active/agent_council/outputs/app-wide-ui-flaws/`, which was about UI correctness and trust before feature work. This topic assumes that cleanup is complete and asks what the application should focus on next.
