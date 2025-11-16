#!/usr/bin/env python3
"""
Create notification template for saved_search_matches trigger
One-time script to add saved search matches email template to notification_templates collection
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from bson import ObjectId
from dotenv import load_dotenv


async def create_template():
    load_dotenv('.env.local')
    
    # Connect to MongoDB
    mongodb_url = os.getenv('MONGODB_URL')
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    # Check if template already exists
    existing = await db.notification_templates.find_one({
        'trigger': 'saved_search_matches',
        'channel': 'email'
    })
    
    if existing:
        print(f"⚠️  Template already exists with ID: {existing['_id']}")
        choice = input("Do you want to replace it? (y/n): ")
        if choice.lower() != 'y':
            print("Aborted.")
            client.close()
            return
        await db.notification_templates.delete_one({'_id': existing['_id']})
        print(f"✅ Deleted old template")
    
    template = {
        "_id": ObjectId(),
        "name": "Saved Search Matches Notification",
        "description": "Email sent when new profiles match a user's saved search criteria",
        "trigger": "saved_search_matches",
        "channel": "email",
        "priority": "medium",
        "subject": "🔍 {{matchCount}} New Match{{plural}} for '{{searchName}}'",
        "body": """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🔍 New Matches Found!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your saved search has new results</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            
            <div style="font-size: 20px; color: #667eea; margin-bottom: 20px; font-weight: 600;">
                Hello {{user.firstName}}! 👋
            </div>
            
            <div style="font-size: 16px; line-height: 1.8; margin-bottom: 30px; color: #333;">
                <p>Great news! We found <strong>{{matchCount}} new match{{plural}}</strong> for your saved search:</p>
                
                <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px 20px; margin: 20px 0;">
                    <strong style="color: #667eea; font-size: 18px;">{{searchName}}</strong>
                    {% if searchDescription %}
                    <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">{{searchDescription}}</p>
                    {% endif %}
                </div>
            </div>
            
            <!-- Matches HTML will be injected here -->
            {{{matchesHtml}}}
            
            <div style="text-align: center; margin: 40px 0 20px 0;">
                <a href="{{app.searchUrl}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                    View All Matches →
                </a>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px; font-size: 14px; color: #666;">
                <p><strong>💡 Tip:</strong> You can adjust your notification frequency in your <a href="{{app.preferencesUrl_tracked}}" style="color: #667eea; text-decoration: none;">notification preferences</a>.</p>
            </div>
            
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 30px 20px; text-align: center; color: #666; font-size: 14px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong>L3V3LMATCH</strong> - Premium Matrimonial Platform</p>
            <p style="margin: 0;">
                <a href="{{app.dashboardUrl}}" style="color: #667eea; text-decoration: none;">Dashboard</a> • 
                <a href="{{app.preferencesUrl_tracked}}" style="color: #667eea; text-decoration: none;">Preferences</a> • 
                <a href="{{app.unsubscribeUrl_tracked}}" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
            </p>
            <img src="{{app.trackingPixelUrl}}" width="1" height="1" alt="" style="display: block; margin: 10px auto 0;">
        </div>
        
    </div>
</body>
</html>""",
        "bodyText": """Hello {{user.firstName}}!

Great news! We found {{matchCount}} new match{{plural}} for your saved search:

Search: {{searchName}}
{% if searchDescription %}
{{searchDescription}}
{% endif %}

{{matchesText}}

View all matches: {{app.searchUrl}}

---

You can adjust your notification frequency in your preferences: {{app.preferencesUrl_tracked}}

Best regards,
The L3V3LMATCH Team
""",
        "variables": [
            "user.firstName",
            "user.username",
            "matchCount",
            "plural",
            "searchName",
            "searchDescription",
            "matchesHtml",
            "matchesText",
            "app.searchUrl",
            "app.dashboardUrl",
            "app.preferencesUrl_tracked",
            "app.unsubscribeUrl_tracked",
            "app.trackingPixelUrl"
        ],
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    result = await db.notification_templates.insert_one(template)
    print(f"✅ Saved search matches template created with ID: {result.inserted_id}")
    print(f"   Trigger: saved_search_matches")
    print(f"   Channel: email")
    print(f"   Subject: {template['subject']}")
    
    # Close connection
    client.close()


if __name__ == "__main__":
    asyncio.run(create_template())
