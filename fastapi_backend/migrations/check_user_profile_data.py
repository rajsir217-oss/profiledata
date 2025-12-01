"""
Check user profile data to see what L3V3L-relevant fields are populated
"""

import asyncio
import sys
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

# Force production environment BEFORE importing Settings
os.environ['APP_ENVIRONMENT'] = 'production'

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings

async def main():
    """Check user profile data for L3V3L scoring"""
    
    settings = Settings()
    
    print("🔧 Loading configuration for environment: production")
    print("✅ Loaded configuration from .env.production")
    print(f"🗄️  Database: {settings.database_name}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("=" * 80)
    print("🔍 Checking User Profile Data for L3V3L Scoring")
    print("=" * 80)
    
    # Check ramsir1995 profile
    username = "ramsir1995"
    user = await db.users.find_one({"username": username})
    
    if not user:
        print(f"\n❌ User '{username}' not found")
        client.close()
        return
    
    print(f"\n👤 User: {username}")
    print(f"   Name: {user.get('firstName', '')} {user.get('lastName', '')}")
    
    # L3V3L-relevant fields
    l3v3l_fields = {
        'Basic Info': ['gender', 'dateOfBirth', 'age'],
        'L3V3L Pillars': ['familyValues', 'partnerPreference'],
        'Demographics': ['city', 'state', 'country', 'caste', 'subcaste'],
        'Partner Preferences': [
            'partnerAgeMin', 'partnerAgeMax',
            'partnerHeightMin', 'partnerHeightMax',
            'partnerEducation', 'partnerOccupation',
            'partnerIncome', 'partnerLocation'
        ],
        'Habits & Personality': ['drinkingHabits', 'smokingHabits', 'dietaryHabits'],
        'Career & Education': ['education', 'occupation', 'income'],
        'Physical Attributes': ['height', 'weight', 'bodyType', 'complexion'],
        'Cultural': ['religion', 'motherTongue', 'nativePlace', 'manglik']
    }
    
    print(f"\n📋 L3V3L-Relevant Profile Fields:")
    total_fields = 0
    filled_fields = 0
    
    for category, fields in l3v3l_fields.items():
        print(f"\n🔹 {category}:")
        for field in fields:
            value = user.get(field)
            total_fields += 1
            if value and value != '' and value != 'Not specified':
                filled_fields += 1
                print(f"   ✅ {field}: {value}")
            else:
                print(f"   ❌ {field}: (empty)")
    
    completion = (filled_fields / total_fields) * 100
    print(f"\n📊 Profile Completion: {filled_fields}/{total_fields} fields ({completion:.1f}%)")
    
    if completion < 30:
        print(f"\n⚠️  WARNING: Profile is only {completion:.1f}% complete!")
        print(f"   L3V3L scores require more profile data to calculate accurately.")
        print(f"   Scores may be 0 or very low due to missing data.")
    elif completion < 60:
        print(f"\n⚡ Profile is {completion:.1f}% complete - scores will be moderate")
    else:
        print(f"\n✅ Profile is {completion:.1f}% complete - good for L3V3L scoring!")
    
    client.close()
    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
