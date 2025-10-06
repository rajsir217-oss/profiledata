#!/usr/bin/env python3
"""
Comprehensive dependency injection fix for ALL routes
"""
import re

with open("routes.py", "r") as f:
    content = f.read()

# Fix all functions that call get_database() directly
fixes = [
    # register_user - add db parameter
    (r'(images: List\[UploadFile\] = File\(default=\[\]\))\n\):',
     r'\1,\n    db = Depends(get_database)\n):'),
    
    # login_user - add db parameter
    (r'(@router\.post\("/login"\)\s*\nasync def login_user\(login_data: LoginRequest)\):',
     r'@router.post("/login")\nasync def login_user(login_data: LoginRequest, db = Depends(get_database)):'),
    
    # update_user_profile - add db parameter 
    (r'(images: List\[UploadFile\] = File\(default=\[\]\))\n\):\s*\n\s*"""Update user profile"""',
     r'\1,\n    db = Depends(get_database)\n):\n    """Update user profile"""'),
    
    # get_all_users - add db parameter
    (r'async def get_all_users\(\):',
     r'async def get_all_users(db = Depends(get_database)):'),
    
    # respond_to_request - add db parameter
    (r'(responder: str = Form\(\.\.\.\))\n\):',
     r'\1,\n    db = Depends(get_database)\n):'),
    
    # delete_user_profile - add db parameter
    (r'async def delete_user_profile\(username: str\):',
     r'async def delete_user_profile(username: str, db = Depends(get_database)):'),
    
    # get_saved_searches - add db parameter
    (r'async def get_saved_searches\(username: str\):',
     r'async def get_saved_searches(username: str, db = Depends(get_database)):'),
    
    # save_search - add db parameter
    (r'async def save_search\(username: str, search_data: dict\):',
     r'async def save_search(username: str, search_data: dict, db = Depends(get_database)):'),
    
    # delete_saved_search - add db parameter
    (r'async def delete_saved_search\(username: str, search_id: str\):',
     r'async def delete_saved_search(username: str, search_id: str, db = Depends(get_database)):'),
    
    # create_pii_request - add db parameter
    (r'(message: Optional\[str\] = Form\(None\))\n\):',
     r'\1,\n    db = Depends(get_database)\n):'),
     
    # get_pii_requests - add db parameter
    (r'async def get_pii_requests\(username: str, type: str = "received"\):',
     r'async def get_pii_requests(username: str, type: str = "received", db = Depends(get_database)):'),
    
    # respond_to_pii_request - add db parameter
    (r'(response_message: Optional\[str\] = Form\(None\))\n\):',
     r'\1,\n    db = Depends(get_database)\n):'),
    
    # add_to_favorites - add db parameter
    (r'async def add_to_favorites\(username: str, target_username: str\):',
     r'async def add_to_favorites(username: str, target_username: str, db = Depends(get_database)):'),
    
    # remove_from_favorites - add db parameter
    (r'async def remove_from_favorites\(username: str, target_username: str\):',
     r'async def remove_from_favorites(username: str, target_username: str, db = Depends(get_database)):'),
    
    # get_favorites - add db parameter
    (r'async def get_favorites\(username: str\):',
     r'async def get_favorites(username: str, db = Depends(get_database)):'),
    
    # add_to_shortlist - add db parameter
    (r'(notes: Optional\[str\] = Form\(None\))\n\):',
     r'\1,\n    db = Depends(get_database)\n):'),
    
    # get_shortlist - add db parameter
    (r'async def get_shortlist\(username: str\):',
     r'async def get_shortlist(username: str, db = Depends(get_database)):'),
    
    # add_to_exclusions - add db parameter
    (r'async def add_to_exclusions\(username: str, target_username: str\):',
     r'async def add_to_exclusions(username: str, target_username: str, db = Depends(get_database)):'),
    
    # get_exclusions - add db parameter
    (r'async def get_exclusions\(username: str\):',
     r'async def get_exclusions(username: str, db = Depends(get_database)):'),
    
    # remove_from_exclusions - add db parameter
    (r'async def remove_from_exclusions\(username: str, target_username: str\):',
     r'async def remove_from_exclusions(username: str, target_username: str, db = Depends(get_database)):'),
    
    # send_message - add db parameter
    (r'(content: str = Form\(\.\.\.\))\n\):\s*\n\s*"""Send message between users"""',
     r'\1,\n    db = Depends(get_database)\n):\n    """Send message between users"""'),
    
    # get_messages - add db parameter
    (r'async def get_messages\(username: str\):',
     r'async def get_messages(username: str, db = Depends(get_database)):'),
    
    # get_conversations - add db parameter
    (r'async def get_conversations\(username: str\):',
     r'async def get_conversations(username: str, db = Depends(get_database)):'),
    
    # remove_from_shortlist - add db parameter
    (r'async def remove_from_shortlist\(username: str, target_username: str\):',
     r'async def remove_from_shortlist(username: str, target_username: str, db = Depends(get_database)):'),
]

# Apply all parameter fixes
for pattern, replacement in fixes:
    content = re.sub(pattern, replacement, content)

# Now remove all the try-except blocks that call get_database()
# This pattern matches the try-except blocks used for database connections
pattern = r'\s*try:\s*\n\s*db = get_database\(\)\s*\n\s*except Exception as e:\s*\n\s*logger\.error\([^)]+\)\s*\n\s*raise HTTPException\([^)]+\)'
content = re.sub(pattern, '', content, flags=re.MULTILINE | re.DOTALL)

# Clean up any double blank lines left after removal
content = re.sub(r'\n\n\n+', '\n\n', content)

# Write back
with open("routes.py", "w") as f:
    f.write(content)

print("Applied comprehensive dependency injection fixes to all routes")
