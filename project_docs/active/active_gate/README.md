Goal: Make AI Chat a reliable business workspace from grounded questions to reviewable dashboard results.

## User Outcome

Users can start with meaningful data-aware questions, refine verified answers, inspect a dashboard draft and add chosen results without losing existing dashboard content or analytical provenance.

## Scope

**Current Step**: Step 4: Integrated regression verification and contract alignment

**Target Files**: AI Chat, semantic resolver, dashboard and state regression tests; BI/dashboard contracts and governing status.

**Step Acceptance**: Representative integrated journeys, backend regression tests, focused frontend tests, Python compilation, production build and documentation checks pass. Record actual limitations and preserve the user-owned visual acceptance boundary.

**Step Verification**: All commands below, plus relationship execution and semantic-role regressions for the shared resolver.

**Next Step**: Return verified engineering results and limitations to the user in chat.

**Continuation Rule**: CONTINUE through executable steps under explicit backend and frontend authorization.

**Stop Condition**: Engineering acceptance evidence is complete, or a concrete blocker prevents meaningful progress. Browser acceptance belongs to the user in chat.

- [x] **Step 1: Grounded follow-ups and temporal analysis** — [COMPLETED]
- [x] **Step 2: Reviewable dashboard drafts and provenance** — [COMPLETED]
- [x] **Step 3: Chat interaction reliability and presentation** — [COMPLETED]
- [ ] **Step 4: Integrated regression verification and contract alignment** — [IN PROGRESS]

## Contracts

- [BI result, grounding, refinement and session contracts](../contracts/decision_objects.md)
- [Dashboard storage](../contracts/dashboard_canvas_state.md)
- [Workspace identity](../contracts/multiple_data_source_workspace.md)
- [Governed relationships](../contracts/multiple_data_source_relationships.md)
- [AI Chat roadmap](../ai_chat/README.md)

## Acceptance

- Preserve BI answers, charts, tables, artifact inspection and exports; numerical claims come from real analytical execution.
- Test grounded answer, contextual follow-up, ambiguity, draft selection, dashboard addition and recoverable failure journeys using synthetic data.
- Retain metric definitions, aggregation, filters, time grain, dataset identity and multi-source lineage. Do not present snapshots as live refreshable results.
- Preserve `chartStudioDashboard:v1`, its legacy fallback and existing items; avoid duplicate additions.
- Guard duplicate submission, cancellation, stale responses and dataset changes. Preserve recoverable work.
- Keep existing themes, responsive layout and keyboard access. Do not introduce inert controls or unimplemented success states.

## Verification

- `python -m unittest tests.test_decision_chat_service tests.test_decision_chat_workspace -q`
- Compile changed Python modules with `python -m py_compile`.
- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testPathPattern '(features/ai/.*test|features/dashboard/.*test|context/WindowContext.*test|utils/aiDashboard.*test)'`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: Codex, with CONTINUE. Codex implements and reviews the full authorized scope. Return to the user when engineering checks pass, with limitations stated. Preserve ML Studio's pending acceptance. No browser operations are authorized.
