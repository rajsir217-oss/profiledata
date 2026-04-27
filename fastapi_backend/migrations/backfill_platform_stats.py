"""
Backfill Platform Stats from Activity Logs

This script populates the platform stats snapshot collections with historical data
from the activity_logs collection.

Phase 1 of migration strategy from PLATFORM_STATS_SNAPSHOT_DESIGN.md

Usage:
    python -m migrations.backfill_platform_stats --env development
    python -m migrations.backfill_platform_stats --env production
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Set APP_ENVIRONMENT BEFORE any imports that depend on config.py (database, etc.)
# config.py loads environment at module import time, so this must run first
env_value = None
if "--env" in sys.argv:
    env_index = sys.argv.index("--env") + 1
    if env_index < len(sys.argv):
        env_value = sys.argv[env_index]
        if env_value and not env_value.startswith("-"):
            os.environ["APP_ENVIRONMENT"] = env_value
            print(f"🔧 Set APP_ENVIRONMENT={env_value} before imports")

# Force-load the correct .env file BEFORE config.py is imported
# This ensures MONGODB_URL and other vars are set in os.environ
script_dir = Path(__file__).resolve().parent.parent  # migrations -> fastapi_backend
env_file = script_dir / f".env.{env_value or 'local'}"
if env_file.exists():
    print(f"📄 Force-loading env file: {env_file}")
    load_dotenv(str(env_file), override=True)
    print(f"✅ MONGODB_URL from env: {os.environ.get('MONGODB_URL', 'NOT SET')[:50]}...")
else:
    print(f"⚠️ Env file not found: {env_file}")

import asyncio
import argparse
from datetime import datetime, timedelta
from typing import Dict, Any
from database import connect_to_mongo, close_mongo_connection, get_database


async def backfill_daily_snapshots(db, days: int = 90) -> Dict[str, Any]:
    """
    Backfill daily snapshots for the last N days from activity_logs.
    
    Args:
        db: AsyncIOMotorDatabase instance
        days: Number of days to backfill (default: 90)
    
    Returns:
        Dict with backfill results
    """
    today = datetime.utcnow()
    results = {
        "daily_snapshots_created": 0,
        "errors": []
    }
    
    for i in range(days):
        target_date = today - timedelta(days=i)
        date_str = target_date.strftime("%Y-%m-%d")
        
        # Time filter for activity_logs (target date UTC)
        day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        time_filter = {"timestamp": {"$gte": day_start, "$lte": day_end}}
        
        try:
            # 1. Searches (activity_logs only - no historical alternative)
            searches = await db.activity_logs.count_documents({
                "action_type": "search_performed",
                **time_filter
            })
            
            # 2. Profile Views - query profile_views collection directly
            # Uses $or to handle mixed schemas (viewedAt, lastViewedAt, createdAt, viewed_at)
            profile_views = await db.profile_views.count_documents({
                "$or": [
                    {"viewedAt": {"$gte": day_start, "$lte": day_end}},
                    {"lastViewedAt": {"$gte": day_start, "$lte": day_end}},
                    {"createdAt": {"$gte": day_start, "$lte": day_end}},
                    {"viewed_at": {"$gte": day_start, "$lte": day_end}}
                ]
            })
            
            # 3. Favorited - query favorites collection
            favorited = await db.favorites.count_documents({
                "createdAt": {"$gte": day_start, "$lte": day_end}
            })
            
            # 4. Shortlisted - query shortlists collection
            shortlisted = await db.shortlists.count_documents({
                "createdAt": {"$gte": day_start, "$lte": day_end}
            })
            
            # 5. Messages Sent - query messages collection
            messages_sent = await db.messages.count_documents({
                "createdAt": {"$gte": day_start, "$lte": day_end}
            })
            
            # 6. Active Members (users who logged in on this day)
            active_members = await db.users.count_documents({
                "accountStatus": "active",
                "security.last_login_at": {"$gte": day_start, "$lte": day_end}
            })
            
            # 7. Upsert to platform_stats_daily
            daily_doc = {
                "date": date_str,
                "searches": searches,
                "profileViews": profile_views,
                "favorited": favorited,
                "shortlisted": shortlisted,
                "messagesSent": messages_sent,
                "activeMembers": active_members,
                "createdAt": day_start,
                "updatedAt": day_end
            }
            
            await db.platform_stats_daily.update_one(
                {"_id": date_str},
                {"$set": daily_doc},
                upsert=True
            )
            
            results["daily_snapshots_created"] += 1
            print(f"✅ Created daily snapshot for {date_str}")
            
        except Exception as e:
            error_msg = f"Failed to create daily snapshot for {date_str}: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
    
    return results


async def backfill_monthly_snapshots(db, year: int) -> Dict[str, Any]:
    """
    Backfill monthly snapshots for a given year from daily snapshots.
    
    Args:
        db: AsyncIOMotorDatabase instance
        year: Year to backfill (e.g., 2025)
    
    Returns:
        Dict with backfill results
    """
    results = {
        "monthly_snapshots_created": 0,
        "errors": []
    }
    
    for month in range(1, 13):
        year_str = str(year)
        month_str = f"{month:02d}"
        month_id = f"{year_str}-{month_str}"
        
        # Calculate date range for the month
        if month == 12:
            next_month_start = datetime(year + 1, 1, 1, 0, 0, 0)
        else:
            next_month_start = datetime(year, month + 1, 1, 0, 0, 0)
        
        month_start = datetime(year, month, 1, 0, 0, 0)
        month_end = next_month_start - timedelta(seconds=1)
        
        try:
            # Aggregate all daily docs for this month via $group (avoids loading all docs into memory)
            pipeline = [
                {"$match": {"date": {"$gte": month_start.strftime("%Y-%m-%d"), "$lte": month_end.strftime("%Y-%m-%d")}}},
                {"$group": {
                    "_id": None,
                    "searches": {"$sum": "$searches"},
                    "profileViews": {"$sum": "$profileViews"},
                    "favorited": {"$sum": "$favorited"},
                    "shortlisted": {"$sum": "$shortlisted"},
                    "messagesSent": {"$sum": "$messagesSent"}
                }}
            ]
            agg_result = await db.platform_stats_daily.aggregate(pipeline).to_list(length=1)
            
            if not agg_result:
                print(f"⚠️ No daily snapshots found for {month_id}, skipping")
                continue
            
            # Build aggregated stats
            aggregated = agg_result[0]
            del aggregated["_id"]
            
            # Compute active members for the month (users who logged in during the month)
            aggregated["activeMembers"] = await db.users.count_documents({
                "accountStatus": "active",
                "security.last_login_at": {"$gte": month_start, "$lte": month_end}
            })
            
            # Upsert to platform_stats_monthly
            monthly_doc = {
                "_id": month_id,
                "year": year_str,
                "month": month_str,
                "searches": aggregated["searches"],
                "profileViews": aggregated["profileViews"],
                "favorited": aggregated["favorited"],
                "shortlisted": aggregated["shortlisted"],
                "messagesSent": aggregated["messagesSent"],
                "activeMembers": aggregated["activeMembers"],
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
            
            await db.platform_stats_monthly.update_one(
                {"_id": month_id},
                {"$set": monthly_doc},
                upsert=True
            )
            
            results["monthly_snapshots_created"] += 1
            print(f"✅ Created monthly snapshot for {month_id}")
            
        except Exception as e:
            error_msg = f"Failed to create monthly snapshot for {month_id}: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
    
    return results


async def backfill_yearly_snapshots(db, year: int) -> Dict[str, Any]:
    """
    Backfill yearly snapshot for a given year from monthly snapshots.
    
    Args:
        db: AsyncIOMotorDatabase instance
        year: Year to backfill (e.g., 2024)
    
    Returns:
        Dict with backfill results
    """
    year_str = str(year)
    results = {
        "yearly_snapshot_created": 0,
        "errors": []
    }
    
    try:
        # Aggregate all monthly docs for this year via $group (avoids loading all docs into memory)
        pipeline = [
            {"$match": {"year": year_str}},
            {"$group": {
                "_id": None,
                "searches": {"$sum": "$searches"},
                "profileViews": {"$sum": "$profileViews"},
                "favorited": {"$sum": "$favorited"},
                "shortlisted": {"$sum": "$shortlisted"},
                "messagesSent": {"$sum": "$messagesSent"}
            }}
        ]
        agg_result = await db.platform_stats_monthly.aggregate(pipeline).to_list(length=1)
        
        if not agg_result:
            print(f"⚠️ No monthly snapshots found for {year_str}, skipping")
            return results
        
        # Build aggregated stats
        aggregated = agg_result[0]
        del aggregated["_id"]
        
        # Compute active members for the year (users who logged in during the year)
        year_start = datetime(year, 1, 1, 0, 0, 0)
        year_end = datetime(year, 12, 31, 23, 59, 59, 999999)
        aggregated["activeMembers"] = await db.users.count_documents({
            "accountStatus": "active",
            "security.last_login_at": {"$gte": year_start, "$lte": year_end}
        })
        
        # Upsert to platform_stats_yearly
        yearly_doc = {
            "_id": year_str,
            "year": year_str,
            "searches": aggregated["searches"],
            "profileViews": aggregated["profileViews"],
            "favorited": aggregated["favorited"],
            "shortlisted": aggregated["shortlisted"],
            "messagesSent": aggregated["messagesSent"],
            "activeMembers": aggregated["activeMembers"],
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.platform_stats_yearly.update_one(
            {"_id": year_str},
            {"$set": yearly_doc},
            upsert=True
        )
        
        results["yearly_snapshot_created"] = 1
        print(f"✅ Created yearly snapshot for {year_str}")
        
    except Exception as e:
        error_msg = f"Failed to create yearly snapshot for {year_str}: {str(e)}"
        results["errors"].append(error_msg)
        print(f"❌ {error_msg}")
    
    return results


async def backfill_all_time_snapshot(db) -> Dict[str, Any]:
    """
    Backfill all-time snapshot from all activity logs.
    
    Args:
        db: AsyncIOMotorDatabase instance
    
    Returns:
        Dict with backfill results
    """
    results = {
        "all_time_snapshot_created": 0,
        "errors": []
    }
    
    try:
        # 1. Searches
        searches = await db.activity_logs.count_documents({
            "action_type": "search_performed"
        })
        
        # 2. Profile Views — sum viewCount from dedicated profile_views collection
        pv_pipeline = [
            {"$group": {
                "_id": None,
                "totalViews": {"$sum": "$viewCount"}
            }}
        ]
        pv_result = await db.profile_views.aggregate(pv_pipeline).to_list(1)
        profile_views = pv_result[0]["totalViews"] if pv_result else 0
        
        # 3. Favorited (dedicated collection — source of truth)
        favorited = await db.favorites.count_documents({
            "createdAt": {"$exists": True, "$ne": None}
        })
        
        # 4. Shortlisted (dedicated collection — source of truth)
        shortlisted = await db.shortlists.count_documents({
            "createdAt": {"$exists": True, "$ne": None}
        })
        
        # 5. Messages Sent (dedicated collection — source of truth)
        messages_sent = await db.messages.count_documents({
            "createdAt": {"$exists": True, "$ne": None}
        })
        
        # 6. Active Members (users who have ever logged in)
        active_members = await db.users.count_documents({
            "accountStatus": "active",
            "security.last_login_at": {"$exists": True, "$ne": None}
        })
        
        # Upsert to platform_stats_all_time
        all_time_doc = {
            "_id": "all_time",
            "searches": searches,
            "profileViews": profile_views,
            "favorited": favorited,
            "shortlisted": shortlisted,
            "messagesSent": messages_sent,
            "activeMembers": active_members,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.platform_stats_all_time.update_one(
            {"_id": "all_time"},
            {"$set": all_time_doc},
            upsert=True
        )
        
        results["all_time_snapshot_created"] = 1
        print(f"✅ Created all-time snapshot")
        
    except Exception as e:
        error_msg = f"Failed to create all-time snapshot: {str(e)}"
        results["errors"].append(error_msg)
        print(f"❌ {error_msg}")
    
    return results


async def main():
    """Main backfill function."""
    parser = argparse.ArgumentParser(description="Backfill platform stats from activity logs")
    parser.add_argument(
        "--env",
        choices=["local", "development", "staging", "production", "docker", "test"],
        default=None,
        help="Environment to use for database connection (auto-detect if not specified)"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Number of days to backfill (default: 90)"
    )
    parser.add_argument(
        "--check-actions",
        action="store_true",
        help="Check what action types exist in activity_logs"
    )
    args = parser.parse_args()
    
    # Set environment if specified
    if args.env:
        os.environ["APP_ENVIRONMENT"] = args.env
    
    print("=" * 60)
    print("Platform Stats Backfill Script")
    if args.env:
        print(f"📦 Environment: {args.env}")
    print("=" * 60)
    
    # Initialize database connection
    await connect_to_mongo()
    db = get_database()
    
    # Log which database we're actually connected to
    from config import settings
    print(f"\n🔌 Connected to MongoDB: {settings.mongodb_url}")
    print(f"📁 Database name: {settings.database_name}")
    
    # Verify connection by listing collections
    collections = await db.list_collection_names()
    print(f"📂 Available collections: {collections}")
    
    # Check action types if requested
    if args.check_actions:
        print("\n🔍 Checking action types in activity_logs...")
        action_types = await db.activity_logs.distinct("action_type")
        print(f"Found {len(action_types)} unique action types:")
        for action_type in sorted(action_types):
            count = await db.activity_logs.count_documents({"action_type": action_type})
            print(f"  - {action_type}: {count} occurrences")
        return
    
    # Check if activity_logs collection exists and has data
    activity_count = await db.activity_logs.count_documents({})
    print(f"\n📊 Activity logs count: {activity_count}")
    
    if activity_count == 0:
        print("⚠️ No activity logs found. Skipping backfill.")
        return
    
    # Get earliest activity log date
    earliest_log = await db.activity_logs.find_one(
        sort=[("timestamp", 1)]
    )
    if earliest_log:
        earliest_date = earliest_log.get("timestamp")
        print(f"📅 Earliest activity log: {earliest_date}")
    
    total_results = {
        "daily_snapshots_created": 0,
        "monthly_snapshots_created": 0,
        "yearly_snapshots_created": 0,
        "all_time_snapshot_created": 0,
        "errors": []
    }
    
    # 1. Backfill daily snapshots (last N days)
    print("\n" + "=" * 60)
    print(f"Step 1: Backfilling daily snapshots (last {args.days} days)")
    print("=" * 60)
    daily_results = await backfill_daily_snapshots(db, days=args.days)
    total_results["daily_snapshots_created"] = daily_results["daily_snapshots_created"]
    total_results["errors"].extend(daily_results["errors"])
    
    # Verify daily snapshots were actually written
    daily_count = await db.platform_stats_daily.count_documents({})
    print(f"\n🔍 Verification: platform_stats_daily has {daily_count} documents")
    
    # 2. Backfill monthly snapshots for all years with daily data
    print("\n" + "=" * 60)
    print("Step 2: Backfilling monthly snapshots")
    print("=" * 60)
    # Determine years from daily snapshots
    daily_years = set()
    async for doc in db.platform_stats_daily.find({}, {"date": 1}):
        date_val = doc.get("date")
        if date_val and len(date_val) >= 4:
            daily_years.add(int(date_val[:4]))
    # Also include current year in case dailies don't exist yet
    current_year = datetime.utcnow().year
    daily_years.add(current_year)
    for year in sorted(daily_years):
        print(f"  → Backfilling monthly snapshots for {year}")
        monthly_results = await backfill_monthly_snapshots(db, year)
        total_results["monthly_snapshots_created"] += monthly_results["monthly_snapshots_created"]
        total_results["errors"].extend(monthly_results["errors"])
    
    # 3. Backfill yearly snapshots for previous years
    print("\n" + "=" * 60)
    print("Step 3: Backfilling yearly snapshots (previous years)")
    print("=" * 60)
    # Check if there are monthly snapshots from previous years
    distinct_years = await db.platform_stats_monthly.distinct("year")
    for year_str in distinct_years:
        year = int(year_str)
        if year < current_year:
            yearly_results = await backfill_yearly_snapshots(db, year)
            total_results["yearly_snapshots_created"] += yearly_results["yearly_snapshot_created"]
            total_results["errors"].extend(yearly_results["errors"])
    
    # 4. Backfill all-time snapshot
    print("\n" + "=" * 60)
    print("Step 4: Backfilling all-time snapshot")
    print("=" * 60)
    all_time_results = await backfill_all_time_snapshot(db)
    total_results["all_time_snapshot_created"] = all_time_results["all_time_snapshot_created"]
    total_results["errors"].extend(all_time_results["errors"])
    
    # Print summary
    print("\n" + "=" * 60)
    print("Backfill Summary")
    print("=" * 60)
    print(f"✅ Daily snapshots created: {total_results['daily_snapshots_created']}")
    print(f"✅ Monthly snapshots created: {total_results['monthly_snapshots_created']}")
    print(f"✅ Yearly snapshots created: {total_results['yearly_snapshots_created']}")
    print(f"✅ All-time snapshot created: {total_results['all_time_snapshot_created']}")
    
    if total_results["errors"]:
        print(f"\n❌ Errors encountered: {len(total_results['errors'])}")
        for error in total_results["errors"]:
            print(f"  - {error}")
    else:
        print("\n✅ Backfill completed successfully!")
    
    # Close database connection
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
