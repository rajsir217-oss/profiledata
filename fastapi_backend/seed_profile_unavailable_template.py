#!/usr/bin/env python3
"""
Seed Email Template for Profile Unavailable Notification
Sent when a user marks someone as "not interested" - polite notification to the excluded user
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os

# Use EnvironmentManager to auto-detect and load correct environment
from env_config import EnvironmentManager

# Auto-detect environment and load appropriate .env file
env_manager = EnvironmentManager()
current_env = env_manager.detect_environment()
env_manager.load_environment_config(current_env)

# Get configuration from environment variables
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DATABASE_NAME", "matrimonialDB")
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

template = {
    "trigger": "profile_unavailable",
    "channel": "email",
    "category": "activity",
    "subject": "A profile update on USVedika",
    "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .info-icon { font-size: 48px; margin: 15px 0; }
        .info-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #6366f1; margin: 20px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .suggestion-box { background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="info-icon">💫</div>
            <h1>Profile Update</h1>
        </div>
        <div class="content">
            <p>Hi there,</p>
            
            <div class="info-box">
                <p><strong>A profile you were interested in is no longer available for you.</strong></p>
                <p style="color: #666; font-size: 14px; margin-top: 10px;">
                    This can happen when users update their preferences or make changes to their account settings.
                </p>
            </div>
            
            <p>Don't worry - there are many other great matches waiting for you!</p>
            
            <div class="suggestion-box">
                <h3 style="margin-top: 0;">💡 What You Can Do:</h3>
                <ul style="margin-bottom: 0;">
                    <li>Browse new profiles in your matches</li>
                    <li>Update your preferences to find more compatible matches</li>
                    <li>Check out the L3V3L matching feature for AI-powered suggestions</li>
                </ul>
            </div>
            
            <center>
                <a href="{app_url}/search" class="button">Find New Matches</a>
            </center>
            
            <p style="color: #666; font-size: 13px; margin-top: 25px;">
                <em>Note: For privacy reasons, we don't share specific details about profile changes. 
                Any previous messages or shared information with this profile have been removed.</em>
            </p>
            
            <p>Best wishes on your journey,<br>The USVedika Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 USVedika. All rights reserved.</p>
            <p><a href="{app_url}/preferences">Notification Settings</a> | <a href="{app_url}/help">Help Center</a></p>
        </div>
    </div>
</body>
</html>
    """,
    "priority": "low",
    "enabled": True
}

async def seed_template():
    # Add SSL certificate handling for MongoDB Atlas connections
    import ssl
    import certifi
    
    # Connect to MongoDB with SSL support
    if "mongodb+srv" in MONGO_URL or "mongodb.net" in MONGO_URL:
        client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
    else:
        client = AsyncIOMotorClient(MONGO_URL)
    
    db = client[DB_NAME]
    
    print("🌱 Seeding profile_unavailable email template...")
    print(f"🌍 Environment: {current_env}")
    print(f"📍 APP_URL: {APP_URL}")
    print(f"🗄️  Database: {DB_NAME}")
    
    # Replace {app_url} placeholder with actual APP_URL
    template_copy = template.copy()
    template_copy["body"] = template_copy["body"].replace("{app_url}", APP_URL)
    
    # Check if template already exists
    existing = await db.notification_templates.find_one({"trigger": template_copy["trigger"]})
    
    if existing:
        # Update existing template
        template_copy["updatedAt"] = datetime.utcnow()
        await db.notification_templates.update_one(
            {"trigger": template_copy["trigger"]},
            {"$set": template_copy}
        )
        print(f"  ✅ Updated template: {template_copy['trigger']}")
    else:
        # Insert new template
        template_copy["createdAt"] = datetime.utcnow()
        template_copy["updatedAt"] = datetime.utcnow()
        await db.notification_templates.insert_one(template_copy)
        print(f"  ✅ Created template: {template_copy['trigger']}")
    
    print(f"\n✅ Successfully seeded profile_unavailable template with APP_URL={APP_URL}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_template())
