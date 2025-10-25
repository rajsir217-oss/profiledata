"""
Approve rajsir742 and send welcome email
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "fastapi_backend"))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from services.email_verification_service import EmailVerificationService

async def approve_and_email():
    print("🔧 Approving rajsir742 and sending welcome email...")
    
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.matrimonialDB
    
    # Get user
    user = await db.users.find_one({'username': 'rajsir742'})
    if not user:
        print("❌ User not found!")
        return
    
    print(f"📧 Email: {user.get('contactEmail')}")
    print(f"👤 Name: {user.get('firstName')}")
    print(f"📊 Current Status: {user.get('accountStatus')}")
    
    # Update status
    result = await db.users.update_one(
        {'username': 'rajsir742'},
        {
            '$set': {
                'adminApprovalStatus': 'approved',
                'adminApprovedBy': 'admin',
                'adminApprovedAt': datetime.utcnow(),
                'accountStatus': 'active',
                'onboardingCompleted': True,
                'onboardingCompletedAt': datetime.utcnow()
            }
        }
    )
    
    print(f"✅ Database updated: {result.modified_count} document")
    
    # Send welcome email
    service = EmailVerificationService(db)
    email = user.get('contactEmail') or user.get('email')
    first_name = user.get('firstName', '')
    
    if email:
        print(f"📤 Sending welcome email to {email}...")
        email_sent = await service.send_welcome_email('rajsir742', email, first_name)
        
        if email_sent:
            print(f"✅ Welcome email sent successfully!")
        else:
            print(f"❌ Failed to send welcome email")
            print(f"⚠️ Check SMTP configuration in .env")
    else:
        print(f"❌ No email address found")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(approve_and_email())
