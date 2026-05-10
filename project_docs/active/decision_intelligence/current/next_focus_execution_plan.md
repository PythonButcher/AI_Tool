# Decision Intelligence Next Focus Execution Plan

## Purpose

This plan converts the Agent Council output at `project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json` into an active execution path.

This plan does not require the project to start this work immediately. It exists so the next agent can pick a direction cleanly when the user decides to proceed.

## Current Decision

The council recommends measurable Decision Intelligence reliability before broad feature expansion.

The strongest next path is:

1. Build a reliability benchmark and capability/readiness boundary. Completed.
2. Strengthen semantic role detection and confidence. Active next.
3. Add correction and richer observational evidence.
4. Align active dataset truth across surfaces.
5. Add ML readiness diagnostics.
6. Design future simulation and trade-off contracts without implementing simulation.

## Non-Goals

Do not add simulation, optimizer, autonomous decisioning, final recommendation, or goal-seeking behavior.

Do not start with a broad frontend shell rewrite.

Do not add stronger ML outputs before readiness diagnostics and evaluation data exist.

Do not make weak semantic mappings look certain.

Do not treat ranked observational evidence as ranked recommendations.

## Recommended Execution Order

| Phase | Owner | Status | Source Recommendation | Objective |
| --- | --- | --- | --- | --- |
| 1 | Codex and Gemini | Complete | `rec-decision-reliability-foundation` | Add prompt benchmark fixtures, grading checks, additive capability/readiness fields, and frontend rendering of reliability truth. |
| 2 | Codex | Active next | `rec-semantic-model-role-strengthening` | Add decision-aware semantic roles, confidence, aliases, polarity, controllability, and unresolved mapping details. |
| 3 | Codex first, Gemini after backend contract stabilizes | Later | `rec-decision-frame-correction-loop`, `rec-ranked-observational-evidence` | Add frame correction actions and richer ranked observational evidence. |
| 4 | Codex planning, Gemini frontend implementation | Later | `rec-canonical-active-dataset-contract` | Define and implement one active dataset source of truth across AI chat, Decisions, charts, dashboards, and workflows. |
| 5 | Codex | Deferred | `rec-decision-context-ml-readiness` | Add ML readiness diagnostics without producing predictions or recommendations. |
| 6 | Codex | Deferred design only | `rec-future-simulation-contract-design` | Design future simulation/trade-off contracts without runtime simulation or frontend claims. |

## Phase 1: Reliability Foundation

Phase 1 is complete. It remains here as a completed reference because later phases should keep using the benchmark suite and readiness/capability contract as regression coverage.

May 9, 2026 completion note: Phase 1 now has a Python unittest benchmark suite at `tests/test_decision_reliability_benchmark.py` backed by fixtures in `tests/decision_reliability_benchmark_cases.py`. Backend decision responses include additive readiness and capability truth fields. Gemini frontend integration is complete and verified for object-path normalization, response-level state preservation, and capability merging. The benchmark and workspace tests pass in the bundled Codex Python runtime. The existing Flask route-level chat test could not run in the current non-escalated runtime because Flask is not visible there; system Python also cannot see dependencies inside the sandbox.

The goal is to make prompt-first Decision Intelligence measurable. The system should no longer rely on a few manually verified prompts. It should have a repeatable benchmark that checks extraction, readiness, allowed actions, and forbidden claims.

Work should include a named prompt suite with at least 20 realistic prompts. The suite should cover complete decision prompts, incomplete prompts, ambiguous objectives, guardrail-only prompts, segment-only prompts, normal analytics questions, unsupported simulation or optimization requests, and truthfulness-note behavior.

Each benchmark case should define expected mode, objective, levers, guardrails, segments, horizon, readiness state, allowed actions, disabled or blocked actions, expected missing inputs, and forbidden claims.

Backend response changes should be additive. New readiness/capability fields should distinguish structural readiness, observational-only analysis, blocked state, unsupported capability, allowed next action, and not-ready-for-recommendation state. Existing endpoint names, action IDs, artifact types, and frontend-compatible fields should not be renamed.

Primary files to inspect:

| Area | Path |
| --- | --- |
| Chat tests | `tests/test_decision_chat_service.py` |
| Workspace tests | `tests/test_decision_workspace_service.py` |
| Chat service | `backend/decision_engine/` |
| Workspace service | `backend/services/decision_workspace_service.py` |
| Contract docs | `project_docs/active/contracts/decision_objects.md` |

Exit criteria:

The benchmark can be run repeatably.

