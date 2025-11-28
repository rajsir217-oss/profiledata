"""
Migration: Deprecate status.status, migrate fully to accountStatus

Purpose: Consolidate two competing status systems into one unified accountStatus field
Created: 2025-11-28

Background:
- Legacy system used: status.status (nested object)
- New system uses: accountStatus (simple string)
- This causes data inconsistencies and confusion

This migration:
1. Syncs all users from status.status → accountStatus
2. Keeps status.last_seen for activity tracking
3. Archives old status data in status.legacy for rollback
4. Provides dry-run mode for safety

Usage:
    # Dry run (see what would change)
    python migrations/migrate_to_accountstatus.py --dry-run
    
    # Live migration
    python migrations/migrate_to_accountstatus.py
    
    # Fix specific user
    python migrations/migrate_to_accountstatus.py --username lak421
"""

import asyncio
import sys
import argparse
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()


# Status mapping from legacy to new format
STATUS_MAPPING = {
    'pending': 'pending_admin_approval',
    'active': 'active',
    'inactive': 'deactivated',
    'suspended': 'suspended',
    'banned': 'suspended',
    'paused': 'paused',
    'pending_email_verification': 'pending_email_verification',
    'pending_admin_approval': 'pending_admin_approval',
    'deactivated': 'deactivated',
}


def get_account_status_from_legacy(status_field):
    """
    Extract accountStatus from legacy status field
    
    Args:
        status_field: Can be dict, string, or None
        
    Returns:
        Mapped accountStatus value
    """
    if status_field is None:
        return 'active'  # Default for old users
    
    if isinstance(status_field, dict):
        legacy_status = status_field.get('status', 'active')
    elif isinstance(status_field, str):
        legacy_status = status_field
    else:
        return 'active'
    
    # Map to new format
    return STATUS_MAPPING.get(legacy_status, legacy_status)


