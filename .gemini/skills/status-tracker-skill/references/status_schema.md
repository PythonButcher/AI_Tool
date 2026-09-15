# AI Tool Status Return Schema

The authoritative status file is `project_docs/active/status/project_execution_status.md`.

## Start Conditions

Current Owner must be `Antigravity`. Frontend Readiness must be `backend_contract_ready` or `frontend_repair_only`. The active handoff directory must contain its README and exactly one additional Markdown handoff. The status `Active Handoff` field must name that file.

## Permitted Return Changes

The governed script may set Phase State to `IN PROGRESS`, Current Owner to `Codex`, Automatic Continuation to `CONTINUE`, and describe the returned handoff in What This State Means, Required Action, and Active Handoff.

It must preserve Phase Identity, Current Milestone, Backend Readiness, Frontend Readiness, Active Gate, Authorization Record, Roadmap, Latest Verification, Completion Rule, and the authorization JSON byte-for-byte. It does not edit the active gate or handoff and cannot claim Codex review or browser acceptance.

## Blocked Work

If source work is blocked by a contract mismatch, return the exact evidence in chat without inventing a schema or changing backend truth. Codex decides the next gate or repair handoff.
