#!/usr/bin/env python3
"""
Create multiple test notifications for bulk email testing
"""

import sys
from datetime import datetime
from pymongo import MongoClient

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["matrimonialDB"]
queue = db["notification_queue"]

# Clear old test notifications
result = queue.delete_many({
    "channels": {"$in": ["email"]},
    "templateData.test": True
})
print(f"🗑️  Removed {result.deleted_count} old test notifications")

# Create 5 test notifications
now = datetime.utcnow()

notifications = [
    {
        "username": "admin",
        "trigger": "weekly_digest",
        "channels": ["email"],
        "priority": "high",
        "status": "pending",
        "templateData": {
            "test": True,
            "subject": "📊 Weekly Digest Notification",
            "message": "This is bulk test email #1 - Weekly digest content"
        },
        "scheduledFor": now,
        "createdAt": now,
        "updatedAt": now,
        "attempts": 0
    },
    {
        "username": "admin",
        "trigger": "new_message",
        "channels": ["email"],
        "priority": "high",
        "status": "pending",
        "templateData": {
            "test": True,
            "subject": "💌 New Message Notification",
            "message": "This is bulk test email #2 - You have a new message!"
        },
        "scheduledFor": now,
        "createdAt": now,
        "updatedAt": now,
        "attempts": 0
    },
    {
        "username": "admin",
        "trigger": "favorited",
        "channels": ["email"],
        "priority": "medium",
        "status": "pending",
        "templateData": {
            "test": True,
            "subject": "❤️ Someone Favorited Your Profile",
            "message": "This is bulk test email #3 - Someone added you to favorites!"
        },
        "scheduledFor": now,
        "createdAt": now,
        "updatedAt": now,
        "attempts": 0
    },
    {
        "username": "admin",
        "trigger": "shortlist_added",
        "channels": ["email"],
        "priority": "medium",
        "status": "pending",
        "templateData": {
            "test": True,
            "subject": "⭐ Added to Shortlist",
            "message": "This is bulk test email #4 - You were added to someone's shortlist!"
        },
        "scheduledFor": now,
        "createdAt": now,
        "updatedAt": now,
        "attempts": 0
    },
    {
        "username": "admin",
        "trigger": "profile_view",
        "channels": ["email"],
        "priority": "low",
        "status": "pending",
        "templateData": {
            "test": True,
            "subject": "👀 Profile View Notification",
            "message": "This is bulk test email #5 - Someone viewed your profile!"
        },
        "scheduledFor": now,
        "createdAt": now,
        "updatedAt": now,
        "attempts": 0
    }
]

# Insert all notifications
result = queue.insert_many(notifications)
inserted_ids = result.inserted_ids

print(f"\n✅ Created {len(inserted_ids)} test notifications for bulk email testing!")
print("\n📋 Notification IDs:")
for i, notification_id in enumerate(inserted_ids, 1):
    print(f"   {i}. {notification_id}")

print("\n" + "="*60)
print("🚀 Next Steps:")
print("="*60)
print("1. Go to Dynamic Scheduler in your app")
print("2. Find 'Email Notifications' job")
print("3. Click 'Run Now' ▶️")
print("4. Job will process all 5 notifications")
print("5. Check Gmail inbox - you should receive 5 emails!")
print("\n✨ All emails will be sent to: rajl3v3l@gmail.com")
print("="*60)
