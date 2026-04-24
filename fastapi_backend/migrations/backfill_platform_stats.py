"""
Backfill Platform Stats from Activity Logs

This script populates the platform stats snapshot collections with historical data
from the activity_logs collection.

Phase 1 of migration strategy from PLATFORM_STATS_SNAPSHOT_DESIGN.md

Usage:
    python -m migrations.backfill_platform_stats --env development
    python -m migrations.backfill_platform_stats --env production
"""

import asyncio
import argparse
import os
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
            # 1. Searches
            searches = await db.activity_logs.count_documents({
                "action_type": "search_performed",
                **time_filter
            })
            
            # 2. Profile Views
            profile_views = await db.activity_logs.count_documents({
                "action_type": "profile_viewed",
                **time_filter
            })
            
            # 3. Favorited
            favorited = await db.activity_logs.count_documents({
                "action_type": "favorite_added",
                **time_filter
            })
            
            # 4. Shortlisted
            shortlisted = await db.activity_logs.count_documents({
                "action_type": "shortlist_added",
                **time_filter
            })
            
            # 5. Messages Sent
            messages_sent = await db.activity_logs.count_documents({
                "action_type": "message_sent",
                **time_filter
            })
            
            # 6. Active Members (users who logged in on this day)
            active_members = await db.users.count_documents({
                "accountStatus": "active",
                "security.last_login_at": {"$gte": day_start, "$lte": day_end}
            })
            
            # 7. Upsert to platform_stats_daily
            daily_doc = {
                "_id": date_str,
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
            # Aggregate all daily docs for this month
            daily_docs = await db.platform_stats_daily.find({
                "date": {"$gte": month_start.strftime("%Y-%m-%d"), "$lte": month_end.strftime("%Y-%m-%d")}
            }).to_list(length=None)
            
            if not daily_docs:
                print(f"⚠️ No daily snapshots found for {month_id}, skipping")
                continue
            
            # Sum all stats
            aggregated = {
                "searches": 0,
                "profileViews": 0,
                "favorited": 0,
                "shortlisted": 0,
                "messagesSent": 0,
                "activeMembers": 0
            }
            
            for doc in daily_docs:
                aggregated["searches"] += doc.get("searches", 0)
                aggregated["profileViews"] += doc.get("profileViews", 0)
                aggregated["favorited"] += doc.get("favorited", 0)
                aggregated["shortlisted"] += doc.get("shortlisted", 0)
                aggregated["messagesSent"] += doc.get("messagesSent", 0)
            
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
        # Aggregate all monthly docs for this year
        monthly_docs = await db.platform_stats_monthly.find({
            "year": year_str
        }).to_list(length=None)
        
        if not monthly_docs:
            print(f"⚠️ No monthly snapshots found for {year_str}, skipping")
            return results
        
        # Sum all stats
        aggregated = {
            "searches": 0,
            "profileViews": 0,
            "favorited": 0,
            "shortlisted": 0,
            "messagesSent": 0,
            "activeMembers": 0
        }
        
        for doc in monthly_docs:
            aggregated["searches"] += doc.get("searches", 0)
            aggregated["profileViews"] += doc.get("profileViews", 0)
            aggregated["favorited"] += doc.get("favorited", 0)
            aggregated["shortlisted"] += doc.get("shortlisted", 0)
            aggregated["messagesSent"] += doc.get("messagesSent", 0)
        
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
        
        # 2. Profile Views
        profile_views = await db.activity_logs.count_documents({
            "action_type": "profile_viewed"
        })
        
        # 3. Favorited
        favorited = await db.activity_logs.count_documents({
            "action_type": "favorite_added"
        })
        
        # 4. Shortlisted
        shortlisted = await db.activity_logs.count_documents({
            "action_type": "shortlist_added"
        })
        
        # 5. Messages Sent
        messages_sent = await db.activity_logs.count_documents({
            "action_type": "message_sent"
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
    args = parser.parse_args()
    
    # Set environment if specified
    if args.env:
        os.environ["APP_ENV"] = args.env
    
    print("=" * 60)
    print("Platform Stats Backfill Script")
    if args.env:
        print(f"📦 Environment: {args.env}")
    print("=" * 60)
    
    # Initialize database connection
    await connect_to_mongo()
    db = get_database()
    
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
    
    # 1. Backfill daily snapshots (last 90 days)
    print("\n" + "=" * 60)
    print("Step 1: Backfilling daily snapshots (last 90 days)")
    print("=" * 60)
    daily_results = await backfill_daily_snapshots(db, days=90)
    total_results["daily_snapshots_created"] = daily_results["daily_snapshots_created"]
    total_results["errors"].extend(daily_results["errors"])
    
    # 2. Backfill monthly snapshots for current year (older months)
    print("\n" + "=" * 60)
    print("Step 2: Backfilling monthly snapshots (current year)")
    print("=" * 60)
    current_year = datetime.utcnow().year
    monthly_results = await backfill_monthly_snapshots(db, current_year)
    total_results["monthly_snapshots_created"] = monthly_results["monthly_snapshots_created"]
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
