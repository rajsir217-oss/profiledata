"""Update admin email to correct address"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def update_email():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    # Update to correct email
    result = await db.users.update_one(
        {"username": "admin"},
        {"$set": {
            "email": "rajsir217@gmail.com",
            "contactEmail": "rajsir217@gmail.com"
        }}
    )
    
    print(f"✅ Updated admin email to: rajsir217@gmail.com")
    print(f"   Modified count: {result.modified_count}")
    
    # Verify
    admin = await db.users.find_one({"username": "admin"})
    if admin:
        print(f"\n📧 Verified:")
        print(f"   email: {admin.get('email')}")
        print(f"   contactEmail: {admin.get('contactEmail')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_email())
