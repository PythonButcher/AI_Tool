# Compounding Phase Results Council

## Purpose

This Agent Council topic exists because the current Decision Intelligence implementation plan is producing too many microscopic, hard-to-see slices. Codex and Gemini are shipping backend contracts, frontend renderers, docs, and tests, but the user often cannot easily tell what changed in the product or whether thousands of lines of work were worth it.

The council must restructure the current active plan into a different execution model where each section produces obvious, compounding product results.

## User Problem

The user does not want to keep fighting prompts, phase labels, hidden contracts, and narrow acceptance checks just to see whether a feature exists.

The current flow has too much planning and too little visible payoff per implementation slice. Each step may be technically valid, but the result is not obvious enough in the app.

## Council Question

Given the current active documentation and the app direction, how should the Decision Intelligence roadmap be restructured so every future unit of work produces compounding, visible product results?

The council should not simply rename phases. It should propose a different model for organizing work, acceptance, demos, prompts, UI visibility, backend contracts, Gemini handoffs, and user-facing verification.

## Sources To Review

Required:

`project_docs/INDEX.md`

`project_docs/active/README.md`

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

`project_docs/archive/ai_chat_decision_output_unification_rollout_completed.md`

`project_docs/active/ai_hand_off/README.md`

Optional only if needed:

`project_docs/active/contracts/decision_objects.md`

`project_docs/archive/superseded_active_2026_05_24/phase_4_gemini_frontend_canonical_active_dataset.md`

That Phase 4 handoff is superseded. Current truth is now `project_docs/active/status/decision_intelligence_execution_status.md`.

## What The Council Must Produce

The council must produce a strict JSON artifact matching `project_docs/active/agent_council/council_output_schema.json`.

The final recommendations must include:

- A new work organization model that does not depend on microscopic phase labels.
- A rule that every implementation unit must produce an obvious user-visible result.
- A rule that every backend contract slice must include a demo path or visible frontend proof before it is considered done.
- A way to keep Codex and Gemini ownership intact while improving visible outcomes.
- A proposed replacement for the current Phase 4 path if needed, while preserving the app direction toward trustworthy Decision Intelligence.
- Acceptance criteria focused on what the user can see and verify in the app, not only tests, docs, or hidden contract fields.
- A recommendation for how docs should change after the council result is accepted.

## Boundaries

Do not recommend fake simulation, fake optimization, fake causal claims, autonomous decisioning, or final recommendations.

Do not discard useful completed work. The council may reorganize the path forward, but it should preserve the direction of the app: trustworthy Decision Intelligence, clear dataset truth, semantic grounding, observational analysis, readiness diagnostics, and eventually responsible advanced decision support.

Do not break the Codex/Gemini ownership model. Codex remains backend/contracts/docs/review coordinator. Gemini remains frontend implementer unless the user explicitly authorizes Codex frontend edits.

## Paste-Ready Council Prompt

Run an emergency Agent Council for AI_Tool focused on compounding phase results. Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, the active phase plan, `project_docs/active/ai_hand_off/README.md`, and `project_docs/active/agent_council/outputs/compounding-phase-results/README.md`. The current plan is not working for the user: Codex and Gemini are shipping many technical slices, but the results are too microscopic, too hard to see, and too dependent on fighting prompts or reading docs. Restructure the roadmap into a different model where every unit of work creates obvious, compounding product results. Preserve the app direction toward trustworthy Decision Intelligence and preserve the Codex/Gemini ownership split, but challenge the current phase structure, acceptance criteria, handoff style, demo requirements, and documentation flow. Return JSON only, matching `project_docs/active/agent_council/council_output_schema.json`.
