#!/usr/bin/env python3
"""
Script to fix routes.py to use proper FastAPI dependency injection for database
"""

import re

# Read the current routes.py
with open('routes.py', 'r') as f:
    content = f.read()

# Pattern replacements for fixing dependency injection
replacements = [
    # Fix register_user endpoint
    (r'(@router\.post\("/register".*?\n)async def register_user\((.*?)images: List\[UploadFile\] = File\(default=\[\]\)\n\):',
     r'\1async def register_user(\2images: List[UploadFile] = File(default=[]),\n    db = Depends(get_database)\n):'),
    
    # Fix login_user endpoint - add db parameter
    (r'(@router\.post\("/login"\).*?\n)async def login_user\(login_data: LoginRequest\):',
     r'\1async def login_user(login_data: LoginRequest, db = Depends(get_database)):'),
    
    # Fix get_user_profile endpoint
    (r'(@router\.get\("/profile/\{username\}"\).*?\n)async def get_user_profile\(username: str, requester: str = None\):',
     r'\1async def get_user_profile(username: str, requester: str = None, db = Depends(get_database)):'),
    
    # Fix update_user_profile endpoint
    (r'(@router\.put\("/profile/\{username\}"\).*?\n)async def update_user_profile\((.*?)images: List\[UploadFile\] = File\(default=\[\]\)\n\):',
     r'\1async def update_user_profile(\2images: List[UploadFile] = File(default=[]),\n    db = Depends(get_database)\n):'),
    
    # Fix get_all_users endpoint
    (r'(@router\.get\("/admin/users"\).*?\n)async def get_all_users\(\):',
     r'\1async def get_all_users(db = Depends(get_database)):'),
    
    # Fix create_pii_access_request endpoint
    (r'(@router\.post\("/access-request"\).*?\n)async def create_pii_access_request\((.*?)message: Optional\[str\] = Form\(None\)\n\):',
     r'\1async def create_pii_access_request(\2message: Optional[str] = Form(None),\n    db = Depends(get_database)\n):'),
    
    # Fix get_access_requests endpoint
    (r'(@router\.get\("/access-requests/\{username\}"\).*?\n)async def get_access_requests\(username: str, type: str = "received"\):',
     r'\1async def get_access_requests(username: str, type: str = "received", db = Depends(get_database)):'),
    
    # Fix respond_to_request endpoint
    (r'(@router\.put\("/access-request/\{request_id\}/respond"\).*?\n)async def respond_to_request\((.*?)responder: str = Form\(\.\.\.\)\n\):',
     r'\1async def respond_to_request(\2responder: str = Form(...),\n    db = Depends(get_database)\n):'),
    
    # Fix delete_user_profile endpoint
    (r'(@router\.delete\("/profile/\{username\}"\).*?\n)async def delete_user_profile\(username: str\):',
     r'\1async def delete_user_profile(username: str, db = Depends(get_database)):'),
    
    # Fix search_users endpoint
    (r'(async def search_users\()(.*?)(limit: int = 20\n\):)',
     r'\1\2limit: int = 20,\n    db = Depends(get_database)\n):'),
    
    # Fix get_saved_searches endpoint
    (r'(@router\.get\("/\{username\}/saved-searches"\).*?\n)async def get_saved_searches\(username: str\):',
     r'\1async def get_saved_searches(username: str, db = Depends(get_database)):'),

    # Fix save_search endpoint
    (r'(@router\.post\("/\{username\}/saved-searches"\).*?\n)async def save_search\(username: str, search_data: dict\):',
     r'\1async def save_search(username: str, search_data: dict, db = Depends(get_database)):'),
]

# Apply replacements
for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Remove all the try/except blocks that call get_database()
remove_patterns = [
    r'    try:\n        db = get_database\(\)\n    except Exception as e:\n        logger\.error\(f".*?", exc_info=True\)\n        raise HTTPException\(status_code=500, detail=str\(e\)\)\n',
]

for pattern in remove_patterns:
    content = re.sub(pattern, '', content, flags=re.DOTALL)

# Add Depends import if not present
if 'from fastapi import' in content and 'Depends' not in content.split('\n')[1]:
    content = content.replace(
        'from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form,',
        'from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends,'
    )

# Write the fixed content
with open('routes_fixed.py', 'w') as f:
    f.write(content)

print("Routes fixed and saved to routes_fixed.py")
print("Review the changes and then replace routes.py with routes_fixed.py")
