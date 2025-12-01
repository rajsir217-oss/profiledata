"""
Fix account status for ramsir1995 user in PRODUCTION
CRITICAL: This user shows as "Active" in admin but "pending" on frontend
"""

import asyncio
import sys
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force production environment
os.environ['APP_ENVIRONMENT'] = 'production'

from config import Settings

async def main():
    """Fix user account status in PRODUCTION"""
    
    settings = Settings()
    
    print(f"🌍 Environment: {os.getenv('APP_ENVIRONMENT', 'not set')}")
    print(f"🗄️  Database: {settings.database_name}")
    print(f"🔗 MongoDB URL: {settings.mongodb_url[:50]}..." if settings.mongodb_url else "NOT SET")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("=" * 80)
    print("🔧 Fixing Account Status for: ramsir1995")
    print("=" * 80)
    
    # Find user
    user = await db.users.find_one({"username": "ramsir1995"})
    
    if not user:
        print(f"\n⚠️  User 'ramsir1995' not found in database!")
        client.close()
        return
    
    print(f"\n📋 Current User Status:")
    print(f"   - username: {user.get('username')}")
    print(f"   - accountStatus: {user.get('accountStatus')}")
    print(f"   - adminApprovalStatus: {user.get('adminApprovalStatus')}")
    print(f"   - emailVerified: {user.get('emailVerified')}")
    print(f"   - role_name: {user.get('role_name')}")
    
    # Check if fix is needed
    if user.get('accountStatus') == 'active' and user.get('adminApprovalStatus') == 'approved':
        print(f"\n✅ User status is already correct - no fix needed!")
        client.close()
        return
    
    if user.get('accountStatus') == 'active' and user.get('adminApprovalStatus') == 'pending':
        print(f"\n⚠️  MISMATCH DETECTED:")
        print(f"   - accountStatus: active ✅")
        print(f"   - adminApprovalStatus: pending ❌ (should be 'approved')")
        print(f"   This mismatch causes 'pending' message on frontend!")
    
    print(f"\n🔧 Applying Fix:")
    print(f"   - Keeping accountStatus: 'active' (no change)")
    print(f"   - Updating adminApprovalStatus: 'pending' → 'approved'")
    print(f"   - Adding adminApprovedAt timestamp")
    
    # Update ONLY adminApprovalStatus (keep accountStatus as-is)
    now = datetime.utcnow()
    update_data = {
        "adminApprovalStatus": "approved",
        "adminApprovedAt": now.isoformat(),
        "adminApprovedBy": "admin",
        "updatedAt": now.isoformat()
    }
    
    # Only update emailVerified if it's False
    if not user.get('emailVerified'):
        update_data["emailVerified"] = True
        print(f"   - Setting emailVerified: True")
    
    result = await db.users.update_one(
        {"username": "ramsir1995"},
        {"$set": update_data}
    )
    
    if result.modified_count > 0:
        print(f"\n✅ Successfully updated user status!")
        print(f"   - Modified {result.modified_count} document(s)")
        
        # Verify the update
        updated_user = await db.users.find_one({"username": "ramsir1995"})
        print(f"\n📋 Updated User Status:")
        print(f"   - accountStatus: {updated_user.get('accountStatus')}")
        print(f"   - adminApprovalStatus: {updated_user.get('adminApprovalStatus')}")
        print(f"   - emailVerified: {updated_user.get('emailVerified')}")
        print(f"   - adminApprovedBy: {updated_user.get('adminApprovedBy')}")
        print(f"   - adminApprovedAt: {updated_user.get('adminApprovedAt')}")
    else:
        print(f"\n⚠️ No changes made - user may already have correct status")
    
    client.close()
    print("\n" + "=" * 80)
    print("🎉 Fix complete! User should now have full access.")
    print("💡 Have the user log out and log back in to refresh their session.")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
