#!/usr/bin/env python3
"""
Comprehensive fix for all routes that still call get_database() directly
"""
import re

with open("routes.py", "r") as f:
    content = f.read()

# List of functions that need fixing with their signatures
functions_to_fix = [
    # Fixed pattern for register_user - needs special handling as it was partially fixed
    (r'(@router\.post\("/register".*?\n.*?)\n\):', r'\1,\n    db = Depends(get_database)\n):'),
    
    # Update all other POST endpoints
    (r'(@router\.put\("/profile/\{username\}".*?\n.*?)images: List\[UploadFile\] = File\(default=\[\]\)\n\):', 
     r'\1images: List[UploadFile] = File(default=[]),\n    db = Depends(get_database)\n):'),
    
    (r'(@router\.get\("/admin/users".*?\n)async def get_all_users\(\):', 
     r'\1async def get_all_users(db = Depends(get_database)):'),
    
    (r'(@router\.put\("/access-request/\{request_id\}/respond".*?\n.*?)responder: str = Form\(\.\.\.\)\n\):', 
     r'\1responder: str = Form(...),\n    db = Depends(get_database)\n):'),
    
    (r'(@router\.delete\("/profile/\{username\}".*?\n)async def delete_user_profile\(username: str\):', 
     r'\1async def delete_user_profile(username: str, db = Depends(get_database)):'),
    
    (r'(@router\.get\("/\{username\}/saved-searches".*?\n)async def get_saved_searches\(username: str\):', 
     r'\1async def get_saved_searches(username: str, db = Depends(get_database)):'),
    
    (r'(@router\.post\("/\{username\}/saved-searches".*?\n)async def save_search\(username: str, search_data: dict\):', 
     r'\1async def save_search(username: str, search_data: dict, db = Depends(get_database)):'),
    
    (r'(@router\.delete\("/\{username\}/saved-searches/\{search_id\}".*?\n)async def delete_saved_search\(username: str, search_id: str\):', 
     r'\1async def delete_saved_search(username: str, search_id: str, db = Depends(get_database)):'),
    
    (r'(@router\.post\("/pii-request".*?\n.*?)message: Optional\[str\] = Form\(None\)\n\):', 
     r'\1message: Optional[str] = Form(None),\n    db = Depends(get_database)\n):'),
    
    (r'(@router\.get\("/pii-requests/\{username\}".*?\n)async def get_pii_requests\(username: str, type: str = "received"\):', 
     r'\1async def get_pii_requests(username: str, type: str = "received", db = Depends(get_database)):'),
    
    (r'(@router\.put\("/pii-request/\{request_id\}/respond".*?\n.*?)response_message: Optional\[str\] = Form\(None\)\n\):', 
     r'\1response_message: Optional[str] = Form(None),\n    db = Depends(get_database)\n):'),
    
    (r'(@router\.post\("/favorites/\{target_username\}".*?\n)async def add_to_favorites\(username: str, target_username: str\):', 
     r'\1async def add_to_favorites(username: str, target_username: str, db = Depends(get_database)):'),
    
    (r'(@router\.delete\("/favorites/\{target_username\}".*?\n)async def remove_from_favorites\(username: str, target_username: str\):', 
     r'\1async def remove_from_favorites(username: str, target_username: str, db = Depends(get_database)):'),
    
    (r'(@router\.get\("/favorites/\{username\}".*?\n)async def get_favorites\(username: str\):', 
     r'\1async def get_favorites(username: str, db = Depends(get_database)):'),
    
    (r'(@router\.post\("/shortlist/\{target_username\}".*?\n.*?)notes: Optional\[str\] = Form\(None\)\n\):', 
     r'\1notes: Optional[str] = Form(None),\n    db = Depends(get_database)\n):'),
    
    (r'(@router\.get\("/shortlist/\{username\}".*?\n)async def get_shortlist\(username: str\):', 
     r'\1async def get_shortlist(username: str, db = Depends(get_database)):'),
    
    (r'(@router\.post\("/exclude/\{target_username\}".*?\n)async def add_to_exclusions\(username: str, target_username: str\):', 
     r'\1async def add_to_exclusions(username: str, target_username: str, db = Depends(get_database)):'),
    
    (r'(@router\.get\("/exclusions/\{username\}".*?\n)async def get_exclusions\(username: str\):', 
     r'\1async def get_exclusions(username: str, db = Depends(get_database)):'),
    
    (r'(@router\.delete\("/exclusions/\{target_username\}".*?\n)async def remove_from_exclusions\(username: str, target_username: str\):', 
     r'\1async def remove_from_exclusions(username: str, target_username: str, db = Depends(get_database)):'),
    
    (r'(@router\.post\("/messages".*?\n.*?)content: str = Form\(\.\.\.\)\n\):', 
     r'\1content: str = Form(...),\n    db = Depends(get_database)\n):'),
    
    (r'(@router\.get\("/messages/\{username\}".*?\n)async def get_messages\(username: str\):', 
     r'\1async def get_messages(username: str, db = Depends(get_database)):'),
    
    (r'(@router\.get\("/conversations/\{username\}".*?\n)async def get_conversations\(username: str\):', 
     r'\1async def get_conversations(username: str, db = Depends(get_database)):'),
    
    (r'(@router\.delete\("/shortlist/\{target_username\}".*?\n)async def remove_from_shortlist\(username: str, target_username: str\):', 
     r'\1async def remove_from_shortlist(username: str, target_username: str, db = Depends(get_database)):'),
]

# Apply all fixes
for pattern, replacement in functions_to_fix:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Remove all try-except blocks for get_database()
content = re.sub(
    r'    try:\s*\n\s*db = get_database\(\)\s*\n\s*except Exception as e:\s*\n\s*logger\.error\(.*?\)\s*\n\s*raise HTTPException\(.*?\)',
    '',
    content,
    flags=re.DOTALL
)

# Write back
with open("routes.py", "w") as f:
    f.write(content)

print("Fixed all routes to use dependency injection")
