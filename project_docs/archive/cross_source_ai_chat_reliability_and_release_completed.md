# Completed Reference — Cross-Source AI Chat Reliability And Release

This archived gate records the verified cross-source AI Chat reliability and release scope. It is not active work.

Goal: Make governed cross-source AI Chat answer natural-language metric-by-dimension questions correctly, produce complete charts without accidental filters, present business-readable result labels, and complete the remaining multi-source release hardening.

## User Outcome

Users can ask a normal question such as “Which inventory categories generated the most total sales revenue? Show total revenue by category as a bar chart” and receive the complete governed cross-source result. The chart must not silently substitute an identifier field, invent a category filter from a source alias, collapse to one bar, or expose technical field namespaces as the primary explanation.

Users can also rely on multi-source workspaces across restarts, conflicting edits, changing source schemas, large joins, and source lifecycle operations without silent corruption, unsafe execution, or regressions to one-source analysis.

## Scope

Repair cross-source question interpretation and artifact construction in `backend/nlp_engine/nlp_extraction.py`, `backend/nlp_engine/nlp_interpreter.py`, `backend/decision_engine/chat_service.py`, and the chart-building boundary used by Decision Chat. Add focused regression coverage in `tests/test_decision_chat_service.py` and the narrow NLP or chart test modules that own the repaired behavior.

The repair must address the verified failure modes directly: identifier-shaped text such as `TXN-000001` must not become a numeric measure; tokens from source namespaces such as `sales` and `inventory` must not give every field in that source equal semantic relevance; “sales revenue” must resolve to the governed `TotalAmount` measure; and the word `hardware` inside `hardware_inventory_5000_csv.Category` must not become an implicit `Category = Hardware` filter.

Define a presentation boundary that preserves fully qualified field identity for execution and lineage while supplying business-readable labels for answer text, chart titles, axes, metrics, dimensions, and filters. Ensure `frontend/frontend/src/features/ai/AIShell.jsx` consumes those labels for visible result presentation while preserving machine fields in artifact state and backend-bound payloads.

Continue auditing and hardening `backend/repositories/source_workspace_repository.py`, `backend/repositories/source_relationship_repository.py`, `backend/services/workspace_context.py`, `backend/services/source_relationships.py`, and `backend/services/relationship_execution.py`, with route changes only where verified service errors require accurate HTTP translation. Add focused coverage in `tests/test_source_workspace_context.py`, `tests/test_source_relationships.py`, `tests/test_relationship_execution.py`, and adjacent upload tests when their compatibility boundary is affected.

Use `project_docs/active/data_sources/multiple_data_sources_implementation_plan.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, and `project_docs/active/contracts/multiple_data_source_relationships.md` as the required context. Update contracts only with behavior proven by implementation and tests.

## Contracts

Source deletion must refuse unsafe removal or explicitly and transactionally invalidate every dependent workspace membership and relationship. Restart persistence, duplicate registration, optimistic workspace and relationship versions, stale source fingerprints, and schema changes must retain stable errors and workspace isolation.

Relationship execution must continue refusing ambiguous, cyclic, disconnected, stale, blocked, unsupported many-to-many, and row-expanding graphs. Governance aggregation and lineage remain value-safe. Existing upload, Data Hub, AI Chat, chart, export, cleaning, and one-source dataset behavior must remain compatible.

Internal source aliases, qualified field names, relationship IDs, and execution locators remain stable machine identities. They must not be treated as natural-language filter evidence or used as the primary user-facing labels. Filter extraction must require evidence that the user actually requested a dimension value, not merely that the value appears inside a technical identifier.

## Acceptance

Focused tests prove restart persistence, duplicate uploads or memberships, stale workspace and relationship versions, dependent-source deletion behavior, stale schemas, large bounded joins, row-explosion refusal, governance aggregation, and unchanged one-source analysis. Every mutation is atomic, workspace-isolated, and leaves no orphaned relationship or membership state.

A deterministic sales-to-inventory relationship fixture proves that the natural-language revenue-by-category question selects `TotalAmount` as the summed measure, selects inventory `Category` as the grouping dimension, produces every category in the result, and produces no `Category = Hardware` filter. A technical structured prompt that contains `hardware_inventory_5000_csv.Category` must also produce no filter unless the user explicitly requests Hardware.

Chart construction must fail with a useful grounded error when the selected measure has no usable numeric values instead of emitting an empty chart with default axes. Result artifacts must retain qualified identities and lineage while providing readable labels such as “Total Sales Revenue” and “Inventory Category.” One-source question interpretation and explicit user-requested filters remain unchanged.

Release documentation and API examples match verified request fields, response fields, error codes, labels, and compatibility behavior. Frontend result presentation consumes backend labels while preserving qualified machine fields.

## Verification

Start with focused NLP interpretation, semantic-filter, Decision Chat, and chart-construction tests for the exact cross-source question. Then run the focused workspace, relationship, execution, upload, and Decision Chat regression suites affected by the implementation. Run `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`, and `git diff --check`.

## Owner And Control Return

Codex owns release-readiness coordination, contracts, regression verification, status truth, and gate closure. No frontend implementation handoff is active.
