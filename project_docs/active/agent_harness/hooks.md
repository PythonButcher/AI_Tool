# Hooks

Hooks are optional automation around the agent lifecycle. In this repo they should start as conservative checks, not hidden source-modifying automation.

## Current Scripts

`.codex/hooks/pre_tool_use_policy.py` reads Codex hook JSON from stdin. It can deny destructive shell commands, deny attempted `GEMINI.md` edits, and add context when a command appears to touch Gemini-owned frontend source.

`.codex/hooks/agent_harness_check.py` is a manual validation command. It checks that harness navigation exists, hook scripts are parseable, active docs point to existing paths, and `GEMINI.md` is not modified in the current git diff.

`.codex/hooks/codex_hooks.example.toml` is a sample hook configuration. It is not active by itself. Review it before copying entries into a real Codex config.

## Safe Adoption Path

Start by running hooks manually:

`python .codex/hooks/agent_harness_check.py`

Then test `pre_tool_use_policy.py` with synthetic JSON before enabling it as a lifecycle hook. Once trusted, copy the relevant entries from `.codex/hooks/codex_hooks.example.toml` into the appropriate Codex config file.

Keep hook scope narrow. Prefer a hook that blocks one dangerous action or adds one clear reminder over a hook that tries to infer the whole task.

## Project Policy

Hooks must not edit files automatically.

Hooks must not weaken sandbox, approval, or ownership rules.

Hooks must not modify, restore, delete, or rewrite any `GEMINI.md` file.

Hooks that block commands must explain the exact project rule being protected.

If a hook becomes noisy, disable it and revise the matcher or policy before relying on it again.
