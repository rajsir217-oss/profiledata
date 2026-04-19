"""
Platform Stats Router
Provides aggregated, anonymous platform activity statistics for the footer bar.
Cached in-memory with a 5-minute TTL to minimize database load.
"""

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

# --- In-Memory Cache ---
_stats_cache = {}  # {"weekly": {"data": {...}, "expires": datetime}, ...}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _get_period_start(period: str) -> Optional[datetime]:
    """Calculate the start datetime for a given period."""
    now = datetime.utcnow()
    if period == "weekly":
        return now - timedelta(days=7)
    elif period == "monthly":
        return now - timedelta(days=30)
    elif period == "yearly":
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "all":
        return None  # No lower bound
    return now - timedelta(days=7)  # fallback


async def _compute_stats(period: str, db) -> dict:
    """Run the aggregation queries against the database."""
    period_start = _get_period_start(period)
    now = datetime.utcnow()

    # Time filter for activity_logs (timestamp field)
    time_filter = {}
    if period_start:
        time_filter = {"timestamp": {"$gte": period_start}}

    # Time filter for collections using createdAt (datetime objects)
    created_at_filter = {}
    if period_start:
        created_at_filter = {"createdAt": {"$gte": period_start}}

    # Time filter for profile_views (uses firstViewedAt / lastViewedAt)
    pv_filter = {}
    if period_start:
        pv_filter = {"lastViewedAt": {"$gte": period_start}}

    try:
        # 1. Searches — from activity_logs
        searches = await db.activity_logs.count_documents({
            "action_type": "search_performed",
            **time_filter
        })

        # 2. Profile Views — from profile_views collection (count view events, not unique pairs)
        profile_views = await db.profile_views.count_documents(pv_filter) if period_start else await db.profile_views.count_documents({})

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

        # 5. Conversations — from activity_logs
        conversations = await db.activity_logs.count_documents({
            "action_type": "conversation_started",
            **time_filter
        })

        # 6. Active Members — users with recent login
        if period_start:
            active_members = await db.users.count_documents({
                "accountStatus": "active",
                "security.last_login_at": {"$gte": period_start}
            })
        else:
            active_members = await db.users.count_documents({
                "accountStatus": "active"
            })

        # 7. Messages sent — from activity_logs
        messages_sent = await db.activity_logs.count_documents({
            "action_type": "message_sent",
            **time_filter
        })

        return {
            "searches": searches,
            "profileViews": profile_views,
            "favorited": favorited,
            "shortlisted": shortlisted,
            "conversations": conversations,
            "activeMembers": active_members,
            "messagesSent": messages_sent,
            "period": period,
            "cachedAt": now.isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Error computing platform stats: {e}")
        return {
            "searches": 0,
            "profileViews": 0,
            "favorited": 0,
            "shortlisted": 0,
            "conversations": 0,
            "activeMembers": 0,
            "messagesSent": 0,
            "period": period,
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
    # Check cache
    cached = _stats_cache.get(period)
    if cached and cached["expires"] > datetime.utcnow():
        return cached["data"]

    # Compute fresh stats
    stats = await _compute_stats(period, db)

    # Store in cache
    _stats_cache[period] = {
        "data": stats,
        "expires": datetime.utcnow() + timedelta(seconds=CACHE_TTL_SECONDS)
    }

    return stats
