# AI Hand-Off

This folder is the active coordination space for Codex and Gemini handoffs.

Codex is the application organizer and backend owner. Codex owns backend logic, contracts, tests, architecture decisions, status documentation, and final coordination judgment. The user and Codex review Codex backend work together before accepting it as product truth.

Gemini owns frontend implementation. Gemini must do React, CSS, UI rendering, browser verification, and frontend build work unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Handoffs

| Handoff | Owner | Status |
| --- | --- | --- |
| `phase_4_gemini_frontend_canonical_active_dataset.md` | Gemini frontend | Active next |
| `phase_3_gemini_frontend_correction_and_ranked_evidence.md` | Gemini frontend | Complete |
| `phase_2_5_gemini_frontend_segment_dimensions.md` | Gemini frontend | Complete |

## Rules

Codex writes backend and contract truth first, then writes the Gemini handoff when frontend work is needed.

Gemini must not change backend files. If Gemini finds missing backend behavior, Gemini should document it in the status docs and stop for Codex review.

Gemini must preserve existing features and workflows. Do not hide, remove, downgrade, disable, de-scope, or retire visible capability unless the user explicitly approves it.

Codex has final say on sequencing and acceptance. Gemini implements the frontend slice described in the handoff, verifies it, and updates active status docs truthfully.

## Codex Review Budget

When Codex reviews Gemini frontend work, keep the pass narrow:

- Read the active handoff and status truth.
- Inspect only changed frontend files named by the handoff or Gemini summary.
- Use targeted searches for the specific contract fields under review.
- Do not rerun the frontend build when Gemini already reported a successful build unless Codex finds a likely syntax/import defect or the user asks for build verification.
- Do not turn acceptance review into a broad source audit or browser QA pass unless the handoff explicitly requires browser evidence and Gemini did not provide it.

The output should be short: acceptance label first, only actionable findings, then a concise Gemini prompt if a fix is needed.

## Historical Examples

Historical handoff examples live under `project_docs/archive/ai_handoff_legacy/`. They are examples only. Do not treat archived wording as current truth.
