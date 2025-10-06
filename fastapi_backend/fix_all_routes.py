#!/usr/bin/env python3
"""
Fix all route handlers in routes.py to use dependency injection
"""

import re

with open('routes.py', 'r') as f:
    content = f.read()

# List of all function signatures that need fixing with their corresponding patterns
fixes = [
    # login_user 
    ('async def login_user(login_data: LoginRequest):', 
     'async def login_user(login_data: LoginRequest, db = Depends(get_database)):'),
    
    # get_user_profile
    ('async def get_user_profile(username: str, requester: str = None):',
     'async def get_user_profile(username: str, requester: str = None, db = Depends(get_database)):'),
    
    # update_user_profile - need to find and fix
    (r'(async def update_user_profile\([^)]*\n[^)]*images: List\[UploadFile\] = File\(default=\[\]\)\n\):)',
     r'\1'.replace('):', '),\n    db = Depends(get_database)\n):')),
     
    # get_all_users
    ('async def get_all_users():',
     'async def get_all_users(db = Depends(get_database)):'),
     
    # delete_user_profile
    ('async def delete_user_profile(username: str):',
     'async def delete_user_profile(username: str, db = Depends(get_database)):'),
     
    # search_users - complex function signature
    (r'(async def search_users\([^)]*\n[^)]*\n[^)]*limit: int = 20\n\):)',
     r'\1'.replace('):', ',\n    db = Depends(get_database)\n):')),
     
    # get_saved_searches
    ('async def get_saved_searches(username: str):',
     'async def get_saved_searches(username: str, db = Depends(get_database)):'),
     
    # save_search
    ('async def save_search(username: str, search_data: dict):',
     'async def save_search(username: str, search_data: dict, db = Depends(get_database)):'),
]

# Apply simple fixes
for old, new in fixes:
    if not old.startswith('('):  # Simple string replacement
        content = content.replace(old, new)

# Now handle the complex multi-line signatures
# update_user_profile
pattern = r'async def update_user_profile\((.*?)images: List\[UploadFile\] = File\(default=\[\]\)\n\):'
replacement = r'async def update_user_profile(\1images: List[UploadFile] = File(default=[]),\n    db = Depends(get_database)\n):'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# search_users
pattern = r'async def search_users\((.*?)limit: int = 20\n\):'
replacement = r'async def search_users(\1limit: int = 20,\n    db = Depends(get_database)\n):'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# create_pii_access_request
pattern = r'async def create_pii_access_request\((.*?)message: Optional\[str\] = Form\(None\)\n\):'
replacement = r'async def create_pii_access_request(\1message: Optional[str] = Form(None),\n    db = Depends(get_database)\n):'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# get_access_requests
content = content.replace(
    'async def get_access_requests(username: str, type: str = "received"):',
    'async def get_access_requests(username: str, type: str = "received", db = Depends(get_database)):'
)

# respond_to_request
pattern = r'async def respond_to_request\((.*?)responder: str = Form\(\.\.\.\)\n\):'
replacement = r'async def respond_to_request(\1responder: str = Form(...),\n    db = Depends(get_database)\n):'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Other functions that also need fixing
more_fixes = [
    ('async def get_user_by_username(username: str):',
     'async def get_user_by_username(username: str, db = Depends(get_database)):'),
    ('async def delete_saved_search(username: str, search_id: str):',
     'async def delete_saved_search(username: str, search_id: str, db = Depends(get_database)):'),
    ('async def get_favorites(username: str):',
     'async def get_favorites(username: str, db = Depends(get_database)):'),
    ('async def add_to_favorites(username: str, favorite_username: str = Form(...)):',
     'async def add_to_favorites(username: str, favorite_username: str = Form(...), db = Depends(get_database)):'),
    ('async def remove_from_favorites(username: str, favorite_username: str):',
     'async def remove_from_favorites(username: str, favorite_username: str, db = Depends(get_database)):'),
    ('async def send_message(',
     'async def send_message('),
    ('async def get_messages(username: str, other_user: str = None):',
     'async def get_messages(username: str, other_user: str = None, db = Depends(get_database)):'),
    ('async def mark_message_read(message_id: str, reader: str = Form(...)):',
     'async def mark_message_read(message_id: str, reader: str = Form(...), db = Depends(get_database)):'),
    ('async def get_unread_count(username: str):',
     'async def get_unread_count(username: str, db = Depends(get_database)):'),
]

for old, new in more_fixes:
    content = content.replace(old, new)

# Fix send_message separately as it's multiline
pattern = r'async def send_message\((.*?)content: str = Form\(\.\.\.\)\n\):'
replacement = r'async def send_message(\1content: str = Form(...),\n    db = Depends(get_database)\n):'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Now remove all try/except blocks that get database
lines = content.split('\n')
new_lines = []
skip_mode = False
skip_indent = 0

for i, line in enumerate(lines):
    # Check if we're starting a try block that gets database
    if line.strip() == 'try:' and i + 1 < len(lines) and 'db = get_database()' in lines[i + 1]:
        skip_mode = True
        skip_indent = len(line) - len(line.lstrip())
        continue
    
    # If we're in skip mode
    if skip_mode:
        current_indent = len(line) - len(line.lstrip()) if line.strip() else 999
        # Check if we've exited the try/except block
        if line.strip() and current_indent <= skip_indent:
            skip_mode = False
            new_lines.append(line)
        # Skip lines inside the try/except block
        continue
    
    new_lines.append(line)

content = '\n'.join(new_lines)

# Write back
with open('routes.py', 'w') as f:
    f.write(content)

print("Fixed all route handlers to use dependency injection!")
print("Removed all try/except blocks that called get_database()")
