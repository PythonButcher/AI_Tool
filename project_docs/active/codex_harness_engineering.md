# Codex Harness Engineering

## Purpose

This file defines how Codex should run efficiently on AI_Tool without lowering implementation quality.

The main goal is to prevent a single implementation session from spending excessive context on broad file reads, full diffs, noisy browser logs, repeated verification attempts, or unrelated exploration. Codex should still do careful work, but every expensive read, test, browser run, artifact inspection, and diff must have a clear reason.

This file applies to Codex. It is not an Antigravity rule file.

For reusable agent-harness structure, hook-ready checks, and future-project templates, use `project_docs/active/agent_harness/README.md`. This file remains the Codex run-efficiency rule; the agent harness folder owns reusable harness architecture.

Past expensive branches may be useful examples, but they are not global templates. Codex must derive the run shape from the current task, active plan, and touched subsystem instead of reusing the last branch's verification pattern.

## Entry Rule

Codex still starts with `AGENTS.md`.

After `AGENTS.md`, use `project_docs/INDEX.md` and `project_docs/active/README.md` as routing maps. Read `project_docs/active/status/project_execution_status.md` and then `project_docs/active/active_gate/README.md`. Read only the active status file, active-gate files, frontend guardrail when relevant, this harness file for substantial repo work, and the task-specific active plan named by the routing docs.

Do not scan every Markdown file. Do not scan archive, completed, future, or old handoff folders unless the current task explicitly needs historical evidence.

## Active-Gate Context Pattern

The project uses one global active gate so context selection and ownership are explicit. The status file names the gate; `project_docs/active/active_gate/README.md` names the current slice, objective, and owner. A file in a product-area folder, `ai_hand_off/`, `future/`, `completed/`, or `archive/` is not active unless the status or active-gate README points to it.

When Codex is the current owner, the status `Next Action` must point to the sole executable gate at `project_docs/active/active_gate/README.md`. That directory must contain no companion goal, kickoff, plan, status, or supporting file. Codex must perform its own source, contract, and test review before ending a gate. It must never return control to an unspecified future Codex review or leave the user to infer whether a new session is required.

This follows the context-engineering rule of selecting only the context needed for the current step and isolating stale or future context away from the working set. If active status, active-gate README, and the active handoff disagree, stop and repair docs before implementation.

## Default Run Budget

For substantial implementation work, Codex should begin with a short run plan that names the likely files, the first verification command, and the final acceptance check.

Codex should prefer this order:

1. Read routing docs and the task-specific plan.
2. Build a narrow file map with `rg --files` or targeted `rg`.
3. Inspect symbols, headings, and line ranges before full files.
4. Edit the smallest coherent file set.
5. Run the narrowest verification that can prove the change.
6. Escalate verification only when a cheaper check cannot prove the claim.

Full-file reads are allowed when a file is small or the local structure cannot be understood from targeted ranges. Large files should be read by symbol, heading, or line range first.

## Tool Output Rules

Codex should keep tool output tight by default.

Use `git diff --stat`, `git diff --name-only`, or targeted hunks before full diffs. Do not dump a large full diff into context unless the changed file set is already known to be small.

Use targeted searches instead of broad recursive searches when the task has a known feature area. If a broad search is needed, search for exact API names, function names, route names, or visible labels first.

Summarize build, test, and browser output. Do not paste long stack traces, webpack overlays, dependency warnings, or console noise into the conversation unless the exact lines are needed to diagnose the failure.

If a command produces large noisy output, switch to a filtered command on the next attempt.

## Source Inspection Rules

Codex should avoid reading large React, CSS, or backend service files from top to bottom unless necessary.

For frontend work, inspect component exports, relevant handlers, hook state, props at the call site, and nearby styles before broader source reading.

For backend work, inspect the route, service function, tests, and contract section that define the behavior before broader source reading.

For contract or documentation work, inspect headings and current source-of-truth sections before opening large historical documents.

## Verification Ladder

Verification should prove the claim at the lowest reliable cost.

For backend changes, start with the smallest relevant unit test or direct service test. Then run the broader regression suite only if the touched behavior crosses shared contracts.

For frontend changes, start with static/source review and the relevant build or lint command. Then run one focused browser path after the implementation is stable.

For visual, browser, or generated-artifact work, verify in stages: first the specific user path being fixed, then representative adjacent paths only when the active plan requires cross-feature confidence.

Do not repeat the same expensive browser flow after an unrelated infrastructure failure. Capture the blocker, narrow the diagnostic, and continue only if the blocker is relevant to the requested work.

## Browser And Artifact Rules

Browser automation should return only the signal needed for the task: page state, selected visible text, generated file path, screenshot path if needed, and the first relevant error summary.

Suppress or filter console logs when possible. Webpack overlays, extension errors, chunk-load stacks, and repeated warnings should not be dumped into model context unless they are the target bug.

For generated artifacts such as documents, images, spreadsheets, slides, or reports, inspect the artifact against the current task's acceptance criteria. Do not create repeated screenshots, renders, or image inspections unless the previous artifact was inconclusive.

## Status And Completion Rules

Codex should not mark work complete because a patch exists. Completion requires the acceptance check named in the active plan or a truthful explanation of what could not be verified.

Status Markdown should be updated only with facts that were actually implemented and verified. If verification was blocked, record the exact blocker and the best completed check.

## Stop Conditions

Codex should pause broad exploration when it has enough local context to make a scoped change.

Codex should stop retrying a noisy or failing tool path after two attempts unless the next attempt changes the diagnostic strategy.

Codex should ask for direction when the task requires expanding beyond the active plan, changing ownership boundaries, or spending substantial browser or artifact verification on a side issue.

## Harness Validation

For changes to agent instructions, hook scripts, routing docs, or harness templates, run:

`python .codex/hooks/agent_harness_check.py`

Then run `git diff --check`.
