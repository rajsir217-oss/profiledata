"""
Seed L3V3L Matching Weekly/Monthly Digest Email Template
Creates a comprehensive digest template showing all user activity
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "matrimonialDB"

async def seed_digest_template():
    """Insert weekly/monthly digest template into database"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check if template already exists
    existing = await db.notification_templates.find_one({
        "trigger": "weekly_digest"
    })
    
    if existing:
        print("⏭️  Weekly digest template already exists")
        client.close()
        return
    
    template = {
        "trigger": "weekly_digest",
        "channel": "email",
        "category": "engagement",
        "subject": "[LOGO] L3V3L Matching - Weekly / Monthly Digest",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>L3V3L Matching Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">[LOGO] L3V3L Matching - Weekly / Monthly Digest</h1>
            <p style="margin: 10px 0 0 0; font-size: 14px;">one step closer to your happy family</p>
        </div>
        
        <!-- Greeting -->
        <div style="padding: 20px; background-color: white;">
            <p style="margin: 0; font-size: 16px; color: #333;">
                Hi <strong>{recipient.firstName}</strong>,
            </p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                Here's your activity summary for the past {digest.period}:
            </p>
        </div>
        
        <!-- You are Viewed By -->
        {% if stats.profileViews > 0 %}
        <div style="margin: 0 20px 20px 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: #8bc34a; color: white; padding: 12px; font-weight: bold; text-align: center;">
                You are Viewed By
            </div>
            <div style="background-color: #f1f8e9; padding: 15px;">
                {% for profile in digest.viewedBy %}
                <div style="padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 14px; color: #333;">
                    ({loop.index}) {profile.firstName} | {profile.age} | {profile.height} | {profile.location}
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        <!-- You are added to Favorites -->
        {% if stats.favorites > 0 %}
        <div style="margin: 0 20px 20px 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: #ff9800; color: white; padding: 12px; font-weight: bold; text-align: center;">
                You are added to Favorites
            </div>
            <div style="background-color: #fff3e0; padding: 15px;">
                {% for profile in digest.favoritedBy %}
                <div style="padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 14px; color: #333;">
                    ({loop.index}) {profile.firstName} | {profile.age} | {profile.height} | {profile.location}
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        <!-- You are added to Shortlisted -->
        {% if stats.shortlisted > 0 %}
        <div style="margin: 0 20px 20px 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: #3f51b5; color: white; padding: 12px; font-weight: bold; text-align: center;">
                You are added to Shortlisted
            </div>
            <div style="background-color: #e8eaf6; padding: 15px;">
                {% for profile in digest.shortlistedBy %}
                <div style="padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 14px; color: #333;">
                    ({loop.index}) {profile.firstName} | {profile.age} | {profile.height} | {profile.location}
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        <!-- Messages Received By -->
        {% if stats.newMessages > 0 %}
        <div style="margin: 0 20px 20px 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: #607d8b; color: white; padding: 12px; font-weight: bold; text-align: center;">
                Messages Received By
            </div>
            <div style="background-color: #eceff1; padding: 15px;">
                {% for profile in digest.messagesFrom %}
                <div style="padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 14px; color: #333;">
                    ({loop.index}) {profile.firstName} | {profile.age} | {profile.height} | {profile.location}
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        <!-- You are blocked by -->
        {% if stats.blockedBy > 0 %}
        <div style="margin: 0 20px 20px 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: #ffccbc; color: #333; padding: 12px; font-weight: bold; text-align: center;">
                You are blocked by
            </div>
            <div style="background-color: #fbe9e7; padding: 15px;">
                {% for profile in digest.blockedBy %}
                <div style="padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 14px; color: #333;">
                    ({loop.index}) {profile.firstName} | {profile.age} | {profile.height} | {profile.location}
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        <!-- You are requested PII data by -->
        {% if stats.piiRequests > 0 %}
        <div style="margin: 0 20px 20px 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: #c8e6c9; color: #2e7d32; padding: 12px; font-weight: bold; text-align: center;">
                You are requested PII data by
            </div>
            <div style="background-color: #f1f8e9; padding: 15px;">
                {% for profile in digest.piiRequestsFrom %}
                <div style="padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 14px; color: #333;">
                    ({loop.index}) {profile.firstName} | {profile.age} | {profile.height} | {profile.location}
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        <!-- You are Searched By -->
        {% if stats.searchAppearances > 0 %}
        <div style="margin: 0 20px 20px 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: #e0f2f1; color: #00695c; padding: 12px; font-weight: bold; text-align: center;">
                You are Searched By
            </div>
            <div style="background-color: #f1f8e9; padding: 15px;">
                {% for profile in digest.searchedBy %}
                <div style="padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 14px; color: #333;">
                    ({loop.index}) {profile.firstName} | {profile.age} | {profile.height} | {profile.location}
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        <!-- CTA Button -->
        <div style="padding: 30px 20px; text-align: center;">
            <a href="{app.dashboardUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                      font-weight: bold; font-size: 16px;">
                View Full Dashboard
            </a>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                📊 Total Activity: {stats.totalActivity} interactions this {digest.period}
            </p>
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #999;">
                You're receiving this because you subscribed to {digest.frequency} digests
            </p>
            <div style="margin-top: 15px;">
                <a href="{app.preferencesUrl}" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 10px;">
                    Notification Preferences
                </a>
                <span style="color: #ddd;">|</span>
                <a href="{app.unsubscribeUrl}" style="color: #999; text-decoration: none; font-size: 12px; margin: 0 10px;">
                    Unsubscribe
                </a>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 11px; color: #999;">
                © 2025 L3V3L Matching. All rights reserved.
            </p>
        </div>
        
    </div>
</body>
</html>
        """,
        "priority": "medium",
        "active": True,
        "variables": [
            "recipient.firstName",
            "digest.period",
            "digest.frequency",
            "stats.profileViews",
            "stats.favorites",
            "stats.shortlisted",
            "stats.newMessages",
            "stats.blockedBy",
            "stats.piiRequests",
            "stats.searchAppearances",
            "stats.totalActivity",
            "digest.viewedBy",
            "digest.favoritedBy",
            "digest.shortlistedBy",
            "digest.messagesFrom",
            "digest.blockedBy",
            "digest.piiRequestsFrom",
            "digest.searchedBy",
            "app.dashboardUrl",
            "app.preferencesUrl",
            "app.unsubscribeUrl"
        ],
        "description": "Weekly or monthly digest email showing all user activity including profile views, favorites, shortlists, messages, blocks, PII requests, and search appearances",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    # Insert template
    result = await db.notification_templates.insert_one(template)
    
    print(f"✅ Created weekly digest template with ID: {result.inserted_id}")
    
    client.close()


async def main():
    print("🌱 Seeding L3V3L Matching Digest Template...")
    await seed_digest_template()
    print("🎉 Done!")


if __name__ == "__main__":
    asyncio.run(main())
