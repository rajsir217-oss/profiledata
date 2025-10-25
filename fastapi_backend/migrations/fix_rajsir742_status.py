"""
Fix rajsir742 account status
User verified email but not yet admin approved
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()

async def fix_rajsir742_status():
    """Fix rajsir742 to pending_admin_approval status"""
    print("🔧 Fixing rajsir742 account status...")
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Update rajsir742 to correct status
        result = await db.users.update_one(
            {"username": "rajsir742"},
            {
                "$set": {
                    "accountStatus": "pending_admin_approval",
                    "emailVerified": True,  # Keep email as verified
                    "adminApprovalStatus": "pending",  # Waiting for admin
                    "adminApprovedBy": None,
                    "adminApprovedAt": None
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"✅ Updated rajsir742 status to 'pending_admin_approval'")
            
            # Verify the update
            user = await db.users.find_one(
                {"username": "rajsir742"},
                {"accountStatus": 1, "emailVerified": 1, "adminApprovalStatus": 1}
            )
            print(f"📊 Current status:")
            print(f"   accountStatus: {user.get('accountStatus')}")
            print(f"   emailVerified: {user.get('emailVerified')}")
            print(f"   adminApprovalStatus: {user.get('adminApprovalStatus')}")
        else:
            print("⚠️ User not found or already has correct status")
        
    except Exception as e:
        print(f"❌ Failed: {e}")
        raise
    finally:
        client.close()
        print("🔌 Database connection closed")

if __name__ == "__main__":
    asyncio.run(fix_rajsir742_status())
