#!/usr/bin/env python3
"""
Test if SimpleTexting service can be imported and initialized
"""

import sys
sys.path.insert(0, '/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend')

print("🔍 Testing SimpleTexting Service Import...\n")

# Test 1: Import config
try:
    from config import settings
    print("✅ Config imported")
    print(f"   SMS_PROVIDER: {settings.sms_provider}")
    print(f"   SIMPLETEXTING_API_TOKEN: {settings.simpletexting_api_token[:20] + '...' if settings.simpletexting_api_token else 'NOT SET'}")
    print(f"   SIMPLETEXTING_ACCOUNT_PHONE: {settings.simpletexting_account_phone}")
except Exception as e:
    print(f"❌ Config import failed: {e}")
    sys.exit(1)

# Test 2: Import SimpleTexting service
try:
    from services.simpletexting_service import SimpleTextingService
    print("\n✅ SimpleTextingService imported")
except Exception as e:
    print(f"\n❌ SimpleTextingService import failed: {e}")
    sys.exit(1)

# Test 3: Initialize service
try:
    service = SimpleTextingService()
    print(f"\n✅ SimpleTextingService initialized")
    print(f"   Enabled: {service.enabled}")
    print(f"   API Token: {service.api_token[:20] + '...' if service.api_token else 'None'}")
    print(f"   Account Phone: {service.account_phone}")
except Exception as e:
    print(f"\n❌ SimpleTextingService initialization failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "="*60)
if service.enabled:
    print("🎉 SimpleTexting is READY to send SMS!")
else:
    print("❌ SimpleTexting is DISABLED - missing credentials")
print("="*60)
