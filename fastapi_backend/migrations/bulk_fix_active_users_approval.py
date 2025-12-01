"""
BULK FIX: Sync adminApprovalStatus for ALL active users
Updates all users where accountStatus='active' but adminApprovalStatus='pending'
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
    """Bulk fix all active users with pending approval status"""
    
    settings = Settings()
    
    print(f"🌍 Environment: {os.getenv('APP_ENVIRONMENT', 'not set')}")
    print(f"🗄️  Database: {settings.database_name}")
    print(f"🔗 MongoDB URL: {settings.mongodb_url[:50]}..." if settings.mongodb_url else "NOT SET")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("=" * 80)
    print("🔧 BULK FIX: Sync Admin Approval Status for Active Users")
    print("=" * 80)
    
    # Find all users with mismatch
    query = {
        "accountStatus": "active",
        "adminApprovalStatus": {"$ne": "approved"}  # Not equal to "approved"
    }
    
    print(f"\n🔍 Searching for users with mismatch...")
    print(f"   Query: accountStatus='active' AND adminApprovalStatus!='approved'")
    
    users_to_fix = await db.users.find(query).to_list(length=None)
    
    if not users_to_fix:
        print(f"\n✅ No users found with mismatch - all users are correctly configured!")
        client.close()
        return
    
    print(f"\n⚠️  Found {len(users_to_fix)} users with mismatch:")
    print(f"   {'Username':<20} {'accountStatus':<15} {'adminApprovalStatus':<20}")
    print(f"   {'-'*20} {'-'*15} {'-'*20}")
    
    for user in users_to_fix[:20]:  # Show first 20
        username = user.get('username', 'N/A')
        account_status = user.get('accountStatus', 'N/A')
        admin_approval = user.get('adminApprovalStatus', 'N/A')
        print(f"   {username:<20} {account_status:<15} {admin_approval:<20}")
    
    if len(users_to_fix) > 20:
        print(f"   ... and {len(users_to_fix) - 20} more users")
    
    # Confirm before proceeding
    print(f"\n" + "=" * 80)
    print(f"⚠️  CONFIRMATION REQUIRED")
    print(f"=" * 80)
    print(f"About to update {len(users_to_fix)} users:")
    print(f"   - Set adminApprovalStatus='approved'")
    print(f"   - Set adminApprovedBy='system_migration'")
    print(f"   - Set adminApprovedAt=<current timestamp>")
    print(f"\nThis is a PRODUCTION database update.")
    
    # Auto-proceed (since script requires manual run with --force flag)
    response = input(f"\nType 'YES' to proceed: ")
    
    if response.strip().upper() != 'YES':
        print(f"\n❌ Aborted by user")
        client.close()
        return
    
    # Perform bulk update
    print(f"\n🔧 Applying bulk update...")
    now = datetime.utcnow()
    
    update_data = {
        "$set": {
            "adminApprovalStatus": "approved",
            "adminApprovedBy": "system_migration",
            "adminApprovedAt": now.isoformat(),
            "updatedAt": now.isoformat()
        }
    }
    
    result = await db.users.update_many(query, update_data)
    
    if result.modified_count > 0:
        print(f"\n✅ Successfully updated {result.modified_count} users!")
        print(f"   - Matched: {result.matched_count}")
        print(f"   - Modified: {result.modified_count}")
        
        # Verify the update
        remaining = await db.users.count_documents(query)
        if remaining == 0:
            print(f"\n✅ VERIFICATION PASSED: No more mismatches found!")
        else:
            print(f"\n⚠️  WARNING: {remaining} users still have mismatches")
    else:
        print(f"\n⚠️  No users were modified")
        print(f"   - Matched: {result.matched_count}")
        print(f"   - Modified: {result.modified_count}")
    
    client.close()
    print("\n" + "=" * 80)
    print("🎉 Bulk fix complete!")
    print("💡 Users should log out and log back in to refresh their sessions.")
    print("=" * 80)

if __name__ == "__main__":
    # Check for --force flag
    if len(sys.argv) < 2 or sys.argv[1] != '--force':
        print("=" * 80)
        print("⚠️  BULK MIGRATION SCRIPT - PRODUCTION DATABASE")
        print("=" * 80)
        print(f"\nThis script will update ALL users with:")
        print(f"  accountStatus='active' AND adminApprovalStatus!='approved'")
        print(f"\nTo run this script, use:")
        print(f"  python3 {sys.argv[0]} --force")
        print(f"\n⚠️  This affects PRODUCTION data. Make sure you understand the impact!")
        print("=" * 80)
        sys.exit(1)
    
    asyncio.run(main())
