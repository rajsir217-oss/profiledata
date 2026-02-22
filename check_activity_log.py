#!/usr/bin/env python3
"""
Script to analyze contribution_activity collection and suggest cleanup strategy
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os

load_dotenv()

async def analyze_activity_log():
    """Analyze the activity log collection"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        print("📊 Analyzing contribution_activity collection...\n")
        
        # Get total count
        total_count = await db.contribution_activity.count_documents({})
        print(f"📝 Total records: {total_count:,}")
        
        if total_count == 0:
            print("✅ No activity data to clean up!")
            return
        
        # Get date range
        oldest = await db.contribution_activity.find().sort("timestamp", 1).limit(1).to_list(length=1)
        newest = await db.contribution_activity.find().sort("timestamp", -1).limit(1).to_list(length=1)
        
        if oldest:
            oldest_date = oldest[0].get("timestamp")
            newest_date = newest[0].get("timestamp")
            print(f"📅 Date range: {oldest_date} to {newest_date}")
            
            # Calculate days spanned
            days_spanned = (newest_date - oldest_date).days if oldest_date else 0
            print(f"📈 Days spanned: {days_spanned}")
        
        # Check for TTL index
        indexes = await db.contribution_activity.list_indexes().to_list(length=10)
        has_ttl = any("expireAfterSeconds" in idx for idx in indexes)
        print(f"🗑️  Has TTL index: {'Yes' if has_ttl else 'No'}")
        
        # Analyze by action type
        print("\n📋 Records by action type:")
        pipeline = [
            {"$group": {"_id": "$action", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        action_stats = await db.contribution_activity.aggregate(pipeline).to_list(length=20)
        for stat in action_stats:
            action = stat["_id"]
            count = stat["count"]
            percentage = (count / total_count) * 100
            print(f"   {action}: {count:,} ({percentage:.1f}%)")
        
        # Analyze by age
        print("\n📅 Records by age:")
        now = datetime.utcnow()
        
        age_ranges = [
            ("Last 7 days", now - timedelta(days=7)),
            ("7-30 days", now - timedelta(days=30), now - timedelta(days=7)),
            ("30-90 days", now - timedelta(days=90), now - timedelta(days=30)),
            ("90-180 days", now - timedelta(days=180), now - timedelta(days=90)),
            ("180+ days", None, now - timedelta(days=180))
        ]
        
        for label, start_date, end_date in age_ranges:
            query = {"timestamp": {}}
            if start_date:
                query["timestamp"]["$gte"] = start_date
            if end_date:
                query["timestamp"]["$lt"] = end_date
            if not start_date and not end_date:
                query = {"timestamp": {"$lt": end_date}}
            
            count = await db.contribution_activity.count_documents(query)
            percentage = (count / total_count) * 100
            print(f"   {label}: {count:,} ({percentage:.1f}%)")
        
        # Estimate storage size
        stats = await db.command("collStats", "contribution_activity")
        size_mb = stats.get("size", 0) / (1024 * 1024)
        avg_size_bytes = stats.get("size", 0) / total_count if total_count > 0 else 0
        print(f"\n💾 Storage size: {size_mb:.2f} MB")
        print(f"📏 Average record size: {avg_size_bytes:.0f} bytes")
        
        # Cleanup recommendations
        print("\n🔧 Cleanup Recommendations:")
        
        # Check old data
        old_cutoff = now - timedelta(days=90)
        old_count = await db.contribution_activity.count_documents({"timestamp": {"$lt": old_cutoff}})
        old_percentage = (old_count / total_count) * 100
        
        if old_count > 0:
            print(f"   ⚠️  {old_count:,} records ({old_percentage:.1f}%) are older than 90 days")
            
            if not has_ttl:
                print("   💡 Consider adding a TTL index to automatically delete old records:")
                print("      db.contribution_activity.create_index('timestamp', expireAfterSeconds=7776000)")
                print("      # 7776000 seconds = 90 days")
        else:
            print("   ✅ All records are within the last 90 days")
        
        # Check for high volume
        daily_avg = total_count / max(days_spanned, 1)
        if daily_avg > 1000:
            print(f"   ⚠️  High volume: {daily_avg:.0f} records per day on average")
            print("   💡 Consider reducing retention period or sampling data")
        
        # Check for test/spam data
        print("\n🔍 Checking for potential test/spam data...")
        
        # Check for actions with amounts but no actual contribution
        suspicious = await db.contribution_activity.count_documents({
            "action": {"$in": ["popup_shown", "closed", "remind_later"]},
            "amount": {"$exists": True, "$ne": None}
        })
        
        if suspicious > 0:
            print(f"   ⚠️  {suspicious} records have amounts for non-payment actions")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(analyze_activity_log())
