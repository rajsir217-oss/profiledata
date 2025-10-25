"""
Migration: Remove startYear and endYear from educationHistory entries
Date: October 24, 2025
Reason: Simplified education structure - years not needed

This migration:
1. Removes 'startYear' and 'endYear' fields from all educationHistory array entries
2. Keeps level, degree, and institution fields intact
3. Reports number of affected documents
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path so we can import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()

async def remove_education_years():
    """Remove startYear and endYear from educationHistory entries"""
    print("🔄 Starting education years removal...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Count users with educationHistory
        users_with_education = await db.users.count_documents(
            {"educationHistory": {"$exists": True, "$ne": []}}
        )
        
        print(f"📊 Found {users_with_education} users with education history")
        
        if users_with_education == 0:
            print("✅ No education history found. Migration not needed.")
            return
        
        # Get all users with educationHistory
        users = await db.users.find(
            {"educationHistory": {"$exists": True, "$ne": []}}
        ).to_list(None)
        
        updated_count = 0
        
        for user in users:
            username = user.get("username")
            education_history = user.get("educationHistory", [])
            
            # Remove startYear and endYear from each entry
            cleaned_history = []
            for edu in education_history:
                cleaned_entry = {
                    "level": edu.get("level"),
                    "degree": edu.get("degree"),
                    "institution": edu.get("institution")
                }
                # Remove None values
                cleaned_entry = {k: v for k, v in cleaned_entry.items() if v is not None}
                cleaned_history.append(cleaned_entry)
            
            # Update the user
            result = await db.users.update_one(
                {"username": username},
                {"$set": {"educationHistory": cleaned_history}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"  ✅ Cleaned: {username} ({len(education_history)} entries)")
        
        print(f"\n📊 Migration Summary:")
        print(f"  ✅ Updated users: {updated_count}")
        print(f"  🗑️  Removed startYear and endYear fields from educationHistory")
        print(f"  ✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        client.close()
        print("🔌 Database connection closed")

if __name__ == "__main__":
    asyncio.run(remove_education_years())
