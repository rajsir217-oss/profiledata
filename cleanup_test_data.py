#!/usr/bin/env python3
"""
Cleanup test data from matrimonial database
Removes test profiles, interactions, and related data
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

async def cleanup_database():
    """Remove all test data and reset database to clean state"""
    
    print("🧹 Starting database cleanup...")
    print(f"🔗 Connecting to MongoDB: {MONGO_URL}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Get current statistics
        print("\n📊 Current Database State:")
        users_count = await db.users.count_documents({})
        messages_count = await db.messages.count_documents({})
        favorites_count = await db.favorites.count_documents({})
        shortlist_count = await db.shortlist.count_documents({})
        exclusions_count = await db.exclusions.count_documents({})
        profile_views_count = await db.profile_views.count_documents({})
        pii_requests_count = await db.pii_access_requests.count_documents({})
        
        print(f"   Users: {users_count}")
        print(f"   Messages: {messages_count}")
        print(f"   Favorites: {favorites_count}")
        print(f"   Shortlists: {shortlist_count}")
        print(f"   Exclusions: {exclusions_count}")
        print(f"   Profile Views: {profile_views_count}")
        print(f"   PII Requests: {pii_requests_count}")
        
        # Ask for confirmation
        print("\n⚠️  WARNING: This will delete ALL data from the database!")
        confirm = input("Type 'DELETE' to confirm: ")
        
        if confirm != "DELETE":
            print("❌ Cleanup cancelled")
            return
        
        print("\n🗑️  Deleting data...")
        
        # Delete collections (except admin users)
        # Keep admin and any users with role='admin'
        
        # Delete test users (keep admin accounts)
        users_result = await db.users.delete_many({
            "username": {"$ne": "admin"},
            "$or": [
                {"status.updatedBy": "system_test_generation"},
                {"status.updatedBy": "system_migration"},
                {"username": {"$regex": "^[a-z]+[a-z]+[0-9]{3}$"}},  # Matches generated usernames
                {"username": {"$regex": "v2[0-9]+$"}},  # Matches old batch usernames
            ]
        })
        
        # Delete all interactions
        favorites_result = await db.favorites.delete_many({})
        shortlist_result = await db.shortlist.delete_many({})
        exclusions_result = await db.exclusions.delete_many({})
        messages_result = await db.messages.delete_many({})
        profile_views_result = await db.profile_views.delete_many({})
        pii_requests_result = await db.pii_access_requests.delete_many({})
        
        print(f"\n✅ Cleanup Results:")
        print(f"   Deleted users: {users_result.deleted_count}")
        print(f"   Deleted messages: {messages_result.deleted_count}")
        print(f"   Deleted favorites: {favorites_result.deleted_count}")
        print(f"   Deleted shortlists: {shortlist_result.deleted_count}")
        print(f"   Deleted exclusions: {exclusions_result.deleted_count}")
        print(f"   Deleted profile views: {profile_views_result.deleted_count}")
        print(f"   Deleted PII requests: {pii_requests_result.deleted_count}")
        
        # Show remaining data
        remaining_users = await db.users.count_documents({})
        print(f"\n📊 Remaining Data:")
        print(f"   Users (admin accounts): {remaining_users}")
        
        # List remaining users
        if remaining_users > 0:
            remaining = await db.users.find({}, {"username": 1, "firstName": 1, "lastName": 1}).to_list(100)
            print("\n👤 Remaining Users:")
            for user in remaining:
                print(f"   - {user['username']} ({user.get('firstName', '')} {user.get('lastName', '')})")
        
        print("\n✨ Database cleanup complete!")
        
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        client.close()
        print(f"\n🔌 Database connection closed")

async def cleanup_specific_patterns():
    """Remove only specific test data patterns (safer option)"""
    
    print("🧹 Starting selective cleanup...")
    print(f"🔗 Connecting to MongoDB: {MONGO_URL}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Show what will be deleted
        print("\n🔍 Finding test data patterns...")
        
        # Pattern 1: Generated usernames (lowercase + lowercase + 3 digits)
        pattern1 = await db.users.count_documents({
            "username": {"$regex": "^[a-z]+[a-z]+[0-9]{3}$"}
        })
        
        # Pattern 2: Old batch (v2 suffix)
        pattern2 = await db.users.count_documents({
            "username": {"$regex": "v2[0-9]+$"}
        })
        
        # Pattern 3: Test generation marker
        pattern3 = await db.users.count_documents({
            "status.updatedBy": "system_test_generation"
        })
        
        print(f"\n📊 Test Data Found:")
        print(f"   Generated pattern usernames: {pattern1}")
        print(f"   Old batch (v2) usernames: {pattern2}")
        print(f"   System test generation marker: {pattern3}")
        
        total_to_delete = await db.users.count_documents({
            "$or": [
                {"username": {"$regex": "^[a-z]+[a-z]+[0-9]{3}$"}},
                {"username": {"$regex": "v2[0-9]+$"}},
                {"status.updatedBy": "system_test_generation"}
            ]
        })
        
        print(f"\n⚠️  Total users to delete: {total_to_delete}")
        
        if total_to_delete == 0:
            print("✅ No test data found!")
            return
        
        confirm = input("\nType 'YES' to delete these test users: ")
        
        if confirm != "YES":
            print("❌ Cleanup cancelled")
            return
        
        # Get usernames to delete
        users_to_delete = await db.users.find({
            "$or": [
                {"username": {"$regex": "^[a-z]+[a-z]+[0-9]{3}$"}},
                {"username": {"$regex": "v2[0-9]+$"}},
                {"status.updatedBy": "system_test_generation"}
            ]
        }, {"username": 1}).to_list(1000)
        
        usernames = [u["username"] for u in users_to_delete]
        
        print(f"\n🗑️  Deleting {len(usernames)} test users and their interactions...")
        
        # Delete users
        users_result = await db.users.delete_many({
            "username": {"$in": usernames}
        })
        
        # Delete related interactions
        favorites_result = await db.favorites.delete_many({
            "$or": [
                {"userUsername": {"$in": usernames}},
                {"favoriteUsername": {"$in": usernames}}
            ]
        })
        
        shortlist_result = await db.shortlist.delete_many({
            "$or": [
                {"userUsername": {"$in": usernames}},
                {"shortlistedUsername": {"$in": usernames}}
            ]
        })
        
        exclusions_result = await db.exclusions.delete_many({
            "$or": [
                {"userUsername": {"$in": usernames}},
                {"excludedUsername": {"$in": usernames}}
            ]
        })
        
        messages_result = await db.messages.delete_many({
            "$or": [
                {"sender": {"$in": usernames}},
                {"receiver": {"$in": usernames}}
            ]
        })
        
        profile_views_result = await db.profile_views.delete_many({
            "$or": [
                {"profileUsername": {"$in": usernames}},
                {"viewedByUsername": {"$in": usernames}}
            ]
        })
        
        pii_requests_result = await db.pii_access_requests.delete_many({
            "$or": [
                {"requesterUsername": {"$in": usernames}},
                {"profileOwnerUsername": {"$in": usernames}}
            ]
        })
        
        print(f"\n✅ Cleanup Results:")
        print(f"   Deleted users: {users_result.deleted_count}")
        print(f"   Deleted favorites: {favorites_result.deleted_count}")
        print(f"   Deleted shortlists: {shortlist_result.deleted_count}")
        print(f"   Deleted exclusions: {exclusions_result.deleted_count}")
        print(f"   Deleted messages: {messages_result.deleted_count}")
        print(f"   Deleted profile views: {profile_views_result.deleted_count}")
        print(f"   Deleted PII requests: {pii_requests_result.deleted_count}")
        
        print("\n✨ Selective cleanup complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        client.close()
        print(f"\n🔌 Database connection closed")

if __name__ == "__main__":
    print("=" * 70)
    print("  MATRIMONIAL APP - DATABASE CLEANUP UTILITY")
    print("=" * 70)
    
    print("\n🔧 Cleanup Options:")
    print("  1. Full cleanup (delete ALL data except admin)")
    print("  2. Selective cleanup (delete only test data patterns)")
    print("  3. Cancel")
    
    choice = input("\nSelect option (1/2/3): ")
    
    if choice == "1":
        asyncio.run(cleanup_database())
    elif choice == "2":
        asyncio.run(cleanup_specific_patterns())
    else:
        print("❌ Cancelled")
    
    print("=" * 70)
