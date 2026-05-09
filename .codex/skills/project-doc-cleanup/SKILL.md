---
name: project-doc-cleanup
description: Scan and self-clean a project's Markdown documentation, navigation files, agent instructions, handoffs, plans, archive folders, and status docs. Use when the user asks to organize docs, simplify project documentation, remove confusing or duplicate information, clean stale handoffs, fix broken doc links, make OpenAI/Codex/Gemini rules easier to find, audit documentation structure, or keep active docs tidy.
---

# Project Doc Cleanup

## Goal

Make project documentation easy for agents and humans to navigate. Prefer fewer active files, one current source of truth, clear task routing, and obvious archive/completed boundaries.

Do not preserve stale explanations just because they might be historically interesting. If old content confuses current work, move it out of the active path, mark it clearly as completed or archived, or delete it when the user asks.

## Workflow

### 1. Find the documentation entry points

Start with the project's root instructions, usually `AGENTS.md`, `GEMINI.md`, `README.md`, and the project docs index such as `project_docs/INDEX.md`.

Identify the intended first-read path for each agent type:

| Agent | Needs |
| --- | --- |
| OpenAI/Codex | Current source of truth, coding ownership, validation rules, what not to scan. |
| Gemini | Frontend ownership, handoff path, acceptance checks, files to touch. |
| Future agents | One short navigation path, current plan, archive boundaries. |

If the first-read path is not obvious, create or update a navigation hub before editing deeper docs.

### 2. Inventory docs without reading everything deeply

Use fast file and text scans before opening many files.

Good commands:

`rg --files -g "*.md" project_docs`

`rg -n "source of truth|active|next|required|handoff|resume|status|TODO|TBD|BLOCKED|archive|completed|read in this order|scan order" project_docs AGENTS.md GEMINI.md README.md`

`rg -n "project_docs/" project_docs AGENTS.md GEMINI.md README.md`

Classify files as current, completed/reference-only, archive, contract, review, workflow, or delete candidate.

### 3. Remove confusion from the active path

Keep active docs short and direct. The active path should answer what is true now, what should happen next, which files an agent should read, and which files an agent should avoid unless explicitly needed.

Move completed plans and old handoffs out of active/current folders. Use folders like `completed/` or `archive/` when the content is still useful. Delete redundant files when the user explicitly asks or when a file only repeats current truth with old framing.

### 4. Eliminate duplicate source-of-truth claims

Search for phrases that create competing authority:

`source of truth`

`current truth`

`active next`

`required resume`

`canonical`

`must read`

Only one current status/navigation doc should own current truth. Old docs may keep historical detail only if they are clearly marked as completed or archived.

### 5. Make completed and archived files unmistakable

Every completed active-folder reference file should start with a direct warning, for example:

`> COMPLETED REFERENCE ONLY: This file is not part of the default active scan path. Old wording below is historical unless the current status or active execution plan explicitly points here.`

Every archive folder should have a README or banner making it clear that archive files are not current implementation plans.

Do not put long explanations in active docs to justify old files. Move or mark the old files instead.

### 6. Fix links after moving files

After any move, scan for stale paths.

Use path checks for literal `project_docs/...` references and update links to the new location. Avoid leaving example paths that look real but do not exist. If an example path is needed, use a placeholder like `project_docs/active/agent_council/outputs/<topic-slug>/`.

Validate:

`rg -n "old-file-name|old-folder-name" project_docs AGENTS.md GEMINI.md README.md`

`git diff --check`

For JSON artifacts with validators, run the validator after path edits.

### 7. Keep agent rules simple

Root agent instructions should work like a table of contents, not a project history.

Use a compact table:

| Need | Read |
| --- | --- |
| Start any project task | main index |
| Current truth | active status |
| Ownership rules | guardrail |
| Current plan | active execution plan |
| Historical context | archive or completed folder only when requested |

Remove duplicate narrative from root agent docs when it is already in the current status or current plan.

### 8. Report what changed

Summarize what was deleted, what was moved, what remains as the current source of truth, what agents should read first, and what validation passed.

## Cleanup Rules

Prefer deletion over preserving redundant docs when the user explicitly says the file is confusing or useless.

Prefer moving to `completed/` when the file records useful work but is no longer current.

Prefer archive banners when old files contain historically useful but misleading language.

Never leave a deleted file referenced from active navigation, guardrails, council prompts, JSON artifacts, or handoffs.

Never let old branch names, stale phase labels, or resume handoffs define current work.

Never make agents scan a broad folder when one README or current plan can route them.
