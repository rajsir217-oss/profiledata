"""
Update conversation_cold email template to include profile card
Run: python scripts/update_conversation_cold_template.py [local|production]
"""

import sys
import os

# Set environment before imports
if len(sys.argv) > 1:
    env = sys.argv[1].lower()
    if env in ["production", "local", "staging"]:
        os.environ["APP_ENVIRONMENT"] = env

import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Import settings after setting environment
from config import Settings
settings = Settings()

UPDATED_TEMPLATE_BODY = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .logo-container { text-align: center; padding: 20px 0; }
        .logo-container img { width: 120px; height: auto; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #3b82f6dd 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; font-weight: bold; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding: 20px; border-top: 1px solid #ddd; }
        .footer a { color: #3b82f6; text-decoration: none; }
        .profile-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; margin: 15px 0; }
        .profile-card img { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; }
        .profile-card-info { flex: 1; }
        .profile-card-name { font-weight: bold; color: #1a202c; font-size: 16px; }
        .profile-card-location { color: #718096; font-size: 13px; }
        .profile-card-detail { display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-top: 4px; }
        .profile-card-detail span { margin-right: 8px; }
        .view-profile-link { display: inline-block; color: #667eea; text-decoration: none; font-weight: 500; font-size: 14px; margin-top: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-container">
            <div style="font-size: 32px; font-weight: bold; color: #667eea;">🦋 L3V3L</div>
        </div>
        <div class="header">
            <h1>❄️ Re-ignite your conversation with {match.firstName}</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <div class="card">
                <p>Your conversation with <strong>{match.firstName}</strong> has been quiet for a while. Don't let this connection go cold!</p>
                
                <p style="color: #666; font-size: 12px; margin-top: 10px;">Profile ID: <a href="{profile_url}" style="color: #667eea; font-weight: bold; text-decoration: none;">{match.profileId}</a></p>
                
                <!-- Profile Card -->
                {match.profileCardHtml}
            </div>
            
            <p style="text-align: center; color: #666; margin: 20px 0;">
                A simple "Hi, how have you been?" can restart a great conversation! 💬
            </p>
            
            <center>
                <a href="{chat_url}" class="button">Send Message</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{unsubscribe_url}">Unsubscribe</a> | <a href="{preferences_url}">Preferences</a></p>
            <img src="{tracking_pixel_url}" width="1" height="1" style="display:none;" alt="" />
        </div>
    </div>
</body>
</html>
"""

async def update_template():
    print(f"\n{'='*60}")
    print(f"🔄 Updating conversation_cold Email Template")
    print(f"{'='*60}")
    print(f"Environment: {os.environ.get('APP_ENVIRONMENT', 'not set')}")
    print(f"MongoDB URL: {settings.mongodb_url[:50]}...")
    print(f"Database: {settings.database_name}")
    
    # Connect to MongoDB
    if "mongodb+srv" in settings.mongodb_url:
        client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    else:
        client = AsyncIOMotorClient(settings.mongodb_url)
    
    db = client[settings.database_name]
    
    # Find existing template
    existing = await db.notification_templates.find_one({
        "trigger": "conversation_cold",
        "channel": "email"
    })
    
    if existing:
        print(f"\n📋 Found existing template:")
        print(f"   ID: {existing['_id']}")
        print(f"   Subject: {existing.get('subject', 'N/A')}")
        print(f"   Has profileCardHtml: {'profileCardHtml' in existing.get('body', '')}")
        
        # Update the template
        result = await db.notification_templates.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "body": UPDATED_TEMPLATE_BODY.strip(),
                    "subject": "❄️ Re-ignite your conversation with {match.firstName}",
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"\n✅ Template updated successfully!")
        else:
            print(f"\n⚠️ No changes made (template may already be up to date)")
    else:
        print(f"\n❌ Template not found! Creating new one...")
        
        template = {
            "trigger": "conversation_cold",
            "channel": "email",
            "category": "engagement",
            "subject": "❄️ Re-ignite your conversation with {match.firstName}",
            "body": UPDATED_TEMPLATE_BODY.strip(),
            "priority": "low",
            "active": True,
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.notification_templates.insert_one(template)
        print(f"✅ Created new template with ID: {result.inserted_id}")
    
    # Verify the update
    updated = await db.notification_templates.find_one({
        "trigger": "conversation_cold",
        "channel": "email"
    })
    
    print(f"\n📋 Verification:")
    print(f"   Has profileCardHtml placeholder: {'profileCardHtml' in updated.get('body', '')}")
    print(f"   Body length: {len(updated.get('body', ''))}")
    
    client.close()
    print(f"\n{'='*60}")
    print("✅ Done!")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    asyncio.run(update_template())
