#!/usr/bin/env python3
"""
Fix syntax errors from incomplete try/except removal
"""

with open('routes.py', 'r') as f:
    lines = f.readlines()

new_lines = []
skip_except = False

for i, line in enumerate(lines):
    # Skip orphaned except blocks
    if line.strip().startswith('except Exception as e:'):
        # Check if previous non-empty line is not 'try:' or inside a try block
        found_try = False
        for j in range(i-1, max(0, i-20), -1):
            if lines[j].strip():
                if 'try:' in lines[j]:
                    found_try = True
                    break
                elif lines[j].strip() and not lines[j].startswith(' '):
                    break
        
        if not found_try:
            # This is an orphaned except, skip it and the following raise
            skip_except = True
            continue
    
    if skip_except:
        # Skip lines that are part of the except block
        if line.strip() and not line[0].isspace():
            # We've exited the except block
            skip_except = False
            new_lines.append(line)
        elif 'raise HTTPException' in line or 'logger.error' in line or 'detail=' in line or 'status_code=' in line or line.strip() == ')':
            # Skip these lines that are part of the except block
            continue
        else:
            skip_except = False
            new_lines.append(line)
    else:
        new_lines.append(line)

# Write back
with open('routes.py', 'w') as f:
    f.writelines(new_lines)

print("Fixed syntax errors from orphaned except blocks")
