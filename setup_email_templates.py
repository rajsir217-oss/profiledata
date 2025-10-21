"""
Setup Email Templates for Notification System
Run this script to populate the notification_templates collection
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Template definitions
TEMPLATES = [
    {
        "trigger": "new_match",
        "channel": "email",
        "category": "match",
        "subject": "🎉 You have a new match, {recipient.firstName}!",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #6366f1;">Congratulations, {recipient.firstName}! 🎉</h2>
    <p>You matched with <strong>{match.firstName}</strong>, {match.age}, from {match.location}.</p>
    
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;">Match Score: <strong style="color: #6366f1; font-size: 1.2em;">{match.matchScore}%</strong></p>
    </div>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.matchUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Profile
        </a>
    </p>
    
    <p>Don't keep them waiting - start chatting now!</p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "mutual_favorite",
        "channel": "email",
        "category": "match",
        "subject": "💕 {match.firstName} favorited you back!",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #ec4899;">It's mutual, {recipient.firstName}! 💕</h2>
    <p><strong>{match.firstName}</strong> also added you to their favorites.</p>
    
    <p>This could be the start of something special!</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.chatUrl}" style="background: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Start Chatting
        </a>
    </p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "shortlist_added",
        "channel": "email",
        "category": "match",
        "subject": "⭐ {match.firstName} added you to their shortlist",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f59e0b;">You're on someone's shortlist! ⭐</h2>
    <p><strong>{match.firstName}</strong>, {match.age}, thinks you're special!</p>
    
    <p>They added you to their shortlist - you're one step closer to a match.</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.profileUrl}" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Their Profile
        </a>
    </p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "match_milestone",
        "channel": "email",
        "category": "match",
        "subject": "🎊 Milestone reached: {stats.mutualMatches} mutual matches!",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #10b981;">Congratulations, {recipient.firstName}! 🎊</h2>
    <p>You've reached <strong>{stats.mutualMatches} mutual matches</strong>!</p>
    
    <p>You're doing great! Keep connecting with amazing people.</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.matchUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Your Matches
        </a>
    </p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "profile_view",
        "channel": "email",
        "category": "activity",
        "subject": "👀 {match.firstName} viewed your profile",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #6366f1;">Someone's interested! 👀</h2>
    <p><strong>{match.firstName}</strong>, {match.age}, viewed your profile.</p>
    
    <p>Why not check them out?</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.profileUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Their Profile
        </a>
    </p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "favorited",
        "channel": "email",
        "category": "activity",
        "subject": "❤️ {match.firstName} favorited you!",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #ef4444;">Someone likes you! ❤️</h2>
    <p><strong>{match.firstName}</strong> added you to their favorites.</p>
    
    <p>Favorite them back to let them know you're interested!</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.profileUrl}" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Their Profile
        </a>
    </p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "new_message",
        "channel": "email",
        "category": "messages",
        "subject": "💬 New message from {match.firstName}",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #6366f1;">You have a new message! 💬</h2>
    <p><strong>{match.firstName}</strong> sent you a message.</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.chatUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Read Message
        </a>
    </p>
    
    <p>Reply quickly to keep the conversation going!</p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "message_read",
        "channel": "email",
        "category": "messages",
        "subject": "✓ {match.firstName} read your message",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #10b981;">Message read! ✓</h2>
    <p><strong>{match.firstName}</strong> read your message.</p>
    
    <p>They might reply soon!</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.chatUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Conversation
        </a>
    </p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "pii_request",
        "channel": "email",
        "category": "privacy",
        "subject": "🔐 {match.firstName} requested access to your contact info",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #6366f1;">Privacy Request 🔐</h2>
    <p><strong>{match.firstName}</strong> requested access to your private contact information.</p>
    
    <p>You can grant or deny this request from your privacy settings.</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.profileUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Review Request
        </a>
    </p>
    
    <p><small>Never share your contact information unless you're comfortable doing so.</small></p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "pii_granted",
        "channel": "email",
        "category": "privacy",
        "subject": "🔓 {match.firstName} shared their contact info",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #10b981;">Access Granted! 🔓</h2>
    <p><strong>{match.firstName}</strong> granted you access to their private information.</p>
    
    <p>You can now view their full contact details.</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.profileUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Details
        </a>
    </p>
    
    <p><small>This access will expire in 30 days unless renewed.</small></p>
</div>
        """,
        "active": True,
        "version": 1
    },
    {
        "trigger": "unread_messages",
        "channel": "email",
        "category": "engagement",
        "subject": "💬 You have {stats.unreadMessages} unread messages",
        "body": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #6366f1;">Don't miss out, {recipient.firstName}! 💬</h2>
    <p>You have <strong>{stats.unreadMessages} unread messages</strong> waiting for you.</p>
    
    <p>Someone might be waiting for your reply!</p>
    
    <p style="margin: 20px 0; text-align: center;">
        <a href="{app.chatUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Read Messages
        </a>
    </p>
</div>
        """,
        "active": True,
        "version": 1
    }
]


async def setup_templates():
    """Create email templates in database"""
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["matrimonialDB"]
    collection = db["notification_templates"]
    
    print("🔧 Setting up email templates...")
    
    # Insert templates
    for template in TEMPLATES:
        # Check if exists
        existing = await collection.find_one({
            "trigger": template["trigger"],
            "channel": template["channel"]
        })
        
        if existing:
            # Update existing
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    **template,
                    "updated_at": datetime.utcnow()
                }}
            )
            print(f"✅ Updated: {template['trigger']} ({template['channel']})")
        else:
            # Insert new
            await collection.insert_one({
                **template,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            print(f"✨ Created: {template['trigger']} ({template['channel']})")
    
    print(f"\n🎉 Successfully set up {len(TEMPLATES)} email templates!")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(setup_templates())
