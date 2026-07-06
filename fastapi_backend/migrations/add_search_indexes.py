"""
MongoDB Index Migration for Search Performance Optimization
Adds compound indexes to improve search query performance
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

INDEXES_TO_CREATE = [
    # Compound index for gender + accountStatus (most common filter combo)
    {
        "name": "idx_gender_accountStatus",
        "keys": [("gender", 1), ("accountStatus", 1)],
        "description": "Gender + Account Status compound index"
    },
    # Compound index for height range queries
    {
        "name": "idx_heightInches",
        "keys": [("heightInches", 1)],
        "description": "Height index for range queries"
    },
    # Compound index for city + state (location searches)
    {
        "name": "idx_city_state",
        "keys": [("city", 1), ("state", 1)],
        "description": "City + State compound index for location searches"
    },
    # Compound index for birthYear + birthMonth (age filtering)
    {
        "name": "idx_birthYear_birthMonth",
        "keys": [("birthYear", 1), ("birthMonth", 1)],
        "description": "Birth Year + Month compound index for age filtering"
    },
    # Compound index for workExperience.workType (occupation searches)
    {
        "name": "idx_workType",
        "keys": [("workExperience.workType", 1)],
        "description": "Work Type index for occupation searches"
    },
    # Compound index for education
    {
        "name": "idx_education",
        "keys": [("education", 1)],
        "description": "Education index"
    },
    # Compound index for religion
    {
        "name": "idx_religion",
        "keys": [("religion", 1)],
        "description": "Religion index"
    },
    # Compound index for castePreference
    {
        "name": "idx_castePreference",
        "keys": [("castePreference", 1)],
        "description": "Caste Preference index"
    },
    # Compound index for accountStatus alone (frequently filtered)
    {
        "name": "idx_accountStatus",
        "keys": [("accountStatus", 1)],
        "description": "Account Status index"
    },
    # Compound index for createdAt (newest/oldest sorting)
    {
        "name": "idx_createdAt",
        "keys": [("createdAt", -1)],
        "description": "Created At index for sorting"
    },
    # Compound index for updatedAt (sorting)
    {
        "name": "idx_updatedAt",
        "keys": [("updatedAt", -1)],
        "description": "Updated At index for sorting"
    },
]

async def up(db):
    """Add compound indexes for common search patterns"""
    print("🔍 Adding search performance indexes...")
    
    for index_def in INDEXES_TO_CREATE:
        try:
            index_name = index_def["name"]
            keys = index_def["keys"]
            description = index_def["description"]
            
            # Check if index already exists
            existing_indexes = await db.users.list_indexes().to_list(length=None)
            existing_names = [idx["name"] for idx in existing_indexes]
            
            if index_name in existing_names:
                print(f"  ⏭️  Index '{index_name}' already exists, skipping")
                continue
            
            # Create index
            await db.users.create_index(keys, name=index_name)
            print(f"  ✅ Created index: {description} ({index_name})")
            
        except Exception as e:
            print(f"  ❌ Failed to create index '{index_def['name']}': {e}")
    
    print("\n📊 Index creation complete!")
    
    # Display current indexes
    print("\n📋 Current indexes on 'users' collection:")
    indexes = await db.users.list_indexes().to_list(length=None)
    for idx in indexes:
        print(f"  - {idx['name']}: {idx['key']}")
    
    print("\n✅ Migration up completed successfully!")

async def down(db):
    """Drop the search performance indexes"""
    print("🗑️  Dropping search performance indexes...")
    
    for index_def in INDEXES_TO_CREATE:
        try:
            index_name = index_def["name"]
            
            # Check if index exists
            existing_indexes = await db.users.list_indexes().to_list(length=None)
            existing_names = [idx["name"] for idx in existing_indexes]
            
            if index_name not in existing_names:
                print(f"  ⏭️  Index '{index_name}' does not exist, skipping")
                continue
            
            # Drop index
            await db.users.drop_index(index_name)
            print(f"  ✅ Dropped index: {index_name}")
            
        except Exception as e:
            print(f"  ❌ Failed to drop index '{index_def['name']}': {e}")
    
    print("\n✅ Migration down completed successfully!")
