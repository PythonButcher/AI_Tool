# Codex Hooks

This folder contains repo-local hook-ready scripts for AI_Tool. They are safe to run manually and can be wired into Codex hook configuration after review.

The project documentation for these hooks lives at `project_docs/active/agent_harness/hooks.md`.

Manual validation:

`python .codex/hooks/agent_harness_check.py`

The scripts are intentionally conservative. They enforce project rules that should not depend on an agent remembering every instruction in a long conversation.
