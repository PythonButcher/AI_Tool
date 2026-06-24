# Hooks

Hooks are optional automation around the agent lifecycle. In this repo they should start as conservative checks, not hidden source-modifying automation.

## Current Scripts

`.codex/hooks/pre_tool_use_policy.py` reads Codex hook JSON from stdin. It can deny destructive shell commands, deny attempted `GEMINI.md` edits, and add context when a command appears to touch Gemini-owned frontend source.

It also denies dynamic-path Python writes such as `open(f, "w")`, dynamic `Path.write_text`, and direct PowerShell writes to frontend source. These patterns can truncate a file before its contents are read. Source edits must use `apply_patch`.

`.codex/hooks/agent_harness_check.py` is a manual validation command. It checks that harness navigation exists, hook scripts are parseable, active docs point to existing paths, `GEMINI.md` is not modified in the current git diff, completed plans are not left in the active current path, and the active gate declares a phase number.

`.codex/hooks/codex_hooks.example.toml` is a sample hook configuration. It is not active by itself. Review it before copying entries into a real Codex config.

## Safe Adoption Path

Start by running hooks manually:

`python .codex/hooks/agent_harness_check.py`

Then test `pre_tool_use_policy.py` with synthetic JSON before enabling it as a lifecycle hook. Once trusted, copy the relevant entries from `.codex/hooks/codex_hooks.example.toml` into the appropriate Codex config file.

Keep hook scope narrow. Prefer a hook that blocks one dangerous action or adds one clear reminder over a hook that tries to infer the whole task.

The repo-local hook can enforce commands only for an agent runtime configured to invoke it. For other runtimes, `AGENTS.md` and the required `agent_harness_check.py` command provide the portable guard. Do not claim equivalent enforcement unless that runtime has its own pre-command hook configured.

## Project Policy

Hooks must not edit files automatically.

Hooks must not weaken sandbox, approval, or ownership rules.

Hooks must not modify, restore, delete, or rewrite any `GEMINI.md` file.

Hooks that block commands must explain the exact project rule being protected.

Before reporting frontend work complete, run `python .codex/hooks/agent_harness_check.py`. The check rejects missing or unexpectedly small core components, including AI Chat, AutoML, and export source files.

If a hook becomes noisy, disable it and revise the matcher or policy before relying on it again.
