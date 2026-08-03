# AI Chat Readable Filter Labels

REPAIR REQUIRED

## Repair Blocker

`frontend/frontend/src/features/ai/AIShell.jsx` renders `artifact.bi_grounding.filters[].field` as the visible filter name inside `TrustedResultCard`. Cross-source fields are intentionally qualified machine identities, so this currently exposes text such as `hardware_inventory_5000_csv.Category` even when the backend supplies the business-readable `label: "Inventory Category"`.

Goal: Make the AI Chat trusted-result filter summary render the backend business label while preserving compatibility with filters that do not yet carry one.

## Target File

Edit only `frontend/frontend/src/features/ai/AIShell.jsx` unless a directly required adjacent frontend test already exists and needs a focused expectation update.

## Required Context

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/active_gate/README.md`, and `project_docs/active/contracts/multiple_data_source_workspace.md`.

## Backend Contract

Use `artifact.bi_grounding.filters[]` exactly as returned. Each normalized semantic filter retains the qualified machine `field` and may include `dimension_id`, business-readable `label`, `operator`, `value`, and `values`.

Render `filter.label` as the visible name when it is present. Fall back to `filter.field`, then `unknown`, for older one-source or raw artifacts. Keep `field` unchanged in artifact state, slicers, exports, inspection data, and every backend-bound payload. Do not derive labels from source aliases or split qualified identifiers in React.

## Acceptance

A governed filter with `{ field: "hardware_inventory_5000_csv.Category", label: "Inventory Category", operator: "eq", value: "Hardware" }` displays `Inventory Category eq Hardware` in the trusted-result filter summary and does not display the qualified field.

A legacy filter without `label` continues displaying its `field`. Multiple filters, `values[]`, nullish values, metrics, dimensions, chart rendering, lineage, artifact inspection, pinning, exports, error rendering, and one-source AI Chat remain unchanged.

## Verification

Run `npm --prefix frontend\frontend run build`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`.

## Ownership And Control Return

Antigravity owns this bounded React repair and reasonable accessible presentation details inside the existing design system. Do not change backend files, contracts, APIs, chart data, semantic identity, or broader AI Chat layout. Stop after the source change and verification evidence, then return the changed-file list and build result to Codex for integration review.
