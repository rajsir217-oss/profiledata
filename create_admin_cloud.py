#!/usr/bin/env python3
"""
Quick script to create admin user in cloud MongoDB
"""

import sys
from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime, timezone

# Get MongoDB URL from command line
if len(sys.argv) < 2:
    print("❌ Usage: python3 create_admin_cloud.py 'YOUR_MONGODB_URL'")
    print("\nExample:")
    print("python3 create_admin_cloud.py 'mongodb+srv://user:password@cluster.mongodb.net/matrimonialDB'")
    sys.exit(1)

mongodb_url = sys.argv[1]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

print("🔐 Creating admin user in cloud MongoDB...")

try:
    # Connect to MongoDB
    client = MongoClient(
        mongodb_url,
        tlsAllowInvalidCertificates=True,
        serverSelectionTimeoutMS=10000
    )
    db = client.matrimonialDB
    
    # Test connection
    client.admin.command('ping')
    print("✅ Connected to MongoDB")
    
    # Create admin user
    admin_user = {
        "username": "admin",
        "password": pwd_context.hash("admin123"),
        "email": "admin@l3v3l.com",
        "contactEmail": "admin@l3v3l.com",
        "role_name": "admin",
        "status": {"status": "active"},
        "firstName": "Admin",
        "lastName": "User",
        "age": 30,
        "gender": "Male",
        "location": "System",
        "profession": "Administrator",
        "createdAt": datetime.now(timezone.utc),
        "themePreference": "cozy-light"
    }
    
    # Insert or update
    result = db.users.update_one(
        {"username": "admin"},
        {"$set": admin_user},
        upsert=True
    )
    
    print(f"✅ Admin user: {'created' if result.upserted_id else 'updated'}")
    print("\n🎉 Success!")
    print("\nLogin credentials:")
    print("  Username: admin")
    print("  Password: admin123")
    print("\nYou can now login at:")
    print("  https://matrimonial-frontend-458052696267.us-central1.run.app")
    
    client.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\n💡 Check:")
    print("   1. MongoDB URL is correct")
    print("   2. Password doesn't have special characters needing URL encoding")
    print("   3. Network Access allows 0.0.0.0/0")
    sys.exit(1)
