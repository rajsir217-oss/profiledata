"""
Update new_message email template to handle empty message preview gracefully.
Previously showed "" when preview was empty.
Run: python scripts/update_new_message_template.py [local|production]
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

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

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
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid #667eea; }
        .sender { font-weight: bold; color: #667eea; margin-bottom: 10px; }
        .message-preview { font-style: italic; color: #666; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .footer a { color: #667eea; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-container">
            <img src="{app.logoUrl}" alt="L3V3L" />
        </div>
        <div class="header">
            <h1>💬 New Message</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <p>You have a new message waiting for you!</p>
            
            <div class="message-box">
                <div class="sender">From: {match.firstName}, {match.age}</div>
                {% if message.preview %}
                <div class="message-preview">"{message.preview}"</div>
                {% endif %}
            </div>
            
            <p><strong>Don't keep them waiting!</strong> Reply now to keep the conversation going.</p>
            
            <center>
                <a href="{app.chatUrl_tracked}" class="button">Read & Reply</a>
            </center>
            
            <p><em>Quick responses lead to better connections!</em></p>
        </div>
        <div class="footer">
            <p>You're receiving this because you opted in for message notifications.</p>
            <p><a href="{app.unsubscribeUrl_tracked}">Unsubscribe</a> | <a href="{app.preferencesUrl_tracked}">Manage Preferences</a></p>
            <img src="{app.trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
        </div>
    </div>
</body>
</html>
"""

async def update_template():
    print(f"\n{'='*60}")
    print(f"🔄 Updating new_message Email Template")
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
        "trigger": "new_message",
        "channel": "email"
    })
    
    if existing:
        print(f"\n📋 Found existing template:")
        print(f"   ID: {existing['_id']}")
        print(f"   Subject: {existing.get('subject', 'N/A')}")
        print(f"   Has empty-quote bug: {'\"{{message.preview}}\"' in existing.get('body', '') or '\"{message.preview}\"' in existing.get('body', '')}")
        
        # Update the template
        result = await db.notification_templates.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "body": UPDATED_TEMPLATE_BODY.strip(),
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
            "trigger": "new_message",
            "channel": "email",
            "category": "messages",
            "subject": "💬 New message from {match.firstName}",
            "body": UPDATED_TEMPLATE_BODY.strip(),
            "priority": "high",
            "active": True,
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.notification_templates.insert_one(template)
        print(f"✅ Created new template with ID: {result.inserted_id}")
    
    # Verify the update
    updated = await db.notification_templates.find_one({
        "trigger": "new_message",
        "channel": "email"
    })
    
    print(f"\n📋 Verification:")
    print(f"   Has conditional preview: {'{% if message.preview %}' in updated.get('body', '')}")
    print(f"   Body length: {len(updated.get('body', ''))}")
    
    client.close()
    print(f"\n{'='*60}")
    print("✅ Done!")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    asyncio.run(update_template())
