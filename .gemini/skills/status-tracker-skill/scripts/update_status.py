import re
import sys
import os

# Keep the skill aligned with the active project docs tree.
STATUS_FILE = "project_docs/active/status/decision_intelligence_execution_status.md"

def update_checkbox(task_name, state="x"):
    """
    Finds a line with task_name and a checkbox, then updates the checkbox.
    Example: update_checkbox("Workspace Analysis Wiring", "x")
    """
    if not os.path.exists(STATUS_FILE):
        print(f"Error: {STATUS_FILE} not found.")
        return False

    with open(STATUS_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex to find [ ] or [~] or [x] followed by task_name
    # We use re.escape to handle special characters in task_name
    pattern = rf"(\[\s*[ x~]\s*\])(.*{re.escape(task_name)})"
    
    new_checkbox = f"[{state}]"
    
    # Check if pattern exists
    if not re.search(pattern, content, re.IGNORECASE):
        print(f"Error: Could not find task '{task_name}' with a checkbox.")
        return False

    new_content = re.sub(pattern, rf"{new_checkbox}\2", content, flags=re.IGNORECASE)

    with open(STATUS_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    print(f"Successfully marked '{task_name}' as [{state}].")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python update_status.py \"Task Name\" [state]")
        sys.exit(1)
    
    task = sys.argv[1]
    status = sys.argv[2] if len(sys.argv) > 2 else "x"
    update_checkbox(task, status)
