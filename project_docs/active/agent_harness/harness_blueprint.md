# Agent Harness Blueprint

This document turns current agentic harness practice into a practical project template. The goal is not more instructions. The goal is a small system that makes agent behavior observable, repeatable, and safe enough to improve over time.

## Research Cross-Reference

Recent Codex guidance treats `AGENTS.md` as the reusable place for repo layout, commands, conventions, do-not rules, and what done means. OpenAI's current Codex docs also recommend keeping it practical, then moving task-specific detail into referenced Markdown when the file grows too large.

OpenAI's hook docs define lifecycle points such as `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart`, and `Stop`, with repo-local command hooks resolved from a stable project path. This matches the missing layer in this repo: the project has strong written rules, but only limited executable checks.

The agent improvement-loop pattern is traces plus human or model feedback, turned into evals and then into ranked harness changes. For this repo, that means each harness edit should explain the observed failure it prevents, the check that catches it, and the verification command that proves the edit works.

The 2026 agentic harness engineering literature points in the same direction: the useful improvements are often in tools, middleware, memory, and verification loops rather than only in prompt prose. That is why this folder separates instructions, hook scripts, templates, and validation.

## Backbone Pattern

The harness has five parts.

First, a short instruction manifest loads automatically and states the few rules that must never be missed. In this repo, that is `AGENTS.md`.

Second, active routing docs tell agents what to read next and what not to scan. In this repo, that is `project_docs/INDEX.md`, `project_docs/active/README.md`, and the task-specific active file.

Third, hook-ready checks turn high-risk rules into executable policy. In this repo, `.codex/hooks/pre_tool_use_policy.py` blocks or flags commands that violate known boundaries, and `.codex/hooks/agent_harness_check.py` validates the harness manually.

Fourth, verification ladders keep checks proportional. Backend work starts with focused tests, bounded frontend work stays with Antigravity unless Codex is explicitly authorized to implement it, and documentation work uses path checks plus `git diff --check`.

Fifth, harness evolution is evidence-based. When an agent repeats a mistake, record the pattern here, add the smallest reusable check or instruction, and verify it. Avoid broad prompts that try to solve every future task at once.

## Template For Future Projects

For a new project, copy only the generic shape:

`AGENTS.md`

`project_docs/INDEX.md`

`project_docs/active/README.md`

`project_docs/active/agent_harness/`

`.codex/hooks/`

Then replace project-specific ownership, commands, and verification ladders. Do not copy this repo's Decision Intelligence status, Gemini handoffs, or archived history into another project.

## Good Harness Change Test

A good harness improvement should pass four questions.

Does it prevent or reveal a real repeated failure?

Can a future agent understand it in under two minutes?

Can it be verified with a cheap command or a focused review?

Does it preserve the existing project rules and ownership boundaries?
