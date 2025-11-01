"""
Check if MFA is enabled for user
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_mfa():
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    # Find user
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": "rajl3v3l", "$options": "i"}},
            {"contactEmail": {"$regex": "rajl3v3l", "$options": "i"}},
            {"username": {"$regex": "admin", "$options": "i"}}
        ]
    })
    
    if user:
        username = user.get("username")
        mfa = user.get("mfa", {})
        
        print(f"\n{'='*60}")
        print(f"User: {username}")
        print(f"{'='*60}")
        print(f"MFA Enabled: {mfa.get('mfa_enabled', False)}")
        print(f"MFA Type: {mfa.get('mfa_type', 'None')}")
        print(f"MFA Enabled At: {mfa.get('mfa_enabled_at', 'Never')}")
        print(f"Backup Codes: {len(mfa.get('mfa_backup_codes', []))} codes")
        print(f"{'='*60}\n")
        
        if not mfa.get('mfa_enabled'):
            print("⚠️ MFA is NOT enabled for this user!")
            print("To test MFA flow, you need to enable it first in Security Settings.")
        else:
            print("✅ MFA is enabled. Login should show MFA verification screen.")
    else:
        print("User not found!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_mfa())
