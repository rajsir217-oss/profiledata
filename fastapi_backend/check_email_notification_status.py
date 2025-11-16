#!/usr/bin/env python3
"""
Check status of the shortlist_added email notification
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv('.env.local')

async def check_status():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🔍 Checking email notification status...\n")
    print("=" * 60)
    
    # Check the queued notification
    print("\n1️⃣  Notification Queue:\n")
    queue_item = await db.notification_queue.find_one({
        "username": "admin",
        "trigger": "shortlist_added",
        "channels": {"$in": ["email"]}
    })
    
    if queue_item:
        print(f"   ✅ Found in queue:")
        print(f"      ID: {queue_item.get('_id')}")
        print(f"      Status: {queue_item.get('status')}")
        print(f"      Channels: {queue_item.get('channels')}")
        print(f"      Created: {queue_item.get('createdAt')}")
        print(f"      Attempts: {queue_item.get('attempts', 0)}")
        print(f"      Error: {queue_item.get('lastError', 'None')}")
    else:
        print("   ❌ Not found in queue (might have been processed)")
    
    # Check notification log
    print("\n2️⃣  Notification Log:\n")
    log_entries = await db.notification_log.find({
        "username": "admin",
        "trigger": "shortlist_added",
        "channel": "email"
    }).sort("sentAt", -1).limit(5).to_list(5)
    
    if log_entries:
        print(f"   ✅ Found {len(log_entries)} email log entries:")
        for i, entry in enumerate(log_entries, 1):
            print(f"\n   {i}. Status: {entry.get('status')}")
            print(f"      Sent: {entry.get('sentAt')}")
            print(f"      Subject: {entry.get('subject', 'N/A')}")
            print(f"      Preview: {entry.get('preview', 'N/A')[:50]}...")
            if entry.get('error'):
                print(f"      ❌ Error: {entry.get('error')}")
    else:
        print("   ❌ No email log entries found")
    
    # Check admin's email address
    print("\n3️⃣  Admin Email Address:\n")
    admin = await db.users.find_one({"username": "admin"})
    if admin:
        email = admin.get("email") or admin.get("contactEmail")
        print(f"   Email field: {admin.get('email', 'NOT SET')}")
        print(f"   ContactEmail field: {admin.get('contactEmail', 'NOT SET')}")
        
        # Check if encrypted
        if email and email.startswith('gAAAAA'):
            print(f"   ⚠️  Email is ENCRYPTED: {email[:30]}...")
            print(f"   This should have been decrypted by the job!")
        elif email:
            print(f"   ✅ Email: {email}")
    else:
        print("   ❌ Admin user not found!")
    
    # Check email template
    print("\n4️⃣  Email Template:\n")
    template = await db.notification_templates.find_one({
        "trigger": "shortlist_added",
        "channel": "email",
        "active": True
    })
    
    if template:
        print(f"   ✅ Template exists:")
        print(f"      Subject: {template.get('subject', 'N/A')}")
        print(f"      Active: {template.get('active')}")
    else:
        print(f"   ❌ NO TEMPLATE FOUND!")
        print(f"   This is why the email might not have sent!")
    
    # Check recent job executions
    print("\n5️⃣  Recent Email Notifier Job Runs:\n")
    cutoff = datetime.utcnow() - timedelta(hours=1)
    recent_jobs = await db.job_executions.find({
        "jobType": "email_notifier",
        "startTime": {"$gte": cutoff}
    }).sort("startTime", -1).limit(3).to_list(3)
    
    if recent_jobs:
        print(f"   ✅ Found {len(recent_jobs)} recent runs:")
        for i, job in enumerate(recent_jobs, 1):
            print(f"\n   {i}. Status: {job.get('status')}")
            print(f"      Start: {job.get('startTime')}")
            print(f"      Records Processed: {job.get('recordsProcessed', 0)}")
            print(f"      Records Affected: {job.get('recordsAffected', 0)}")
            details = job.get('details', {})
            print(f"      Sent: {details.get('sent', 0)}")
            print(f"      Failed: {details.get('failed', 0)}")
            if job.get('errors'):
                print(f"      Errors: {job.get('errors')}")
    else:
        print("   ⚠️  No recent email notifier job runs found")
    
    print("\n" + "=" * 60)
    print("\n💡 Summary:")
    
    if queue_item and queue_item.get('status') == 'pending':
        print("   🟡 Notification is still QUEUED (not processed yet)")
        print("   → Run the Email Notifier job to process it")
    elif queue_item and queue_item.get('status') in ['sent', 'delivered']:
        print("   ✅ Notification was processed")
        if log_entries:
            print("   ✅ Email was logged as sent")
            print(f"   📧 Check your inbox for: {admin.get('contactEmail') or admin.get('email')}")
        else:
            print("   ⚠️  But no log entry found - something went wrong")
    elif not template:
        print("   ❌ CRITICAL: No email template for 'shortlist_added'!")
        print("   → Create template in notification_templates collection")
    elif not queue_item:
        print("   ⚠️  Notification not found in queue")
        print("   → It might have been processed or deleted")
    
    print()
    client.close()

if __name__ == "__main__":
    asyncio.run(check_status())
