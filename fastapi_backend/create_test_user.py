#!/usr/bin/env python3
"""
Create Test User
Creates a simple test user for testing the messages system
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import DESCENDING
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
from passlib.context import CryptContext

# Load environment variables
load_dotenv('.env')

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "matrimonialDB")

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_test_user(username="testuser1", password="test123"):
    """Create a test user"""
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users_collection = db.users
    
    # Check if user already exists
    existing = await users_collection.find_one({"username": username})
    if existing:
        print(f"⚠️  User '{username}' already exists")
        return False
    
    # Create user document
    user_doc = {
        "username": username,
        "email": f"{username}@test.com",
        "security": {
            "password_hash": pwd_context.hash(password),
            "failed_login_attempts": 0,
            "locked_until": None,
            "last_failed_attempt": None
        },
        "firstName": "Test",
        "lastName": "User",
        "status": {
            "status": "active"
        },
        "accountStatus": "active",
        "profileCreatedBy": "self",
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "preferences": {
            "notifications": True,
            "privacy": "public"
        }
    }
    
    # Insert user
    result = await users_collection.insert_one(user_doc)
    
    if result.inserted_id:
        print(f"✅ Created test user: '{username}' with password: '{password}'")
        return True
    else:
        print(f"❌ Failed to create user '{username}'")
        return False
    
    client.close()

async def create_multiple_test_users():
    """Create multiple test users"""
    
    usernames = ["testuser1", "testuser2", "testuser3", "testuser4", "testuser5"]
    created = 0
    
    for username in usernames:
        if await create_test_user(username, "test123"):
            created += 1
    
    print(f"\n🎉 Created {created} test users")

async def main():
    """Main function"""
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python create_test_user.py single [username] [password]")
        print("  python create_test_user.py multiple")
        return
    
    command = sys.argv[1].lower()
    
    if command == "single":
        username = sys.argv[2] if len(sys.argv) > 2 else "testuser1"
        password = sys.argv[3] if len(sys.argv) > 3 else "test123"
        await create_test_user(username, password)
    elif command == "multiple":
        await create_multiple_test_users()
    else:
        print(f"❌ Unknown command: {command}")

if __name__ == "__main__":
    asyncio.run(main())
