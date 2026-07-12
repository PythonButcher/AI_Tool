> REJECTED GATE CONCLUSION: The user rejected using this audit to hold Phase 4 open. The technical observations remain historical input, but PDF/export work belongs outside the wrapped Phase 4 gate.

# Advanced Readiness System Audit

Date: 2026-07-11

## Verdict

The current gate is not ready for browser acceptance or phase closure. The React surface compiles and the backend contract tests pass, but the product path does not yet connect Advanced Readiness to the real model lifecycle, and the Decision Output PDF is neither contract-complete nor visually clean.

The automated project documentation audit and agent harness check pass because the files are structurally consistent. The phase model is still confusing in practice because multiple implementation cycles reuse the same phase numbers. The active council sequence calls Advanced Readiness priority 4, while completed records from other sequences also use Phase 4, Phase 5, and Phase 6 without a cycle-qualified label.

## Findings

| Severity | Finding | Evidence | Required correction |
| --- | --- | --- | --- |
| High | Live prediction readiness is not connected to AutoML or ML Prep results. | AutoML training returned HTTP 200 with a run ID and Linear Regression model for the same 60-row dataset, but the following Decision Chat response still classified prediction as `limited` and exposed no model evidence. `model_evaluation` is accepted by `DecisionOutputService.compose` but no live Decision Chat caller supplies it. | Define a trusted, dataset-matched model-evaluation source and pass it through the live Decision Chat path, or remove the reachable `supported` claim until that bridge exists. Reuse real ML Prep and AutoML evidence instead of relying only on row count, semantic readiness, governance status, and a target label. |
| High | The PDF omits the new Advanced Readiness contract. | The live `decision_output` contained `advanced_readiness`, but its eleven `export_sections` did not include it. The saved-asset export endpoint also returns only those sections and omits `advanced_readiness`. | Add a backend-owned Advanced Readiness export section with capability states, reasons, evidence, missing requirements, safe next steps, and the observational boundary. Preserve it in saved snapshot export responses. |
| High | The generated PDF has a visible label collision. | In the rendered Truth Boundary page, `READY FOR FINAL RECOMMENDATION` overlaps the value `No`. `writePdfKeyValues` uses a fixed 126-point label column and does not wrap or resize long labels. | Make key-value layout measure or wrap labels and reserve adequate value-column space. Add a PDF render regression check for long labels. |
| Medium | PDF content contains avoidable duplication. | Evidence Board empty-state text appears twice because both empty `items` and empty `cards` render the same `emptyText`. Goal, driver, breakdown, and assumption cards often repeat identical title and body text. | Render one empty state per section and suppress card bodies that duplicate titles. |
| Medium | Export readiness is too shallow. | `command_center.export_readiness.ready` was `true` even though Advanced Readiness was absent and the produced PDF contained layout defects. Backend checks only require non-empty section ID, title, and body; saved-asset metadata uses only `bool(export_sections)`. | Validate required section IDs and contract completeness. Treat layout QA as a separate verified gate rather than equating non-empty sections with a ready executive export. |
| Medium | Phase numbering is technically consistent but operationally ambiguous. | The current council priority sequence labels this work as item 4, while the completed 11-phase rollout and other Decision Intelligence V3 records also contain Phase 4/5/6 files. Active status lists these together without a cycle identifier. | Replace bare phase labels in active truth with a cycle-qualified gate name or a standalone product gate name. Keep historical filenames unchanged, but stop making the user infer which numbering system is active. |
| Medium | Frontend and PDF behavior lack automated regression coverage. | No frontend test or spec file covers `DecisionCommandCenter`, `advanced_readiness`, `decisionPdfExport`, or `exportStructuredPdf`. Backend tests verify section data but not the generated PDF. | Add focused frontend adapter tests and a stable PDF-generation/render audit that checks required text, duplicate fallbacks, label fit, page count, and truth-boundary content. |
| Low | The saved-asset export API and visible PDF path are disconnected. | The backend exposes `GET /api/decision/assets/<asset_id>/export`, but the frontend saved-library flow reopens the stored `decision_output` and generates PDF locally; no frontend caller uses the export endpoint. | Choose one canonical saved-export path, document it, and test it end to end. Remove or clearly classify the other path as metadata/API support. |

## Verification Evidence

The full focused backend audit passed 92 tests across Decision Chat, workspaces, corrections, graph, pipeline, reliability benchmarks, saved assets, governance, semantic roles, and Advanced Readiness. The production React build succeeded with existing lint and bundle-size warnings. `git diff --check`, the project documentation audit, and the agent harness check passed.

A representative Decision Output PDF was generated through the repository's real backend export sections and structured jsPDF renderer. It produced three letter-sized pages. Visual inspection confirmed the missing Advanced Readiness section, duplicated empty-state and card text, the Truth Boundary label collision, and an under-filled final page. The rendered PDF and page images were retained with the session's visualization artifacts for review.

## Gate Decision

Backend and frontend compilation are healthy, but the product gate is repair-required. Codex owns the next backend and contract correction. Frontend PDF repair should not be handed off until the backend export contract includes the missing readiness content and the canonical saved-export path is settled. User browser acceptance should resume only after those repairs pass source, build, PDF render, and focused regression review.
