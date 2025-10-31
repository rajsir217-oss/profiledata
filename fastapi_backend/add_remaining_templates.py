"""
Quick script to add remaining 15 email templates
Run this after seed_complete_email_templates.py to add missing templates
All templates include logo, tracking pixel, and tracked links
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

# Template generator function
def create_template(trigger, category, subject, color, priority, description, cta_text, cta_link_type):
    """Generate a template with consistent structure"""
    return {
        "trigger": trigger,
        "channel": "email",
        "category": category,
        "subject": subject,
        "body": f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .logo-container {{ text-align: center; padding: 20px 0; }}
        .logo-container img {{ width: 120px; height: auto; }}
        .header {{ background: linear-gradient(135deg, {color} 0%, {color}dd 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
        .card {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        .button {{ display: inline-block; background: {color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; font-weight: bold; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding: 20px; border-top: 1px solid #ddd; }}
        .footer a {{ color: {color}; text-decoration: none; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-container">
            <img src="{{app.logoUrl}}" alt="L3V3L" />
        </div>
        <div class="header">
            <h1>{subject}</h1>
        </div>
        <div class="content">
            <p>Hi {{recipient.firstName}},</p>
            
            <div class="card">
                <p>{description}</p>
            </div>
            
            <center>
                <a href="{{app.{cta_link_type}Url_tracked}}" class="button">{cta_text}</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{{app.unsubscribeUrl_tracked}}">Unsubscribe</a> | <a href="{{app.preferencesUrl_tracked}}">Preferences</a></p>
            <img src="{{app.trackingPixelUrl}}" width="1" height="1" style="display:none;" alt="" />
        </div>
    </div>
</body>
</html>
        """,
        "priority": priority,
        "enabled": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

# Remaining 15 templates (simplified definitions)
REMAINING_TEMPLATES = [
    create_template(
        "shortlist_added", "engagement", 
        "⭐ {match.firstName} added you to their shortlist!",
        "#f59e0b", "medium",
        "You've been shortlisted by {match.firstName}. They're seriously interested in connecting with you!",
        "View Their Profile", "profile"
    ),
    create_template(
        "mutual_favorite", "match",
        "💕 It's a match! You and {match.firstName} both favorited each other",
        "#ec4899", "high",
        "Exciting news! You and {match.firstName} have mutual interest. This is rare - don't wait!",
        "Start Chatting", "chat"
    ),
    create_template(
        "favorited", "engagement",
        "❤️ {match.firstName} added you to favorites!",
        "#ef4444", "medium",
        "{match.firstName} likes your profile. Check them out and see if it's a match!",
        "View Profile", "profile"
    ),
    create_template(
        "pii_granted", "privacy",
        "✅ {match.firstName} granted you contact access!",
        "#10b981", "high",
        "Great news! {match.firstName} approved your contact request. Their details are now available.",
        "View Contact Info", "contact"
    ),
    create_template(
        "suspicious_login", "security",
        "🔐 Security Alert: Unusual login detected",
        "#dc2626", "critical",
        "We detected a login from an unusual location. Was this you? If not, secure your account immediately.",
        "Secure My Account", "security"
    ),
    create_template(
        "match_milestone", "milestones",
        "🎉 Milestone: {milestone.description}",
        "#8b5cf6", "low",
        "Congratulations! You've reached a new milestone: {milestone.description}",
        "View Stats", "dashboard"
    ),
    create_template(
        "search_appearance", "activity",
        "📊 Your profile appeared in {stats.searchCount} searches!",
        "#06b6d4", "low",
        "Your profile is trending! You appeared in {stats.searchCount} searches today.",
        "Update Profile", "profile"
    ),
    create_template(
        "message_read", "messages",
        "✓ {match.firstName} read your message",
        "#10b981", "low",
        "{match.firstName} has read your message. They might reply soon!",
        "View Conversation", "chat"
    ),
    create_template(
        "conversation_cold", "engagement",
        "❄️ Re-ignite your conversation with {match.firstName}",
        "#3b82f6", "low",
        "Your conversation with {match.firstName} has been quiet. Why not send them a message?",
        "Send Message", "chat"
    ),
    create_template(
        "pii_denied", "privacy",
        "🔒 Contact request declined",
        "#6b7280", "medium",
        "{match.firstName} declined your contact request. You can still connect through messaging!",
        "Find More Matches", "search"
    ),
    create_template(
        "pii_expiring", "privacy",
        "⏰ Contact access expiring for {match.firstName}",
        "#f59e0b", "medium",
        "Your access to {match.firstName}'s contact info expires in {pii.daysRemaining} days.",
        "View Contact", "contact"
    ),
    create_template(
        "upload_photos", "onboarding",
        "📸 Complete your profile with photos",
        "#8b5cf6", "medium",
        "Profiles with photos get 5x more attention. Upload yours now!",
        "Upload Photos", "profile"
    ),
    create_template(
        "profile_incomplete", "onboarding",
        "✏️ Complete your profile ({profile.completeness}% done)",
        "#f97316", "low",
        "Your profile is {profile.completeness}% complete. Fill in the missing details to get better matches!",
        "Complete Profile", "profile"
    ),
    create_template(
        "new_users_matching", "digest",
        "📬 {matches.count} new people match your preferences",
        "#667eea", "low",
        "This week, {matches.count} new people joined who match your preferences. Check them out!",
        "Browse Matches", "search"
    ),
    create_template(
        "profile_visibility_spike", "activity",
        "🔥 Your profile views increased by {stats.increase}%!",
        "#10b981", "low",
        "Your profile is getting more attention! Views increased by {stats.increase}% this week.",
        "Keep It Going", "profile"
    )
]

async def add_templates():
    """Add remaining 15 templates to database"""
    print("🌱 Adding remaining 15 email templates...")
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    collection = db.notification_templates
    
    inserted = 0
    skipped = 0
    
    for template in REMAINING_TEMPLATES:
        # Check if already exists
        existing = await collection.find_one({
            "trigger": template["trigger"],
            "channel": "email"
        })
        
        if existing:
            print(f"   ⏭️  Skipping {template['trigger']} - already exists")
            skipped += 1
        else:
            await collection.insert_one(template)
            print(f"   ✅ Created: {template['trigger']} ({template['category']})")
            inserted += 1
    
    total = await collection.count_documents({"channel": "email"})
    
    print(f"\n🎉 Done!")
    print(f"   ✅ Inserted: {inserted}")
    print(f"   ⏭️  Skipped: {skipped}")
    print(f"   📊 Total templates: {total}/20")
    
    if total == 20:
        print("\n🎊 SUCCESS! All 20 email templates are now in the database!")
        print("\n📝 All templates include:")
        print("   ✅ L3V3L logo")
        print("   ✅ Tracking pixel")
        print("   ✅ Tracked links")
        print("   ✅ Professional design")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(add_templates())
