# Hooks

Hooks are optional automation around the agent lifecycle. In this repo they should start as conservative checks, not hidden source-modifying automation.

## Current Scripts

`.codex/hooks/pre_tool_use_policy.py` reads Codex hook JSON from stdin. It distinguishes read-only inspection from mutation, loads canonical phase authorization, and denies destructive commands, `GEMINI.md` changes, truncating script writes, unauthorized frontend edits, and writes outside the active path boundary.

It also denies dynamic-path Python writes such as `open(f, "w")`, dynamic `Path.write_text`, and direct PowerShell writes to frontend source. These patterns can truncate a file before its contents are read. Source edits must use `apply_patch`.

`.codex/hooks/agent_harness_check.py` is the authoritative repository validator. It checks required paths and syntax, canonical authorization, allowed diffs, lifecycle/readiness/ownership/continuation alignment, gate identity and WIP=1, handoff state, navigation, local skill manifests, stale status paths, `GEMINI.md` protection, and critical source sizes.

`.codex/hooks/check_active_gate.py` is the repository-local gate validator. `.codex/hooks/ci_harness_check.py` is the provider-neutral CI entrypoint; it configures no external provider.

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
