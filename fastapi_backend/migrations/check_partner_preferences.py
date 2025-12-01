"""
Check partner preferences structure in database
"""

import asyncio
import sys
import os
import certifi
import json
from motor.motor_asyncio import AsyncIOMotorClient

# Force production environment BEFORE importing Settings
os.environ['APP_ENVIRONMENT'] = 'production'

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings

async def main():
    """Check partner preferences structure"""
    
    settings = Settings()
    
    print("🔧 Loading configuration for environment: production")
    print("✅ Loaded configuration from .env.production")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("\n" + "=" * 80)
    print("🔍 Checking Partner Preferences Data Structure")
    print("=" * 80)
    
    # Check ramsir1995 profile
    username = "ramsir1995"
    user = await db.users.find_one({"username": username})
    
    if not user:
        print(f"\n❌ User '{username}' not found")
        client.close()
        return
    
    print(f"\n👤 User: {username}")
    
    # Check all partner preference related fields
    print(f"\n📋 Partner Preference Fields in Database:")
    
    # Individual fields (what L3V3L expects)
    individual_fields = [
        'partnerAgeMin', 'partnerAgeMax',
        'partnerHeightMin', 'partnerHeightMax',
        'partnerEducation', 'partnerOccupation',
        'partnerIncome', 'partnerLocation'
    ]
    
    print(f"\n🔹 Individual Fields (L3V3L expects these):")
    for field in individual_fields:
        value = user.get(field)
        if value and value != '' and value != 'Not specified':
            print(f"   ✅ {field}: {value}")
        else:
            print(f"   ❌ {field}: (empty)")
    
    # Check for partnerCriteria object
    print(f"\n🔹 Partner Criteria Object:")
    partner_criteria = user.get('partnerCriteria')
    if partner_criteria:
        print(f"   ✅ partnerCriteria exists (type: {type(partner_criteria).__name__})")
        if isinstance(partner_criteria, dict):
            print(f"\n   📝 Contents:")
            for key, value in partner_criteria.items():
                print(f"      - {key}: {value}")
        elif isinstance(partner_criteria, str):
            print(f"\n   📝 String value: {partner_criteria[:200]}")
    else:
        print(f"   ❌ partnerCriteria: (empty)")
    
    # Check for other related fields
    print(f"\n🔹 Other Preference Fields:")
    other_fields = [
        'partnerPreference',  # Text description
        'lookingFor',  # Relationship type
        'relationshipStatus'
    ]
    
    for field in other_fields:
        value = user.get(field)
        if value:
            display_value = value if len(str(value)) < 100 else str(value)[:100] + "..."
            print(f"   ✅ {field}: {display_value}")
        else:
            print(f"   ❌ {field}: (empty)")
    
    client.close()
    print("\n" + "=" * 80)
    
    print(f"\n💡 Analysis:")
    print(f"   - If individual fields are empty but partnerCriteria exists,")
    print(f"     we need to extract/flatten partnerCriteria → individual fields")
    print(f"   - L3V3L scoring expects individual fields, not nested objects")

if __name__ == "__main__":
    asyncio.run(main())
