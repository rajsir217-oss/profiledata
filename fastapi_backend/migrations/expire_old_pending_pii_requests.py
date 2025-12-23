#!/usr/bin/env python3
"""
Migration: Expire old pending PII requests (PRODUCTION)

This migration updates pending PII requests older than 14 days to 'expired' status.

Run on production with: 
  MONGODB_URL="mongodb+srv://..." DATABASE_NAME="matrimonialDB" python migrations/expire_old_pending_pii_requests.py
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient

# Get MongoDB URL directly from environment variable (bypasses config)
MONGODB_URL = os.environ.get('MONGODB_URL')
DATABASE_NAME = os.environ.get('DATABASE_NAME', 'matrimonialDB')

if not MONGODB_URL:
    print("❌ Error: MONGODB_URL environment variable is required")
    print("Usage: MONGODB_URL='mongodb+srv://...' python migrations/expire_old_pending_pii_requests.py")
    sys.exit(1)


async def run_migration():
    """Expire old pending PII requests"""
    
    print("=" * 60)
    print("Migration: Expire Old Pending PII Requests")
    print(f"Database: {DATABASE_NAME}")
    print(f"MongoDB: {MONGODB_URL[:50]}...")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Calculate cutoff date (14 days ago)
        pending_expiry_days = 14
        cutoff_date = datetime.utcnow() - timedelta(days=pending_expiry_days)
        
        print(f"\n📅 Cutoff date: {cutoff_date.isoformat()} ({pending_expiry_days} days ago)")
        
        # Find pending requests older than 14 days
        pending_query = {
            "status": "pending",
            "$or": [
                {"createdAt": {"$lt": cutoff_date}},
                {"requestedAt": {"$lt": cutoff_date}}
            ]
        }
        
        # Count first
        pending_count = await db.pii_requests.count_documents(pending_query)
        print(f"\n📧 Found {pending_count} pending requests older than {pending_expiry_days} days")
        
        if pending_count == 0:
            print("\n✅ No old pending requests to expire!")
            return
        
        # Show some examples
        print("\n📋 Sample requests to be expired:")
        sample_requests = await db.pii_requests.find(pending_query).limit(5).to_list(length=5)
        for req in sample_requests:
            requester = req.get('requesterUsername', 'unknown')
            requested = req.get('requestedUsername', 'unknown')
            created = req.get('createdAt') or req.get('requestedAt')
            print(f"   - {requester} → {requested} (created: {created})")
        
        # Confirm before proceeding
        print(f"\n⚠️  About to expire {pending_count} pending requests...")
        confirm = input("Type 'yes' to proceed: ")
        
        if confirm.lower() != 'yes':
            print("❌ Migration cancelled")
            return
        
        # Update status to "expired"
        result = await db.pii_requests.update_many(
            pending_query,
            {
                "$set": {
                    "status": "expired",
                    "expiredAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        print(f"\n🎉 Migration complete!")
        print(f"   Expired: {result.modified_count} pending requests")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
