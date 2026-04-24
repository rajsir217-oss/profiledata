"""
Platform Stats Router
Provides aggregated, anonymous platform activity statistics for the footer bar.
Cached in Redis (shared across workers) with a 5-minute TTL; falls back to
in-memory cache if Redis is unavailable.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/platform-stats",
    tags=["platform-stats"]
)

# --- Caching ---
CACHE_TTL_SECONDS = 300  # 5 minutes
CACHE_KEY_PREFIX = "platform_stats:"

# In-memory fallback cache (used if Redis is down)
_stats_cache = {}  # {"weekly": {"data": {...}, "expires": datetime}, ...}


def _cache_get(period: str) -> Optional[dict]:
    """Fetch cached stats from Redis, falling back to in-memory dict."""
    # Try Redis first
    try:
        from redis_manager import get_redis_manager
        rm = get_redis_manager()
        if rm and rm.redis_client:
            raw = rm.redis_client.get(f"{CACHE_KEY_PREFIX}{period}")
            if raw:
                return json.loads(raw)
    except Exception as e:
        logger.debug(f"Redis cache read skipped: {e}")

    # Fallback: in-memory
    cached = _stats_cache.get(period)
    if cached and cached["expires"] > datetime.utcnow():
        return cached["data"]
    return None


def _cache_set(period: str, data: dict) -> None:
    """Store stats in Redis (with TTL) and in-memory as backup."""
    # Write to Redis
    try:
        from redis_manager import get_redis_manager
        rm = get_redis_manager()
        if rm and rm.redis_client:
            rm.redis_client.setex(
                f"{CACHE_KEY_PREFIX}{period}",
                CACHE_TTL_SECONDS,
                json.dumps(data, default=str)
            )
    except Exception as e:
        logger.debug(f"Redis cache write skipped: {e}")

    # Always also update in-memory (fast-path for same worker)
    _stats_cache[period] = {
        "data": data,
        "expires": datetime.utcnow() + timedelta(seconds=CACHE_TTL_SECONDS)
    }


def _get_period_start(period: str) -> Optional[datetime]:
    """Calculate the calendar-aligned start datetime for a given period (UTC).

    - weekly: Monday 00:00 UTC of the current ISO week
    - monthly: 1st of current month at 00:00 UTC
    - yearly: January 1st at 00:00 UTC of current year
    - all: None (no lower bound)
    """
    now = datetime.utcnow()
    if period == "weekly":
        # Python's weekday(): Monday=0, Sunday=6
        monday = now - timedelta(days=now.weekday())
        return monday.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "monthly":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "yearly":
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "all":
        return None
    # Fallback: week-to-date
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


async def _compute_stats(period: str, db) -> dict:
    """Run the aggregation queries against the snapshot collections."""
    period_start = _get_period_start(period)
    now = datetime.utcnow()

    try:
        # For "all time" - query single all_time snapshot
        if period == "all":
            all_time_doc = await db.platform_stats_all_time.find_one({"_id": "all_time"})
            if all_time_doc:
                return {
                    "searches": all_time_doc.get("searches", 0),
                    "profileViews": all_time_doc.get("profileViews", 0),
                    "favorited": all_time_doc.get("favorited", 0),
                    "shortlisted": all_time_doc.get("shortlisted", 0),
                    "activeMembers": all_time_doc.get("activeMembers", 0),
                    "messagesSent": all_time_doc.get("messagesSent", 0),
                    "period": period,
                    "periodStart": None,
                    "cachedAt": now.isoformat()
                }
        
        # For other periods - aggregate from snapshot collections
        # Calculate date range
        if period == "weekly":
            # Get Monday-Sunday of current ISO week
            monday = now - timedelta(days=now.weekday())
            period_start = monday.replace(hour=0, minute=0, second=0, microsecond=0)
            period_end = monday + timedelta(days=6)
            period_end = period_end.replace(hour=23, minute=59, second=59, microsecond=999999)
        elif period == "monthly":
            # 1st of month to last day
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if now.month == 12:
                next_month = now.replace(year=now.year + 1, month=1, day=1)
            else:
                next_month = now.replace(month=now.month + 1, day=1)
            period_end = next_month - timedelta(days=1)
            period_end = period_end.replace(hour=23, minute=59, second=59, microsecond=999999)
        elif period == "yearly":
            # Jan 1 to Dec 31
            period_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            period_end = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
        else:
            # Default to week
            monday = now - timedelta(days=now.weekday())
            period_start = monday.replace(hour=0, minute=0, second=0, microsecond=0)
            period_end = monday + timedelta(days=6)
            period_end = period_end.replace(hour=23, minute=59, second=59, microsecond=999999)

        # Determine cutoff for daily snapshots (90 days ago)
        daily_cutoff = now - timedelta(days=90)
        daily_cutoff_str = daily_cutoff.strftime("%Y-%m-%d")
        period_start_str = period_start.strftime("%Y-%m-%d")
        period_end_str = period_end.strftime("%Y-%m-%d")

        # Aggregate stats from appropriate collections
        searches = 0
        profile_views = 0
        favorited = 0
        shortlisted = 0
        messages_sent = 0

        # Query daily snapshots for recent dates
        if period_start <= daily_cutoff:
            # Period starts within last 90 days - use daily snapshots
            daily_docs = await db.platform_stats_daily.find({
                "date": {"$gte": period_start_str, "$lte": period_end_str}
            }).to_list(length=None)
            
            for doc in daily_docs:
                searches += doc.get("searches", 0)
                profile_views += doc.get("profileViews", 0)
                favorited += doc.get("favorited", 0)
                shortlisted += doc.get("shortlisted", 0)
                messages_sent += doc.get("messagesSent", 0)

        # Query monthly snapshots for older dates in current year
        if period_start < daily_cutoff:
            # Period spans beyond 90 days - need monthly snapshots
            year_str = str(now.year)
            month_start = int(period_start_str[5:7])
            month_end = int(period_end_str[5:7])
            
            for month in range(month_start, month_end + 1):
                month_id = f"{year_str}-{month:02d}"
                monthly_doc = await db.platform_stats_monthly.find_one({"_id": month_id})
                if monthly_doc:
                    searches += monthly_doc.get("searches", 0)
                    profile_views += monthly_doc.get("profileViews", 0)
                    favorited += monthly_doc.get("favorited", 0)
                    shortlisted += monthly_doc.get("shortlisted", 0)
                    messages_sent += monthly_doc.get("messagesSent", 0)

        # Query yearly snapshots if period spans multiple years
        if period_start and period_start.year < now.year:
            year_start = period_start.year
            year_end = period_end.year
            
            for year in range(year_start, year_end + 1):
                year_id = str(year)
                yearly_doc = await db.platform_stats_yearly.find_one({"_id": year_id})
                if yearly_doc:
                    searches += yearly_doc.get("searches", 0)
                    profile_views += yearly_doc.get("profileViews", 0)
                    favorited += yearly_doc.get("favorited", 0)
                    shortlisted += yearly_doc.get("shortlisted", 0)
                    messages_sent += yearly_doc.get("messagesSent", 0)

        # Active members - query from users collection based on period
        active_members_query = {"accountStatus": "active"}
        if period_start:
            active_members_query["security.last_login_at"] = {"$gte": period_start}
        else:
            active_members_query["security.last_login_at"] = {
                "$exists": True, "$ne": None
            }
        active_members = await db.users.count_documents(active_members_query)

        return {
            "searches": searches,
            "profileViews": profile_views,
            "favorited": favorited,
            "shortlisted": shortlisted,
            "activeMembers": active_members,
            "messagesSent": messages_sent,
            "period": period,
            "periodStart": period_start.isoformat() if period_start else None,
            "cachedAt": now.isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Error computing platform stats: {e}")
        return {
            "searches": 0,
            "profileViews": 0,
            "favorited": 0,
            "shortlisted": 0,
            "activeMembers": 0,
            "messagesSent": 0,
            "period": period,
            "periodStart": period_start.isoformat() if period_start else None,
            "cachedAt": now.isoformat(),
            "error": str(e)
        }


@router.get("")
async def get_platform_stats(
    period: str = Query("weekly", regex="^(weekly|monthly|yearly|all)$"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get aggregated platform activity statistics.
    Available to all logged-in users. Cached for 5 minutes per period.
    """
    cached = _cache_get(period)
    if cached:
        return cached

    stats = await _compute_stats(period, db)
    _cache_set(period, stats)
    return stats
