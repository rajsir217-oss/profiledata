#!/usr/bin/env python3
"""
Add missing except blocks to try statements
"""

with open('routes.py', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    new_lines.append(line)
    
    # If we find a try: block
    if line.strip() == 'try:':
        # Find the end of this try block
        indent = len(line) - len(line.lstrip())
        j = i + 1
        
        # Skip all lines in the try block
        while j < len(lines):
            current_line = lines[j]
            current_indent = len(current_line) - len(current_line.lstrip())
            
            # Check if we're still in the try block
            if current_line.strip() and current_indent <= indent:
                # We've exited the try block - check if next line is except or finally
                if not (current_line.strip().startswith('except') or current_line.strip().startswith('finally')):
                    # Need to add an except block before this line
                    except_block = ' ' * indent + 'except Exception as e:\n'
                    except_body1 = ' ' * (indent + 4) + 'logger.error(f"Error: {e}", exc_info=True)\n'
                    except_body2 = ' ' * (indent + 4) + 'raise HTTPException(\n'
                    except_body3 = ' ' * (indent + 8) + 'status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,\n'
                    except_body4 = ' ' * (indent + 8) + 'detail=str(e)\n'
                    except_body5 = ' ' * (indent + 4) + ')\n'
                    
                    # Insert the except block
                    new_lines.extend([except_block, except_body1, except_body2, except_body3, except_body4, except_body5])
                break
            j += 1
    
    i += 1

# Write back
with open('routes.py', 'w') as f:
    f.writelines(new_lines)

print("Added missing except blocks to all try statements")
