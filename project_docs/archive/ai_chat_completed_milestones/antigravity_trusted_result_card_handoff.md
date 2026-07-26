> **[COMPLETED REFERENCE ONLY]** This handoff for Slice 2 was successfully executed and verified on 2026-07-18.

Goal: Build a Trusted Result Card for AI Chat answers and charts using the verified backend BI grounding contract.

Target files:
- `frontend/frontend/src/features/ai/AIShell.jsx`
- `frontend/frontend/src/features/ai/AIShell.css`

Read first:
- `project_docs/INDEX.md`
- `project_docs/active/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/active_gate/README.md`
- `project_docs/active/contracts/decision_objects.md`, especially `AI Chat BI Result Contract` and `BI Grounding`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

Backend contract:
Consume `artifact.bi_grounding` from each `answer` or `chart` returned by `POST /api/decision/chat/turns`. Use `bi_grounding.dataset.dataset_name`, `row_count`, `source_row_count`, `freshness.state`, `freshness.as_of`, `cleaning.state`, `metric_definition.label` or `metric_definition.name`, `aggregation`, `dimensions`, `filters`, and `time_period`. Treat `unknown` and `null` as honest backend states. Do not derive trust metadata from chart labels, assistant copy, raw dataset rows, `dataset_trust`, or retired Decision Intelligence objects.

Implementation boundary:
Add one compact trusted-result metadata treatment to the existing answer card, chart preview, and active chart inspector. Keep the current split-pane AI Chat architecture, artifact filtering, PDF export, and `buildBiSessionState` behavior intact. This task does not implement clickable guided exploration, chart-context controls, multimodal output, persistence, export redesign, or any Decision Intelligence UI.

Acceptance checks:
The result card clearly names the dataset and filtered row basis, shows conservative freshness and cleaning state, and displays metric plus aggregation when present. Filtered results distinguish `row_count` from `source_row_count`. Unknown freshness, cleaning, metric, aggregation, or time context renders as unavailable or unknown without invented confidence. Both answer and chart paths use the same normalized renderer or helper so their meanings cannot drift. Existing artifact rendering and export controls remain functional, and no Decision Intelligence artifact type is admitted into `BI_ARTIFACT_TYPES`.

Verification:
Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend/frontend run build`. Provide a concise manual browser checklist for the user covering an unfiltered answer, a filtered answer, and a chart; do not claim browser acceptance on the user's behalf.

Ownership constraints:
Antigravity owns the frontend implementation and frontend documentation updates for this task. Do not modify backend contract fields or reconnect retired Decision Intelligence UI. Stop after this bounded Trusted Result Card behavior is implemented and verified.
