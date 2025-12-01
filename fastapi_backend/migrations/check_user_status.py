"""
Check account status for a specific user in PRODUCTION database
"""

import asyncio
import sys
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force production environment
os.environ['APP_ENVIRONMENT'] = 'production'

from config import Settings

async def main():
    """Check user account status in PRODUCTION"""
    
    settings = Settings()
    
    print(f"🌍 Environment: {os.getenv('APP_ENVIRONMENT', 'not set')}")
    print(f"🗄️  Database: {settings.database_name}")
    print(f"🔗 MongoDB URL: {settings.mongodb_url[:50]}..." if settings.mongodb_url else "NOT SET")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client.get_database(settings.database_name)
    
    print("=" * 80)
    print("🔍 Checking User Account Status: ramsir1995")
    print("=" * 80)
    
    # Check user
    user = await db.users.find_one({"username": "ramsir1995"})
    
    if user:
        print(f"\n📋 User Found:")
        print(f"   - username: {user.get('username')}")
        print(f"   - firstName: {user.get('firstName')}")
        print(f"   - lastName: {user.get('lastName')}")
        print(f"   - contactEmail: {user.get('contactEmail')}")
        print(f"\n🔐 Account Status Fields:")
        print(f"   - accountStatus: {user.get('accountStatus')}")
        print(f"   - adminApprovalStatus: {user.get('adminApprovalStatus')}")
        print(f"   - emailVerified: {user.get('emailVerified')}")
        print(f"   - phoneVerified: {user.get('phoneVerified')}")
        print(f"   - role_name: {user.get('role_name')}")
        
        # Legacy status field
        if 'status' in user and isinstance(user.get('status'), dict):
            print(f"\n📊 Legacy Status Object:")
            for key, value in user['status'].items():
                print(f"   - status.{key}: {value}")
        
        # Check what the status should be
        print(f"\n✅ Expected Status:")
        if user.get('accountStatus') == 'active':
            print(f"   ✓ User should have full access (status is 'active')")
        else:
            print(f"   ⚠️ User has limited access (status is '{user.get('accountStatus')}')")
            print(f"   ⚠️ This needs to be fixed!")
            
    else:
        print(f"\n⚠️ User 'ramsir1995' not found in database")
    
    client.close()
    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
