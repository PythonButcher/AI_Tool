# Agent Council Workflow

## Purpose

The Agent Council is a lightweight planning and debate framework for AI_Tool. It lets multiple AI agents challenge one another before the project commits to a direction, then leaves behind a strict JSON artifact that another AI can inspect, rank, compare, or turn into a handoff later.

This is not a runtime feature. It does not add backend endpoints, frontend UI, database state, or product contracts. It lives in project documentation so it can support future planning debates without changing application behavior.

## Where The Artifacts Live

The council artifacts are stored here:

`project_docs/active/agent_council/agent_roles.md`

`project_docs/active/agent_council/master_council_prompt.md`

`project_docs/active/agent_council/council_output_schema.json`

`project_docs/active/agent_council/sample_decision_intelligence_council_output.json`

`project_docs/active/agent_council/validate_council_json.py`

## How To Run A Council

Start by choosing a planning topic. Good topics are questions like what the next Decision Intelligence slice should be, whether a proposed UI handoff is strong enough, whether a backend contract is ready for Gemini, or which risks should gate the next implementation phase.

Before running the council, the orchestrating agent should inspect the current active project docs. The normal starting point is `project_docs/INDEX.md`, followed by the active scan order listed there. For Decision Intelligence work, this usually means reading the frontend guardrail, execution status, V3 resume handoff, Phase 4.5 plan, relevant active handoff, and relevant contract.

Then paste `project_docs/active/agent_council/master_council_prompt.md` into the AI system that will simulate or coordinate the agents. Add the specific planning topic after the prompt in plain language. The council should run four rounds: independent proposals, critique, reconciliation, and final JSON synthesis.

The output should be saved as JSON. Use a name that captures the topic and date, such as `project_docs/active/agent_council/outputs/2026-04-27-decision-chat-hardening.json`. The `outputs/` folder is intentionally not required by this initial setup, because this task creates the reusable workflow and a sample artifact rather than a live council result.

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
