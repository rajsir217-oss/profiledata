#!/usr/bin/env python3
"""
Test Real Email Sending
Creates a test email notification to verify Gmail SMTP works
"""

import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pymongo import MongoClient
from bson import ObjectId

# MongoDB connection
client = MongoClient("mongodb://localhost:27017")
db = client["matrimonialDB"]
queue = db["notification_queue"]

print("=" * 60)
print("🔔 REAL EMAIL TEST - Gmail SMTP")
print("=" * 60)

# Get recipient email from user
recipient = input("Enter recipient email (or press Enter for your Gmail): ").strip()
if not recipient:
    # Read from .env.local
    env_file = Path(__file__).parent.parent / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("SMTP_USER="):
                recipient = line.split("=", 1)[1].strip()
                break

if not recipient or recipient == "your-email@gmail.com":
    print("❌ Error: No valid recipient email found!")
    print("Please update SMTP_USER in .env.local or provide email as input")
    sys.exit(1)

print(f"\n📧 Will send test email to: {recipient}")

# Clear old test emails
result = queue.delete_many({
    "channels": {"$in": ["email"]},
    "templateData.test": True
})
print(f"🗑️  Removed {result.deleted_count} old test notifications")

# Create test notification with correct schema
test_notification = {
    "username": "admin",  # Required: recipient username (use real user!)
    "trigger": "weekly_digest",  # Required: notification trigger type
    "channels": ["email"],  # Required: delivery channels
    "priority": "high",
    "status": "pending",
    "templateData": {
        "test": True,
        "recipient_email": recipient,
        "sent_from": "L3V3L Dating Backend",
        "timestamp": datetime.utcnow().isoformat(),
        "subject": "🎉 Real Email Test from L3V3L",
        "message": "This is a test email sent via SMTP. If you received this, your email configuration is working perfectly!"
    },
    "scheduledFor": datetime.utcnow(),
    "createdAt": datetime.utcnow(),
    "updatedAt": datetime.utcnow(),
    "attempts": 0
}

result = queue.insert_one(test_notification)
print(f"✅ Created test notification: {result.inserted_id}")

print("\n" + "=" * 60)
print("📊 Test Setup Complete!")
print("=" * 60)
print(f"\n📧 Recipient: {recipient}")
print(f"📋 Notification ID: {result.inserted_id}")
print("\n🚀 Next Steps:")
print("   1. Go to Dynamic Scheduler in your app")
print("   2. Find 'Email Notifications' job")
print("   3. Click 'Run Now' ▶️")
print("   4. Check your Gmail inbox!")
print(f"   5. Email should arrive at: {recipient}")
print("\n✨ If email arrives, Gmail SMTP is working!")
print("=" * 60)
