"""
Quick test script for email templates API
Login as admin and fetch templates
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import requests
from datetime import datetime, timedelta, timezone
import jwt
from config import Settings

# Load settings
settings = Settings()

# Config
MONGODB_URL = settings.mongodb_url
DATABASE_NAME = settings.database_name
API_URL = settings.backend_url
SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm

async def get_admin_token():
    """Generate admin JWT token"""
    payload = {
        "sub": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(days=1)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

async def test_templates_api():
    """Test email templates API endpoints"""
    print("=" * 60)
    print("EMAIL TEMPLATES API TEST")
    print("=" * 60)
    
    # Generate token
    token = await get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🔑 Generated admin token: {token[:50]}...")
    
    # Test 1: Get all templates
    print("\n📧 Test 1: GET /api/email-templates/templates")
    response = requests.get(f"{API_URL}/api/email-templates/templates", headers=headers)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Success! Found {data.get('total', 0)} templates")
        print(f"   Templates: {[t['trigger'] for t in data.get('templates', [])[:5]]}")
    else:
        print(f"   ❌ Error: {response.text}")
        return False
    
    # Test 2: Get categories
    print("\n📊 Test 2: GET /api/email-templates/templates/categories")
    response = requests.get(f"{API_URL}/api/email-templates/templates/categories", headers=headers)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Success! Categories: {data.get('categories', [])}")
        print(f"   Counts: {data.get('counts', {})}")
    else:
        print(f"   ❌ Error: {response.text}")
    
    # Test 3: Get specific template
    print("\n📝 Test 3: GET /api/email-templates/templates/mutual_favorite")
    response = requests.get(f"{API_URL}/api/email-templates/templates/mutual_favorite", headers=headers)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Success! Template: {data.get('trigger')}")
        print(f"   Subject: {data.get('subject')}")
        print(f"   Category: {data.get('category')}, Priority: {data.get('priority')}")
    else:
        print(f"   ❌ Error: {response.text}")
    
    # Test 4: Check database directly
    print("\n🗄️  Test 4: Check MongoDB directly")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    count = await db.notification_templates.count_documents({"channel": "email"})
    print(f"   Total email templates in DB: {count}")
    
    if count > 0:
        templates = await db.notification_templates.find({"channel": "email"}).limit(5).to_list(length=5)
        print(f"   Sample triggers: {[t['trigger'] for t in templates]}")
    
    client.close()
    
    print("\n" + "=" * 60)
    print("✅ API TEST COMPLETE")
    print("=" * 60)
    return True

if __name__ == "__main__":
    asyncio.run(test_templates_api())
