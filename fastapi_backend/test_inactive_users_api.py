#!/usr/bin/env python3
"""
Test script for the inactive users API
Run this to verify the API is working correctly
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from config import Settings

async def test_inactive_users_api():
    """Test the inactive users API logic"""
    
    print("🔍 Testing Inactive Users API Logic")
    print("=" * 50)
    
    # Connect to database
    settings = Settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        today = datetime.utcnow()
        fifteen_days_ago = today - timedelta(days=15)
        fifteen_days_ago_str = fifteen_days_ago.strftime("%Y-%m-%d")
        
        print(f"Today: {today}")
        print(f"15 days ago: {fifteen_days_ago} ({fifteen_days_ago_str})")
        
        # Test the query logic step by step
        print("\n📊 Testing Query Logic:")
        
        # Step 1: Count active users
        total_active = await db.users.count_documents({"accountStatus": "active"})
        print(f"Total active users: {total_active}")
        
        # Step 2: Count users with updatedAt
        users_with_updated = await db.users.count_documents({
            "accountStatus": "active",
            "updatedAt": {"$exists": True, "$ne": None}
        })
        print(f"Users with updatedAt: {users_with_updated}")
        
        # Step 3: Test the main query (simplified)
        print("\n🔍 Testing Main Query:")
        
        # Create the match stage as in the API
        match_stage = {
            "accountStatus": "active",
            "updatedAt": {"$exists": True, "$ne": None},
            "$or": [
                {"updatedAt": {"$lt": fifteen_days_ago_str}},  # String dates
                {"updatedAt": {"$lt": fifteen_days_ago}}       # DateTime objects
            ]
        }
        
        # Count users matching the criteria
        inactive_count = await db.users.count_documents(match_stage)
        print(f"Users inactive 15+ days: {inactive_count}")
        
        if inactive_count > 0:
            # Get sample users
            sample_users = await db.users.find(match_stage).limit(3).to_list(length=3)
            
            print("\n📋 Sample Inactive Users:")
            for user in sample_users:
                updated = user.get("updatedAt")
                username = user.get("username")
                
                print(f"\n  👤 {username}")
                print(f"     Updated: {updated}")
                print(f"     Type: {type(updated)}")
                
                # Calculate days
                if isinstance(updated, str):
                    try:
                        parsed = datetime.fromisoformat(updated.replace('Z', '+00:00'))
                        days = (today - parsed.replace(tzinfo=None)).days
                        print(f"     Days inactive: {days}")
                    except Exception as e:
                        print(f"     Parse error: {e}")
                elif isinstance(updated, datetime):
                    days = (today - updated).days
                    print(f"     Days inactive: {days}")
                
                print(f"     Gender: {user.get('gender', 'Unknown')}")
                print(f"     Email: {user.get('email', 'N/A')}")
        else:
            print("\n❌ No inactive users found!")
            print("This could mean:")
            print("  - All users are recently active")
            print("  - updatedAt field format issue")
            print("  - Date comparison logic issue")
            
            # Debug: Show some sample updatedAt values
            print("\n🔍 Debug: Sample updatedAt values:")
            sample_any = await db.users.find({"accountStatus": "active"}).limit(5).to_list(length=5)
            for user in sample_any:
                updated = user.get("updatedAt")
                print(f"  {user['username']}: {updated} ({type(updated)})")
        
        print("\n✅ Test completed!")
        
    except Exception as e:
        print(f"\n❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_inactive_users_api())
