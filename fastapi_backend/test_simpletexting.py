#!/usr/bin/env python3
"""
Test SimpleTexting SMS Integration
Quick test to verify SimpleTexting API is configured correctly
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
from dotenv import load_dotenv
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    load_dotenv(env_file)
    print(f"📂 Loaded .env from: {env_file}")
else:
    print(f"⚠️  .env file not found at: {env_file}")
    load_dotenv()  # Try default locations

from services.simpletexting_service import SimpleTextingService


async def test_simpletexting():
    """Test SimpleTexting SMS service"""
    
    print("\n" + "="*60)
    print("🧪 SIMPLETEXTING SMS INTEGRATION TEST")
    print("="*60 + "\n")
    
    # Check environment variables
    api_token = os.getenv("SIMPLETEXTING_API_TOKEN")
    account_phone = os.getenv("SIMPLETEXTING_ACCOUNT_PHONE")
    sms_provider = os.getenv("SMS_PROVIDER")
    
    print("📋 Configuration Check:")
    print(f"   SMS_PROVIDER: {sms_provider or 'NOT SET'}")
    print(f"   API Token: {'✅ Set' if api_token else '❌ Missing'} ({api_token[:20] + '...' if api_token else 'N/A'})")
    print(f"   Account Phone: {'✅ Set' if account_phone else '❌ Missing'} ({account_phone or 'N/A'})")
    print()
    
    # Initialize service
    print("🔌 Initializing SimpleTexting Service...")
    service = SimpleTextingService()
    
    if not service.enabled:
        print("❌ SimpleTexting service NOT enabled!")
        print("\nPlease check:")
        print("1. SIMPLETEXTING_API_TOKEN is set in .env")
        print("2. SIMPLETEXTING_ACCOUNT_PHONE is set in .env")
        return
    
    print(f"✅ SimpleTexting service initialized!")
    print(f"   Using phone: {service.account_phone}")
    print()
    
    # Ask for test phone number
    print("📱 SMS Test")
    print("-" * 60)
    test_phone = input("Enter phone number to test (with country code, e.g., +13334445555): ").strip()
    
    if not test_phone:
        print("⏭️  Skipping SMS test (no phone provided)")
        return
    
    # Generate test OTP
    test_otp = "123456"
    
    print(f"\n📤 Sending test SMS to {test_phone}...")
    print(f"   Message: [test_profile] Login code: {test_otp}")
    
    # Send test SMS
    result = await service.send_otp(
        phone=test_phone,
        otp=test_otp,
        purpose="mfa",
        username="test_profile"
    )
    
    print()
    if result["success"]:
        print("✅ SMS SENT SUCCESSFULLY!")
        print(f"   Message ID: {result.get('message_id', 'N/A')}")
        print(f"   Status: {result.get('status', 'N/A')}")
        print()
        print("📬 Check your phone - you should receive:")
        print(f"   '[test_profile] Login code: {test_otp}'")
        print(f"   'Expires in 5 minutes.'")
    else:
        print("❌ SMS SEND FAILED!")
        print(f"   Error: {result.get('error', 'Unknown error')}")
        
        if "status_code" in result:
            print(f"   Status Code: {result['status_code']}")
        if "response" in result:
            print(f"   Response: {result['response']}")
    
    print()
    print("="*60)
    print("✅ TEST COMPLETE")
    print("="*60)
    print()


if __name__ == "__main__":
    asyncio.run(test_simpletexting())
