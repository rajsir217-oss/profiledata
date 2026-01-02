#!/usr/bin/env python3
"""
Test Monthly Digest email in dev environment
1. Insert sample weekly stats for a test user
2. Generate and preview the email HTML
3. Optionally send a real email
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv

# Add parent directory to path for imports
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from job_templates.monthly_digest_notifier import MonthlyDigestNotifierTemplate


async def test_monthly_digest():
    load_dotenv('.env')  # Use local dev environment
    
    # Connect to local MongoDB
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.matrimonialDB
    
    print("=" * 60)
    print("🧪 TESTING MONTHLY DIGEST EMAIL IN DEV")
    print("=" * 60)
    
    # Sample weekly data with realistic values
    test_username = "abhisheksethi013"  # Use an existing test user
    month_key = datetime.now().strftime("%Y-%m")
    
    # Check if user exists
    user = await db.users.find_one({"username": test_username})
    if not user:
        print(f"❌ User '{test_username}' not found in dev database")
        print("   Available users:")
        users = await db.users.find({}, {"username": 1}).limit(5).to_list(5)
        for u in users:
            print(f"   - {u['username']}")
        client.close()
        return
    
    print(f"✅ Found user: {user.get('firstName', test_username)} ({test_username})")
    print(f"   Email: {user.get('contactEmail', 'N/A')[:20]}...")
    
    # Insert sample weekly stats
    sample_stats = {
        "username": test_username,
        "month": month_key,
        "week1": {
            "profile_views_received": 12,
            "interests_received": 3,
            "interests_sent": 5,
            "messages_received": 2,
            "messages_sent": 4,
            "connection_requests": 1,
            "new_matches": 8
        },
        "week1_range": {"start": "2025-12-01", "end": "2025-12-07"},
        "week2": {
            "profile_views_received": 8,
            "interests_received": 5,
            "interests_sent": 3,
            "messages_received": 4,
            "messages_sent": 2,
            "connection_requests": 2,
            "new_matches": 5
        },
        "week2_range": {"start": "2025-12-08", "end": "2025-12-14"},
        "week3": {
            "profile_views_received": 15,
            "interests_received": 2,
            "interests_sent": 7,
            "messages_received": 1,
            "messages_sent": 6,
            "connection_requests": 0,
            "new_matches": 10
        },
        "week3_range": {"start": "2025-12-15", "end": "2025-12-21"},
        "week4": {
            "profile_views_received": 10,
            "interests_received": 4,
            "interests_sent": 4,
            "messages_received": 3,
            "messages_sent": 3,
            "connection_requests": 3,
            "new_matches": 6
        },
        "week4_range": {"start": "2025-12-22", "end": "2025-12-28"},
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    # Upsert sample stats
    await db.weekly_user_stats.update_one(
        {"username": test_username, "month": month_key},
        {"$set": sample_stats},
        upsert=True
    )
    print(f"\n✅ Inserted sample weekly stats for {month_key}")
    
    # Generate email HTML using the template
    template = MonthlyDigestNotifierTemplate()
    
    weeks_data = [
        {"stats": sample_stats["week1"]},
        {"stats": sample_stats["week2"]},
        {"stats": sample_stats["week3"]},
        {"stats": sample_stats["week4"]},
    ]
    
    first_name = user.get("firstName", test_username)
    month_name = datetime.now().strftime("%B %Y")
    
    email_html = template._build_digest_email(first_name, month_name, weeks_data)
    
    # Save HTML preview
    preview_path = "/tmp/monthly_digest_preview.html"
    with open(preview_path, "w") as f:
        f.write(email_html)
    
    print(f"\n✅ Email HTML generated ({len(email_html)} characters)")
    print(f"   Preview saved to: {preview_path}")
    print(f"\n   Open in browser: file://{preview_path}")
    
    # Ask if user wants to send actual email
    print("\n" + "=" * 60)
    print("📧 SEND TEST EMAIL?")
    print("=" * 60)
    
    send_email = input("Send actual email to test user? (y/n): ").strip().lower()
    
    if send_email == 'y':
        from services.notification_service import NotificationService
        from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
        
        notification_service = NotificationService(db)
        
        notification = NotificationQueueCreate(
            username=test_username,
            trigger=NotificationTrigger.MONTHLY_DIGEST,
            channels=[NotificationChannel.EMAIL],
            templateData={
                "user": {
                    "firstName": first_name,
                    "username": test_username
                },
                "month": month_name,
                "emailHtml": email_html
            }
        )
        
        await notification_service.enqueue_notification(notification)
        print(f"\n✅ Email queued for {test_username}")
        print("   Run the Email Notifier job to send it")
    else:
        print("\n⏭️  Skipped sending email")
    
    client.close()
    print("\n✅ Done!")


if __name__ == "__main__":
    asyncio.run(test_monthly_digest())
