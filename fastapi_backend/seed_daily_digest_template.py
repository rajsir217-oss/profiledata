"""
Seed script for Daily Digest Email Template
Run this to add the daily digest email template to the notification_templates collection
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()

DAILY_DIGEST_TEMPLATE = {
    "templateId": "daily_digest_email",
    "trigger": "daily_digest",
    "channel": "email",
    "subject": "📬 Your Daily Digest - {stats.total_favorites} favorites, {stats.total_views} views",
    "bodyTemplate": """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Daily Digest</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; line-height: 1.6; }
        .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); }
        .email-header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); padding: 30px 24px; text-align: center; color: white; }
        .email-header .logo { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .email-header .date { font-size: 14px; opacity: 0.9; }
        .email-header h1 { font-size: 24px; font-weight: 600; margin-top: 16px; }
        .greeting { padding: 24px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-bottom: 1px solid #f59e0b; }
        .greeting h2 { font-size: 20px; color: #92400e; margin-bottom: 8px; }
        .greeting p { color: #a16207; font-size: 14px; }
        .quick-stats { display: flex; justify-content: space-around; padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
        .stat-item { text-align: center; padding: 10px; }
        .stat-number { font-size: 28px; font-weight: 700; color: #6366f1; }
        .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .section { padding: 24px; border-bottom: 1px solid #e2e8f0; }
        .section:last-child { border-bottom: none; }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .section-title { font-size: 16px; font-weight: 600; color: #1e293b; }
        .section-count { background: #6366f1; color: white; font-size: 12px; padding: 2px 10px; border-radius: 12px; font-weight: 600; }
        .user-card { display: flex; align-items: center; padding: 12px; background: #f8fafc; border-radius: 12px; margin-bottom: 12px; border: 1px solid #e2e8f0; }
        .user-avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%); display: flex; align-items: center; justify-content: center; font-size: 24px; margin-right: 14px; flex-shrink: 0; }
        .user-info { flex: 1; min-width: 0; }
        .user-name { font-weight: 600; color: #1e293b; font-size: 15px; margin-bottom: 4px; }
        .user-details { font-size: 12px; color: #64748b; }
        .view-all { display: block; text-align: center; padding: 12px; color: #6366f1; font-weight: 600; font-size: 14px; text-decoration: none; background: #f1f5f9; border-radius: 8px; margin-top: 16px; }
        .cta-section { padding: 30px 24px; text-align: center; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); }
        .cta-section h3 { font-size: 18px; color: #0369a1; margin-bottom: 8px; }
        .cta-section p { font-size: 14px; color: #0284c7; margin-bottom: 16px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 30px; font-weight: 600; font-size: 15px; text-decoration: none; }
        .email-footer { padding: 24px; background: #1e293b; color: #94a3b8; text-align: center; font-size: 12px; }
        .email-footer a { color: #a78bfa; text-decoration: none; }
        .empty-state { text-align: center; padding: 20px; color: #94a3b8; }
        @media (max-width: 480px) {
            .quick-stats { flex-direction: column; }
            .stat-item { width: 50%; display: inline-block; }
            .user-card { flex-direction: column; text-align: center; }
            .user-avatar { margin-right: 0; margin-bottom: 10px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">🦋 ProfileData</div>
            <div class="date">{generatedAt}</div>
            <h1>Your Daily Digest ✨</h1>
        </div>
        
        <div class="greeting">
            <h2>Good morning, {recipient.firstName}! ☀️</h2>
            <p>Here's what happened on your profile in the last 24 hours.</p>
        </div>
        
        <div class="quick-stats">
            <div class="stat-item">
                <div class="stat-number">{stats.total_views}</div>
                <div class="stat-label">Profile Views</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">{stats.total_favorites}</div>
                <div class="stat-label">New Favorites</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">{stats.total_messages}</div>
                <div class="stat-label">Messages</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">{stats.total_pii_requests}</div>
                <div class="stat-label">PII Requests</div>
            </div>
        </div>
        
        {% if activity.favorited_by %}
        <div class="section">
            <div class="section-header">
                <div class="section-title">⭐ Favorited By</div>
                <span class="section-count">{stats.total_favorites} new</span>
            </div>
            {% for user in activity.favorited_by %}
            <div class="user-card">
                <div class="user-avatar">👤</div>
                <div class="user-info">
                    <div class="user-name">{user.firstName} {user.lastName}</div>
                    <div class="user-details">
                        🎓 {user.education} • 💼 {user.occupation} • 📍 {user.location}
                    </div>
                </div>
            </div>
            {% endfor %}
            <a href="{app_url}/favorites" class="view-all">View All Favorites →</a>
        </div>
        {% endif %}
        
        {% if activity.shortlisted_by %}
        <div class="section">
            <div class="section-header">
                <div class="section-title">📋 Shortlisted By</div>
                <span class="section-count">{len(activity.shortlisted_by)} new</span>
            </div>
            {% for user in activity.shortlisted_by %}
            <div class="user-card">
                <div class="user-avatar">👤</div>
                <div class="user-info">
                    <div class="user-name">{user.firstName} {user.lastName}</div>
                    <div class="user-details">
                        🎓 {user.education} • 💼 {user.occupation} • 📍 {user.location}
                    </div>
                </div>
            </div>
            {% endfor %}
            <a href="{app_url}/shortlist" class="view-all">View All Shortlists →</a>
        </div>
        {% endif %}
        
        {% if activity.profile_views %}
        <div class="section">
            <div class="section-header">
                <div class="section-title">👁️ Profile Views</div>
                <span class="section-count">{stats.total_views} today</span>
            </div>
            {% for user in activity.profile_views[:5] %}
            <div class="user-card">
                <div class="user-avatar">👤</div>
                <div class="user-info">
                    <div class="user-name">{user.firstName} {user.lastName}</div>
                    <div class="user-details">
                        🎓 {user.education} • 💼 {user.occupation} • 📍 {user.location}
                    </div>
                </div>
            </div>
            {% endfor %}
            <a href="{app_url}/dashboard" class="view-all">View All Viewers →</a>
        </div>
        {% endif %}
        
        {% if activity.new_messages %}
        <div class="section">
            <div class="section-header">
                <div class="section-title">💬 New Messages</div>
                <span class="section-count">{stats.total_messages} unread</span>
            </div>
            {% for msg in activity.new_messages %}
            <div class="user-card">
                <div class="user-avatar">💬</div>
                <div class="user-info">
                    <div class="user-name">{msg.firstName} {msg.lastName}</div>
                    <div class="user-details">
                        {msg.count} message(s) • "{msg.lastMessage}..."
                    </div>
                </div>
            </div>
            {% endfor %}
            <a href="{app_url}/messages" class="view-all">View All Messages →</a>
        </div>
        {% endif %}
        
        {% if activity.pii_requests %}
        <div class="section" style="background: #fef3c7;">
            <div class="section-header">
                <div class="section-title">🔐 PII Data Requests</div>
                <span class="section-count" style="background: #f59e0b;">{stats.total_pii_requests} pending</span>
            </div>
            {% for req in activity.pii_requests %}
            <div class="user-card" style="background: white; border-color: #fcd34d;">
                <div class="user-avatar" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);">🔐</div>
                <div class="user-info">
                    <div class="user-name">{req.firstName} {req.lastName}</div>
                    <div class="user-details">
                        Requested: {', '.join(req.requestedTypes)}
                    </div>
                </div>
            </div>
            {% endfor %}
            <a href="{app_url}/pii-management" class="view-all" style="background: #fef3c7; color: #92400e;">Review Requests →</a>
        </div>
        {% endif %}
        
        {% if activity.expiring_access %}
        <div class="section" style="background: #fef2f2;">
            <div class="section-header">
                <div class="section-title">⚠️ Expiring Access</div>
                <span class="section-count" style="background: #ef4444;">{len(activity.expiring_access)}</span>
            </div>
            {% for access in activity.expiring_access %}
            <div class="user-card" style="background: white; border-color: #fecaca;">
                <div class="user-avatar" style="background: linear-gradient(135deg, #fca5a5 0%, #ef4444 100%);">⏰</div>
                <div class="user-info">
                    <div class="user-name">{access.firstName} {access.lastName}</div>
                    <div class="user-details" style="color: #dc2626;">
                        Access expires soon: {', '.join(access.accessTypes)}
                    </div>
                </div>
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        <div class="cta-section">
            <h3>🎯 Ready to connect?</h3>
            <p>Don't miss out on these potential matches!</p>
            <a href="{app_url}/dashboard" class="cta-button">Open Dashboard →</a>
        </div>
        
        <div class="email-footer">
            <p>
                You're receiving this daily digest because you enabled it in your preferences.<br>
                <a href="{app_url}/preferences?tab=notifications">Manage digest settings</a> • 
                <a href="{app_url}/preferences?tab=notifications">Unsubscribe</a>
            </p>
            <p style="margin-top: 16px;">ProfileData Matrimonial</p>
        </div>
    </div>
</body>
</html>
""",
    "priority": "low",
    "active": True,
    "createdAt": datetime.utcnow(),
    "updatedAt": datetime.utcnow()
}


async def seed_daily_digest_template():
    """Seed the daily digest email template"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Check if template already exists
        existing = await db.notification_templates.find_one({"templateId": "daily_digest_email"})
        
        if existing:
            # Update existing template
            result = await db.notification_templates.update_one(
                {"templateId": "daily_digest_email"},
                {"$set": {
                    "subject": DAILY_DIGEST_TEMPLATE["subject"],
                    "bodyTemplate": DAILY_DIGEST_TEMPLATE["bodyTemplate"],
                    "updatedAt": datetime.utcnow()
                }}
            )
            print(f"✅ Updated daily_digest_email template (modified: {result.modified_count})")
        else:
            # Insert new template
            result = await db.notification_templates.insert_one(DAILY_DIGEST_TEMPLATE)
            print(f"✅ Created daily_digest_email template (id: {result.inserted_id})")
        
        # Verify
        template = await db.notification_templates.find_one({"templateId": "daily_digest_email"})
        print(f"📧 Template verified: {template['templateId']}")
        print(f"   Subject: {template['subject'][:50]}...")
        print(f"   Active: {template['active']}")
        
    except Exception as e:
        print(f"❌ Error seeding template: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(seed_daily_digest_template())
