"""
Check what age-related fields are in the database
"""

import asyncio
import sys
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

# Force production environment
os.environ['APP_ENVIRONMENT'] = 'production'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings

async def main():
    settings = Settings()
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("=" * 80)
    print("🔍 Checking Age-Related Fields in Database")
    print("=" * 80)
    
    username = "ramsir1995"
    user = await db.users.find_one({"username": username})
    
    if not user:
        print(f"\n❌ User '{username}' not found")
        client.close()
        return
    
    print(f"\n👤 User: {username}")
    print(f"\n📋 Age-Related Fields in Database:")
    
    age_fields = {
        'dateOfBirth': user.get('dateOfBirth'),
        'birthMonth': user.get('birthMonth'),
        'birthYear': user.get('birthYear'),
        'dateofmonth': user.get('dateofmonth'),
        'dateofyear': user.get('dateofyear'),
        'age': user.get('age'),
    }
    
    for field, value in age_fields.items():
        if value:
            print(f"   ✅ {field}: {value}")
        else:
            print(f"   ❌ {field}: (empty)")
    
    print(f"\n💡 L3V3L Scoring Engine expects:")
    print(f"   - birthMonth (1-12)")
    print(f"   - birthYear (e.g., 1995)")
    print(f"   OR")
    print(f"   - dateOfBirth (YYYY-MM-DD format)")
    
    client.close()
    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
