"""
Priority 1: High Impact Email Templates (5 templates)
These are frequently triggered and users expect them
"""

from datetime import datetime

def get_priority1_templates():
    """Returns list of Priority 1 email templates"""
    return [
        # 1. ENGAGEMENT - Shortlist Added
        {
            "trigger": "shortlist_added",
            "channel": "email",
            "category": "engagement",
            "subject": "✨ {match.firstName} added you to their shortlist!",
            "body": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .profile-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .footer a { color: #f59e0b; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✨ Someone Shortlisted You!</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            <p><strong>{match.firstName}</strong> has added you to their shortlist.</p>
            <div class="profile-card">
                <h2>{match.firstName}, {match.age}</h2>
                <p><strong>Location:</strong> {match.location}</p>
                <p><strong>Profession:</strong> {match.profession}</p>
            </div>
            <center>
                <a href="{app.profileUrl}" class="button">View Their Profile</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Preferences</a></p>
        </div>
    </div>
</body>
</html>""",
            "priority": "medium",
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        
        # 2. MATCH - Mutual Favorite
        {
            "trigger": "mutual_favorite",
            "channel": "email",
            "category": "match",
            "subject": "💖 It's a match! You and {match.firstName} favorited each other",
            "body": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .match-card { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; box-shadow: 0 4px 12px rgba(236,72,153,0.2); border: 2px solid #ec4899; }
        .match-score { font-size: 28px; font-weight: bold; color: #ec4899; }
        .button { display: inline-block; background: #ec4899; color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .footer a { color: #ec4899; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💖 It's a Mutual Match!</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            <p>You and <strong>{match.firstName}</strong> have favorited each other!</p>
            <div class="match-card">
                <h2>{match.firstName}, {match.age}</h2>
                <p class="match-score">{match.matchScore}% Match</p>
            </div>
            <center>
                <a href="{app.conversationUrl}" class="button">Start Chatting Now</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Preferences</a></p>
        </div>
    </div>
</body>
</html>""",
            "priority": "high",
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        
        # 3. ENGAGEMENT - Favorited
        {
            "trigger": "favorited",
            "channel": "email",
            "category": "engagement",
            "subject": "💝 {match.firstName} added you to their favorites!",
            "body": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .profile-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .footer a { color: #f59e0b; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💝 Someone Likes Your Profile!</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            <p><strong>{match.firstName}</strong> has added you to their favorites!</p>
            <div class="profile-card">
                <h2>{match.firstName}, {match.age}</h2>
                <p><strong>Location:</strong> {match.location}</p>
            </div>
            <center>
                <a href="{app.profileUrl}" class="button">View Profile</a>
                <a href="{app.favoriteBackUrl}" class="button">❤️ Favorite Back</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Preferences</a></p>
        </div>
    </div>
</body>
</html>""",
            "priority": "medium",
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        
        # 4. PRIVACY - PII Access Granted
        {
            "trigger": "pii_granted",
            "channel": "email",
            "category": "privacy",
            "subject": "✅ {match.firstName} shared their contact details with you",
            "body": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .contact-card { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .contact-info { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 10px 0; font-family: monospace; }
        .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .footer a { color: #8b5cf6; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Contact Details Shared</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            <p><strong>{match.firstName}</strong> has granted you access to their contact information.</p>
            <div class="contact-card">
                <h2>{match.firstName}'s Contact Details</h2>
                <div class="contact-info">
                    <strong>📧 Email:</strong> {contact.email}
                </div>
                <div class="contact-info">
                    <strong>📱 Phone:</strong> {contact.phone}
                </div>
            </div>
            <center>
                <a href="{app.conversationUrl}" class="button">Send Message</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Preferences</a></p>
        </div>
    </div>
</body>
</html>""",
            "priority": "high",
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        },
        
        # 5. SECURITY - Suspicious Login
        {
            "trigger": "suspicious_login",
            "channel": "email",
            "category": "security",
            "subject": "🔒 Security Alert: New login to your account",
            "body": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .login-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .footer a { color: #dc2626; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Security Alert</h1>
        </div>
        <div class="content">
            <p>Hi {recipient.firstName},</p>
            <p>We detected a new login to your account.</p>
            <div class="login-details">
                <p><strong>Location:</strong> {login.location}</p>
                <p><strong>Device:</strong> {login.device}</p>
                <p><strong>Time:</strong> {login.timestamp}</p>
                <p><strong>IP:</strong> {login.ipAddress}</p>
            </div>
            <p>If this wasn't you, change your password immediately.</p>
            <center>
                <a href="{app.changePasswordUrl}" class="button">Change Password</a>
            </center>
        </div>
        <div class="footer">
            <p><a href="{app.unsubscribeUrl}">Unsubscribe</a> | <a href="{app.preferencesUrl}">Preferences</a></p>
        </div>
    </div>
</body>
</html>""",
            "priority": "critical",
            "enabled": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
    ]
