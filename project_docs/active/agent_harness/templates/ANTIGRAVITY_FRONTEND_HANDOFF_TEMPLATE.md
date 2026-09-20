# [Slice Name] — Antigravity Frontend Handoff

Goal: [State one independently reviewable user outcome for one React slice.]

## Readiness Evidence

**Frontend Readiness**: `[backend_contract_ready | frontend_repair_only]`

[Cite the focused backend tests, endpoint or service evidence, contract, and fixture source that prove readiness. For a repair, add `REPAIR REQUIRED` above this section and a `## Repair Blocker` section naming the exact file, observed defect, expected behavior, and evidence.]

## Required Context

- Active gate: `project_docs/active/active_gate/README.md`
- Execution status: `project_docs/active/status/project_execution_status.md`
- Authorization record: `project_docs/active/status/phase_authorization.json`
- Frontend guardrail: `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- Contract: `[exact active contract path]`
- Source evidence: `[small exact path list]`

Remove placeholders and unrelated references before issuing the handoff.

## Scope And Target Files

This handoff covers `[one view or one to two tightly coupled components]` and one coherent API or state boundary.

Target files:

- `[exact React source path]`
- `[exact focused test path]`

**Required Change Coverage**: `[all target files | only the named required subset]`

**Maximum Diff Lines**: `[25-1000, sized to the bounded task]`

**Inline Styles**: `[forbidden | allowed only for named dynamic values]`

Excluded files and behavior:

- `[adjacent UI or API work]`
- Backend, contracts, authorization, gate, readiness, persistence, and browser acceptance.

If the outcome requires another independent view, persistence migration, export path, or broad API-client rewrite, stop and return the scope mismatch to Codex.

## Proven API Contract

State every endpoint's method, path, path/query parameters, headers, request body, success status, success response, and applicable safe error responses. Include copy-ready TypeScript for exact enums, nullability, request, success, and error types. Do not use prose in place of interfaces and do not invent server behavior.

## Representative JSON Fixtures

Provide exact, realistic JSON for:

- Success with representative data.
- Empty success.
- Every applicable validation, permission, not-found, conflict, and server error.

Fixtures must match the proven backend response and TypeScript types exactly.

## Required UI States

Provide a compact wireframe or precise layout description for:

- Loading, including disabled actions or skeleton placement.
- Empty, including helpful copy and the available action.
- Error, including safe message placement and retry behavior.
- Success, including primary, secondary, and danger actions.
- Form validation and asynchronous pending state when applicable.
- Conflict or stale-data reconciliation when applicable.

## State Ownership

Server state: name query keys, mutations, invalidation/update timing, and retry rules. Do not copy API records into local state.

Local UI state: name only ephemeral state such as open panels, unsaved form fields, or local selections.

URL state: name bookmarkable filters, tabs, or pagination parameters plus defaults, invalid values, and back/forward behavior.

Asynchronous job state: name polling, cancellation, terminal states, stale-response guards, and which server fields remain authoritative.

## Non-Negotiables

- Use the exact API contract, fixtures, state boundaries, and target files.
- Render all required states with accessible names, keyboard behavior, visible focus, pending protection, and announced errors.
- Never infer authorization, identity, permissions, or hidden records on the client.
- Do not modify backend, active gate, authorization, readiness, contracts, or any `GEMINI.md` file.
- Use reviewable editor operations only. Never bulk-rewrite source or use Git restore/reset commands. If a target becomes empty or unexpectedly smaller, stop and return the incident without attempting reconstruction.
- Preserve existing AI Chat and data-workspace behavior outside the slice.

## Creative Latitude

Antigravity may choose component composition, spacing, typography, restrained motion, accessible control treatment, micro-interactions, and concise copy within the existing design system when those choices preserve the contract and required hierarchy.

## Acceptance Checklist

- [ ] The exact success and empty payloads render correctly.
- [ ] Loading, empty, error, success, validation, pending, and applicable conflict states are covered.
- [ ] Server, local, URL, and asynchronous state remain explicitly separated.
- [ ] Accessible names, keyboard interaction, focus, duplicate-submit prevention, and error announcements are verified.
- [ ] No excluded path or undocumented backend assumption was added.

## Verification And Stop Point

Run:

- `[exact focused frontend test command]`
- `npm --prefix frontend/frontend run build`
- `git diff --check`
- `git diff --name-only`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff HANDOFF_FILE --summary "CONCISE EVIDENCE"`

The governed return command rejects missing or empty targets, suspicious shrinkage, out-of-scope frontend files, missing required changes, forbidden inline styles, whitespace errors, and a return with no durable source diff. Return the exact changed-file list, each command and exit result, a concise evidence summary, and any contract mismatch, then stop for Codex review. Do not begin adjacent work or claim browser acceptance.
