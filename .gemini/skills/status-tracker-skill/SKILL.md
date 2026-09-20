---
name: status-tracker-skill
description: Validate AI Tool handoff readiness and return bounded Antigravity evidence to Codex without changing gate, readiness, authorization, or acceptance authority.
---

# AI Tool Status Return

Before frontend work, read execution status, phase authorization, the handoff map, the single active handoff, and the frontend guardrail. Run `python .gemini/skills/status-tracker-skill/scripts/update_status.py check` and stop without source changes if it rejects ownership, readiness, or handoff count.

After completing the handoff's tests and build, run `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff HANDOFF_FILE --summary "CONCISE EVIDENCE"`.

The return command validates the actual frontend worktree before changing ownership. It rejects missing or empty targets, suspicious shrinkage, out-of-scope frontend changes, missing required target changes, forbidden inline styles, whitespace errors, and a return with no durable source diff. Never bypass a rejection with a bulk rewrite or Git restore command; stop and report it to Codex.

The script may update only `Phase State`, `What This State Means`, `Current Owner`, `Automatic Continuation`, `Required Action`, and `Active Handoff`. It cannot change the phase heading or identity, current milestone, backend or frontend readiness, active gate, roadmap, authorization record, completion rule, handoff content, or any `GEMINI.md` file.

Returning control does not accept the implementation. Codex reviews source and build evidence, and the user retains browser acceptance. Read `references/status_schema.md` for the exact boundary.
