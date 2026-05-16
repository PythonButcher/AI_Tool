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
| 6 | `project_docs/active/pdf_export_unification_plan.md` | Active PDF export remediation plan before Phase 2.5. |
| 7 | `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md` | Next implementation plan after PDF export acceptance. |
| 8 | `project_docs/active/decision_intelligence/current/phase_3_correction_and_observational_evidence_plan.md` | Deferred next plan after Phase 2.5 is complete. |
| 9 | `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md` | Council-derived roadmap and later-phase sequencing. |
| 10 | `project_docs/active/contracts/decision_objects.md` | Current backend/frontend decision object contract reference. |

Do not start by reading every file in `project_docs/active/decision_intelligence/`. That folder now has a README plus `current/` and `completed/` subfolders. Read the README first and open only the specific file needed.

## Current Project Truth

Decision Intelligence V3 is the active product line. Phase 4.5 AI Chat hardening is complete. The app has a real backend chat contract, grounded `ask`, `explore`, and `decide` modes, real action handling, chat-to-Decisions continuity, truthful observational-analysis language, and improved artifact rendering.

Phase 1 reliability foundation is complete. Phase 2 semantic metadata plumbing is implemented, and Gemini frontend integration is functionally in place, but May 14 PDF review showed the active prompt-first decision frame still drops or misclassifies key semantic roles. App-wide PDF export remediation is active first because the Decisions workspace export still does not match the visible workspace window closely enough. Phase 2.5 semantic frame completion resumes after PDF export acceptance. Phase 3 correction and ranked observational evidence is deferred until Phase 2.5 is complete.

## Documentation Areas

| Area | Location | Default Action |
| --- | --- | --- |
| Current status | `project_docs/active/status/` | Read first for active truth. |
| Codex harness | `project_docs/active/codex_harness_engineering.md` | Read for substantial Codex repo work before large source reads or noisy verification. |
| Rules | `project_docs/active/rules/` | Read when ownership or frontend scope matters. |
| Current council decision | `project_docs/active/agent_council/outputs/application-next-focus-priorities/` | Read when choosing next work. |
| Contracts | `project_docs/active/contracts/` | Read when touching backend response shape, frontend consumption, or Gemini handoff. |
| Decision Intelligence docs | `project_docs/active/decision_intelligence/` | Do not bulk scan. Use `current/` for active docs and `completed/` only for reference. |
| Reviews | `project_docs/active/reviews/` | Read only when the task touches the reviewed area. |
| Archive | `project_docs/archive/` | Do not scan unless an active doc explicitly points there or the user asks for historical context. |

## Current Next Work

The next implementation slice should be PDF export remediation, using `project_docs/active/pdf_export_unification_plan.md`. Decision Workspace export fidelity is the first blocker: the PDF must be formatted much closer to the visible workspace results in the window. Phase 2.5 semantic frame completion remains documented at `project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md` and resumes after PDF export acceptance. Broader unrelated frontend cleanup still belongs to Gemini unless the user explicitly authorizes it.

Good first files for that slice are `frontend/frontend/src/utils/appPdfExport.js`, `frontend/frontend/src/utils/decisionPdfExport.js`, `frontend/frontend/src/utils/pdfReportExport.js`, `frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`, `frontend/frontend/src/features/business/decision/DecisionWorkspace.css`, `frontend/frontend/src/features/ai/AIShell.jsx`, `frontend/frontend/src/features/ai/AIShell.css`, and the existing PDF export entry points for charts, Data Story, workflow reports, and file export.

## Do Not Scan By Default

Do not scan `project_docs/archive/`.

Do not scan `project_docs/active/decision_intelligence/completed/` unless the current task specifically asks for completed plans, historical implementation details, or frontend handoff review.

Do not treat old Phase 4 checklist items as current truth if they conflict with `project_docs/active/status/decision_intelligence_execution_status.md`.

Do not treat the Agent Council sample JSON as a live council result.
