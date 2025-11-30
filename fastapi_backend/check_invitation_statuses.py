#!/usr/bin/env python3
"""
Check invitation statuses in MongoDB to debug why accepted invitations don't show up
"""

import asyncio
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_database


async def check_invitation_statuses():
    """Check invitation statuses in the database"""
    db = await get_database()
    
    print("=" * 80)
    print("🔍 INVITATION STATUS CHECKER")
    print("=" * 80)
    
    # Total invitations
    total = await db.invitations.count_documents({})
    print(f"\n📊 Total Invitations: {total}")
    
    # Count by emailStatus
    print("\n📧 Email Status Breakdown:")
    pipeline = [
        {"$group": {"_id": "$emailStatus", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    async for status_count in db.invitations.aggregate(pipeline):
        status = status_count["_id"] if status_count["_id"] else "null"
        count = status_count["count"]
        print(f"   {status}: {count}")
    
    # Count by smsStatus
    print("\n📱 SMS Status Breakdown:")
    pipeline = [
        {"$group": {"_id": "$smsStatus", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    async for status_count in db.invitations.aggregate(pipeline):
        status = status_count["_id"] if status_count["_id"] else "null"
        count = status_count["count"]
        print(f"   {status}: {count}")
    
    # Count invitations with registeredAt
    registered_count = await db.invitations.count_documents({
        "registeredAt": {"$ne": None}
    })
    print(f"\n✅ Invitations with registeredAt field set: {registered_count}")
    
    # Count invitations with registeredUsername
    registered_username_count = await db.invitations.count_documents({
        "registeredUsername": {"$ne": None}
    })
    print(f"✅ Invitations with registeredUsername field set: {registered_username_count}")
    
    # Show sample accepted invitations
    print("\n" + "=" * 80)
    print("📋 SAMPLE ACCEPTED INVITATIONS (if any):")
    print("=" * 80)
    
    cursor = db.invitations.find({
        "registeredAt": {"$ne": None}
    }).limit(5)
    
    count = 0
    async for invitation in cursor:
        count += 1
        print(f"\n🎯 Invitation #{count}:")
        print(f"   Name: {invitation.get('name', 'N/A')}")
        print(f"   Email: {invitation.get('email', 'N/A')}")
        print(f"   Email Status: {invitation.get('emailStatus', 'N/A')}")
        print(f"   SMS Status: {invitation.get('smsStatus', 'N/A')}")
        print(f"   Registered Username: {invitation.get('registeredUsername', 'N/A')}")
        print(f"   Registered At: {invitation.get('registeredAt', 'N/A')}")
        print(f"   Invited By: {invitation.get('invitedBy', 'N/A')}")
        print(f"   Archived: {invitation.get('archived', False)}")
    
    if count == 0:
        print("\n⚠️  No accepted invitations found in database!")
        print("   This means either:")
        print("   1. No one has registered via invitation link, OR")
        print("   2. The registration process is not calling /api/invitations/accept/{token}")
    
    # Check for invitations with emailStatus="accepted" but no registeredAt
    print("\n" + "=" * 80)
    print("🔍 CHECKING FOR INCONSISTENCIES:")
    print("=" * 80)
    
    inconsistent = await db.invitations.count_documents({
        "emailStatus": "accepted",
        "registeredAt": None
    })
    
    if inconsistent > 0:
        print(f"\n⚠️  Found {inconsistent} invitations with emailStatus='accepted' but registeredAt is null!")
        print("   Showing samples:")
        
        cursor = db.invitations.find({
            "emailStatus": "accepted",
            "registeredAt": None
        }).limit(3)
        
        async for inv in cursor:
            print(f"\n   - {inv.get('name')} ({inv.get('email')})")
            print(f"     Email Status: {inv.get('emailStatus')}")
            print(f"     Registered At: {inv.get('registeredAt')}")
    
    # Check the opposite: registeredAt but status not "accepted"
    inconsistent2 = await db.invitations.count_documents({
        "registeredAt": {"$ne": None},
        "emailStatus": {"$ne": "accepted"}
    })
    
    if inconsistent2 > 0:
        print(f"\n⚠️  Found {inconsistent2} invitations with registeredAt but emailStatus != 'accepted'!")
        print("   Showing samples:")
        
        cursor = db.invitations.find({
            "registeredAt": {"$ne": None},
            "emailStatus": {"$ne": "accepted"}
        }).limit(3)
        
        async for inv in cursor:
            print(f"\n   - {inv.get('name')} ({inv.get('email')})")
            print(f"     Email Status: {inv.get('emailStatus')}")
            print(f"     Registered At: {inv.get('registeredAt')}")
            print(f"     Registered Username: {inv.get('registeredUsername')}")
    
    print("\n" + "=" * 80)
    print("✅ DIAGNOSIS COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(check_invitation_statuses())
