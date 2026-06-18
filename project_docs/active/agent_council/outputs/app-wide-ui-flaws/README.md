# App-Wide UI Flaws Council Topic

## Purpose

This folder contains the Agent Council artifacts for the app-wide UI flaws cleanup that prepared a Gemini frontend hardening pass.

Each council topic should own its own folder under `project_docs/active/agent_council/outputs/`. Keep the council output, derived handoffs, review notes, and follow-up prompts together here instead of mixing topic-specific files with the reusable council framework.

## Status

Accepted as done.

Codex review found no blocking findings in Gemini's final pass. The remaining caveat is that no frontend test files exist for this project yet, so the final acceptance relied on build verification, source review, copy search, contract alignment, and Gemini's documented manual checks.

This topic is historical and must not be used as a current Gemini implementation prompt. Current Decision Intelligence truth is routed by `project_docs/active/status/decision_intelligence_execution_status.md`; completed rollout details live in `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md`.

## Artifacts

Council JSON:

`project_docs/active/agent_council/outputs/app-wide-ui-flaws/2026-04-28-gemini-council.json`

Gemini handoff:

`project_docs/active/agent_council/outputs/app-wide-ui-flaws/gemini_handoff.md`

## Validation

Run this from the repository root:

`python project_docs/active/agent_council/validate_council_json.py project_docs/active/agent_council/outputs/app-wide-ui-flaws/2026-04-28-gemini-council.json`

## Topic Boundary

This topic is about UI correctness and trust before new feature work. It covered AI action state, truthful capability language, inspectability, inert AI shell surfaces, semantic recovery, accessibility, and verification. Its old chat-to-Decisions continuity guidance is superseded by the current AI Chat-first decision output direction.