Existing decision chat and workspace tests still pass.

Decision responses include additive readiness/capability truth fields.

Unsupported simulation, optimization, autonomous decisioning, and final recommendation requests remain truthful and limited.

## Phase 2: Semantic Role Strengthening

Phase 2 is the active next implementation slice. The detailed plan lives at `project_docs/active/decision_intelligence/current/phase_2_semantic_role_strengthening_plan.md`.

The benchmark should become the measuring stick for semantic improvements.

The goal is to improve how the system identifies objective candidates, lever candidates, guardrail candidates, segment dimensions, temporal fields, polarity, controllability, aliases, business terms, confidence, and unresolved mappings.

This phase should stay backend-first. Frontend work should wait until backend fields are stable enough for Gemini to render uncertainty and recovery paths without guessing.

Exit criteria:

Semantic model output includes additive decision role hints and confidence metadata.

Prompt-first intake uses semantic roles without breaking existing behavior.

Ambiguous mappings can trigger clarification or review instead of silent weak selection.

Semantic collision, no-safe-match, missing metric, guardrail-only, and segment-only tests pass.

## Phase 3: Correction And Ranked Observational Evidence

Phase 3 should add trust controls after semantic roles and readiness fields are stable.

The correction loop should let users fix objective, lever, segment, guardrail, and horizon interpretation before analysis. Corrections should update session state and downstream analysis deterministically.

Ranked observational evidence should deepen `Analyze workspace` outputs with scoped diagnostics, evidence, confidence, assumptions, blockers, semantic coverage, data-quality caveats, and limitations.

This phase likely needs a Gemini handoff after backend contracts are ready.

Exit criteria:

Backend correction actions update each frame element deterministically.

Analysis uses corrected state.

Analyze workspace returns ranked scoped diagnostics with evidence and limitations.

The UI, when handed to Gemini, does not imply final recommendation, simulation, or optimization.

## Phase 4: Canonical Active Dataset Contract

Phase 4 should align dataset truth across app surfaces. It should not become a broad shell rewrite.

The goal is one canonical active dataset selector and precedence rule for AI chat, Decisions, charts, dashboards, workflows, filters, cleaned data, uploaded data, and semantic model consumers.

Codex should define the contract and assumptions. Gemini should implement frontend changes after a scoped handoff.

Exit criteria:

One dataset precedence rule is documented.

Major surfaces use the same active dataset unless explicitly overridden.

Dataset metadata includes source, dataset ID where available, row count, column count, and transform state where available.

Existing AI Chat, Decisions, charts, dashboards, and cleaning flows still work.

## Phase 5: ML Readiness Diagnostics

Phase 5 prepares stronger ML responsibly. It should not emit predictions, recommendations, causal claims, or optimization output.

The readiness diagnostic should report target suitability, feature suitability, row-count adequacy, leakage warnings, validation strategy, metric choice, explainability needs, and not-ready reasons.

Exit criteria:

A decision workspace can request ML readiness diagnostics.

Missing target, too-few-rows, leakage-prone features, weak semantic target, temporal leakage, and unsupported objective cases are tested.

The response is explicit when ML is not ready.

## Phase 6: Simulation And Trade-Off Design Only

Phase 6 is design-only until the user explicitly approves implementation.

The design should define simulation prerequisites, request schema, response schema, causal assumptions, lever elasticity, uncertainty bands, guardrail evaluation, refusal states, and UI truth boundaries.

Exit criteria:

A design document exists.

The current observational and direct-adjustment behavior remains clearly separate from future causal simulation.

No runtime simulation feature or UI claim is added.

## Open Decisions Before Implementation

The council left four useful choices open.

| Question | Recommended Default |
| --- | --- |
| Benchmark fixture format | Use Python test fixtures first, with optional JSON fixture export if reuse by Gemini becomes valuable. |
| Semantic confidence thresholds | Start conservative. Low confidence should trigger clarification or review instead of silent mapping. |
| Frontend test ownership | Codex should stabilize backend tests first. Gemini can add formal React tests when frontend contracts are stable. |
| Dashboard decision follow-through | Defer until reliability, semantic roles, and active dataset state are stable. |

## Current Slice Prompt For Codex

Implement Phase 2 from `project_docs/active/decision_intelligence/current/phase_2_semantic_role_strengthening_plan.md`. Keep it backend-first. Add additive decision-aware semantic role metadata, conservative confidence, unresolved mapping details, and tests that protect against semantic false confidence. Update the decision object contract and active status docs truthfully. Do not edit frontend files unless explicitly authorized.

