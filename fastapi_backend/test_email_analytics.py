"""
Test Script: Generate Email Analytics Data
Simulates email opens and clicks to populate analytics dashboard
"""

import asyncio
from datetime import datetime, timedelta
import random
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGODB_URL)
db = client.matrimonialDB


async def generate_test_analytics():
    """Generate test email analytics data"""
    
    print("🧪 Generating test email analytics data...")
    
    # Get some sent email notifications
    sent_emails = await db.notification_queue.find({
        "channels": "email",
        "status": "sent"
    }).limit(20).to_list(20)
    
    if not sent_emails:
        print("❌ No sent emails found. Please send some emails first.")
        return
    
    print(f"✅ Found {len(sent_emails)} sent emails")
    
    # Generate random analytics events
    test_ips = ["192.168.1.100", "192.168.1.101", "10.0.0.50", "172.16.0.10"]
    test_user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)",
        "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)"
    ]
    
    opens_created = 0
    clicks_created = 0
    
    for email in sent_emails:
        tracking_id = str(email["_id"])
        
        # 60% chance email was opened
        if random.random() < 0.6:
            # Create email open event
            timestamp = email.get("updatedAt", datetime.utcnow()) + timedelta(minutes=random.randint(5, 120))
            
            await db.email_analytics.insert_one({
                "tracking_id": tracking_id,
                "event_type": "open",
                "timestamp": timestamp,
                "ip_address": random.choice(test_ips),
                "user_agent": random.choice(test_user_agents),
                "referer": ""
            })
            
            opens_created += 1
            
            # Update notification queue
            await db.notification_queue.update_one(
                {"_id": email["_id"]},
                {
                    "$set": {
                        "emailOpened": True,
                        "emailOpenedAt": timestamp
                    },
                    "$inc": {"emailOpenCount": 1}
                }
            )
            
            # 40% chance user clicked a link (if email was opened)
            if random.random() < 0.4:
                link_types = ["profile", "chat", "dashboard", "preferences"]
                link_type = random.choice(link_types)
                
                click_timestamp = timestamp + timedelta(minutes=random.randint(1, 30))
                
                await db.email_analytics.insert_one({
                    "tracking_id": tracking_id,
                    "event_type": "click",
                    "link_type": link_type,
                    "destination_url": f"http://localhost:3000/{link_type}",
                    "timestamp": click_timestamp,
                    "ip_address": random.choice(test_ips),
                    "user_agent": random.choice(test_user_agents)
                })
                
                clicks_created += 1
                
                # Update notification queue
                await db.notification_queue.update_one(
                    {"_id": email["_id"]},
                    {
                        "$inc": {"emailClickCount": 1},
                        "$push": {
                            "emailClicks": {
                                "link_type": link_type,
                                "url": f"http://localhost:3000/{link_type}",
                                "timestamp": click_timestamp
                            }
                        }
                    }
                )
    
    print(f"\n✅ Analytics data generated:")
    print(f"   📬 Email opens: {opens_created}")
    print(f"   🖱️  Link clicks: {clicks_created}")
    print(f"   📊 Total events: {opens_created + clicks_created}")
    
    # Show summary
    total_analytics = await db.email_analytics.count_documents({})
    print(f"\n📈 Total analytics events in database: {total_analytics}")


async def clear_test_analytics():
    """Clear all test analytics data"""
    print("🗑️  Clearing email analytics data...")
    
    result = await db.email_analytics.delete_many({})
    print(f"   Deleted {result.deleted_count} analytics events")
    
    # Reset tracking fields in notification queue
    await db.notification_queue.update_many(
        {},
        {
            "$unset": {
                "emailOpened": "",
                "emailOpenedAt": "",
                "emailOpenCount": "",
                "emailClicks": ""
            }
        }
    )
    print("   Reset tracking fields in notification queue")


async def show_analytics_summary():
    """Show current analytics summary"""
    print("\n📊 Current Email Analytics Summary:")
    
    total_events = await db.email_analytics.count_documents({})
    total_opens = await db.email_analytics.count_documents({"event_type": "open"})
    total_clicks = await db.email_analytics.count_documents({"event_type": "click"})
    
    total_sent = await db.notification_queue.count_documents({
        "channels": "email",
        "status": "sent"
    })
    
    print(f"   📨 Emails sent: {total_sent}")
    print(f"   👀 Total opens: {total_opens}")
    print(f"   🖱️  Total clicks: {total_clicks}")
    print(f"   📈 Total events: {total_events}")
    
    if total_sent > 0:
        open_rate = (total_opens / total_sent) * 100
        print(f"   📊 Open rate: {open_rate:.1f}%")
        
        if total_opens > 0:
            ctr = (total_clicks / total_opens) * 100
            print(f"   📊 Click-through rate: {ctr:.1f}%")


async def main():
    """Main menu"""
    print("\n" + "="*50)
    print("📧 Email Analytics Test Data Generator")
    print("="*50)
    
    while True:
        print("\nOptions:")
        print("1. Generate test analytics data")
        print("2. Show current analytics summary")
        print("3. Clear all analytics data")
        print("4. Exit")
        
        choice = input("\nEnter choice (1-4): ").strip()
        
        if choice == "1":
            await generate_test_analytics()
        elif choice == "2":
            await show_analytics_summary()
        elif choice == "3":
            confirm = input("⚠️  Are you sure? This will delete ALL analytics data (y/n): ")
            if confirm.lower() == 'y':
                await clear_test_analytics()
        elif choice == "4":
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
