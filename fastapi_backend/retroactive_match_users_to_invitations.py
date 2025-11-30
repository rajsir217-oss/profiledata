#!/usr/bin/env python3
"""
Retroactively Match Existing Users to Their Invitations

This script finds users who already registered, decrypts their emails,
and updates their corresponding invitations to "ACCEPTED" status.

Usage:
    python retroactive_match_users_to_invitations.py [--dry-run]
"""

import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Check if running in production mode (via environment variables)
USE_PRODUCTION = os.getenv("USE_PRODUCTION") == "true"

if USE_PRODUCTION:
    # Production mode: Use environment variables directly (don't load config files)
    print("🔧 Using PRODUCTION environment variables (not loading .env files)")
    
    class ProductionSettings:
        mongodb_url = os.getenv("MONGODB_URL")
        database_name = os.getenv("DATABASE_NAME", "matrimonialDB")
        encryption_key = os.getenv("ENCRYPTION_KEY")
        
        if not mongodb_url or not encryption_key:
            raise ValueError("MONGODB_URL and ENCRYPTION_KEY must be set in environment")
    
    settings = ProductionSettings()
    
    # Import PIIEncryption and initialize with our settings
    from cryptography.fernet import Fernet
    
    class PIIEncryption:
        def __init__(self, encryption_key: str):
            try:
                if isinstance(encryption_key, str):
                    encryption_key = encryption_key.encode()
                self.cipher = Fernet(encryption_key)
            except Exception as e:
                raise ValueError(f"Invalid encryption key: {e}") from e
        
        def decrypt(self, encrypted_value: str) -> str:
            """Decrypt a value"""
            try:
                if not encrypted_value:
                    return ""
                decrypted_bytes = self.cipher.decrypt(encrypted_value.encode())
                return decrypted_bytes.decode()
            except Exception as e:
                raise ValueError(f"Failed to decrypt: {e}") from e
    
else:
    # Local development: Use config file and crypto_utils
    from config import Settings
    from crypto_utils import PIIEncryption
    settings = Settings()


async def retroactive_match_users(dry_run=True):
    """
    Match existing users to invitations by decrypting emails
    
    Args:
        dry_run: If True, only show what would be updated without making changes
    """
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Initialize encryption
    try:
        encryption = PIIEncryption(settings.encryption_key)
    except Exception as e:
        print(f"❌ Failed to initialize encryption: {e}")
        print("   Make sure ENCRYPTION_KEY is set in .env")
        client.close()
        return {"error": str(e)}
    
    print("=" * 80)
    print("🔄 RETROACTIVE MATCHING: Users → Invitations")
    print("=" * 80)
    print(f"Database: {settings.database_name}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will update database)'}")
    print()
    
    # Get all users
    users_cursor = db.users.find({})
    users = await users_cursor.to_list(length=None)
    total_users = len(users)
    
    print(f"📊 Found {total_users} registered users")
    print()
    
    matched_count = 0
    not_matched_count = 0
    already_matched_count = 0
    errors = []
    
    # Check each user
    for idx, user in enumerate(users, 1):
        username = user.get("username")
        encrypted_email = user.get("contactEmail")
        registered_at = user.get("created_at") or user.get("createdAt")
        
        if not encrypted_email:
            print(f"  ⚠️  [{idx}/{total_users}] User {username} has no contactEmail")
            continue
        
        # Decrypt email
        try:
            decrypted_email = encryption.decrypt(encrypted_email)
        except Exception as e:
            error_msg = f"Failed to decrypt email for {username}: {e}"
            errors.append(error_msg)
            print(f"  ❌ [{idx}/{total_users}] {error_msg}")
            continue
        
        # Look for invitation with this email
        invitation = await db.invitations.find_one({
            "email": decrypted_email,
            "archived": False
        })
        
        if invitation:
            # Check if already matched
            if invitation.get("registeredUsername"):
                already_matched_count += 1
                if idx <= 5:  # Show first 5
                    print(f"  ↪️  [{idx}/{total_users}] ALREADY MATCHED: {username} ({decrypted_email})")
                    print(f"      Invitation already linked to: {invitation.get('registeredUsername')}")
                continue
            
            matched_count += 1
            print(f"  ✅ [{idx}/{total_users}] MATCH FOUND: {username} ({decrypted_email})")
            print(f"      User registered: {registered_at}")
            print(f"      Invitation created: {invitation.get('createdAt')}")
            
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
                    error_msg = f"Failed to update invitation for {username}: {e}"
                    errors.append(error_msg)
                    print(f"      ❌ {error_msg}")
        else:
            not_matched_count += 1
            if idx % 5 == 0 or idx <= 3:  # Show first 3 and every 5th
                print(f"  ⏭️  [{idx}/{total_users}] No invitation found: {username} ({decrypted_email})")
    
    # Summary
    print()
    print("=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    print(f"Total Users Checked: {total_users}")
    print(f"✅ Matched (invitation found): {matched_count}")
    print(f"↪️  Already Matched: {already_matched_count}")
    print(f"⏭️  Not Matched (no invitation): {not_matched_count}")
    
    if not dry_run:
        print(f"✅ Invitations Updated: {matched_count}")
        if errors:
            print(f"❌ Errors: {len(errors)}")
            for error in errors:
                print(f"   - {error}")
    else:
        print()
        print("⚠️  DRY RUN MODE - No changes were made to the database")
        print("   Run with --live to apply changes")
    
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
        "total": total_users,
        "matched": matched_count,
        "already_matched": already_matched_count,
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
        print("⚠️  WARNING: LIVE MODE - RETROACTIVE MATCHING")
        print("=" * 80)
        print("This will UPDATE invitation records for existing users.")
        print("It will decrypt user emails and match them to invitations.")
        print()
        confirmation = input("Type 'YES' to proceed with live update: ")
        
        if confirmation != "YES":
            print("❌ Cancelled - confirmation did not match")
            return
        print()
    
    # Run matching
    results = await retroactive_match_users(dry_run=dry_run)
    
    # Exit code based on results
    if "error" in results:
        sys.exit(1)
    elif results["errors"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
