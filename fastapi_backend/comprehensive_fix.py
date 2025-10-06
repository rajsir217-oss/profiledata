#!/usr/bin/env python3
"""
Comprehensive fix for routes.py - apply dependency injection properly
"""

import re

with open('routes.py', 'r') as f:
    content = f.read()

# List of all functions that need the db parameter added
function_fixes = {
    'register_user': r'    images: List\[UploadFile\] = File\(default=\[\]\)\n\):',
    'login_user': r'async def login_user\(login_data: LoginRequest\):',
    'get_user_profile': r'async def get_user_profile\(username: str, requester: str = None\):',
    'update_user_profile': r'    images: List\[UploadFile\] = File\(default=\[\]\)\n\):',
    'get_all_users': r'async def get_all_users\(\):',
    'delete_user_profile': r'async def delete_user_profile\(username: str\):',
    'search_users': r'    limit: int = 20\n\):',
    'get_saved_searches': r'async def get_saved_searches\(username: str\):',
    'save_search': r'async def save_search\(username: str, search_data: dict\):',
    'delete_saved_search': r'async def delete_saved_search\(username: str, search_id: str\):',
    'create_pii_access_request': r'    message: Optional\[str\] = Form\(None\)\n\):',
    'get_access_requests': r'async def get_access_requests\(username: str, type: str = "received"\):',
    'respond_to_request': r'    responder: str = Form\(\.\.\.\)\n\):',
    'get_user_by_username': r'async def get_user_by_username\(username: str\):',
    'get_favorites': r'async def get_favorites\(username: str\):',
    'add_to_favorites': r'async def add_to_favorites\(username: str, favorite_username: str = Form\(\.\.\.\)\):',
    'remove_from_favorites': r'async def remove_from_favorites\(username: str, favorite_username: str\):',
    'send_message': r'    content: str = Form\(\.\.\.\)\n\):',
    'get_messages': r'async def get_messages\(username: str, other_user: str = None\):',
    'mark_message_read': r'async def mark_message_read\(message_id: str, reader: str = Form\(\.\.\.\)\):',
    'get_unread_count': r'async def get_unread_count\(username: str\):',
    'get_conversations': r'async def get_conversations\(username: str\):',
    'add_to_shortlist': r'async def add_to_shortlist\(username: str, target_username: str = Form\(\.\.\.\)\):',
    'get_shortlist': r'async def get_shortlist\(username: str\):',
    'remove_from_shortlist': r'async def remove_from_shortlist\(username: str, target_username: str\):',
    'add_to_exclusions': r'async def add_to_exclusions\(username: str, target_username: str = Form\(\.\.\.\)\):',
    'get_exclusions': r'async def get_exclusions\(username: str\):',
    'remove_from_exclusions': r'async def remove_from_exclusions\(username: str, target_username: str\):',
}

# Apply fixes for each function - add db = Depends(get_database) parameter
for func_name, pattern in function_fixes.items():
    # Special handling for different function signatures
    if pattern.endswith('):'):
        # Functions with no parameters or simple parameters
        replacement = pattern[:-2] + ', db = Depends(get_database)):'
    else:
        # Functions that already have parameters
        replacement = pattern.replace('):', ', db = Depends(get_database)):')
    
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

# Now replace all occurrences of the try/except blocks that get the database
# Pattern: try:\n\s+db = get_database()\n\s+except.*\n\s+.*\n\s+.*
try_except_pattern = r'    try:\n        db = get_database\(\)\n    except Exception as e:\n        logger\.error\(.*?\)\n        raise HTTPException\(status_code=500, detail=str\(e\)\)\n'
content = re.sub(try_except_pattern, '', content, flags=re.MULTILINE)

# Write back
with open('routes.py', 'w') as f:
    f.write(content)

print("Comprehensive fix applied successfully")
