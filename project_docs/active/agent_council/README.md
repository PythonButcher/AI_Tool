# Agent Council Workflow

## Purpose

The Agent Council is a lightweight planning and debate framework for AI_Tool. It lets multiple AI agents challenge one another before the project commits to a direction, then leaves behind a strict JSON artifact that another AI can inspect, rank, compare, or turn into a handoff later.

This is not a runtime feature. It does not add backend endpoints, frontend UI, database state, or product contracts. It lives in project documentation so it can support future planning debates without changing application behavior.

## Where The Framework Lives

The reusable council framework files are stored here:

`project_docs/active/agent_council/agent_roles.md`

`project_docs/active/agent_council/master_council_prompt.md`

`project_docs/active/agent_council/council_output_schema.json`

`project_docs/active/agent_council/sample_decision_intelligence_council_output.json`

`project_docs/active/agent_council/validate_council_json.py`

Live council outputs should not be stored beside these framework files. Each topic gets a dedicated folder under:

`project_docs/active/agent_council/outputs/<topic-slug>/`

The topic folder should contain the council JSON, derived handoffs, review notes, and follow-up prompts for that topic. This keeps the workflow reusable and prevents unrelated council runs from becoming a flat pile of files.

Current topic folders:

`project_docs/active/agent_council/outputs/app-wide-ui-flaws/`

`project_docs/active/agent_council/outputs/application-next-focus-priorities/`

`project_docs/active/agent_council/outputs/compounding-phase-results/`

## Setup Summary

The reusable setup now consists of an agent role definition, master council prompt, strict JSON schema, realistic sample output, usage documentation, output registry, and dependency-free validator. The framework is linked from `project_docs/INDEX.md` and `project_docs/active/status/decision_intelligence_execution_status.md`, and live outputs are stored under `project_docs/active/agent_council/outputs/`.

The sample file is an example artifact only. It demonstrates the required shape and level of detail for a council output; it should not be treated as the result of a newly run council unless a future task explicitly says to run that topic.

## How To Run A Council

Start by choosing a planning topic. Good topics are questions like what the next Decision Intelligence slice should be, whether a proposed UI handoff is strong enough, whether a backend contract is ready for Gemini, or which risks should gate the next implementation phase.

Before running the council, the orchestrating agent should inspect the current active project docs. Start with `project_docs/INDEX.md`, then `project_docs/active/README.md`, then the active status and frontend guardrail. For Decision Intelligence work, use `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md` for the current plan and read completed plans or handoffs only when the topic explicitly needs historical evidence.

Then paste `project_docs/active/agent_council/master_council_prompt.md` into the AI system that will simulate or coordinate the agents. Add the specific planning topic after the prompt in plain language. The council should run four rounds: independent proposals, critique, reconciliation, and final JSON synthesis.

The output should be saved as JSON inside a topic folder. Use a topic slug and date-based filename inside `project_docs/active/agent_council/outputs/<topic-slug>/`. If the council creates an implementation handoff, save that handoff in the same topic folder.

## Current Emergency Council Topic

The active emergency topic is documented at `project_docs/active/agent_council/outputs/compounding-phase-results/README.md`.

It asks the council to restructure the current Decision Intelligence roadmap around compounding, obvious product results because the current Codex/Gemini phase flow has produced too many microscopic outcomes that are hard for the user to see or trust.

## Good First Council Topic

A strong next live topic is: "What should the first measurable Decision Intelligence reliability slice include after Phase 4.5 hardening?" That topic fits the current project truth because it can examine prompt benchmark fixtures, readiness fields, semantic role gaps, active dataset alignment, and truthful frontend handoff needs without changing runtime behavior.

## How To Validate Council JSON

Run the validator from the repository root:

`python project_docs/active/agent_council/validate_council_json.py project_docs/active/agent_council/sample_decision_intelligence_council_output.json`

The validator uses only Python standard-library modules. It checks that the JSON parses, the schema parses, required fields exist, object and array shapes are correct, enums match, and unknown fields are rejected where the schema marks objects as closed.

The validator is intentionally lightweight. It is good enough for council handoff hygiene, but it is not a full replacement for the `jsonschema` package. If the council artifacts become part of an automated pipeline later, the next iteration should either vendor a formal JSON Schema validator or add `jsonschema` to the project tooling deliberately.

## Current Project Fit

The workflow matches the existing project division of labor. Codex remains responsible for backend logic, contracts, architecture, review, and markdown coordination. Gemini remains responsible for frontend implementation unless the user explicitly authorizes Codex frontend work in the current session.

The council also preserves the current Decision Intelligence truth. Phase 4.5 is about improving a real chat-first decision workflow: mode clarity, prompt-first intake reliability, action fidelity, artifact quality, workspace handoff quality, and evaluation coverage. The council should not recommend fake simulation, fake optimization, fake autonomous recommendation behavior, or fake upload ingestion.

## What Good Council Output Looks Like

A good council JSON artifact should show what was reviewed, what each role argued, where the roles disagreed, which ideas survived critique, what remains unresolved, and how implementation should be phased. It should be concrete enough that another AI can turn it into a Codex backend task, a Gemini frontend handoff, a test plan, or a future product planning document without re-litigating the whole debate.
