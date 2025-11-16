#!/usr/bin/env python3
"""
Direct SMS Test - Send to specific number
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
    print(f"📂 Loaded .env from: {env_file}\n")

from services.simpletexting_service import SimpleTextingService


async def test_send_sms():
    """Send test SMS to specific number"""
    
    print("="*60)
    print("📱 SENDING TEST SMS")
    print("="*60 + "\n")
    
    # Target phone number
    target_phone = "+12032165623"
    
    # Initialize service
    print("🔌 Initializing SimpleTexting Service...")
    service = SimpleTextingService()
    
    if not service.enabled:
        print("❌ SimpleTexting service NOT enabled!")
        print("Check your .env configuration.")
        return
    
    print(f"✅ SimpleTexting initialized (Account: {service.account_phone})\n")
    
    # Generate test OTP
    test_otp = "123456"
    
    print(f"📤 Sending SMS to: {target_phone}")
    print(f"   Message: [test_profile] Login code: {test_otp}")
    print(f"   Purpose: mfa\n")
    
    # Send SMS
    result = await service.send_otp(
        phone=target_phone,
        otp=test_otp,
        purpose="mfa",
        username="test_profile"
    )
    
    print("="*60)
    if result["success"]:
        print("✅ SMS ACCEPTED BY API!")
        print(f"   Message ID: {result.get('message_id', 'N/A')}")
        print(f"   Provider: {result.get('provider', 'simpletexting')}")
        
        # Show API response for debugging
        if "api_response" in result:
            import json
            print(f"\n📋 API Response:")
            print(json.dumps(result['api_response'], indent=2))
        
        print(f"\n📬 Check phone {target_phone} for message!")
        print("\n⏱️  Note: Delivery may take 10-60 seconds")
        print("   If not received:")
        print("   1. Check SimpleTexting dashboard for delivery status")
        print("   2. Verify phone can receive SMS from toll-free numbers")
        print("   3. Check carrier spam filters")
    else:
        print("❌ SMS SEND FAILED!")
        print(f"   Error: {result.get('error', 'Unknown error')}")
        if "details" in result:
            print(f"   Details: {result['details']}")
        if "status_code" in result:
            print(f"   Status Code: {result['status_code']}")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(test_send_sms())
