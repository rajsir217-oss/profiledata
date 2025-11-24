#!/usr/bin/env python3
"""Check how images are stored in MongoDB"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_images():
    # Connect to MongoDB
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['matrimonialDB']
    
    # Find admin user
    user = await db.users.find_one({'username': 'admin'})
    
    if user:
        images = user.get('images', [])
        print(f"📸 User: {user.get('username')}")
        print(f"📸 Total images: {len(images)}")
        print(f"\n📋 Images in database:")
        for i, img in enumerate(images):
            print(f"  [{i}] {img}")
            print(f"      Type: {type(img)}")
            print(f"      Starts with 'uploads/': {img.startswith('uploads/')}")
            print(f"      Starts with 'http': {img.startswith('http')}")
    else:
        print("❌ User 'admin' not found")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_images())
