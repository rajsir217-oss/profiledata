"""
Seed Production Database with ALL Email Templates
Combines all templates and seeds to production MongoDB
Run this with production MongoDB URL
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import certifi

# Get MongoDB URL from environment or use production default
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://matrimonial-prod-cluster.mongodb.net")
DATABASE_NAME = "matrimonialDB"

# Template generator function
def create_template(trigger, category, subject, color, priority, description, cta_text, cta_link_type):
    """Generate a template with consistent structure"""
    html_body = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .logo-container { text-align: center; padding: 20px 0; }
        .logo-container img { width: 120px; height: auto; }
        .header { background: linear-gradient(135deg, COLOR 0%, COLORdd 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: COLOR; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; font-weight: bold; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding: 20px; border-top: 1px solid #ddd; }
        .footer a { color: COLOR; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-container">
            <img src="{app.logoUrl}" alt="L3V3L" />
        </div>
        <div class="header">
            <h1>SUBJECT</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            
            <div class="card">
                <p>DESCRIPTION</p>
            </div>
            
            <center>
                <a href="{app.CTA_LINK_TYPEUrl_tracked}" class="button">CTA_TEXT</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{app.unsubscribeUrl_tracked}">Unsubscribe</a> | <a href="{app.preferencesUrl_tracked}">Preferences</a></p>
            <img src="{app.trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
        </div>
    </div>
</body>
</html>
    """
    
    html_body = html_body.replace("COLOR", color)
    html_body = html_body.replace("SUBJECT", subject)
    html_body = html_body.replace("DESCRIPTION", description)
    html_body = html_body.replace("CTA_TEXT", cta_text)
    html_body = html_body.replace("CTA_LINK_TYPE", cta_link_type)
    
    return {
        "trigger": trigger,
        "channel": "email",
        "category": category,
        "subject": subject,
        "body": html_body,
        "priority": priority,
        "enabled": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

# ALL 21 EMAIL TEMPLATES
ALL_TEMPLATES = [
    # 1-5: Core templates (from seed_complete_email_templates.py)
    create_template(
        "new_match", "match",
        "🎉 You have a new match, {recipient.firstName}!",
        "#667eea", "high",
        "Great news! We found someone who matches your preferences.",
        "View Match", "profile"
    ),
    create_template(
        "new_message", "messages",
        "💌 New message from {match.firstName}",
        "#10b981", "high",
        "You have a new message from {match.firstName}. Don't keep them waiting!",
        "Read Message", "chat"
    ),
    create_template(
        "profile_view", "engagement",
        "👀 {match.firstName} viewed your profile",
        "#3b82f6", "medium",
        "{match.firstName} is interested in you. Check out their profile!",
        "View Their Profile", "profile"
    ),
    create_template(
        "pii_request", "privacy",
        "📧 Contact Request from {match.firstName}",
        "#8b5cf6", "high",
        "{match.firstName} wants to connect with you outside the platform. Approve or deny this request.",
        "Review Request", "dashboard"
    ),
    create_template(
        "weekly_digest", "digest",
        "📬 Your Weekly Match Summary - {stats.matchCount} new matches!",
        "#667eea", "low",
        "Here's your weekly summary: {stats.matchCount} new matches, {stats.viewCount} profile views, and {stats.messageCount} messages.",
        "View All Activity", "dashboard"
    ),
    
    # 6-20: Additional templates (from add_remaining_templates.py)
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
    ),
    
    # 21: Password reset (critical)
    create_template(
        "password_reset", "security",
        "🔑 Password Reset Request",
        "#dc2626", "critical",
        "We received a request to reset your password. Click the button below to create a new password. This link expires in 1 hour.",
        "Reset Password", "reset"
    )
]

async def seed_production():
    """Seed all 21 templates to production database"""
    print("=" * 60)
    print("🌱 SEEDING PRODUCTION EMAIL TEMPLATES")
    print("=" * 60)
    print(f"MongoDB URL: {MONGODB_URL[:50]}...")
    print(f"Database: {DATABASE_NAME}")
    print(f"Total templates to seed: {len(ALL_TEMPLATES)}")
    print("=" * 60)
    
    try:
        # Connect with proper SSL certificate handling
        client = AsyncIOMotorClient(MONGODB_URL, tlsCAFile=certifi.where())
        db = client[DATABASE_NAME]
        collection = db.notification_templates
        
        # Test connection
        await db.command('ping')
        print("✅ Connected to MongoDB")
        
        inserted = 0
        updated = 0
        skipped = 0
        
        for template in ALL_TEMPLATES:
            # Check if already exists
            existing = await collection.find_one({
                "trigger": template["trigger"],
                "channel": "email"
            })
            
            if existing:
                # Update existing template
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "subject": template["subject"],
                        "body": template["body"],
                        "category": template["category"],
                        "priority": template["priority"],
                        "enabled": template["enabled"],
                        "updatedAt": datetime.utcnow()
                    }}
                )
                print(f"   🔄 Updated: {template['trigger']} ({template['category']})")
                updated += 1
            else:
                await collection.insert_one(template)
                print(f"   ✅ Created: {template['trigger']} ({template['category']})")
                inserted += 1
        
        total = await collection.count_documents({"channel": "email"})
        
        print("\n" + "=" * 60)
        print("🎉 SEEDING COMPLETE!")
        print("=" * 60)
        print(f"   ✅ Inserted: {inserted}")
        print(f"   🔄 Updated: {updated}")
        print(f"   ⏭️  Skipped: {skipped}")
        print(f"   📊 Total email templates: {total}")
        print("=" * 60)
        
        if total >= 20:
            print("\n🎊 SUCCESS! All email templates are now in production!")
            print("\n📝 Templates include all categories:")
            print("   ✅ Match notifications")
            print("   ✅ Message alerts")
            print("   ✅ Engagement triggers")
            print("   ✅ Privacy & security")
            print("   ✅ Onboarding & milestones")
            print("   ✅ Weekly digests")
        
        client.close()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\n💡 Make sure:")
        print("   1. MONGODB_URL environment variable is set")
        print("   2. MongoDB connection string includes credentials")
        print("   3. Network access is configured")
        raise

if __name__ == "__main__":
    import sys
    
    # Check if running with --auto flag (for scripted execution)
    auto_mode = '--auto' in sys.argv
    
    if not auto_mode:
        print("\n⚠️  This will seed/update email templates in PRODUCTION database!")
        print(f"MongoDB: {os.getenv('MONGODB_URL', 'NOT SET')[:50]}...")
        response = input("\nContinue? (yes/no): ")
        
        if response.lower() != 'yes':
            print("❌ Cancelled")
            sys.exit(0)
    
    asyncio.run(seed_production())
