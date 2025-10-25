"""
Test sending welcome email to rajsir742
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "fastapi_backend"))

from motor.motor_asyncio import AsyncIOMotorClient
from services.email_verification_service import EmailVerificationService

async def send_welcome():
    print("📧 Sending welcome email to rajsir742...")
    
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.matrimonialDB
    
    # Get user
    user = await db.users.find_one({'username': 'rajsir742'})
    if not user:
        print("❌ User not found!")
        client.close()
        return
    
    email = user.get('contactEmail') or user.get('email')
    first_name = user.get('firstName', '')
    
    print(f"👤 Name: {first_name}")
    print(f"📧 Email: {email}")
    print(f"📊 Status: {user.get('accountStatus')}")
    
    # Send welcome email
    service = EmailVerificationService(db)
    
    if email:
        print(f"\n📤 Sending welcome email...")
        email_sent = await service.send_welcome_email('rajsir742', email, first_name)
        
        if email_sent:
            print(f"\n✅ SUCCESS! Welcome email sent to {email}")
            print(f"📬 Check your inbox: {email}")
        else:
            print(f"\n❌ FAILED to send welcome email")
            print(f"⚠️ Check backend logs for error details")
    else:
        print(f"\n❌ No email address found")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(send_welcome())
