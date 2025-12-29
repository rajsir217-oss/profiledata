
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path

async def debug_images():
    # Connect to DB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    username = "tarakapoor014"
    user = await db.users.find_one({"username": username})
    
    if not user:
        print(f"User {username} not found in database.")
    else:
        print(f"User {username} found.")
        print(f"Images in DB: {user.get('images')}")
        print(f"Public Images in DB: {user.get('publicImages')}")
        print(f"Image Visibility: {user.get('imageVisibility')}")
        print(f"Profile ID: {user.get('profileId')}")

    # Check files in uploads
    upload_dir = Path("uploads")
    if not upload_dir.exists():
        print("Uploads directory does not exist!")
    else:
        files = list(upload_dir.glob(f"{username}*"))
        print(f"Files in uploads matching {username}*: {files}")
        
        # Check if there are any files at all
        all_files = list(upload_dir.iterdir())
        print(f"Total files in uploads: {len(all_files)}")
        if len(all_files) > 0:
            print(f"Sample files: {all_files[:5]}")

    client.close()

if __name__ == "__main__":
    asyncio.run(debug_images())
