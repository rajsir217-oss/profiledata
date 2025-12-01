"""
Migration: Add city and country aliases for L3V3L scoring

Problem: L3V3L scoring expects 'city' and 'country' fields,
but frontend/backend use 'location' and 'countryOfResidence'.

Solution: Copy values from location → city and countryOfResidence → country
for all existing users where these alias fields are missing.
"""

import asyncio
import sys
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Force production environment BEFORE importing Settings
os.environ['APP_ENVIRONMENT'] = 'production'

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings

async def main():
    """Migrate location → city and countryOfResidence → country"""
    
    settings = Settings()
    
    print("🔧 Loading configuration for environment: production")
    print("✅ Loaded configuration from .env.production")
    print(f"🗄️  Database: {settings.database_name}")
    print(f"🔗 MongoDB URL: {settings.mongodb_url[:50]}...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("\n" + "=" * 80)
    print("🔄 L3V3L Field Mapping Migration")
    print("=" * 80)
    
    print("\n📋 What this migration does:")
    print("   - Copies 'location' → 'city' (for L3V3L scoring)")
    print("   - Copies 'countryOfResidence' → 'country' (for L3V3L scoring)")
    print("   - Only updates users missing these alias fields")
    
    # Find users with location but no city field
    users_needing_city = await db.users.count_documents({
        "location": {"$exists": True, "$ne": ""},
        "$or": [
            {"city": {"$exists": False}},
            {"city": ""}
        ]
    })
    
    # Find users with countryOfResidence but no country field
    users_needing_country = await db.users.count_documents({
        "countryOfResidence": {"$exists": True, "$ne": ""},
        "$or": [
            {"country": {"$exists": False}},
            {"country": ""}
        ]
    })
    
    print(f"\n📊 Found:")
    print(f"   - {users_needing_city} users need 'city' field added")
    print(f"   - {users_needing_country} users need 'country' field added")
    
    if users_needing_city == 0 and users_needing_country == 0:
        print("\n✅ No users need migration - all fields are already mapped!")
        client.close()
        return
    
    # Confirm before proceeding
    print(f"\n⚠️  This will update {max(users_needing_city, users_needing_country)} user records")
    response = input("Do you want to proceed? (yes/no): ")
    
    if response.lower() != 'yes':
        print("\n❌ Migration cancelled by user")
        client.close()
        return
    
    print("\n🔄 Starting migration...")
    
    # Migrate city field
    city_updated = 0
    if users_needing_city > 0:
        print(f"\n1️⃣ Migrating 'location' → 'city' for {users_needing_city} users...")
        
        users_cursor = db.users.find({
            "location": {"$exists": True, "$ne": ""},
            "$or": [
                {"city": {"$exists": False}},
                {"city": ""}
            ]
        })
        
        async for user in users_cursor:
            location = user.get("location")
            if location:
                result = await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"city": location}}
                )
                if result.modified_count > 0:
                    city_updated += 1
                    if city_updated % 10 == 0:
                        print(f"   ✅ Updated {city_updated} users...")
        
        print(f"   ✅ Completed: {city_updated} users updated with 'city' field")
    
    # Migrate country field
    country_updated = 0
    if users_needing_country > 0:
        print(f"\n2️⃣ Migrating 'countryOfResidence' → 'country' for {users_needing_country} users...")
        
        users_cursor = db.users.find({
            "countryOfResidence": {"$exists": True, "$ne": ""},
            "$or": [
                {"country": {"$exists": False}},
                {"country": ""}
            ]
        })
        
        async for user in users_cursor:
            country_of_residence = user.get("countryOfResidence")
            if country_of_residence:
                result = await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"country": country_of_residence}}
                )
                if result.modified_count > 0:
                    country_updated += 1
                    if country_updated % 10 == 0:
                        print(f"   ✅ Updated {country_updated} users...")
        
        print(f"   ✅ Completed: {country_updated} users updated with 'country' field")
    
    client.close()
    
    print("\n" + "=" * 80)
    print("✅ Migration Complete!")
    print("=" * 80)
    print(f"\n📊 Summary:")
    print(f"   - {city_updated} users now have 'city' field")
    print(f"   - {country_updated} users now have 'country' field")
    print(f"\n🎯 Impact:")
    print(f"   - L3V3L scoring will now calculate correctly for these users")
    print(f"   - Demographics component will have proper location data")
    print(f"   - Match scores will improve with complete profile data")
    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
