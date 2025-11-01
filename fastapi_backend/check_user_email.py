"""
Quick script to check user email fields in database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_user_email():
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    # Find user with email containing "rajl3v3l" or list all users
    user = await db.users.find_one({
        "$or": [
            {"email": {"$regex": "rajl3v3l", "$options": "i"}},
            {"contactEmail": {"$regex": "rajl3v3l", "$options": "i"}},
            {"username": {"$regex": "raj", "$options": "i"}}
        ]
    })
    
    if user:
        username = user.get("username")
        print(f"\n{'='*60}")
        print(f"User: {username}")
        print(f"{'='*60}")
        print(f"email field:        {user.get('email', 'NOT SET')}")
        print(f"contactEmail field: {user.get('contactEmail', 'NOT SET')}")
        print(f"contactNumber:      {user.get('contactNumber', 'NOT SET')}")
        print(f"{'='*60}\n")
        
        # Show which one would be used with OLD code (email first)
        email_old = user.get("email") or user.get("contactEmail")
        print(f"Email used with OLD code: {email_old}")
        
        # Show which one would be used with NEW code (contactEmail first)
        email_new = user.get("contactEmail") or user.get("email")
        print(f"Email used with NEW code: {email_new}")
        print(f"{'='*60}\n")
    else:
        print(f"User not found! Listing first 5 users:")
        users = await db.users.find({}).limit(5).to_list(length=5)
        for u in users:
            print(f"  - {u.get('username')}: {u.get('email')} / {u.get('contactEmail')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_user_email())
