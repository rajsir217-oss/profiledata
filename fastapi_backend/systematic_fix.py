#!/usr/bin/env python3
"""
Systematically fix all route handlers in routes.py
"""

import re

with open('routes.py', 'r') as f:
    content = f.read()

# Fix all async def functions to add db = Depends(get_database) parameter
# Pattern: async def function_name(...): followed by optional docstring, then try: db = get_database()

# Find all async def functions
async_def_pattern = r'async def (\w+)\([^)]*\):'
functions = re.findall(async_def_pattern, content)

print(f"Found {len(functions)} async functions: {functions}")

# Add db parameter to all functions that need it (skip main.py functions)
functions_to_skip = ['health_check', 'root_endpoint', 'test_full_user_lifecycle', 'test_pii_masking_workflow', 'test_search_and_filtering', 'test_concurrent_requests']
functions_to_fix = [f for f in functions if f not in functions_to_skip]

print(f"Fixing {len(functions_to_fix)} route functions: {functions_to_fix}")

for func_name in functions_to_fix:
    # Pattern to match the function signature
    func_pattern = rf'(async def {func_name}\([^)]*)\):'
    match = re.search(func_pattern, content)
    if match:
        # Add db parameter before closing parenthesis
        replacement = match.group(1) + ', db = Depends(get_database)):'
        content = content.replace(match.group(0), replacement)
        print(f"Fixed {func_name}")

# Remove all try/except blocks that get database
# Pattern: try:\n\s+db = get_database()\n\s+except Exception as e:\n\s+logger\.error.*\n\s+raise HTTPException.*\n
try_except_pattern = r'    try:\n        db = get_database\(\)\n    except Exception as e:\n        logger\.error\(.*?\)\n        raise HTTPException\(status_code=500, detail=str\(e\)\)\n'
content = re.sub(try_except_pattern, '', content, flags=re.DOTALL)

# Also remove other try/except blocks
content = re.sub(r'    try:\n        db = get_database\(\)\n    except Exception as e:\n        logger\.error\(.*?\)\n        raise HTTPException\(status_code=500, detail=str\(e\)\)\n', '', content, flags=re.DOTALL)

# Write back
with open('routes.py', 'w') as f:
    f.write(content)

print("All route functions fixed!")
