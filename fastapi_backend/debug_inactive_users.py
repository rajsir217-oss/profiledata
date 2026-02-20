#!/usr/bin/env python3
"""
Debug script to check inactive users data directly
"""

import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from config import Settings

async def debug_inactive_users():
    """Debug the inactive users query step by step"""
    
    print("🔍 Debugging Inactive Users Query")
    print("=" * 50)
    
    # Connect to database
    settings = Settings()
    print(f"MongoDB URL: {settings.mongodb_url}")
    print(f"Database: {settings.database_name}")
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Test basic connection
        print("\n1. Testing database connection...")
        await db.command('ping')
        print("✅ Database connection successful")
        
        # Count total users
        print("\n2. Counting total users...")
        total_users = await db.users.count_documents({})
        print(f"Total users: {total_users}")
        
        # Count active users
        print("\n3. Counting active users...")
        active_users = await db.users.count_documents({"accountStatus": "active"})
        print(f"Active users: {active_users}")
        
        # Check users with updatedAt
        print("\n4. Users with updatedAt field...")
        users_with_updated = await db.users.count_documents({
            "accountStatus": "active",
            "updatedAt": {"$exists": True, "$ne": None}
        })
        print(f"Active users with updatedAt: {users_with_updated}")
        
        # Sample some users to check data structure
        print("\n5. Sample user data...")
        sample_users = await db.users.find({
            "accountStatus": "active",
            "updatedAt": {"$exists": True}
        }).limit(3).to_list(length=3)
        
        for i, user in enumerate(sample_users, 1):
            print(f"\n  User {i}: {user.get('username', 'Unknown')}")
            print(f"    Account Status: {user.get('accountStatus', 'Unknown')}")
            print(f"    Updated At: {user.get('updatedAt')} (type: {type(user.get('updatedAt'))})")
            
            # Calculate days inactive
            updated = user.get('updatedAt')
            if updated:
                today = datetime.utcnow()
                if isinstance(updated, str):
                    try:
                        parsed = datetime.fromisoformat(updated.replace('Z', '+00:00'))
                        days = (today - parsed.replace(tzinfo=None)).days
                        print(f"    Days inactive: {days}")
                    except Exception as e:
                        print(f"    Parse error: {e}")
                elif isinstance(updated, datetime):
                    days = (today - updated).days
                    print(f"    Days inactive: {days}")
        
        # Test the actual query
        print("\n6. Testing actual inactive users query...")
        today = datetime.utcnow()
        fifteen_days_ago = today - timedelta(days=15)
        fifteen_days_ago_str = fifteen_days_ago.strftime("%Y-%m-%d")
        
        print(f"Today: {today}")
        print(f"15 days ago: {fifteen_days_ago} ({fifteen_days_ago_str})")
        
        # Build the match stage
        match_stage = {
            "accountStatus": "active",
            "updatedAt": {"$exists": True, "$ne": None},
            "$or": [
                {"updatedAt": {"$lt": fifteen_days_ago_str}},
                {"updatedAt": {"$lt": fifteen_days_ago}}
            ]
        }
        
        print(f"\nMatch stage: {match_stage}")
        
        # Count matching users
        inactive_count = await db.users.count_documents(match_stage)
        print(f"Users inactive 15+ days: {inactive_count}")
        
        if inactive_count > 0:
            # Get sample inactive users
            inactive_users = await db.users.find(match_stage).limit(5).to_list(length=5)
            print(f"\nSample inactive users:")
            for user in inactive_users:
                updated = user.get('updatedAt')
                username = user.get('username', 'Unknown')
                print(f"  - {username}: {updated}")
        else:
            print("\n❌ No inactive users found!")
            print("This could mean:")
            print("  - All users are recently active")
            print("  - updatedAt field format issue")
            print("  - Date comparison logic issue")
            
            # Debug: Show recent users
            print("\n7. Checking recently active users...")
            recent_users = await db.users.find({
                "accountStatus": "active",
                "updatedAt": {"$exists": True}
            }).sort("updatedAt", -1).limit(5).to_list(length=5)
            
            print("Most recently active users:")
            for user in recent_users:
                updated = user.get('updatedAt')
                username = user.get('username', 'Unknown')
                print(f"  - {username}: {updated}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(debug_inactive_users())
