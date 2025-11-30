#!/usr/bin/env python3
"""
Match Invitations to Registered Users (Retroactive Fix)

This script matches invitation emails with registered users and updates
the invitation status to "accepted" if the user exists.

Usage:
    python match_invitations_to_users.py [--dry-run]
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from config import Settings

settings = Settings()


async def match_invitations_to_users(dry_run=True):
    """
    Match invitations to registered users by email
    
    Args:
        dry_run: If True, only show what would be updated without making changes
    """
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("=" * 80)
    print("🔍 MATCHING INVITATIONS TO REGISTERED USERS")
    print("=" * 80)
    print(f"Database: {settings.database_name}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will update database)'}")
    print()
    
    # Get all invitations that are NOT already accepted
    invitations_cursor = db.invitations.find({
        "$or": [
            {"emailStatus": {"$ne": "ACCEPTED"}},
            {"registeredUsername": {"$exists": False}},
            {"registeredUsername": None}
        ],
        "archived": False
    })
    
    invitations = await invitations_cursor.to_list(length=None)
    total_invitations = len(invitations)
    
    print(f"📊 Found {total_invitations} invitations to check")
    print()
    
    matched_count = 0
    not_matched_count = 0
    errors = []
    
    # Check each invitation
    for idx, invitation in enumerate(invitations, 1):
        email = invitation.get("email")
        name = invitation.get("name")
        
        if not email:
            print(f"  ⚠️  [{idx}/{total_invitations}] Invitation {invitation['_id']} has no email")
            continue
        
        # Look for user with this email in contactEmail field
        user = await db.users.find_one({
            "contactEmail": email
        })
        
        if user:
            username = user.get("username")
            registered_at = user.get("created_at") or user.get("createdAt")
            
            matched_count += 1
            print(f"  ✅ [{idx}/{total_invitations}] MATCH: {name} ({email}) → User: {username}")
            print(f"      Registered: {registered_at}")
            
            if not dry_run:
                # Update invitation status
                try:
                    result = await db.invitations.update_one(
                        {"_id": invitation["_id"]},
                        {
                            "$set": {
                                "emailStatus": "ACCEPTED",
                                "smsStatus": "ACCEPTED",
                                "registeredUsername": username,
                                "registeredAt": registered_at,
                                "updatedAt": datetime.utcnow()
                            }
                        }
                    )
                    
                    if result.modified_count > 0:
                        print(f"      ✅ Invitation updated!")
                    else:
                        print(f"      ⚠️  No changes made (already up to date?)")
                except Exception as e:
                    error_msg = f"Failed to update invitation {invitation['_id']}: {e}"
                    errors.append(error_msg)
                    print(f"      ❌ {error_msg}")
        else:
            not_matched_count += 1
            if idx % 10 == 0 or idx <= 5:  # Show first 5 and every 10th
                print(f"  ⏭️  [{idx}/{total_invitations}] No user found: {name} ({email})")
    
    # Summary
    print()
    print("=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    print(f"Total Invitations Checked: {total_invitations}")
    print(f"✅ Matched (user exists): {matched_count}")
    print(f"⏭️  Not Matched (no user): {not_matched_count}")
    
    if not dry_run:
        print(f"✅ Invitations Updated: {matched_count}")
        if errors:
            print(f"❌ Errors: {len(errors)}")
            for error in errors:
                print(f"   - {error}")
    else:
        print()
        print("⚠️  DRY RUN MODE - No changes were made to the database")
        print("   Run without --dry-run to apply changes")
    
    print("=" * 80)
    
    # Verification query
    if not dry_run and matched_count > 0:
        print()
        print("🔍 VERIFICATION")
        print("-" * 80)
        
        accepted_count = await db.invitations.count_documents({
            "emailStatus": "ACCEPTED"
        })
        
        with_username_count = await db.invitations.count_documents({
            "registeredUsername": {"$exists": True, "$ne": None}
        })
        
        print(f"Total Accepted Invitations: {accepted_count}")
        print(f"Total with Registered Username: {with_username_count}")
        print()
    
    # Close connection
    client.close()
    
    return {
        "total": total_invitations,
        "matched": matched_count,
        "not_matched": not_matched_count,
        "errors": len(errors)
    }


async def main():
    """Main entry point"""
    # Check for dry-run flag
    dry_run = True
    if len(sys.argv) > 1 and sys.argv[1] == "--live":
        dry_run = False
        
        # Require confirmation for live run
        print("=" * 80)
        print("⚠️  WARNING: LIVE MODE")
        print("=" * 80)
        print("This will UPDATE invitation records in the database.")
        print()
        confirmation = input("Type 'YES' to proceed with live update: ")
        
        if confirmation != "YES":
            print("❌ Cancelled - confirmation did not match")
            return
        print()
    
    # Run matching
    results = await match_invitations_to_users(dry_run=dry_run)
    
    # Exit code based on results
    if results["errors"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
