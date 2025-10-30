"""
Database Cleanup and Seed Script
- Keeps: admin, testuser, lokeshjain, yogeshmukherjee010
- Removes: All other users and their related data
- Seeds: 50 male + 50 female realistic users for L3V3L matching

Usage: python3 admin_tools/cleanup_and_seed.py
"""

import asyncio
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from seed_data_generator import generate_all_users

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "matrimonialDB")

# Users to preserve
PROTECTED_USERS = ["admin", "testuser", "lokeshjain", "yogeshmukherjee010"]

async def cleanup_database(db):
    """Remove all users except protected ones and clean related data"""
    print("\n🧹 PHASE 1: DATABASE CLEANUP")
    print("=" * 60)
    
    # Find users to delete (all except protected)
    users_to_delete = await db.users.find({
        "username": {"$nin": PROTECTED_USERS}
    }).to_list(None)
    
    usernames_to_delete = [u["username"] for u in users_to_delete]
    print(f"📊 Found {len(usernames_to_delete)} users to delete (keeping {len(PROTECTED_USERS)} protected users)")
    
    if len(usernames_to_delete) == 0:
        print("✅ No users to delete")
        return 0
    
    # Collections to clean
    collections_to_clean = {
        "users": "username",
        "favorites": ["userUsername", "favoriteUsername"],
        "shortlists": ["userUsername", "shortlistedUsername"],
        "exclusions": ["userUsername", "excludedUsername"],
        "messages": ["senderUsername", "receiverUsername"],
        "conversations": ["participants"],  # Array field
        "profile_views": ["viewedByUsername", "profileUsername"],
        "pii_access": ["requesterUsername", "profileOwnerUsername"],
        "pii_requests": ["requesterUsername", "profileOwnerUsername"],
        "activity_logs": "username",
        "notification_queue": "username",
        "notification_log": "username",
        "notification_preferences": "username"
    }
    
    deleted_counts = {}
    
    for collection_name, field in collections_to_clean.items():
        try:
            if collection_name not in await db.list_collection_names():
                continue
                
            if isinstance(field, list):
                # Multiple fields to check (OR condition)
                query = {"$or": [{f: {"$in": usernames_to_delete}} for f in field]}
            elif field == "participants":
                # Array field - check if any participant is in delete list
                query = {"participants": {"$in": usernames_to_delete}}
            else:
                # Single field
                query = {field: {"$in": usernames_to_delete}}
            
            result = await db[collection_name].delete_many(query)
            deleted_counts[collection_name] = result.deleted_count
            print(f"  ✅ {collection_name}: Deleted {result.deleted_count} records")
        except Exception as e:
            print(f"  ⚠️ {collection_name}: Error - {e}")
    
    print(f"\n✅ Cleanup complete! Total deleted:")
    for collection, count in deleted_counts.items():
        if count > 0:
            print(f"   - {collection}: {count}")
    
    return sum(deleted_counts.values())

async def seed_users(db):
    """Seed 50 male + 50 female users"""
    print("\n🌱 PHASE 2: SEEDING NEW USERS")
    print("=" * 60)
    
    # Generate users
    print("📝 Generating 100 user profiles (50 male + 50 female)...")
    users = generate_all_users()
    
    # Check for username conflicts
    existing_usernames = set(PROTECTED_USERS)
    unique_users = []
    for user in users:
        if user["username"] not in existing_usernames:
            unique_users.append(user)
            existing_usernames.add(user["username"])
    
    print(f"✅ Generated {len(unique_users)} unique user profiles")
    
    # Insert users
    if len(unique_users) > 0:
        try:
            result = await db.users.insert_many(unique_users)
            print(f"✅ Successfully inserted {len(result.inserted_ids)} users")
            
            # Show sample
            print("\n📋 Sample users created:")
            for i, user in enumerate(unique_users[:5]):
                print(f"   {i+1}. {user['username']} - {user['firstName']} {user['lastName']} ({user['gender']}, {user['age']}, {user['location']})")
            if len(unique_users) > 5:
                print(f"   ... and {len(unique_users) - 5} more")
            
            return len(result.inserted_ids)
        except Exception as e:
            print(f"❌ Error inserting users: {e}")
            return 0
    else:
        print("⚠️ No users to insert")
        return 0

async def verify_data(db):
    """Verify database state after cleanup and seed"""
    print("\n🔍 PHASE 3: VERIFICATION")
    print("=" * 60)
    
    # Count users
    total_users = await db.users.count_documents({})
    protected_count = await db.users.count_documents({"username": {"$in": PROTECTED_USERS}})
    new_users_count = total_users - protected_count
    
    male_count = await db.users.count_documents({"gender": "Male", "username": {"$nin": PROTECTED_USERS}})
    female_count = await db.users.count_documents({"gender": "Female", "username": {"$nin": PROTECTED_USERS}})
    
    print(f"✅ Total users in database: {total_users}")
    print(f"   - Protected users: {protected_count} {PROTECTED_USERS}")
    print(f"   - New seeded users: {new_users_count}")
    print(f"     • Male: {male_count}")
    print(f"     • Female: {female_count}")
    
    # Check L3V3L scores
    users_with_scores = await db.users.count_documents({"l3v3lScores": {"$exists": True}})
    print(f"   - Users with L3V3L scores: {users_with_scores}")
    
    # Check profile completeness
    avg_completeness = await db.users.aggregate([
        {"$match": {"username": {"$nin": PROTECTED_USERS}}},
        {"$group": {"_id": None, "avg": {"$avg": "$profileCompleteness"}}}
    ]).to_list(1)
    
    if avg_completeness:
        print(f"   - Average profile completeness: {avg_completeness[0]['avg']:.1f}%")
    
    print("\n✅ Verification complete!")

async def main():
    """Main execution"""
    print("\n" + "="*60)
    print("🚀 L3V3L MATCH DATABASE CLEANUP & SEED")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Database: {DATABASE_NAME}")
    print(f"Protected users: {', '.join(PROTECTED_USERS)}")
    
    # Ask for confirmation
    print("\n⚠️  WARNING: This will DELETE all users except protected ones!")
    response = input("Type 'YES' to continue: ")
    
    if response != "YES":
        print("❌ Aborted by user")
        return
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Phase 1: Cleanup
        deleted = await cleanup_database(db)
        
        # Phase 2: Seed
        seeded = await seed_users(db)
        
        # Phase 3: Verify
        await verify_data(db)
        
        print("\n" + "="*60)
        print("🎉 SUCCESS!")
        print("="*60)
        print(f"Summary:")
        print(f"  - Records deleted: {deleted}")
        print(f"  - Users seeded: {seeded}")
        print(f"  - Protected users preserved: {len(PROTECTED_USERS)}")
        print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
