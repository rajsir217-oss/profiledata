"""Quick script to add email address to admin user"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def add_admin_email():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    result = await db.users.update_one(
        {"username": "admin"},
        {"$set": {
            "email": "rajsir@gmail.com",
            "contactEmail": "rajsir@gmail.com"
        }}
    )
    
    if result.modified_count > 0:
        print(f"✅ Added email to admin user")
    else:
        print(f"⚠️  Admin user already has email or doesn't exist")
    
    # Verify
    admin = await db.users.find_one({"username": "admin"})
    if admin:
        print(f"📧 Admin email: {admin.get('email', 'NOT SET')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(add_admin_email())
