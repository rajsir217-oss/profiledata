"""Check admin user email in database"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def check_admin():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    # Get admin user
    admin = await db.users.find_one({"username": "admin"})
    
    if admin:
        print("✅ Found admin user")
        print(f"📧 Email field: {admin.get('email', 'NOT SET')}")
        print(f"📧 ContactEmail field: {admin.get('contactEmail', 'NOT SET')}")
        print(f"\n🔍 Has 'email' key: {'email' in admin}")
        print(f"🔍 Email value: {repr(admin.get('email'))}")
        
        # Show all fields
        print(f"\n📋 All user fields:")
        for key in sorted(admin.keys()):
            if key not in ['_id', 'password', 'hashedPassword']:
                print(f"   {key}: {admin[key]}")
    else:
        print("❌ Admin user not found!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_admin())
