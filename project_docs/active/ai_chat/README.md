# AI Chat Business Workspace

Phase 14 delivers a question-to-dashboard improvement. Codex owns backend and frontend under the user's 2026-10-10 authorization; the user owns final visual acceptance. The sole [active gate](../active_gate/README.md) controls execution and [status](../status/project_execution_status.md) owns delivery truth.

The existing BI-first shell, deterministic metric resolver, typed follow-ups and artifact exports remain the foundation. Source inspection found context gaps in natural breakdown/trend requests, silent metric ambiguity, chart pinning that loses provenance, and missing request lifecycle guards.

Implement in this order: improve grounded follow-ups and temporal grouping; independently execute bounded dashboard draft items; preserve selected result snapshots additively on the local dashboard; improve chat reliability and data-aware starting prompts; verify representative integrated journeys and build the frontend. Each step is independently reviewable and stays within existing analytical capabilities.

Dashboard results must retain their source identity and filters. Stored snapshots are explicitly fixed results; dashboard slicers and a different active dataset must not silently recompute them. Draft selection and titles are editable; numerical changes require another backend execution. Multi-source work always uses the governed resolver.

Scope excludes Decision Intelligence, arbitrary dashboard agents, live sharing, scheduled refresh, cloud persistence, speculative causal explanation and ML Studio changes. Unsupported analysis requires clear guidance rather than invented results. No placeholder success states are needed.
