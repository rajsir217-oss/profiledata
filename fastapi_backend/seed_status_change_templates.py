#!/usr/bin/env python3
"""
Seed Email Templates for User Status Changes
Creates templates for: profile approved, account suspended, account banned, account paused
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

templates = [
    {
        "trigger": "status_approved",
        "channel": "email",
        "category": "account",
        "subject": "🎉 Your Profile is Now Active - Welcome to USVedika!",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .success-icon { font-size: 64px; margin: 20px 0; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .feature-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .feature-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✅</div>
            <h1>Your Profile is Active!</h1>
            <p>Welcome to USVedika</p>
        </div>
        <div class="content">
            <p>Hi {firstname} {lastname},</p>
            
            <p><strong>Great news!</strong> Your profile has been approved by our team and is now active. Keep username: <strong>{username}</strong>, keep it safe.</p>
            
            <p style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; margin: 15px 0; border-radius: 4px;">
                <strong>User ID:</strong> {username}<br>
                <strong>Status:</strong> Active
            </p>
            
            <p>{message}</p>
            
            <div class="feature-list">
                <h3>What You Can Do Now:</h3>
                <div class="feature-item">✨ Browse compatible matches</div>
                <div class="feature-item">💬 Send messages to your matches</div>
                <div class="feature-item">❤️ Add profiles to your favorites</div>
                <div class="feature-item">🔍 Use advanced search filters</div>
                <div class="feature-item">📧 Receive match notifications</div>
            </div>
            
            <center>
                <a href="{app_url}/dashboard" class="button">Go to Dashboard</a>
            </center>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            
            <p>Best regards,<br>The USVedika Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 USVedika. All rights reserved.</p>
            <p><a href="{app_url}/help">Help Center</a> | <a href="{app_url}/contact">Contact Us</a></p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "high",
        "enabled": True
    },
    {
        "trigger": "status_suspended",
        "channel": "email",
        "category": "account",
        "subject": "⚠️ Your Account Has Been Suspended",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .warning-icon { font-size: 64px; margin: 20px 0; }
        .reason-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
        .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="warning-icon">⚠️</div>
            <h1>Account Suspended</h1>
        </div>
        <div class="content">
            <p>Hi {username},</p>
            
            <p>Your account has been temporarily suspended.</p>
            
            <div class="reason-box">
                <h3>Reason for Suspension:</h3>
                <p>{reason}</p>
            </div>
            
            <p>{message}</p>
            
            <h3>What This Means:</h3>
            <ul>
                <li>You cannot access your account until the suspension is lifted</li>
                <li>Your profile is hidden from other users</li>
                <li>You cannot send or receive messages</li>
            </ul>
            
            <p>If you believe this is a mistake or would like to appeal this decision, please contact our support team.</p>
            
            <center>
                <a href="{app_url}/contact" class="button">Contact Support</a>
            </center>
            
            <p>Best regards,<br>The USVedika Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 USVedika. All rights reserved.</p>
            <p><a href="{app_url}/help">Help Center</a> | <a href="{app_url}/contact">Contact Us</a></p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "high",
        "enabled": True
    },
    {
        "trigger": "status_banned",
        "channel": "email",
        "category": "account",
        "subject": "⛔ Your Account Has Been Banned",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .ban-icon { font-size: 64px; margin: 20px 0; }
        .reason-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0; }
        .button { display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="ban-icon">⛔</div>
            <h1>Account Banned</h1>
        </div>
        <div class="content">
            <p>Hi {username},</p>
            
            <p>Your account has been permanently banned from USVedika.</p>
            
            <div class="reason-box">
                <h3>Reason for Ban:</h3>
                <p>{reason}</p>
            </div>
            
            <p>{message}</p>
            
            <h3>What This Means:</h3>
            <ul>
                <li>Your account has been permanently closed</li>
                <li>You can no longer access USVedika</li>
                <li>Your profile and data have been removed</li>
                <li>You cannot create a new account</li>
            </ul>
            
            <p>This decision was made after careful review and is final. If you have questions about this action, you may contact our support team.</p>
            
            <center>
                <a href="{app_url}/contact" class="button">Contact Support</a>
            </center>
            
            <p>Best regards,<br>The USVedika Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 USVedika. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "high",
        "enabled": True
    },
    {
        "trigger": "status_paused",
        "channel": "email",
        "category": "account",
        "subject": "⏸️ Your Account Has Been Paused by Admin",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .pause-icon { font-size: 64px; margin: 20px 0; }
        .reason-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #6366f1; margin: 20px 0; }
        .info-box { background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bfdbfe; }
        .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="pause-icon">⏸️</div>
            <h1>Account Paused</h1>
        </div>
        <div class="content">
            <p>Hi {username},</p>
            
            <p>Your account has been paused by an administrator.</p>
            
            <div class="reason-box">
                <h3>Reason for Pause:</h3>
                <p>{reason}</p>
            </div>
            
            <p>{message}</p>
            
            <div class="info-box">
                <h3>While Your Account is Paused:</h3>
                <ul>
                    <li>Your profile is hidden from searches and matches</li>
                    <li>You cannot send or receive new messages</li>
                    <li>Your existing matches are preserved</li>
                    <li>You can still view your profile</li>
                </ul>
            </div>
            
            <p>If you have questions about this pause or would like to request reactivation, please contact our support team.</p>
            
            <center>
                <a href="{app_url}/contact" class="button">Contact Support</a>
            </center>
            
            <p>Best regards,<br>The USVedika Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 USVedika. All rights reserved.</p>
            <p><a href="{app_url}/help">Help Center</a> | <a href="{app_url}/contact">Contact Us</a></p>
        </div>
    </div>
</body>
</html>
        """,
        "priority": "high",
        "enabled": True
    }
]

async def seed_templates():
    # Add SSL certificate handling for MongoDB Atlas connections
    import ssl
    import certifi
    
    # Create SSL context for MongoDB Atlas
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    
    # Connect to MongoDB with SSL support
    if "mongodb+srv" in MONGO_URL or "mongodb.net" in MONGO_URL:
        client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
    else:
        client = AsyncIOMotorClient(MONGO_URL)
    
    db = client[DB_NAME]
    
    print("🌱 Seeding status change email templates...")
    print(f"🌍 Environment: {current_env}")
    print(f"📍 APP_URL: {APP_URL}")
    print(f"🗄️  Database: {DB_NAME}")
    
    for template in templates:
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
    
    print(f"\n✅ Successfully seeded {len(templates)} templates with APP_URL={APP_URL}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_templates())
