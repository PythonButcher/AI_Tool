import re
with open('c:/Users/18022/Desktop/AI_Tool/frontend/frontend/src/features/business/decision/graph/DecisionGraphWorkspace.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace variables
css = re.sub(r'--graph-ink: #202124;', '--graph-ink: #0f172a;', css)
css = re.sub(r'--graph-muted: #5f6368;', '--graph-muted: #64748b;', css)
css = re.sub(r'--graph-soft: #e8f0fe;', '--graph-soft: #f1f5f9;', css)
css = re.sub(r'--graph-panel: #ffffff;', '--graph-panel: #ffffff;', css)
css = re.sub(r'--graph-panel-alt: #f8f9fa;', '--graph-panel-alt: #f8fafc;', css)
css = re.sub(r'--graph-line: transparent;', '--graph-line: #e2e8f0;', css)
css = re.sub(r'--graph-blue: #1a73e8;', '--graph-blue: #4f46e5;', css)
css = re.sub(r'--graph-teal: #00875a;', '--graph-teal: #10b981;', css)
css = re.sub(r'--graph-amber: #f9ab00;', '--graph-amber: #f59e0b;', css)
css = re.sub(r'--graph-red: #d93025;', '--graph-red: #ef4444;', css)
css = re.sub(r'--graph-shadow: 0 1px 2px 0 rgba\(60,64,67,0\.3\), 0 1px 3px 1px rgba\(60,64,67,0\.15\);', '--graph-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);', css)

# Dark theme variables
css = re.sub(r'--graph-ink: #e8eaed;', '--graph-ink: #f8fafc;', css)
css = re.sub(r'--graph-muted: #9aa0a6;', '--graph-muted: #94a3b8;', css)
css = re.sub(r'--graph-soft: #3c4043;', '--graph-soft: #1e293b;', css)
css = re.sub(r'--graph-panel: #202124;', '--graph-panel: #0f172a;', css)
css = re.sub(r'--graph-panel-alt: #292a2d;', '--graph-panel-alt: #1e293b;', css)
css = re.sub(r'--graph-blue: #8ab4f8;', '--graph-blue: #818cf8;', css)
css = re.sub(r'--graph-teal: #81c995;', '--graph-teal: #34d399;', css)
css = re.sub(r'--graph-amber: #fdd663;', '--graph-amber: #fbbf24;', css)
css = re.sub(r'--graph-red: #f28b82;', '--graph-red: #f87171;', css)
css = re.sub(r'--graph-shadow: 0 1px 2px 0 rgba\(0,0,0,0\.3\), 0 2px 6px 2px rgba\(0,0,0,0\.15\);', '--graph-shadow: 0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.2);', css)

# Replace borders, radiuses and shadows
css = re.sub(r'border-radius: 0;', 'border-radius: 8px;', css)
css = re.sub(r'border: none;', 'border: 1px solid var(--graph-line);', css)
css = re.sub(r'box-shadow: none;', 'box-shadow: var(--graph-shadow);', css)

# Fix double borders
css = re.sub(r'border-bottom: none;', 'border-bottom: 1px solid var(--graph-line);', css)
css = re.sub(r'border-top: none;', 'border-top: 1px solid var(--graph-line);', css)

# Fix the specific transparent dark theme borders to use var(--graph-line)
css = re.sub(r'border-color: transparent;', 'border-color: var(--graph-line);', css)

# Let's do a write
with open('c:/Users/18022/Desktop/AI_Tool/frontend/frontend/src/features/business/decision/graph/DecisionGraphWorkspace.css', 'w', encoding='utf-8') as f:
    f.write(css)
print("CSS Replaced Successfully!")
