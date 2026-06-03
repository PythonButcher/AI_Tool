# Phase 6 Gemini Handoff: Evidence Board Rendering Alignment

## Purpose

Make Phase 6 complete end-to-end by aligning the Evidence Board rendering in the AI Chat results pane with the verified backend contract.

Backend Phase 6 is complete and the `decision_output.evidence_board` contract is updated. An audit of the frontend `AIShell.jsx` revealed concrete rendering gaps:
1. **Evidence Coverage keys mismatch**: The frontend attempts to render coverage tags using legacy/incorrect keys under `rd.covers` (e.g. `objective_covered`, `levers_covered`, and `constraints_covered`), which are undefined in the backend contract.
2. **Missing coverage types**: The frontend completely ignores breakdowns (`breakdowns`), context roles (`context_roles`), and temporal (`temporal`) coverage.
3. **Missing Data Sufficiency rendering**: The frontend does not render `rd.data_sufficiency` status or its business-facing summary inside the Evidence Board item cards.
4. **Missing Source Diagnostic Trace rendering**: The frontend ignores the `rd.source_diagnostic_id` trace key.

## Backend Truth

The backend composer service `DecisionOutputService` structures the `evidence_board` inside the `decision_output` artifact as follows:

```json
"evidence_board": {
  "status": "analyzed",
  "summary": "Ranked observational evidence is available for this decision frame.",
  "items": [
    {
      "rank": 1,
      "title": "Evidence 1: Revenue",
      "summary": "Revenue increased in the latest observed period...",
      "covers": {
        "goal": true,
        "drivers": [{"metric_id": "metric_revenue_sum", "label": "Revenue"}],
        "limits": [],
        "breakdowns": [],
        "context_roles": ["revenue", "objective"],
        "temporal": true
      },
      "strength": "strong",
      "data_sufficiency": {
        "status": "sufficient",
        "row_count": 1280,
        "has_period_comparison": true,
        "summary": "The diagnostic has enough observed data for descriptive comparison."
      },
      "limitations": [
        "This evidence is observational only; it is not advice, a causal claim..."
      ],
      "source_diagnostic_id": "diagnostic_revenue_shift_2026_06_01",
      "observational_boundary": "observational_analysis_only"
    }
  ],
  "observational_boundary": "observational_analysis_only"
}
```

### Coverage Mapping Details
- `rd.covers.goal` (boolean): `true` if the objective is covered.
- `rd.covers.drivers` (list of dicts): list of covered levers.
- `rd.covers.limits` (list of dicts): list of covered constraints.
- `rd.covers.breakdowns` (list of dicts): list of covered segment dimensions.
- `rd.covers.context_roles` (list of strings): list of role tags matched.
- `rd.covers.temporal` (boolean): `true` if temporal context is covered.

## Evidence From Codex Audit

In `frontend/frontend/src/features/ai/AIShell.jsx`, the Evidence Board renderer map (around lines 1569-1580) uses incorrect, outdated keys:

```javascript
{/* Coverage tags */}
{rd.covers && (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
    {rd.covers.objective_covered && (
      <span className="ai-shell__coverage-tag is-objective">Objective Covered</span>
    )}
    {rd.covers.levers_covered?.map((lev, idx) => (
      <span key={idx} className="ai-shell__coverage-tag is-lever">Lever: {lev}</span>
    ))}
    {rd.covers.constraints_covered?.map((c, idx) => (
      <span key={idx} className="ai-shell__coverage-tag is-guardrail">Limit: {c}</span>
    ))}
  </div>
)}
```

Because the backend returns `goal` (boolean), `drivers` (array of objects), and `limits` (array of objects), none of the existing coverage tags ever render under the new contract. 

Furthermore:
- `rd.data_sufficiency` is completely unreferenced in the `decision_output` renderer.
- `rd.source_diagnostic_id` is completely unreferenced.

## Target Files

- `frontend/frontend/src/features/ai/AIShell.jsx`

## Required Frontend Behavior

1. **Fix Evidence Coverage Rendering**:
   - Objective: Render `"Objective Covered"` when `rd.covers.goal` is `true`.
   - Levers / Drivers: Map over `rd.covers.drivers` (or fallback `rd.covers.levers_covered` if backward-compatibility is desired) and render each lever label (e.g. `lev.label || lev.name`).
   - Limits / Constraints: Map over `rd.covers.limits` (or fallback `rd.covers.constraints_covered`) and render each constraint label (e.g. `lim.label || lim.name`).
   - Breakdowns: Map over `rd.covers.breakdowns` and render breakdown labels (e.g. `bd.label || bd.name`) as a segmentation tag.
   - Context Roles: Map over `rd.covers.context_roles` and render tags.
   - Temporal: Render a `"Temporal Context"` coverage tag when `rd.covers.temporal` is `true`.
2. **Render Data Sufficiency**:
   - Display `rd.data_sufficiency.status` (e.g., in a styled sub-badge or meta-row).
   - Display the business-facing data sufficiency summary `rd.data_sufficiency.summary` in a tooltip or a small card description so the user understands the data quality powering the evidence.
3. **Render Source Diagnostic Trace**:
   - Provide a subtle trace indicator showing `rd.source_diagnostic_id` (e.g., `Source ID: ...`) so users can correlate the evidence with raw underlying diagnostics.

Maintain the existing visual style guidelines (using rich aesthetics, HSL Tailored colors, Micro-animations, Google Fonts, and appropriate badge stylings).

## Acceptance Check

1. Run an AI Chat decision flow that produces an analyzed `decision_output` with an `evidence_board`.
2. Verify that:
   - Rank, title, strength, and summary render correctly.
   - Coverage tags appear representing the objective, levers, limits, breakdowns, context roles, and temporal coverage.
   - Data sufficiency status and summary are visible and formatted beautifully.
   - Caveats / limitations list all elements from `rd.limitations` separated by bullet characters.
   - The trace `source_diagnostic_id` is subtly visible on the evidence card.

## Verification Commands

Run:
`npm --prefix frontend\frontend run build`

Run:
`git diff --check`

## Status Update Requirement

After implementation and verification, Gemini must update `project_docs/active/status/decision_intelligence_execution_status.md`. Update the Phase 6 gate to indicate that frontend display rendering has been aligned and verified end-to-end.
