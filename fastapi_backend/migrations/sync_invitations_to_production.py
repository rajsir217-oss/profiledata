#!/usr/bin/env python3
"""
Sync invitations from local MongoDB to production MongoDB
Copies all invitations with all fixes applied (cleaned emails, correct status, etc.)

Usage:
    python sync_invitations_to_production.py --dry-run  # Preview only
    python sync_invitations_to_production.py            # Actually sync
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
import argparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

# Local settings
local_settings = Settings()
local_mongodb_url = local_settings.mongodb_url

# Production MongoDB URL - update this or use environment variable
production_mongodb_url = os.getenv(
    'PRODUCTION_MONGODB_URL',
    'mongodb+srv://rajl3v3l_db_user:3F01eZUHTY9tx07u@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority&appName=MongoCluster0'
)


async def sync_invitations(dry_run=True):
    """Copy invitations from local to production MongoDB"""
    
    print("=" * 80)
    print("INVITATION SYNC: LOCAL → PRODUCTION")
    print("=" * 80)
    print()
    
    # Connect to local MongoDB
    print("📡 Connecting to LOCAL MongoDB...")
    local_client = AsyncIOMotorClient(local_mongodb_url)
    local_db = local_client[local_settings.database_name]
    
    # Connect to production MongoDB
    print("📡 Connecting to PRODUCTION MongoDB...")
    # Disable SSL certificate verification for local connections to Atlas
    prod_client = AsyncIOMotorClient(
        production_mongodb_url,
        tlsAllowInvalidCertificates=True
    )
    prod_db = prod_client[local_settings.database_name]
    
    try:
        # Test connections
        await local_client.server_info()
        print("✅ Connected to LOCAL MongoDB")
        
        await prod_client.server_info()
        print("✅ Connected to PRODUCTION MongoDB")
        print()
        
        # Get local invitations
        print("📥 Fetching invitations from LOCAL...")
        local_invitations = await local_db.invitations.find({}).to_list(None)
        print(f"✅ Found {len(local_invitations)} invitations in LOCAL")
        print()
        
        # Show sample invitation
        if local_invitations:
            sample = local_invitations[0]
            print("📋 Sample invitation:")
            print(f"   Name: {sample.get('name')}")
            print(f"   Email: {sample.get('email')}")
            print(f"   Status: {sample.get('emailStatus')}")
            print(f"   Comments: {sample.get('comments', 'N/A')}")
            print(f"   Subject: {sample.get('emailSubject', 'N/A')[:50]}...")
            print()
        
        # Count existing in production
        prod_count = await prod_db.invitations.count_documents({})
        print(f"📊 Current PRODUCTION count: {prod_count} invitations")
        print()
        
        if dry_run:
            print("🔍 DRY RUN MODE - No changes will be made")
            print()
            print("Would perform:")
            if prod_count > 0:
                print(f"  1. DELETE {prod_count} existing invitations from PRODUCTION")
            print(f"  2. INSERT {len(local_invitations)} invitations to PRODUCTION")
            print()
            print("Run without --dry-run to actually sync")
        else:
            # Confirm before proceeding
            print("⚠️  WARNING: This will REPLACE all production invitations!")
            print(f"   - DELETE: {prod_count} existing invitations")
            print(f"   - INSERT: {len(local_invitations)} new invitations")
            print()
            
            response = input("Type 'yes' to continue: ")
            if response.lower() != 'yes':
                print("❌ Sync cancelled")
                return
            
            print()
            print("🔄 Starting sync...")
            
            # Delete existing invitations in production
            if prod_count > 0:
                print(f"🗑️  Deleting {prod_count} existing invitations from PRODUCTION...")
                result = await prod_db.invitations.delete_many({})
                print(f"✅ Deleted {result.deleted_count} invitations")
            
            # Insert local invitations to production
            print(f"📤 Inserting {len(local_invitations)} invitations to PRODUCTION...")
            if local_invitations:
                result = await prod_db.invitations.insert_many(local_invitations)
                print(f"✅ Inserted {len(result.inserted_ids)} invitations")
            
            # Verify final count
            final_count = await prod_db.invitations.count_documents({})
            print()
            print("=" * 80)
            print("✅ SYNC COMPLETE!")
            print("=" * 80)
            print(f"📊 PRODUCTION now has: {final_count} invitations")
            
            # Verify by status
            pending_count = await prod_db.invitations.count_documents({'emailStatus': 'pending'})
            sent_count = await prod_db.invitations.count_documents({'emailStatus': 'sent'})
            print(f"   - Pending: {pending_count}")
            print(f"   - Sent: {sent_count}")
            print()
    
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        local_client.close()
        prod_client.close()


def main():
    parser = argparse.ArgumentParser(
        description='Sync invitations from local to production MongoDB'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without actually syncing'
    )
    
    args = parser.parse_args()
    
    # Check if production URL is configured
    if 'username:password' in production_mongodb_url:
        print("❌ ERROR: Production MongoDB URL not configured!")
        print()
        print("Please set PRODUCTION_MONGODB_URL environment variable:")
        print("  export PRODUCTION_MONGODB_URL='mongodb+srv://user:pass@cluster.mongodb.net'")
        print()
        print("Or edit this script and replace the placeholder URL")
        sys.exit(1)
    
    asyncio.run(sync_invitations(dry_run=args.dry_run))


if __name__ == '__main__':
    main()
