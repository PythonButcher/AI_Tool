---
name: status-tracker-skill
description: Automatically updates the project execution status in project_docs/active/status/decision_intelligence_execution_status.md. Use this skill immediately after completing a phase, task, or bug fix to fulfill mandatory reporting requirements.
---

# Project Execution Tracker

This skill automates the mandatory reporting requirements defined in `GEMINI.md`. It ensures that the `decision_intelligence_execution_status.md` file accurately reflects the current state of implementation.

## Mandatory Workflow

1.  **Completion**: Finish a code change (Implementation -> Test -> Validate).
2.  **Trigger**: Use this skill to mark the task as complete.
3.  **Audit**: Ensure the "What Is Actually Implemented Today" section is updated for major features.

## Tools

### Update Script
The script `scripts/update_status.py` can be used to toggle checkboxes in the status file.

**Usage:**
```bash
python .gemini/skills/status-tracker-skill/scripts/update_status.py "Task Name" [x|~| ]
```

### Reference
See [references/status_schema.md](references/status_schema.md) for the allowed status labels and formatting conventions.

## Examples

### Marking a task as complete
If you finished the "Workspace Analysis Wiring", run:
```bash
python .gemini/skills/status-tracker-skill/scripts/update_status.py "Workspace Analysis Wiring" x
```

### Marking a task as in-progress
```bash
python .gemini/skills/status-tracker-skill/scripts/update_status.py "Phase 4 Chat Contract" ~
```

## Best Practices
- **Atomic Updates**: Update the status file for each sub-task as you finish it.
- **Truthfulness**: Only mark tasks as `[x]` after empirical verification (tests passed).
- **Consistency**: Use the exact task names as they appear in the markdown file.
