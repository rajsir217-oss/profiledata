"""
Create Invitation Email Template
One-time script to add invitation email template to notification_templates collection
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from bson import ObjectId

async def create_template():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    template = {
        "_id": ObjectId(),
        "name": "Invitation Email",
        "description": "Email sent to invited users with registration link",
        "trigger": "invitation_sent",
        "channel": "email",
        "subject": "You're Invited to Join {app.name}! 💝",
        "bodyHtml": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 20px;
            color: #667eea;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .message {
            font-size: 16px;
            line-height: 1.8;
            margin-bottom: 30px;
        }
        .custom-message {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px 20px;
            margin: 20px 0;
            font-style: italic;
            color: #555;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            padding: 16px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .features {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .features h3 {
            color: #667eea;
            margin-top: 0;
            font-size: 18px;
        }
        .feature-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .feature-list li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
        }
        .feature-list li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #667eea;
            font-weight: bold;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #ddd, transparent);
            margin: 30px 0;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .cta-button {
                display: block;
                padding: 14px 30px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💝 You're Invited!</h1>
            <p>Join L3V3LMATCH - Where Connections Matter</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Hello {invitee.name}! 👋
            </div>
            
            <div class="message">
                <p>We're excited to invite you to join <strong>L3V3LMATCH</strong>, a premium matrimonial platform designed to help you find meaningful connections.</p>
                
                {% if invitation.customMessage %}
                <div class="custom-message">
                    <strong>Personal Message:</strong><br>
                    {invitation.customMessage}
                </div>
                {% endif %}
                
                <p>Your exclusive invitation link is ready! Click the button below to create your profile and start your journey:</p>
            </div>
            
            <center>
                <a href="{invitation.link}" class="cta-button">
                    Create Your Profile →
                </a>
            </center>
            
            <div class="features">
                <h3>Why Join L3V3LMATCH?</h3>
                <ul class="feature-list">
                    <li>Advanced L3V3L matching algorithm for compatibility</li>
                    <li>Privacy-first approach with controlled information sharing</li>
                    <li>Verified profiles for authentic connections</li>
                    <li>Smart preferences and detailed partner criteria</li>
                    <li>Secure messaging and communication</li>
                    <li>Professional and serious community</li>
                </ul>
            </div>
            
            <div class="divider"></div>
            
            <p style="font-size: 14px; color: #666;">
                <strong>Note:</strong> This invitation link is valid for 30 days. If you have any questions, feel free to reply to this email.
            </p>
        </div>
        
        <div class="footer">
            <p><strong>L3V3LMATCH</strong> - Premium Matrimonial Platform</p>
            <p>
                <a href="{app.profileUrl}">About Us</a> • 
                <a href="{app.profileUrl}/privacy">Privacy Policy</a> • 
                <a href="{app.profileUrl}/terms">Terms of Service</a>
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                This invitation was sent by {inviter.name}. If you believe this was sent in error, 
                please ignore this email or contact support.
            </p>
        </div>
    </div>
</body>
</html>
        """,
        "bodyText": """
Hello {invitee.name}!

You're invited to join L3V3LMATCH - a premium matrimonial platform designed to help you find meaningful connections.

{% if invitation.customMessage %}
Personal Message:
{invitation.customMessage}
{% endif %}

Create your profile now: {invitation.link}

Why Join L3V3LMATCH?
• Advanced L3V3L matching algorithm for compatibility
• Privacy-first approach with controlled information sharing
• Verified profiles for authentic connections
• Smart preferences and detailed partner criteria
• Secure messaging and communication
• Professional and serious community

This invitation link is valid for 30 days.

Best regards,
The L3V3LMATCH Team

---
If you believe this was sent in error, please ignore this email.
        """,
        "variables": [
            "invitee.name",
            "invitee.email",
            "inviter.name",
            "invitation.token",
            "invitation.link",
            "invitation.customMessage",
            "app.name",
            "app.profileUrl"
        ],
        "active": True,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    result = await db.notification_templates.insert_one(template)
    print(f"✅ Invitation email template created with ID: {result.inserted_id}")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(create_template())
