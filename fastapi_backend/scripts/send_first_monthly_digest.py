#!/usr/bin/env python3
"""
Send Monthly Digest Email to ALL users for the first time.
This script:
1. Generates sample/real stats for all active users
2. Sends the monthly digest email to everyone

Run with: python scripts/send_first_monthly_digest.py
"""

import asyncio
import os
import sys
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from job_templates.monthly_digest_notifier import MonthlyDigestNotifierTemplate


async def gather_real_stats(db, username: str, start_date: datetime, end_date: datetime) -> dict:
    """Gather real activity stats for a user within date range"""
    stats = {}
    
    # Profile views received
    stats["profile_views_received"] = await db.profile_views.count_documents({
        "viewedUsername": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    
    # Interests received (favorites/shortlists where user is the target)
    fav_received = await db.favorites.count_documents({
        "favoriteUsername": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    shortlist_received = await db.shortlists.count_documents({
        "shortlistedUsername": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    stats["interests_received"] = fav_received + shortlist_received
    
    # Interests sent
    fav_sent = await db.favorites.count_documents({
        "username": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    shortlist_sent = await db.shortlists.count_documents({
        "username": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    stats["interests_sent"] = fav_sent + shortlist_sent
    
    # Messages received
    stats["messages_received"] = await db.messages.count_documents({
        "recipientUsername": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    
    # Messages sent
    stats["messages_sent"] = await db.messages.count_documents({
        "senderUsername": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    
    # Connection requests (PII requests received)
    stats["connection_requests"] = await db.pii_requests.count_documents({
        "targetUsername": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    
    # New matches from saved searches
    stats["new_matches"] = await db.saved_search_notifications.count_documents({
        "username": username,
        "createdAt": {"$gte": start_date, "$lte": end_date}
    })
    
    return stats


async def send_first_monthly_digest():
    """Send monthly digest to all active users"""
    
    # Load production environment - production file has the correct ENCRYPTION_KEY
    load_dotenv('.env.production')  # Production has correct encryption key for prod data
    
    mongodb_url = os.getenv('MONGODB_URL')
    if not mongodb_url:
        print("❌ MONGODB_URL not found in environment")
        return
    
    print("=" * 70)
    print("📊 FIRST-TIME MONTHLY DIGEST EMAIL SENDER")
    print("=" * 70)
    
    # Connect to MongoDB
    print("\n🔌 Connecting to MongoDB...")
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    # Get current month info
    now = datetime.now(timezone.utc)
    month_key = now.strftime("%Y-%m")
    month_name = now.strftime("%B %Y")
    
    print(f"📅 Month: {month_name} ({month_key})")
    
    # Calculate 4-week date ranges (last 28 days)
    week_ranges = []
    for i in range(4, 0, -1):
        week_end = now - timedelta(days=(i-1) * 7)
        week_start = week_end - timedelta(days=7)
        week_ranges.append({
            "week": 5 - i,
            "start": week_start,
            "end": week_end
        })
    
    print("\n📅 Week ranges:")
    for wr in week_ranges:
        print(f"   Week {wr['week']}: {wr['start'].date()} to {wr['end'].date()}")
    
    # Get all active users with email
    print("\n👥 Fetching active users...")
    users_cursor = db.users.find({
        "accountStatus": "active",
        "contactEmail": {"$exists": True, "$ne": ""}
    }, {"username": 1, "firstName": 1, "contactEmail": 1})
    users = await users_cursor.to_list(length=None)
    
    print(f"   Found {len(users)} active users with email")
    
    # Ask for confirmation
    print("\n" + "=" * 70)
    print("⚠️  CONFIRMATION REQUIRED")
    print("=" * 70)
    print(f"\nThis will send monthly digest emails to {len(users)} users.")
    print("Each email will contain their activity stats for the past 4 weeks.")
    
    # Options
    print("\nOptions:")
    print("  1. DRY RUN - Preview without sending (recommended first)")
    print("  2. SEND TO 5 - Send to first 5 users only (test)")
    print("  3. SEND ALL - Send to all users")
    print("  4. CANCEL")
    
    choice = input("\nEnter choice (1/2/3/4): ").strip()
    
    if choice == "4":
        print("\n❌ Cancelled")
        client.close()
        return
    
    dry_run = choice == "1"
    max_users = 5 if choice == "2" else len(users)
    
    if choice == "2":
        users = users[:5]
        print(f"\n📧 Sending to first 5 users only")
    elif choice == "3":
        confirm = input(f"\n⚠️  Type 'SEND' to confirm sending to {len(users)} users: ").strip()
        if confirm != "SEND":
            print("\n❌ Cancelled")
            client.close()
            return
    
    # Import notification service
    from services.notification_service import NotificationService
    from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
    
    # Try to get encryptor - may fail locally if ENCRYPTION_KEY not set
    encryptor = None
    try:
        from crypto_utils import get_encryptor
        encryptor = get_encryptor()
        print("✅ Encryption key loaded")
    except Exception as e:
        print(f"⚠️  Encryption not available: {e}")
        print("   Will skip encrypted emails or use unencrypted ones")
    
    notification_service = NotificationService(db)
    template = MonthlyDigestNotifierTemplate()
    
    # Process users
    print(f"\n{'🔍 DRY RUN' if dry_run else '📧 SENDING'} monthly digest...")
    print("-" * 70)
    
    sent_count = 0
    skipped_count = 0
    error_count = 0
    
    for idx, user in enumerate(users):
        username = user["username"]
        first_name = user.get("firstName", username)
        
        try:
            # Decrypt email if needed
            email = user.get("contactEmail", "")
            if email.startswith("gAAAAA"):
                if encryptor:
                    try:
                        email = encryptor.decrypt(email)
                    except:
                        print(f"   ⏭️  {username}: Could not decrypt email")
                        skipped_count += 1
                        continue
                else:
                    # No encryptor available - skip encrypted emails
                    skipped_count += 1
                    continue
            
            if not email or "@" not in email:
                skipped_count += 1
                continue
            
            # Gather real stats for each week
            weeks_data = []
            for wr in week_ranges:
                stats = await gather_real_stats(db, username, wr["start"], wr["end"])
                weeks_data.append({
                    "week": wr["week"],
                    "stats": stats,
                    "range": {
                        "start": wr["start"].isoformat(),
                        "end": wr["end"].isoformat()
                    }
                })
            
            # Calculate total activity
            total_activity = sum(
                sum(w["stats"].values()) for w in weeks_data
            )
            
            # Generate email HTML
            email_html = template._build_digest_email(first_name, month_name, weeks_data)
            
            if dry_run:
                print(f"   ✓ {idx+1}/{len(users)} {username} ({first_name}) - {email[:30]}... - Activity: {total_activity}")
                sent_count += 1
            else:
                # Queue notification
                notification = NotificationQueueCreate(
                    username=username,
                    trigger=NotificationTrigger.MONTHLY_DIGEST,
                    channels=[NotificationChannel.EMAIL],
                    templateData={
                        "user": {
                            "firstName": first_name,
                            "username": username
                        },
                        "month": month_name,
                        "weeksData": weeks_data,
                        "emailHtml": email_html
                    }
                )
                
                await notification_service.enqueue_notification(notification)
                print(f"   ✅ {idx+1}/{len(users)} Queued: {username} ({first_name}) - Activity: {total_activity}")
                sent_count += 1
                
        except Exception as e:
            print(f"   ❌ {username}: {str(e)}")
            error_count += 1
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)
    print(f"   {'Would send' if dry_run else 'Queued'}: {sent_count}")
    print(f"   Skipped: {skipped_count}")
    print(f"   Errors: {error_count}")
    
    if not dry_run and sent_count > 0:
        print(f"\n✅ {sent_count} emails queued in notification_queue")
        print("   Run the Email Notifier job to send them")
        
        # Check queue count
        queue_count = await db.notification_queue.count_documents({"status": "pending"})
        print(f"\n📬 Total pending notifications in queue: {queue_count}")
    
    client.close()
    print("\n✅ Done!")


if __name__ == "__main__":
    asyncio.run(send_first_monthly_digest())
