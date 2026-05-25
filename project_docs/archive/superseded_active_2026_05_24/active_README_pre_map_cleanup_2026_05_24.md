# Active Documentation Navigation

This is the first active documentation page after `project_docs/INDEX.md`.

Its job is to stop agents from scanning old plans, completed handoffs, and archive material by accident. If another document conflicts with this navigation file or the active status file, this navigation file and the status file win.

## Current Scan Path

| Step | Read | Why |
| --- | --- | --- |
| 1 | `project_docs/active/status/decision_intelligence_execution_status.md` | Current project truth, current phase state, and next recommended work. |
| 2 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` | Ownership boundary: Codex does backend/contracts/docs; Gemini owns frontend unless explicitly reauthorized. |
| 3 | `project_docs/active/codex_harness_engineering.md` | Codex-specific efficiency rules for substantial repo work. |
| 4 | `project_docs/active/agent_council/outputs/application-next-focus-priorities/README.md` | Current next-focus decision after Phase 4.5 hardening. |
| 5 | `project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json` | Detailed ranked recommendations for the next work. |
| 6 | `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md` | Completed backend-first semantic frame completion plan. |
| 7 | `project_docs/active/ai_hand_off/README.md` | Codex/Gemini handoff folder and ownership rules. |
| 8 | `project_docs/active/ai_hand_off/phase_2_5_gemini_frontend_segment_dimensions.md` | Completed Gemini frontend handoff record for Phase 2.5 segment rendering. |
| 9 | `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md` | Council-derived roadmap and Phase 4 canonical active dataset sequencing. |
| 10 | `project_docs/active/ai_hand_off/phase_4_gemini_frontend_canonical_active_dataset.md` | Active Phase 4 Gemini frontend handoff. |
| 11 | `project_docs/active/contracts/decision_objects.md` | Current backend/frontend decision object contract reference. |

Do not start by reading every file in `project_docs/active/decision_intelligence/`. That folder now has a README plus `current/` and `completed/` subfolders. Read the README first and open only the specific file needed.

For Gemini frontend reviews, use the fast path in `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`: targeted contract search and focused diff first, no repeated build or browser pass unless the first pass finds a concrete reason.

## Response Clarity Rule

Project rollout plans must be written in plain language. Use short phase names, explain one purpose at a time, and avoid dense shorthand that hides the actual decision. If a plan mentions a technical concept such as CDD, causal diagrams, Decision Map, canonical dataset, gates, or dashboard state, define what it means in the same paragraph.

When the user asks for a rewritten plan, keep the structure easy to scan: what we build first, what we build next, what Gemini owns, what Codex owns, what proves the phase works, and what is intentionally deferred.

## Current Project Truth

Decision Intelligence V3 is the active product line. Phase 4.5 AI Chat hardening is complete. The app has a real backend chat contract, grounded `ask`, `explore`, and `decide` modes, real action handling, chat-to-Decisions continuity, truthful observational-analysis language, and improved artifact rendering.

Phase 1 reliability foundation is complete. Phase 2 semantic metadata plumbing is implemented, and Gemini frontend integration is functionally in place. Phase 2.5 semantic frame completion is complete and verified on the backend and frontend. The opened Decisions workspace renders `decision_scope.segment_dimensions` as first-class decision-frame information. Phase 3 backend correction actions and ranked observational evidence are implemented and verified, and Gemini frontend rendering for Correction Results and Ranked Observational Evidence is complete as of May 22, 2026. The next active roadmap item is Phase 4: Canonical Active Dataset Contract.

## Documentation Areas

| Area | Location | Default Action |
| --- | --- | --- |
| Current status | `project_docs/active/status/` | Read first for active truth. |
| Codex harness | `project_docs/active/codex_harness_engineering.md` | Read for substantial Codex repo work before large source reads or noisy verification. |
| Rules | `project_docs/active/rules/` | Read when ownership or frontend scope matters. |
| Current council decision | `project_docs/active/agent_council/outputs/application-next-focus-priorities/` | Read when choosing next work. |
| Emergency compounding-results council | `project_docs/active/agent_council/outputs/compounding-phase-results/` | Read when restructuring the roadmap around visible, compounding product outcomes. |
| Contracts | `project_docs/active/contracts/` | Read when touching backend response shape, frontend consumption, or Gemini handoff. |
| AI handoff | `project_docs/active/ai_hand_off/` | Active Codex/Gemini handoff records and ownership rules. |
| Decision Intelligence docs | `project_docs/active/decision_intelligence/` | Do not bulk scan. Use `current/` for active docs and `completed/` only for reference. |
| Reviews | `project_docs/active/reviews/` | Read only when the task touches the reviewed area. |
| Archive | `project_docs/archive/` | Do not scan unless an active doc explicitly points there or the user asks for historical context. |

## Current Next Work

The Phase 3 Gemini frontend handoff at `project_docs/active/ai_hand_off/phase_3_gemini_frontend_correction_and_ranked_evidence.md` is complete. The active Phase 4 Gemini handoff is `project_docs/active/ai_hand_off/phase_4_gemini_frontend_canonical_active_dataset.md`.

## Do Not Scan By Default

Do not scan `project_docs/archive/`.

Do not scan `project_docs/active/decision_intelligence/completed/` unless the current task specifically asks for completed plans, historical implementation details, or frontend handoff review.

Do not treat old Phase 4 checklist items as current truth if they conflict with `project_docs/active/status/decision_intelligence_execution_status.md`.

Do not treat the Agent Council sample JSON as a live council result.
