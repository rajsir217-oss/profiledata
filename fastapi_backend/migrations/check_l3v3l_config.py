"""
Check if L3V3L scoring is enabled in system settings
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
    """Check L3V3L scoring configuration"""
    
    settings = Settings()
    
    print("🔧 Loading configuration for environment: production")
    print("✅ Loaded configuration from .env.production")
    print(f"🗄️  Database: {settings.database_name}")
    print(f"🔗 MongoDB URL: {settings.mongodb_url[:50]}...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("=" * 80)
    print("🔍 Checking L3V3L Configuration")
    print("=" * 80)
    
    # Check system settings
    system_settings = await db.system_settings.find_one()
    
    if system_settings:
        print(f"\n📋 System Settings Found:")
        print(f"   - ticket_delete_days: {system_settings.get('ticket_delete_days')}")
        print(f"   - default_theme: {system_settings.get('default_theme')}")
        print(f"   - enable_l3v3l_for_all: {system_settings.get('enable_l3v3l_for_all')}")
        
        if system_settings.get('enable_l3v3l_for_all'):
            print(f"\n✅ L3V3L scoring is ENABLED for all users")
        else:
            print(f"\n❌ L3V3L scoring is DISABLED - only premium users can see scores")
    else:
        print(f"\n⚠️  No system settings found in database")
        print(f"   Default behavior: enable_l3v3l_for_all = True")
        print(f"\n✅ L3V3L scoring should be ENABLED (using defaults)")
    
    client.close()
    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
