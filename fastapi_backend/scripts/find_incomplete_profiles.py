#!/usr/bin/env python3
"""
Find Incomplete Profiles Script
================================

This script identifies users with incomplete profiles (missing birthMonth or birthYear)
and optionally sends them a notification to complete their profiles.

Usage:
    python find_incomplete_profiles.py [--send-notifications]
"""

import asyncio
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import sys
import os

# Add parent directory to path to import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings

async def find_incomplete_profiles(send_notifications=False):
    """Find users with incomplete profiles (missing birth date)"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔍 Searching for incomplete profiles...")
    print("=" * 60)
    
    # Find users missing birthMonth or birthYear (excluding those with valid dateOfBirth)
    query = {
        "$or": [
            {"birthMonth": {"$exists": False}},
            {"birthMonth": None},
            {"birthMonth": ""},
            {"birthYear": {"$exists": False}},
            {"birthYear": None},
            {"birthYear": ""}
        ],
        # Exclude users who have dateOfBirth (they need migration, not completion)
        "dateOfBirth": {"$exists": False}
    }
    
    incomplete_users = []
    cursor = db.users.find(query)
    
    async for user in cursor:
        incomplete_users.append({
            "username": user.get("username"),
            "email": user.get("contactEmail", "N/A"),
            "firstName": user.get("firstName", "N/A"),
            "lastName": user.get("lastName", "N/A"),
            "createdAt": user.get("createdAt", "N/A"),
            "birthMonth": user.get("birthMonth"),
            "birthYear": user.get("birthYear")
        })
    
    # Display results
    print(f"\n📊 Found {len(incomplete_users)} incomplete profiles\n")
    
    if incomplete_users:
        print("Incomplete Profiles:")
        print("-" * 60)
        for i, user in enumerate(incomplete_users, 1):
            print(f"{i}. {user['username']} ({user['firstName']} {user['lastName']})")
            print(f"   Email: {user['email']}")
            print(f"   Birth Month: {user['birthMonth'] or 'Missing'}")
            print(f"   Birth Year: {user['birthYear'] or 'Missing'}")
            print(f"   Created: {user['createdAt']}")
            print()
        
        # Send notifications if requested
        if send_notifications:
            print("\n📧 Sending profile completion reminders...")
            notification_count = 0
            
            for user in incomplete_users:
                if user['email'] != "N/A":
                    # Create notification in queue
                    notification = {
                        "recipientUsername": user['username'],
                        "recipientEmail": user['email'],
                        "templateId": "profile_completion_reminder",
                        "channel": "email",
                        "priority": "normal",
                        "status": "pending",
                        "scheduledFor": datetime.utcnow(),
                        "createdAt": datetime.utcnow(),
                        "attempts": 0,
                        "metadata": {
                            "firstName": user['firstName'],
                            "missingFields": []
                        }
                    }
                    
                    if not user['birthMonth']:
                        notification["metadata"]["missingFields"].append("birthMonth")
                    if not user['birthYear']:
                        notification["metadata"]["missingFields"].append("birthYear")
                    
                    await db.notification_queue.insert_one(notification)
                    notification_count += 1
                    print(f"   ✓ Queued notification for {user['username']}")
            
            print(f"\n✅ Queued {notification_count} notifications")
        else:
            print("\n💡 Tip: Run with --send-notifications to send reminders")
    else:
        print("✅ All profiles are complete!")
    
    # Close connection
    client.close()
    print("\n" + "=" * 60)

def main():
    parser = argparse.ArgumentParser(description='Find users with incomplete profiles')
    parser.add_argument(
        '--send-notifications',
        action='store_true',
        help='Send email notifications to users with incomplete profiles'
    )
    
    args = parser.parse_args()
    
    asyncio.run(find_incomplete_profiles(send_notifications=args.send_notifications))

if __name__ == "__main__":
    main()
