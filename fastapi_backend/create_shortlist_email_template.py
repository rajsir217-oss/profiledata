#!/usr/bin/env python3
"""
Create email template for shortlist_added notification
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env.local')

async def create_template():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("📧 Creating email template for shortlist_added...\n")
    
    # Check if template already exists
    existing = await db.notification_templates.find_one({
        "trigger": "shortlist_added",
        "channel": "email"
    })
    
    if existing:
        print(f"⚠️  Template already exists (ID: {existing['_id']})")
        print(f"   Active: {existing.get('active')}")
        
        # Update it to be active
        await db.notification_templates.update_one(
            {"_id": existing["_id"]},
            {"$set": {"active": True}}
        )
        print("   ✅ Set to active")
    else:
        # Create new template
        template = {
            "trigger": "shortlist_added",
            "channel": "email",
            "active": True,
            "subject": "💫 You've been shortlisted!",
            "body": """
<h2>Great news, {{user.firstName}}!</h2>

<p><strong>{{actor.firstName}} {{actor.lastName}}</strong> has added you to their shortlist! 🌟</p>

<p>This means they're interested in connecting with you and think you could be a great match.</p>

<div style="margin: 30px 0;">
    <a href="{{app.profileUrl_tracked}}/{{actor.username}}" 
       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 5px;
              display: inline-block;">
        View {{actor.firstName}}'s Profile
    </a>
</div>

<h3>About {{actor.firstName}}:</h3>
<ul>
    <li>📍 Location: {{actor.location}}</li>
    <li>💼 Occupation: {{actor.occupation}}</li>
    <li>🎓 Education: {{actor.education}}</li>
</ul>

<p>Take a moment to check out their profile and see if you'd like to connect!</p>

<p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
    <small>
        You received this email because your notification preferences are set to receive shortlist notifications.
        <br>
        <a href="{{app.profileUrl_tracked}}/settings">Manage notification preferences</a>
    </small>
</p>
""",
            "bodyTemplate": """
<h2>Great news, {{user.firstName}}!</h2>

<p><strong>{{actor.firstName}} {{actor.lastName}}</strong> has added you to their shortlist! 🌟</p>

<p>This means they're interested in connecting with you and think you could be a great match.</p>

<div style="margin: 30px 0;">
    <a href="{{app.profileUrl_tracked}}/{{actor.username}}" 
       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 5px;
              display: inline-block;">
        View {{actor.firstName}}'s Profile
    </a>
</div>

<h3>About {{actor.firstName}}:</h3>
<ul>
    <li>📍 Location: {{actor.location}}</li>
    <li>💼 Occupation: {{actor.occupation}}</li>
    <li>🎓 Education: {{actor.education}}</li>
</ul>

<p>Take a moment to check out their profile and see if you'd like to connect!</p>

<p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
    <small>
        You received this email because your notification preferences are set to receive shortlist notifications.
        <br>
        <a href="{{app.profileUrl_tracked}}/settings">Manage notification preferences</a>
    </small>
</p>
""",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.notification_templates.insert_one(template)
        print(f"✅ Created new template (ID: {result.inserted_id})")
    
    print("\n✅ Template ready for shortlist_added emails!\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_template())
