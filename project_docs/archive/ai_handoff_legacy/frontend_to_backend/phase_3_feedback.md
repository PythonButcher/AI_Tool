> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 3 Frontend to Backend Feedback

## Missing Fields / Observations
- The `warnings` field in the response is very useful; it would be even better if it included a "type" or "severity" code for more tailored UI rendering.
- `key_metrics` in the brief are excellent for summary cards. Consider adding a `trend_data` array (simple values) for sparklines in future phases.
- `evidence` in signals is currently raw JSON. A `format_hint` (e.g., "table", "key-value", "text") would help the frontend render it more elegantly without knowing the domain logic.

## Unclear Structures
- The `action.payload.group_by` can be a list according to contracts, but existing charts usually take a single string. Handled by taking `group_by[0]` for now.
- `scenario_preview.suggested_inputs` is structured well, but the `adjustment_value` (e.g., 0.15 for 15%) should be explicitly documented as fractional or percentage to avoid scale errors in "what-if" UI.

## Performance Concerns
- Since the decision pipeline can be heavy (LLM + Stats), the frontend relies on the backend being optimized for sub-3-second responses to maintain the "Intelligence" vibe.
- For very large datasets, the payload passed back to the decision pipeline should be minimized if possible (currently using `dataset_ref`).

## Suggestions
- Add a `context_summary` field to the bundle that summarizes what filters were active when the decision was run, ensuring the user knows the "scope" of the intelligence.
