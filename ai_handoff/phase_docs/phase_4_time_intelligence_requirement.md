# Phase 4 Time Intelligence Requirement

## Purpose

This file exists to make one business requirement explicit for the current Decision Intelligence work:

time intelligence is not optional.

For many real business workflows, users will expect decision support to compare business periods such as:

- fiscal year versus prior fiscal year
- fiscal quarter versus prior fiscal quarter
- same fiscal period last year
- current fiscal period versus target period

Decision Intelligence should be treated as business-aware enough to support this direction.

## Why This Matters

A large share of decision-oriented analysis depends on period-aware comparison.

If the product only communicates vague "latest period" changes, users may not trust the output for:

- finance
- revenue planning
- budget tracking
- seasonality-sensitive analysis
- performance reviews tied to fiscal calendars

This is especially important because the Decision Intelligence surface is meant to produce action-oriented guidance, not just observations.

## Gemini Guidance

Gemini should treat this requirement as active while staying inside frontend scope.

Gemini should:

- avoid hard-coded UX wording that only fits generic latest-period comparison
- leave visual and copy room for fiscal/calendar comparison context
- prefer labels that can scale to richer time-context metadata later
- preserve the current feature set while improving clarity

Gemini should not:

- invent fiscal logic in the frontend
- fake fiscal-year comparisons from incomplete backend data
- simplify the decision surface by removing comparison-oriented concepts

If Gemini encounters a true backend gap, it should document that gap for Codex instead of weakening the user experience.

## Codex Guidance

Codex should treat this file as a reminder that backend time intelligence may need follow-up work to fully support the decision UX.

Potential backend follow-up areas may include:

- explicit fiscal calendar metadata
- comparison-period labels
- same-period-last-year helpers
- fiscal quarter and fiscal year context in decision signals and briefs

Current backend status after the latest Codex pass:

- the decision contract now includes additive period-label metadata for the current sequential comparison flow
- `brief.period_context` is now the main business-facing label object for existing time comparisons
- `brief.key_metrics[]` now supports `period_label` and `comparison_label`
- `scenario_preview` now supports `period_context`, `baseline_label`, and `projected_label`
- explicit fiscal-calendar support is still not implemented; `fiscal_calendar` remains `null`

This file does not itself implement true fiscal logic.

It establishes the product requirement so frontend work does not drift into a falsely simplified solution.
