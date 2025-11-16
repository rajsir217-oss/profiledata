#!/usr/bin/env python3
"""
Check real profile views for admin user
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv('.env.local')

async def check_views():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    target_username = "admin"
    
    print(f"🔍 Checking profile views for: {target_username}\n")
    print("=" * 60)
    
    # Check activity logs for profile views
    print("\n📊 Profile View Activity (Last 7 days):\n")
    
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    views = await db.activity_logs.find({
        "username": target_username,
        "activityType": "profile_view",
        "timestamp": {"$gte": seven_days_ago}
    }).sort("timestamp", -1).limit(10).to_list(length=10)
    
    if not views:
        print("   ❌ No profile views found in last 7 days")
    else:
        print(f"   ✅ Found {len(views)} recent views:\n")
        for i, view in enumerate(views, 1):
            viewer = view.get("actorUsername", "Unknown")
            timestamp = view.get("timestamp", datetime.utcnow())
            print(f"   {i}. {viewer:20} viewed at {timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check notification queue for profile_view notifications
    print("\n" + "=" * 60)
    print("\n🔔 Profile View Notifications in Queue:\n")
    
    notifications = await db.notification_queue.find({
        "username": target_username,
        "trigger": "profile_view"
    }).sort("createdAt", -1).limit(5).to_list(length=5)
    
    if not notifications:
        print("   ❌ No profile view notifications in queue")
    else:
        print(f"   ✅ Found {len(notifications)} notifications:\n")
        for i, notif in enumerate(notifications, 1):
            status = notif.get("status", "unknown")
            channels = ", ".join(notif.get("channels", []))
            viewer = notif.get("data", {}).get("viewer_username", "Unknown")
            created = notif.get("createdAt", datetime.utcnow())
            
            status_icon = "✅" if status == "sent" else "⏳" if status == "pending" else "❌"
            print(f"   {i}. {status_icon} {viewer:20} → {channels:15} [{status}]")
            print(f"      Created: {created.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check notification log for delivered notifications
    print("\n" + "=" * 60)
    print("\n📬 Delivered Profile View Notifications (Last 7 days):\n")
    
    delivered = await db.notification_log.find({
        "username": target_username,
        "trigger": "profile_view",
        "status": "sent",
        "sentAt": {"$gte": seven_days_ago}
    }).sort("sentAt", -1).limit(5).to_list(length=5)
    
    if not delivered:
        print("   ❌ No delivered notifications found")
    else:
        print(f"   ✅ Found {len(delivered)} delivered:\n")
        for i, log in enumerate(delivered, 1):
            channel = log.get("channel", "unknown")
            viewer = log.get("data", {}).get("viewer_username", "Unknown")
            sent_at = log.get("sentAt", datetime.utcnow())
            print(f"   {i}. {viewer:20} via {channel.upper():6} at {sent_at.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Summary
    print("\n" + "=" * 60)
    print("\n📈 Summary:\n")
    
    total_views = await db.activity_logs.count_documents({
        "username": target_username,
        "activityType": "profile_view"
    })
    
    total_notifications = await db.notification_log.count_documents({
        "username": target_username,
        "trigger": "profile_view"
    })
    
    print(f"   Total profile views (all time): {total_views}")
    print(f"   Total notifications sent: {total_notifications}")
    
    conversion_rate = (total_notifications / total_views * 100) if total_views > 0 else 0
    print(f"   Notification conversion rate: {conversion_rate:.1f}%")
    
    print("\n" + "=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_views())
