#!/usr/bin/env python3
"""
Fix Missing Invitation Tokens
- Finds invitations with null/missing invitationToken
- Generates unique tokens for each
- Updates the database
"""

import asyncio
import sys
import os
import secrets
import string
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()


def generate_token(length: int = 32) -> str:
    """Generate secure random token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def fix_missing_tokens():
    """Find and fix invitations with missing tokens"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("=" * 80)
    print("🔧 FIXING MISSING INVITATION TOKENS")
    print("=" * 80)
    
    # Find invitations with null or missing invitationToken
    missing_token_count = await db.invitations.count_documents({
        "$or": [
            {"invitationToken": {"$exists": False}},
            {"invitationToken": None}
        ]
    })
    
    print(f"\n📊 Found {missing_token_count} invitations without tokens")
    
    if missing_token_count == 0:
        print("✅ All invitations already have tokens!")
        client.close()
        return
    
    # Show sample
    print("\nSample invitations to fix:")
    cursor = db.invitations.find({
        "$or": [
            {"invitationToken": {"$exists": False}},
            {"invitationToken": None}
        ]
    }).limit(5)
    
    async for inv in cursor:
        print(f"  - {inv.get('name')} ({inv.get('email')})")
    
    # Confirm
    response = input(f"\nProceed with fixing {missing_token_count} invitations? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("❌ Operation cancelled")
        client.close()
        return
    
    # Fix each invitation
    cursor = db.invitations.find({
        "$or": [
            {"invitationToken": {"$exists": False}},
            {"invitationToken": None}
        ]
    })
    
    fixed_count = 0
    token_expiry = datetime.utcnow() + timedelta(days=90)  # 90-day expiry for retroactive tokens
    
    async for invitation in cursor:
        # Generate unique token
        token = generate_token()
        
        # Update invitation
        result = await db.invitations.update_one(
            {"_id": invitation["_id"]},
            {
                "$set": {
                    "invitationToken": token,
                    "tokenExpiresAt": token_expiry,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            fixed_count += 1
            if fixed_count % 50 == 0:
                print(f"  Progress: {fixed_count}/{missing_token_count} fixed...")
    
    print(f"\n✅ Fixed {fixed_count} invitations")
    
    # Verify
    remaining = await db.invitations.count_documents({
        "$or": [
            {"invitationToken": {"$exists": False}},
            {"invitationToken": None}
        ]
    })
    
    if remaining > 0:
        print(f"\n⚠️  Warning: {remaining} invitations still have missing tokens")
    else:
        print("\n✅ All invitations now have valid tokens!")
    
    # Show new URL format
    sample = await db.invitations.find_one({"invitationToken": {"$ne": None}})
    if sample:
        print(f"\n📧 Sample invitation link:")
        print(f"   {settings.app_url}/register2?invitation={sample['invitationToken']}&email={sample['email']}")
    
    client.close()
    
    print("\n" + "=" * 80)
    print("✅ TOKEN FIX COMPLETE")
    print("=" * 80)
    print("\nNext steps:")
    print("1. Resend invitations to users who received 'invitation=None' links")
    print("2. New invitation links will now have proper tokens")
    print("3. Users can successfully register and be tracked")


if __name__ == "__main__":
    asyncio.run(fix_missing_tokens())
