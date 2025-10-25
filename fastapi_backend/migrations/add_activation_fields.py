"""
Migration: Add activation fields to existing users
Date: October 25, 2025
Reason: Adding email verification and admin approval system

This migration:
1. Adds activation fields to all existing users
2. Sets existing users to "active" status (they're already registered)
3. Marks their email as verified (legacy users)
4. Sets admin approval to "approved" (legacy users)
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path so we can import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()

async def add_activation_fields():
    """Add activation fields to existing users"""
    print("🔄 Starting activation fields migration...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Count users without activation fields
        users_without_fields = await db.users.count_documents(
            {"accountStatus": {"$exists": False}}
        )
        
        print(f"📊 Found {users_without_fields} users without activation fields")
        
        if users_without_fields == 0:
            print("✅ No users need migration. All users already have activation fields.")
            return
        
        # Update all users without activation fields
        # For existing users, we'll set them as active and verified
        result = await db.users.update_many(
            {"accountStatus": {"$exists": False}},
            {
                "$set": {
                    # Account Activation & Onboarding
                    "accountStatus": "active",  # Existing users are already active
                    "emailVerificationToken": None,
                    "emailVerificationTokenExpiry": None,
                    "emailVerificationSentAt": None,
                    "emailVerificationAttempts": 0,
                    "onboardingCompleted": True,  # Consider them onboarded
                    "onboardingCompletedAt": datetime.utcnow(),
                    # Verification Status
                    "emailVerified": True,  # Assume existing users have valid emails
                    "emailVerifiedAt": datetime.utcnow(),
                    "phoneVerified": False,
                    "phoneVerifiedAt": None,
                    # Admin Approval
                    "adminApprovalStatus": "approved",  # Existing users are pre-approved
                    "adminApprovedBy": "system_migration",
                    "adminApprovedAt": datetime.utcnow(),
                    "adminRejectionReason": None
                }
            }
        )
        
        print(f"\n📊 Migration Summary:")
        print(f"  ✅ Updated {result.modified_count} users")
        print(f"  📧 All existing users marked as email verified")
        print(f"  ✓ All existing users marked as admin approved")
        print(f"  🎯 All existing users set to 'active' status")
        print(f"  ✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        client.close()
        print("🔌 Database connection closed")

if __name__ == "__main__":
    asyncio.run(add_activation_fields())
