#!/usr/bin/env python3
"""
Update shortlist email template to use {actor.firstName} instead of {match.firstName}
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

async def update_template():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🔄 Updating shortlist_added email template...\n")
    
    # Find the template
    template = await db.notification_templates.find_one({
        "trigger": "shortlist_added",
        "channel": "email"
    })
    
    if not template:
        print("❌ Template not found!")
        client.close()
        return
    
    print(f"✅ Found template (ID: {template['_id']})")
    
    # Update the template body to use {actor.} instead of {match.}
    new_body = """
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
    <li>🎂 Age: {{actor.age}}</li>
</ul>

<p>Take a moment to check out their profile and see if you'd like to connect!</p>

<p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
    <small>
        You received this email because your notification preferences are set to receive shortlist notifications.
        <br>
        <a href="{{app.profileUrl_tracked}}/settings">Manage notification preferences</a>
    </small>
</p>
"""
    
    result = await db.notification_templates.update_one(
        {"_id": template["_id"]},
        {
            "$set": {
                "body": new_body,
                "bodyTemplate": new_body,
                "active": True
            }
        }
    )
    
    if result.modified_count > 0:
        print("✅ Template updated to use {{actor.firstName}} instead of {{match.firstName}}")
        print("\n📧 The template now properly uses:")
        print("   - {{actor.firstName}}")
        print("   - {{actor.lastName}}")
        print("   - {{actor.username}}")
        print("   - {{actor.location}}")
        print("   - {{actor.occupation}}")
        print("   - {{actor.education}}")
        print("   - {{actor.age}}")
    else:
        print("⚠️  No changes made")
    
    print("\n✅ Template ready!\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_template())
