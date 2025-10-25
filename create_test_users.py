#!/usr/bin/env python3
"""
Create test users in MongoDB for Docker development
Run this after starting Docker containers
"""

from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Connect to MongoDB
client = MongoClient("mongodb://localhost:27017")
db = client.matrimonialDB

print("🔐 Creating test users...")

# Admin user
admin_password = pwd_context.hash("admin123")
admin_user = {
    "username": "admin",
    "password": admin_password,
    "email": "admin@localhost",
    "contactEmail": "admin@localhost",
    "role_name": "admin",
    "status": {"status": "active"},
    "firstName": "Admin",
    "lastName": "User",
    "createdAt": datetime.utcnow(),
    "themePreference": "light-blue"
}

# Test user 1
test1_password = pwd_context.hash("test123")
test_user1 = {
    "username": "riteshpandey052",
    "password": test1_password,
    "email": "ritesh@test.com",
    "contactEmail": "ritesh@test.com",
    "role_name": "free_user",
    "status": {"status": "active"},
    "firstName": "Ritesh",
    "lastName": "Pandey",
    "age": 28,
    "gender": "Male",
    "location": "Mumbai",
    "profession": "Software Engineer",
    "createdAt": datetime.utcnow(),
    "themePreference": "light-blue"
}

# Test user 2
test_user2 = {
    "username": "testuser",
    "password": test1_password,  # Same password: test123
    "email": "test@test.com",
    "contactEmail": "test@test.com",
    "role_name": "free_user",
    "status": {"status": "active"},
    "firstName": "Test",
    "lastName": "User",
    "age": 25,
    "gender": "Female",
    "location": "Delhi",
    "profession": "Designer",
    "createdAt": datetime.utcnow(),
    "themePreference": "light-pink"
}

# Insert or update users
try:
    # Admin
    result = db.users.update_one(
        {"username": "admin"},
        {"$set": admin_user},
        upsert=True
    )
    print(f"✅ Admin user: {'created' if result.upserted_id else 'updated'}")
    
    # Test user 1
    result = db.users.update_one(
        {"username": "riteshpandey052"},
        {"$set": test_user1},
        upsert=True
    )
    print(f"✅ User riteshpandey052: {'created' if result.upserted_id else 'updated'}")
    
    # Test user 2
    result = db.users.update_one(
        {"username": "testuser"},
        {"$set": test_user2},
        upsert=True
    )
    print(f"✅ User testuser: {'created' if result.upserted_id else 'updated'}")
    
    print("\n🎉 Test users created successfully!")
    print("\nLogin credentials:")
    print("  Admin: username=admin, password=admin123")
    print("  User 1: username=riteshpandey052, password=test123")
    print("  User 2: username=testuser, password=test123")
    
except Exception as e:
    print(f"❌ Error creating users: {e}")

client.close()
