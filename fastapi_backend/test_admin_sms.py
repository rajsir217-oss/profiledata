#!/usr/bin/env python3
"""
Test SMS sending for admin user after adding phone number
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from services.simpletexting_service import SimpleTextingService
from services.sms_service import OTPManager

async def test_admin_sms():
    """Test sending SMS to admin"""
    print("="*60)
    print("Testing Admin SMS Configuration")
    print("="*60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    # Get admin user
    admin = await db.users.find_one({"username": "admin"})
    
    if not admin:
        print("❌ Admin user not found")
        return False
    
    print(f"\n✅ Admin user found")
    print(f"   Username: {admin['username']}")
    print(f"   Phone: {admin.get('contactNumber', 'NOT SET')}")
    print(f"   Email: {admin.get('contactEmail', 'NOT SET')[:20]}..." if admin.get('contactEmail') else "   Email: NOT SET")
    print(f"   MFA Enabled: {admin.get('mfa', {}).get('mfa_enabled', False)}")
    print(f"   MFA Type: {admin.get('mfa', {}).get('mfa_type', 'NOT SET')}")
    
    # Check phone number
    phone = admin.get('contactNumber')
    if not phone:
        print("\n❌ Admin has no phone number!")
        return False
    
    print(f"\n✅ Phone number found: {phone}")
    
    # Test SimpleTexting service
    print("\n" + "="*60)
    print("Testing SimpleTexting Service")
    print("="*60)
    
    sms_service = SimpleTextingService()
    
    if not sms_service.enabled:
        print("\n❌ SimpleTexting service not enabled!")
        print(f"   API Token: {'SET' if settings.simpletexting_api_token else 'NOT SET'}")
        print(f"   Account Phone: {'SET' if settings.simpletexting_account_phone else 'NOT SET'}")
        return False
    
    print(f"\n✅ SimpleTexting service enabled")
    print(f"   Account Phone: {settings.simpletexting_account_phone}")
    
    # Test OTP Manager
    print("\n" + "="*60)
    print("Testing OTP Manager (MFA Code Send)")
    print("="*60)
    
    otp_manager = OTPManager(db)
    
    result = await otp_manager.create_otp_with_channel(
        identifier="admin",
        channel="sms",
        phone=phone,
        email=None,
        username="admin",
        purpose="mfa",
        expires_in_minutes=5
    )
    
    if result["success"]:
        print("\n✅ MFA code sent successfully!")
        print(f"   Channel: {result.get('channel')}")
        print(f"   Contact Masked: {result.get('contact_masked')}")
        print(f"   Expires At: {result.get('expires_at')}")
        if result.get('mock_code'):
            print(f"   Mock Code: {result['mock_code']}")
    else:
        print(f"\n❌ Failed to send MFA code")
        print(f"   Error: {result.get('error')}")
        print(f"   Details: {result.get('details', 'N/A')}")
        return False
    
    # Close connection
    client.close()
    
    print("\n" + "="*60)
    print("✅ All tests passed! Admin SMS MFA should work now.")
    print("="*60)
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_admin_sms())
    sys.exit(0 if success else 1)
