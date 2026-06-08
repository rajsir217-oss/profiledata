#!/usr/bin/env python3
"""
Script to clean up old contribution_activity records
Options:
1. Delete records older than N days
2. Set up TTL index for automatic cleanup
3. Archive old data before deletion
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os
import argparse
import json

load_dotenv()

async def setup_ttl_index(days=90):
    """Set up TTL index for automatic cleanup"""
    
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        print(f"🔧 Setting up TTL index to delete records after {days} days...")
        
        # Drop existing index on timestamp if any
        try:
            await db.contribution_activity.drop_index("timestamp_1")
            print("   Dropped existing index on timestamp")
        except:
            pass
        
        # Create TTL index
        expire_seconds = days * 24 * 60 * 60
        result = await db.contribution_activity.create_index(
            "timestamp", 
            expireAfterSeconds=expire_seconds
        )
        
        print(f"✅ TTL index created successfully!")
        print(f"   Records will be automatically deleted after {days} days")
        print(f"   Index name: {result}")
        
    except Exception as e:
        print(f"❌ Error setting up TTL index: {e}")
    finally:
        client.close()

async def delete_old_records(days=90, dry_run=True, archive=False):
    """Delete records older than specified days"""
    
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        print(f"🗑️  {'DRY RUN: ' if dry_run else ''}Deleting records older than {days} days ({cutoff_date})")
        
        # Count records to be deleted
        count = await db.contribution_activity.count_documents({"timestamp": {"$lt": cutoff_date}})
        
        if count == 0:
            print("✅ No records to delete!")
            return
        
        print(f"📊 Found {count:,} records to delete")
        
        if dry_run:
            print("   This is a dry run - no records will be deleted")
            print("   Run with --no-dry-run to actually delete")
            return
        
        # Archive if requested
        if archive:
            print("📦 Archiving records before deletion...")
            archive_data = []
            async for doc in db.contribution_activity.find({"timestamp": {"$lt": cutoff_date}}):
                doc["_id"] = str(doc["_id"])
                doc["timestamp"] = doc["timestamp"].isoformat()
                archive_data.append(doc)
            
            # Save to file
            filename = f"activity_archive_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            with open(filename, 'w') as f:
                json.dump(archive_data, f, indent=2)
            print(f"   Archived {len(archive_data)} records to {filename}")
        
        # Delete records
        result = await db.contribution_activity.delete_many({"timestamp": {"$lt": cutoff_date}})
        print(f"✅ Deleted {result.deleted_count:,} records")
        
        # Update stats
        remaining = await db.contribution_activity.count_documents({})
        print(f"📊 Remaining records: {remaining:,}")
        
    except Exception as e:
        print(f"❌ Error deleting records: {e}")
    finally:
        client.close()

async def archive_old_records(days=90):
    """Archive old records without deleting"""
    
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        print(f"📦 Archiving records older than {days} days ({cutoff_date})")
        
        count = await db.contribution_activity.count_documents({"timestamp": {"$lt": cutoff_date}})
        
        if count == 0:
            print("✅ No records to archive!")
            return
        
        print(f"📊 Found {count:,} records to archive")
        
        # Fetch and archive
        archive_data = []
        async for doc in db.contribution_activity.find({"timestamp": {"$lt": cutoff_date}}):
            doc["_id"] = str(doc["_id"])
            doc["timestamp"] = doc["timestamp"].isoformat()
            archive_data.append(doc)
        
        # Save to file
        filename = f"activity_archive_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(archive_data, f, indent=2)
        
        print(f"✅ Archived {len(archive_data)} records to {filename}")
        print(f"   File size: {os.path.getsize(filename) / (1024*1024):.2f} MB")
        
    except Exception as e:
        print(f"❌ Error archiving records: {e}")
    finally:
        client.close()

async def main():
    parser = argparse.ArgumentParser(description="Clean up contribution activity log")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # TTL index command
    ttl_parser = subparsers.add_parser('setup-ttl', help='Set up TTL index for automatic cleanup')
    ttl_parser.add_argument('--days', type=int, default=90, help='Days after which to delete records (default: 90)')
    
    # Delete command
    delete_parser = subparsers.add_parser('delete', help='Delete old records')
    delete_parser.add_argument('--days', type=int, default=90, help='Delete records older than this many days (default: 90)')
    delete_parser.add_argument('--no-dry-run', action='store_true', help='Actually delete records (default is dry run)')
    delete_parser.add_argument('--archive', action='store_true', help='Archive records before deleting')
    
    # Archive command
    archive_parser = subparsers.add_parser('archive', help='Archive old records without deleting')
    archive_parser.add_argument('--days', type=int, default=90, help='Archive records older than this many days (default: 90)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'setup-ttl':
        await setup_ttl_index(args.days)
    elif args.command == 'delete':
        await delete_old_records(args.days, dry_run=not args.no_dry_run, archive=args.archive)
    elif args.command == 'archive':
        await archive_old_records(args.days)

if __name__ == "__main__":
    asyncio.run(main())
