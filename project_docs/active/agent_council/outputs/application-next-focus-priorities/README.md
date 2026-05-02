# Application Next Focus Priorities Council Topic

## Purpose

This folder contains the Agent Council artifacts for deciding what AI_Tool should focus on next after the Phase 4.5 Decision Intelligence hardening and the app-wide UI flaw cleanup.

This topic is intentionally broader than the previous UI flaws council. It evaluates backend, frontend, semantic model, machine learning readiness, Decision Intelligence reliability, data workflow, testing, contracts, and product coherence. The goal is a ranked implementation direction, not a narrow Gemini cleanup pass.

## Status

Council run completed and saved.

## Artifacts

Council JSON:

`project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json`

## Validation

Run this from the repository root:

`python project_docs/active/agent_council/validate_council_json.py project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json`

## Topic Boundary

This council ranks the next application focus areas from most critical to least critical. It does not implement runtime behavior, frontend UI, backend endpoints, machine learning features, or contract changes.

The council concluded that the next work should strengthen measurable Decision Intelligence reliability before adding ambitious new features. The highest-priority direction is a Codex-owned prompt benchmark and capability/readiness contract foundation, followed by semantic model strengthening, decision correction, observational evidence, active dataset state alignment, ML readiness, and future simulation architecture design.

This differs from `project_docs/active/agent_council/outputs/app-wide-ui-flaws/`, which was about UI correctness and trust before feature work. This topic assumes that cleanup is complete and asks what the application should focus on next.
