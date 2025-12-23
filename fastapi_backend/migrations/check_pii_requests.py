#!/usr/bin/env python3
"""
Debug: Check PII requests in production
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = os.environ.get('MONGODB_URL')
DATABASE_NAME = os.environ.get('DATABASE_NAME', 'matrimonialDB')

if not MONGODB_URL:
    print("❌ Error: MONGODB_URL environment variable is required")
    sys.exit(1)


async def run_check():
    print("=" * 60)
    print("Debug: Check PII Requests")
    print("=" * 60)
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Get all pending requests
        pending_requests = await db.pii_requests.find({"status": "pending"}).to_list(length=100)
        
        print(f"\n📧 Found {len(pending_requests)} pending requests total")
        
        if pending_requests:
            print("\n📋 All pending requests:")
            for req in pending_requests:
                requester = req.get('requesterUsername', 'unknown')
                requested = req.get('requestedUsername', 'unknown')
                
                # Check all possible date fields
                created_at = req.get('createdAt')
                requested_at = req.get('requestedAt')
                updated_at = req.get('updatedAt')
                
                print(f"\n   {requester} → {requested}")
                print(f"      _id: {req.get('_id')}")
                print(f"      status: {req.get('status')}")
                print(f"      createdAt: {created_at} (type: {type(created_at).__name__})")
                print(f"      requestedAt: {requested_at} (type: {type(requested_at).__name__})")
                print(f"      updatedAt: {updated_at}")
                print(f"      piiTypes: {req.get('piiTypes')}")
                
                # Calculate age
                date_field = created_at or requested_at
                if date_field:
                    if isinstance(date_field, datetime):
                        age = datetime.utcnow() - date_field
                        print(f"      Age: {age.days} days, {age.seconds // 3600} hours")
                    else:
                        print(f"      Age: Cannot calculate (date is {type(date_field).__name__})")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(run_check())
