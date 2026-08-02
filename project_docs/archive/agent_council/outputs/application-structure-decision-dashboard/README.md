# Archived Reference — Application Structure Decision Dashboard Council

This completed council topic belongs to a retired product direction and is not an active project gate.

# Application Structure Decision Dashboard Council

## Purpose

This council topic asks the AI council to redesign the application structure around a clearer, more valuable Decision Intelligence product.

The prior emergency compounding-results council concluded that the current phase roadmap is too focused on hidden technical fields, readiness labels, repeated prompt text, and internal guardrails. The new direction should produce visible, exportable, user-valued results: Executive Decision Brief, Dataset Trust, Visual Evidence Board, bounded Scenario Compare, and Advanced Analysis Readiness Gates.

This follow-up council should turn that direction into a more concrete application structure.

## User Direction

The user is changing the landscape of the project.

Semantic phrases, relationships, objectives, outcomes, levers, guardrails, segments, evidence, and readiness concepts are valid, but the product cannot feel like an internal contract viewer. AI_Tool is an application that helps users build things. It now needs to become a Decision Intelligence application that also helps users build practical decision assets.

The results should feel one of a kind, direct, and to the point. Sometimes more is less. The app should use a down-to-earth business voice, with technical terms only where they clarify the result. The product should tell users what they should actually inspect, change, compare, or export without pretending to make final decisions for them.

The app should move toward a dashboard-like approach where users can easily adjust levers, outcomes, scenarios, assumptions, filters, and decision-map relationships, then rerun or refresh the engine and see the brief, evidence, scenario comparison, and visual model update.

## Decision Map And CDD Context

The app does not currently have a first-class CDD or Decision Intelligence visual model builder.

The near-term safe framing should be Decision Map, not causal model. A Decision Map can show declared relationships and observational evidence coverage without claiming causality. Nodes may include Objective, Lever, Guardrail, Segment, Evidence, Assumption, Unknown, Dataset, and Scenario.

CDD-style modeling can become a later gated mode only if the app explicitly captures assumptions, causal direction, confidence, validation notes, and unsupported simulation boundaries. Until then, CDD should not imply causal proof, optimization, or Monte Carlo simulation.

The strongest near-term option is a backend-generated Decision Map from the current decision workspace, followed by user-editable controls later. The user should be able to change a lever, adjust an assumption, switch a segment, compare a scenario, and rerun the engine to update the visible result.

## What The New Council Should Answer

The council should propose a clearer application structure, not another microscopic phase plan.

It should answer what the first screen of the Decision Intelligence experience should be, what persistent dashboard controls users need, what visual models should exist, what results should be exportable, which low-value surfaces should be removed or demoted, and how Codex and Gemini should split the work.

It should challenge whether old surfaces such as legacy recommendations, Autopilot, AutoML, and generic workflow nodes should remain prominent, be rewritten, be gated, or be removed from the main Decision Intelligence path.

It should preserve truthful capability boundaries while making the product feel useful, practical, and exciting.

## Required Sources

`project_docs/INDEX.md`

`project_docs/active/README.md`

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

`project_docs/active/agent_council/outputs/compounding-phase-results/2026-05-23-emergency-compounding-council.json`

`project_docs/active/reviews/project_pruning_recommendations.md`

`project_docs/active/contracts/decision_objects.md`

## Output Handling

Do not print the council JSON in chat.

The council output must be saved as a JSON file in this folder:

`project_docs/active/agent_council/outputs/application-structure-decision-dashboard/`

Use a date-based filename such as:

`2026-05-23-application-structure-decision-dashboard-council.json`

After saving, validate it with:

`python project_docs/active/agent_council/validate_council_json.py project_docs/active/agent_council/outputs/application-structure-decision-dashboard/2026-05-23-application-structure-decision-dashboard-council.json`

## Paste-Ready Council Prompt

Run a new Agent Council for AI_Tool focused on creating a clearer application structure for a practical Decision Intelligence product. Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/agent_council/outputs/compounding-phase-results/2026-05-23-emergency-compounding-council.json`, `project_docs/active/reviews/project_pruning_recommendations.md`, and `project_docs/active/contracts/decision_objects.md`.

Use the prior council result as the starting point. It said the current roadmap is too microscopic and too focused on hidden contract fields, readiness labels, repeated prompt text, capability boundaries, and internal structures. It recommended replacing the phase roadmap with visible outcomes: Executive Decision Brief with Dataset Trust, Visual Evidence Board and Decision Map, bounded Scenario Compare, executive-ready exports, and Advanced Analysis Readiness Gates.

Now make that concrete. The user is changing the landscape of the project. Semantic phrases, relationships, objectives, outcomes, levers, guardrails, segments, evidence, and readiness concepts are valid, but this cannot feel like an internal contract viewer. AI_Tool is an application that helps users build things. It needs to become a Decision Intelligence application that also helps users build practical decision assets.

The results we provide people need to be one of a kind, direct, and to the point. Sometimes more is less. Use a more down-to-earth business approach, with technical terms only when they clarify the result. The product should tell users what they should actually inspect, change, compare, or export without pretending to make final decisions for them.

Consider a dashboard-like Decision Intelligence structure where users can easily change levers, outcomes, guardrails, assumptions, filters, segments, scenarios, and decision-map relationships, then rerun or refresh the engine and see the brief, evidence, scenario comparison, and visual model update.

Include Decision Map and CDD options. Near term, prefer "Decision Map" over causal CDD unless the council defines explicit assumptions, causal direction, confidence, validation notes, and unsupported simulation boundaries. The Decision Map can show declared relationships and observational evidence coverage using nodes such as Objective, Lever, Guardrail, Segment, Evidence, Assumption, Unknown, Dataset, and Scenario. CDD should be a later gated mode unless the app can truthfully support causal modeling.

Challenge the current app structure. Identify which surfaces should become the main Decision Intelligence experience, which should move behind gates, which should be rewritten, and which should be removed or demoted. Pay special attention to legacy recommendations, Autopilot, AutoML, generic workflow nodes, old Decision Panel surfaces, and any UI that produces many labels without a clear result.

Preserve the Codex/Gemini ownership split. Codex owns backend truth, contracts, tests, architecture, review, and documentation. Gemini owns frontend implementation unless explicitly authorized otherwise.

Do not print the JSON in chat. Save the final council JSON in `project_docs/active/agent_council/outputs/application-structure-decision-dashboard/` using a date-based filename, then validate it with `project_docs/active/agent_council/validate_council_json.py`. The JSON must match `project_docs/active/agent_council/council_output_schema.json`. The final recommendations must include a proposed application structure, primary user workflows, dashboard/control model, Decision Map/CDD approach, export model, low-value surface pruning plan, Codex backend tasks, Gemini frontend tasks, and acceptance criteria where no work is complete unless the visible result is obvious, useful, direct, truthful, and exportable where appropriate.
