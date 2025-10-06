#!/usr/bin/env python3
"""
Apply dependency injection fix to routes.py
"""

import re

with open('routes.py', 'r') as f:
    lines = f.readlines()

# Track which functions need the db parameter added
functions_to_fix = set()
in_function = None
function_indent = 0

for i, line in enumerate(lines):
    # Detect function definitions
    if line.strip().startswith('async def '):
        in_function = line
        function_indent = len(line) - len(line.lstrip())
    
    # Check if we're inside a function and see get_database() call
    if in_function and 'db = get_database()' in line:
        functions_to_fix.add(in_function.strip())
    
    # Reset when we exit the function (dedent)
    if in_function and line and not line.isspace():
        current_indent = len(line) - len(line.lstrip())
        if current_indent <= function_indent and not line.strip().startswith('"""'):
            in_function = None

print(f"Found {len(functions_to_fix)} functions to fix:")
for func in functions_to_fix:
    print(f"  - {func}")

# Now fix the file
output_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Check if this is a function that needs fixing
    is_func_to_fix = False
    for func in functions_to_fix:
        if func in line:
            is_func_to_fix = True
            break
    
    if is_func_to_fix:
        # Look for the closing parenthesis of the function definition
        func_def = line
        j = i
        while ')' not in func_def or ':' not in func_def:
            j += 1
            if j < len(lines):
                func_def += lines[j]
        
        # Add db = Depends(get_database) before the closing parenthesis
        if 'db = Depends(get_database)' not in func_def:
            # Find the last parameter line
            last_paren = func_def.rfind(')')
            # Check if there's already a parameter
            if func_def[:last_paren].strip().endswith('('):
                # No parameters yet
                new_func = func_def[:last_paren] + 'db = Depends(get_database)' + func_def[last_paren:]
            else:
                # Add comma and new parameter
                new_func = func_def[:last_paren].rstrip() + ',\n    db = Depends(get_database)\n' + func_def[last_paren:]
            
            output_lines.append(new_func)
            i = j + 1
        else:
            output_lines.append(line)
            i += 1
    else:
        output_lines.append(line)
        i += 1

# Remove all try/except blocks that get the database
new_output = []
skip_until_dedent = False
base_indent = 0

for i, line in enumerate(output_lines):
    if 'try:' in line and i + 1 < len(output_lines) and 'db = get_database()' in output_lines[i+1]:
        # Start skipping
        skip_until_dedent = True
        base_indent = len(line) - len(line.lstrip())
        continue
    
    if skip_until_dedent:
        current_indent = len(line) - len(line.lstrip()) if line.strip() else 999
        if current_indent <= base_indent and line.strip():
            skip_until_dedent = False
            # Don't skip this line - it's the next statement
            new_output.append(line) 
        # Skip all lines in the try/except block
        continue
    
    new_output.append(line)

# Ensure Depends is imported
import_line_idx = -1
for i, line in enumerate(new_output):
    if line.startswith('from fastapi import'):
        import_line_idx = i
        if 'Depends' not in line:
            new_output[i] = line.rstrip()
            if not line.rstrip().endswith(','):
                new_output[i] += ','
            new_output[i] += ' Depends\n'
        break

# Write the fixed content
with open('routes.py', 'w') as f:
    f.writelines(new_output)

print("\nFixed routes.py successfully!")
print("Dependency injection applied to all endpoints.")
