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
    """Run the aggregation queries against the database."""
    period_start = _get_period_start(period)
    now = datetime.utcnow()

    # Time filter for activity_logs (timestamp field)
    time_filter = {}
    if period_start:
        time_filter = {"timestamp": {"$gte": period_start}}

    try:
        # 1. Searches — from activity_logs
        searches = await db.activity_logs.count_documents({
            "action_type": "search_performed",
            **time_filter
        })

        # 2. Profile Views — count TRUE view EVENTS from activity_logs.
        # (The profile_views collection stores one row per unique
        # viewer/profile pair with upsert-on-revisit, so it cannot be used
        # to count events per period.)
        profile_views = await db.activity_logs.count_documents({
            "action_type": "profile_viewed",
            **time_filter
        })

        # 3. Favorited — from activity_logs
        favorited = await db.activity_logs.count_documents({
            "action_type": "favorite_added",
            **time_filter
        })

        # 4. Shortlisted — from activity_logs
        shortlisted = await db.activity_logs.count_documents({
            "action_type": "shortlist_added",
            **time_filter
        })

        # 5. Messages sent — from activity_logs
        messages_sent = await db.activity_logs.count_documents({
            "action_type": "message_sent",
            **time_filter
        })

        # 6. Active Members — UNIFIED semantics across all periods:
        # "users who logged in at least once during the period".
        # For "all time" this means "users who have ever logged in"
        # (i.e. security.last_login_at is set).
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