async def migrate_users(dry_run=True, specific_username=None):
    """
    Migrate all users from status.status to accountStatus
    
    Args:
        dry_run: If True, only reports changes without applying them
        specific_username: If provided, only migrate this user
    """
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("=" * 80)
    print("MIGRATE TO ACCOUNTSTATUS - DEPRECATE status.status")
    print("=" * 80)
    print(f"Mode: {'🔍 DRY RUN (no changes)' if dry_run else '⚡ LIVE (making changes)'}")
    print(f"Database: {settings.database_name}")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    if specific_username:
        print(f"Target: Single user '{specific_username}'")
    else:
        print(f"Target: All users")
    print("=" * 80)
    print()
    
    # Build query
    if specific_username:
        query = {"username": specific_username}
    else:
        query = {}
    
    # Get all users
    users = await db.users.find(query).to_list(None)
    
    if not users:
        print("❌ No users found matching criteria")
        client.close()
        return
    
    print(f"📊 Found {len(users)} user(s) to process\n")
    
    # Track statistics
    stats = {
        'total': len(users),
        'no_change_needed': 0,
        'synced': 0,
        'created_accountstatus': 0,
        'conflicts_resolved': 0,
        'errors': 0
    }
    
    changes_log = []
    
    for user in users:
        username = user.get('username', 'UNKNOWN')
        
        try:
            # Get current values
            current_account_status = user.get('accountStatus')
            status_field = user.get('status')
            
            # Determine what accountStatus should be
            if status_field:
                if isinstance(status_field, dict):
                    legacy_status = status_field.get('status', 'active')
                    last_seen = status_field.get('last_seen')
                else:
                    legacy_status = status_field if isinstance(status_field, str) else 'active'
                    last_seen = None
            else:
                legacy_status = 'active'
                last_seen = None
            
            # Map to accountStatus format
            target_account_status = STATUS_MAPPING.get(legacy_status, legacy_status)
            
            # Check if change needed
            if current_account_status == target_account_status:
                stats['no_change_needed'] += 1
                continue
            
            # Determine action
            if current_account_status is None:
                action = f"CREATE accountStatus: {target_account_status}"
                stats['created_accountstatus'] += 1
            elif current_account_status != target_account_status:
                action = f"SYNC {current_account_status} → {target_account_status}"
                if current_account_status in ['paused']:
                    # Don't override paused status
                    print(f"⚠️  {username}: SKIP - User is paused, keeping accountStatus='paused'")
                    stats['no_change_needed'] += 1
                    continue
                stats['conflicts_resolved'] += 1
            else:
                stats['synced'] += 1
                action = "SYNC"
            
            change_info = {
                'username': username,
                'action': action,
                'from': current_account_status,
                'to': target_account_status,
                'legacy_status': legacy_status
            }
            changes_log.append(change_info)
            
            print(f"✏️  {username}: {action}")
            print(f"    Legacy status.status: '{legacy_status}'")
            print(f"    Current accountStatus: {current_account_status}")
            print(f"    Target accountStatus: '{target_account_status}'")
            
            if not dry_run:
                # Prepare update
                update_doc = {
                    "$set": {
                        "accountStatus": target_account_status,
                        "status": {
                            "last_seen": last_seen,  # Keep activity tracking
                            "legacy": status_field,  # Archive old data for rollback
                            "migrated_at": datetime.utcnow(),
                            "migrated_from": legacy_status
                        }
                    }
                }
                
                # Apply update
                result = await db.users.update_one(
                    {"_id": user["_id"]},
                    update_doc
                )
                
                if result.modified_count > 0:
                    print(f"    ✅ Updated successfully")
                else:
                    print(f"    ⚠️  No changes made")
                    stats['errors'] += 1
            
            print()
            
        except Exception as e:
            print(f"❌ {username}: ERROR - {str(e)}\n")
            stats['errors'] += 1
            continue
    
    # Print summary
    print("=" * 80)
    print("MIGRATION SUMMARY")
    print("=" * 80)
    print(f"Total users processed: {stats['total']}")
    print(f"✅ No change needed: {stats['no_change_needed']}")
    print(f"📝 Created accountStatus: {stats['created_accountstatus']}")
    print(f"🔄 Synced from status.status: {stats['synced']}")
    print(f"⚡ Conflicts resolved: {stats['conflicts_resolved']}")
    print(f"❌ Errors: {stats['errors']}")
    print("=" * 80)
    
    if dry_run:
        print("\n💡 This was a DRY RUN - no changes were made")
        print("   Run without --dry-run to apply changes")
    else:
        print("\n✅ Migration completed successfully!")
        print("   Old status.status data archived in status.legacy")
        print("   Activity tracking preserved in status.last_seen")
    
    print("\n📋 Changes log:")
    for change in changes_log:
        print(f"   - {change['username']}: {change['action']}")
    
    client.close()


async def rollback_migration(specific_username=None):
    """
    Rollback migration by restoring from status.legacy
    
    Args:
        specific_username: If provided, only rollback this user
    """
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("=" * 80)
    print("ROLLBACK MIGRATION")
    print("=" * 80)
    
    query = {"status.legacy": {"$exists": True}}
    if specific_username:
        query["username"] = specific_username
    
    users = await db.users.find(query).to_list(None)
    
    if not users:
        print("❌ No users found with legacy data to rollback")
        client.close()
        return
    
    print(f"📊 Found {len(users)} user(s) to rollback\n")
    
    for user in users:
        username = user.get('username')
        legacy_data = user.get('status', {}).get('legacy')
        
        if legacy_data:
            print(f"⏮️  {username}: Restoring status.status from backup")
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {"status": legacy_data},
                    "$unset": {"status.legacy": "", "status.migrated_at": "", "status.migrated_from": ""}
                }
            )
            print(f"    ✅ Restored\n")
    
    print("✅ Rollback completed")
    client.close()


def main():
    parser = argparse.ArgumentParser(description='Migrate from status.status to accountStatus')
    parser.add_argument('--dry-run', action='store_true', help='Show what would change without applying')
    parser.add_argument('--username', type=str, help='Migrate specific user only')
    parser.add_argument('--rollback', action='store_true', help='Rollback migration')
    
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration(args.username))
    else:
        asyncio.run(migrate_users(dry_run=args.dry_run, specific_username=args.username))


if __name__ == "__main__":
    main()
