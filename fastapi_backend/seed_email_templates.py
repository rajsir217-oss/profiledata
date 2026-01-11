"""
Seed Email Templates for Notification System
Creates 5 pre-defined email templates for different categories
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# MongoDB connection
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

# Email Templates
EMAIL_TEMPLATES = [
    # 1. MATCH CATEGORY - New Match
    {
        "trigger": "new_match",
        "channel": "email",
        "category": "match",
        "subject": "🎉 You have a new match, {recipient.firstName}!",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .match-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .match-score { font-size: 24px; font-weight: bold; color: #667eea; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Congratulations!</h1>
            <p>You have a new match</p>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <p>Great news! We found someone who matches your preferences.</p>
            
            <div class="match-card">
                <h2>{match.firstName}, {match.age}</h2>
                <p><strong>Location:</strong> {match.location}</p>
                <p><strong>Profession:</strong> {match.profession}</p>
                <p class="match-score">Match Score: {match.matchScore}%</p>
            </div>
            
            <p>This match was selected based on your preferences and compatibility factors.</p>
            
            <center>
                <a href="{app.profileUrl}" class="button">View Full Profile</a>
            </center>
            
            <p>Don't wait too long - good matches don't last!</p>
        </div>
        <div class="footer">
            <p>You're receiving this because you opted in for match notifications.</p>
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "high",
        "enabled": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    },
    
    # 2. ACTIVITY CATEGORY - Profile Viewed
    {
        "trigger": "profile_viewed",
        "channel": "email",
        "category": "activity",
        "subject": "👀 {match.firstName} viewed your profile!",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .profile-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>👀 Someone's Interested!</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <p>Your profile is getting attention!</p>
            
            <div class="profile-card">
                <h2>{match.firstName}, {match.age}</h2>
                <p>{match.location}</p>
                <p><strong>{match.profession}</strong></p>
            </div>
            
            <p>viewed your profile recently. This could be your perfect match!</p>
            
            <div class="stats">
                <div class="stat">
                    <div class="stat-number">{stats.profileViews}</div>
                    <div>Profile Views</div>
                </div>
                <div class="stat">
                    <div class="stat-number">{stats.favorites}</div>
                    <div>Favorites</div>
                </div>
            </div>
            
            <center>
                <a href="{app.profileUrl}" class="button">View Their Profile</a>
            </center>
            
            <p><em>Tip: Profiles with photos get 5x more attention!</em></p>
        </div>
        <div class="footer">
            <p>You're receiving this because you opted in for activity notifications.</p>
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "medium",
        "enabled": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    },
    
    # 3. MESSAGES CATEGORY - New Message
    {
        "trigger": "new_message",
        "channel": "email",
        "category": "messages",
        "subject": "💬 New message from {match.firstName}",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid #667eea; }
        .sender { font-weight: bold; color: #667eea; margin-bottom: 10px; }
        .message-preview { font-style: italic; color: #666; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💬 New Message</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <p>You have a new message waiting for you!</p>
            
            <div class="message-box">
                <div class="sender">From: {match.firstName}, {match.age}</div>
                <div class="message-preview">"{message.preview}"</div>
            </div>
            
            <p><strong>Don't keep them waiting!</strong> Reply now to keep the conversation going.</p>
            
            <center>
                <a href="{app.chatUrl}" class="button">Read & Reply</a>
            </center>
            
            <p><em>Quick responses lead to better connections!</em></p>
            
            {% if stats.unreadMessages > 1 %}
            <p>You also have {stats.unreadMessages} other unread messages.</p>
            {% endif %}
        </div>
        <div class="footer">
            <p>You're receiving this because you opted in for message notifications.</p>
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "high",
        "enabled": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    },
    
    # 4. PRIVACY CATEGORY - PII Request
    {
        "trigger": "pii_request",
        "channel": "email",
        "category": "privacy",
        "subject": "🔒 {match.firstName} wants to connect with you",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .request-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .button-approve { background: #10b981; color: white; }
        .button-deny { background: #ef4444; color: white; }
        .privacy-note { background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Contact Request</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <p><strong>{match.firstName}</strong> wants to connect with you!</p>
            
            <div class="request-card">
                <h2>{match.firstName}, {match.age}</h2>
                <p><strong>Location:</strong> {match.location}</p>
                <p><strong>Profession:</strong> {match.profession}</p>
                <p><strong>Match Score:</strong> {match.matchScore}%</p>
            </div>
            
            <p>has requested access to your contact information (email and phone number).</p>
            
            <div class="privacy-note">
                <strong>🛡️ Your Privacy Matters</strong>
                <p>You have full control over who can access your contact details. You can approve or deny this request, and revoke access anytime.</p>
            </div>
            
            <center>
                <a href="{app.approveUrl}" class="button button-approve">✓ Approve Request</a>
                <a href="{app.denyUrl}" class="button button-deny">✕ Deny Request</a>
            </center>
            
            <p><a href="{app.profileUrl}">View {match.firstName}'s full profile</a> before deciding.</p>
        </div>
        <div class="footer">
            <p>You're receiving this because someone requested your contact information.</p>
            <p><a href="{app.preferencesUrl}">Privacy Settings</a></p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "high",
        "enabled": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    },
    
    # 5. ENGAGEMENT CATEGORY - Unread Messages Reminder
    {
        "trigger": "unread_messages",
        "channel": "email",
        "category": "engagement",
        "subject": "⏰ You have {stats.unreadMessages} unread messages",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .stats-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
        .big-number { font-size: 48px; font-weight: bold; color: #667eea; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .highlights { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .highlight-item { padding: 10px 0; border-bottom: 1px solid #eee; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Don't Miss Out!</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <p>You have messages waiting for you!</p>
            
            <div class="stats-card">
                <div class="big-number">{stats.unreadMessages}</div>
                <p>Unread Messages</p>
            </div>
            
            <p>People are trying to connect with you. Don't let opportunities slip away!</p>
            
            <div class="highlights">
                <h3>📊 Your Activity Summary</h3>
                <div class="highlight-item">
                    <strong>{stats.profileViews}</strong> profile views this week
                </div>
                <div class="highlight-item">
                    <strong>{stats.newMatches}</strong> new matches
                </div>
                <div class="highlight-item">
                    <strong>{stats.favorites}</strong> people added you to favorites
                </div>
            </div>
            
            <center>
                <a href="{app.chatUrl}" class="button">Check Your Messages</a>
            </center>
            
            <p><em>Active users find matches 3x faster!</em></p>
        </div>
        <div class="footer">
            <p>You're receiving this because you have unread messages.</p>
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "medium",
        "enabled": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
]

async def seed_templates():
    """Seed email templates into database"""
    print("🌱 Seeding email templates...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    collection = db.notification_templates
    
    # Check existing templates
    existing_count = await collection.count_documents({"channel": "email"})
    print(f"   Found {existing_count} existing email templates")
    
    # Insert templates
    inserted_count = 0
    for template in EMAIL_TEMPLATES:
        # Check if template already exists
        existing = await collection.find_one({
            "trigger": template["trigger"],
            "channel": template["channel"]
        })
        
        if existing:
            print(f"   ⏭️  Skipping {template['trigger']} - already exists")
        else:
            await collection.insert_one(template)
            print(f"   ✅ Created template: {template['trigger']} ({template['category']})")
            inserted_count += 1
    
    print(f"\n🎉 Done! Inserted {inserted_count} new templates")
    print(f"   Total email templates: {await collection.count_documents({'channel': 'email'})}")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_templates())
