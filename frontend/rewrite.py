import os

file_path = r'frontend\src\features\ai\AIShell.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "      case 'decision_output': {"
start_idx = content.find(start_marker)
# The end marker should be the default case
import re
end_marker_match = re.search(r'      default:\n        return null;', content)
if end_marker_match:
    end_idx = end_marker_match.start()
else:
    end_idx = -1

if start_idx == -1 or end_idx == -1:
    print("Could not find start or end markers")
    print(f"start_idx: {start_idx}, end_idx: {end_idx}")
    exit(1)

with open('new_jsx.txt', 'r', encoding='utf-8') as f:
    new_jsx = f.read()

# Replace the content
new_content = content[:start_idx] + new_jsx + "\n" + content[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("AIShell.jsx updated successfully")
