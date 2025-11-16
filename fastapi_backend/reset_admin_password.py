#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from auth.password_utils import PasswordManager

load_dotenv()

async def reset():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    new_password = "admin123"
    hashed = PasswordManager.hash_password(new_password)
    
    await db.users.update_one(
        {"username": "admin"},
        {"$set": {"password": hashed}}
    )
    
    print(f"✅ Admin password reset to: {new_password}")
    client.close()

asyncio.run(reset())
