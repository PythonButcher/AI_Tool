# Project Execution Status

This file is the single current source of truth for active AI_Tool delivery.

## Project Control

- **Lead Orchestrator**: Codex
- **Backend and Contract Owner**: Codex
- **Backend Implementation Delegate**: Claude, one bounded handoff at a time
- **Document Studio UI Delivery Owner**: Gemini, only after backend readiness and from one bounded handoff
- **Browser Acceptance Owner**: User

## Current Gate: Document Studio Contracts And Local Records

- **Roadmap Phase**: Phase 12 — Document Studio Foundation
- **Status**: Repair required; Claude must enforce the UTC timestamp contract and return focused evidence
- **Backend Readiness**: `implementation_required`
- **Frontend Readiness**: `blocked_backend_first`
- **Current Owner**: Codex
- **Implementation Delegate**: Claude
- **Next Action**: Execute `project_docs/active/active_gate/README.md`
- **Active Gate**: `project_docs/active/active_gate/README.md`
- **Roadmap**: `project_docs/active/document_studio/README.md`
- **Active Backend Handoff**: `project_docs/active/ai_hand_off/document_studio_claude_contracts_local_records.md`
- **Latest Verified Fact**: The standalone FastAPI package, application factory, exact health contract, and five focused tests passed Codex review.
- **Review Blocker**: Domain records accept non-UTC timezone offsets even though every `created_at` field is contracted as UTC.

## Roadmap Outcome

Document Studio runs independently inside the repository, extracts structured information from supported documents with confidence and evidence, and remains reusable by AI_Tool or future platforms through stable backend contracts.

## Control Return

Claude executes only the active backend handoff, reports changed files and verification evidence, and stops. Codex reviews the implementation before another backend chunk or any Gemini frontend handoff is activated.
