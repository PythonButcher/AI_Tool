---
name: auto-handoff-execution
description: Triggers whenever the user asks to read, take over, or execute a codex handoff file, or mentions reading a handoff markdown file.
---

# Auto Handoff Execution

When the user asks you to read a handoff markdown file from Codex (which usually contains a `Goal:` prompt):

1. **Extract the Goal**: Read the specified handoff file (or check `project_docs/active/ai_hand_off/README.md` to find the active handoff) and locate the `Goal:` prompt.
2. **Auto-Execute as a Goal**: You do not need the user to manually copy-paste the prompt or use the `/goal` slash command. You must automatically adopt a "goal-oriented" mode. 
3. **Thorough Execution**: Treat the extracted `Goal:` prompt as your immediate task. Work autonomously and thoroughly step-by-step.
4. **Do Not Stop**: Continue working until the goal is fully achieved, including running verification and acceptance checks. Only pause to ask the user questions if you are entirely blocked or if explicit user action is required.
