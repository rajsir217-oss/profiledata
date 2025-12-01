"""
Migration: Fix uppercase ACCEPTED to lowercase accepted in invitations

Issue: Retroactive job was setting emailStatus/smsStatus to "ACCEPTED" (uppercase)
but the InvitationStatus enum uses "accepted" (lowercase).

This migration fixes the 17 invitations that were incorrectly updated.
"""

import asyncio
import sys
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings

async def main():
    """Fix uppercase ACCEPTED status to lowercase accepted"""
    
    settings = Settings()
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("=" * 80)
    print("🔧 Fixing Invitation Status Case")
    print("=" * 80)
    
    # Find invitations with uppercase "ACCEPTED"
    uppercase_email = await db.invitations.count_documents({
        "emailStatus": "ACCEPTED"
    })
    
    uppercase_sms = await db.invitations.count_documents({
        "smsStatus": "ACCEPTED"
    })
    
    print(f"\n📊 Found:")
    print(f"   - {uppercase_email} invitations with emailStatus='ACCEPTED' (uppercase)")
    print(f"   - {uppercase_sms} invitations with smsStatus='ACCEPTED' (uppercase)")
    
    if uppercase_email == 0 and uppercase_sms == 0:
        print("\n✅ No invitations need fixing!")
        client.close()
        return
    
    # Fix emailStatus
    if uppercase_email > 0:
        result = await db.invitations.update_many(
            {"emailStatus": "ACCEPTED"},
            {
                "$set": {
                    "emailStatus": "accepted",
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        print(f"\n✅ Fixed {result.modified_count} invitations: emailStatus ACCEPTED -> accepted")
    
    # Fix smsStatus
    if uppercase_sms > 0:
        result = await db.invitations.update_many(
            {"smsStatus": "ACCEPTED"},
            {
                "$set": {
                    "smsStatus": "accepted",
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        print(f"✅ Fixed {result.modified_count} invitations: smsStatus ACCEPTED -> accepted")
    
    # Verify
    print("\n" + "=" * 80)
    print("🔍 Verification:")
    print("=" * 80)
    
    accepted_count = await db.invitations.count_documents({
        "emailStatus": "accepted"
    })
    
    uppercase_remaining = await db.invitations.count_documents({
        "emailStatus": "ACCEPTED"
    })
    
    print(f"   ✅ Invitations with emailStatus='accepted': {accepted_count}")
    print(f"   ❌ Invitations with emailStatus='ACCEPTED': {uppercase_remaining}")
    
    if uppercase_remaining > 0:
        print(f"\n⚠️  WARNING: {uppercase_remaining} invitations still have uppercase status!")
    else:
        print("\n✅ All invitations now have correct lowercase status!")
    
    # Show sample
    print("\n" + "=" * 80)
    print("📋 Sample of Fixed Invitations:")
    print("=" * 80)
    
    cursor = db.invitations.find({
        "emailStatus": "accepted",
        "registeredUsername": {"$exists": True, "$ne": None}
    }).limit(5)
    
    async for inv in cursor:
        print(f"\n   Name: {inv.get('name')}")
        print(f"   Email: {inv.get('email')}")
        print(f"   Status: {inv.get('emailStatus')} (email) / {inv.get('smsStatus')} (sms)")
        print(f"   Registered: {inv.get('registeredUsername')} at {inv.get('registeredAt')}")
    
    client.close()
    print("\n" + "=" * 80)
    print("✅ Migration Complete!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
