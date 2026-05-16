# AI Hand-Off

This folder is the active coordination space for Codex and Gemini handoffs.

Codex is the application organizer and backend owner. Codex owns backend logic, contracts, tests, architecture decisions, status documentation, and final coordination judgment. The user and Codex review Codex backend work together before accepting it as product truth.

Gemini owns frontend implementation. Gemini must do React, CSS, UI rendering, browser verification, and frontend build work unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Handoffs

| Handoff | Owner | Status |
| --- | --- | --- |
| `phase_2_5_gemini_frontend_segment_dimensions.md` | Gemini frontend | Ready for Gemini |

## Rules

Codex writes backend and contract truth first, then writes the Gemini handoff when frontend work is needed.

Gemini must not change backend files. If Gemini finds missing backend behavior, Gemini should document it in the status docs and stop for Codex review.

Gemini must preserve existing features and workflows. Do not hide, remove, downgrade, disable, de-scope, or retire visible capability unless the user explicitly approves it.

Codex has final say on sequencing and acceptance. Gemini implements the frontend slice described in the handoff, verifies it, and updates active status docs truthfully.

## Historical Examples

Historical handoff examples live under `project_docs/archive/ai_handoff_legacy/`. They are examples only. Do not treat archived wording as current truth.
