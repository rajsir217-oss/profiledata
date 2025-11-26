"""
Update pii_granted template in database to fix button link
Run: python3 update_pii_granted_template.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

async def update_template():
    """Update the pii_granted template"""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # New template HTML with fixed button link (uses 'profile' instead of 'contact')
    html_body = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .logo-container { text-align: center; padding: 20px 0; }
        .logo-container img { width: 120px; height: auto; }
        .header { background: linear-gradient(135deg, #10b981 0%, #10b981dd 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; font-weight: bold; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding: 20px; border-top: 1px solid #ddd; }
        .footer a { color: #10b981; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-container">
            <img src="{app.logoUrl}" alt="L3V3L" />
        </div>
        <div class="header">
            <h1>✅ {match.firstName} granted you contact access!</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <div class="card">
                <p>Great news! {match.firstName} approved your contact request. Their details are now available.</p>
            </div>
            
            <center>
                <a href="{app.profileUrl_tracked}" class="button">View Contact Info</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{app.unsubscribeUrl_tracked}">Unsubscribe</a> | <a href="{app.preferencesUrl_tracked}">Preferences</a></p>
            <img src="{app.trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
        </div>
    </div>
</body>
</html>
    """
    
    # Update the template
    result = await db.notification_templates.update_one(
        {"trigger": "pii_granted", "channel": "email"},
        {
            "$set": {
                "body": html_body,
                "updatedAt": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count > 0:
        print(f"✅ Updated pii_granted template successfully!")
        print(f"   Matched: {result.matched_count}")
        print(f"   Modified: {result.modified_count}")
    else:
        print(f"❌ Template not found in database")
        print(f"   You may need to run add_remaining_templates.py first")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_template())
