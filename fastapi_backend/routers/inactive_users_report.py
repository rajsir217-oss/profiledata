"""
Inactive Users Report API
Provides comprehensive inactive user data with filtering and sorting capabilities
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, List
from datetime import datetime, timedelta
import logging

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database

logger = logging.getLogger(__name__)
router = APIRouter()


def _parse_updated_at(value) -> Optional[datetime]:
    """Safely parse updatedAt which can be string or datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00').replace('+00:00', ''))
        except (ValueError, TypeError):
            return None
    return None


@router.get("/inactive-users/debug")
async def debug_inactive_users(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Debug endpoint to test basic functionality"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        total_users = await db.users.count_documents({"accountStatus": "active"})
        users_with_updated = await db.users.count_documents({
            "accountStatus": "active",
            "updatedAt": {"$exists": True}
        })

        return {
            "debug": "success",
            "total_active_users": total_users,
            "users_with_updated": users_with_updated,
            "message": "Basic database connection working"
        }

    except Exception as e:
        logger.error(f"Debug endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Debug error: {str(e)}")


@router.get("/inactive-users")
async def get_inactive_users(
    current_user: dict = Depends(get_current_user),
    username: Optional[str] = Query(None, description="Filter by username (partial match)"),
    gender: Optional[str] = Query(None, description="Filter by gender"),
    min_days: Optional[int] = Query(None, ge=0, description="Minimum days inactive"),
    max_days: Optional[int] = Query(None, ge=0, description="Maximum days inactive"),
    date_from: Optional[str] = Query(None, description="Filter by last login date from (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter by last login date to (YYYY-MM-DD)"),
    sort_by: str = Query("daysElapsed", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Results per page"),
    db=Depends(get_database)
):
    """
    Get inactive users report with filtering and sorting.
    Uses simple find() + Python processing instead of heavy aggregation pipeline.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        today = datetime.utcnow()

        # Use min_days default of 15 if not specified
        effective_min_days = min_days if min_days is not None else 15
        cutoff_date = today - timedelta(days=effective_min_days)
        cutoff_str = cutoff_date.strftime("%Y-%m-%d")

        # Build MongoDB query - simple find, no aggregation
        query = {
            "accountStatus": "active",
            "updatedAt": {"$exists": True, "$ne": None}
        }

        if username:
            query["username"] = {"$regex": username, "$options": "i"}
        if gender:
            query["gender"] = gender

        # Fetch with projection for only needed fields
        projection = {
            "username": 1,
            "firstName": 1,
            "lastName": 1,
            "gender": 1,
            "updatedAt": 1,
            "loginCount": 1,
            "_id": 0
        }

        cursor = db.users.find(query, projection)
        raw_users = await cursor.to_list(length=5000)

        # Process in Python - much faster than $dateFromString aggregation
        processed = []
        for user in raw_users:
            updated_at = _parse_updated_at(user.get("updatedAt"))
            if updated_at is None:
                days_elapsed = None  # Never logged in
                last_login_dt = None
            else:
                # Make both naive for comparison
                if updated_at.tzinfo is not None:
                    updated_at = updated_at.replace(tzinfo=None)
                delta = today - updated_at
                days_elapsed = delta.days
                last_login_dt = updated_at

            # Apply days filter — treat never-logged-in as qualifying (no upper bound)
            if days_elapsed is not None and days_elapsed < effective_min_days:
                continue
            if max_days is not None and days_elapsed is not None and days_elapsed > max_days:
                continue

            # Apply date filters
            if date_from and last_login_dt:
                try:
                    date_from_dt = datetime.strptime(date_from, "%Y-%m-%d")
                    if last_login_dt < date_from_dt:
                        continue
                except ValueError:
                    pass
            if date_to and last_login_dt:
                try:
                    date_to_dt = datetime.strptime(date_to, "%Y-%m-%d")
                    if last_login_dt > date_to_dt:
                        continue
                except ValueError:
                    pass

            first = user.get("firstName") or ""
            last = user.get("lastName") or ""
            full_name = f"{first} {last}".strip() or None

            processed.append({
                "username": user.get("username"),
                "firstName": first,
                "lastName": last,
                "fullName": full_name,
                "gender": user.get("gender"),
                "lastLogin": last_login_dt.isoformat() if last_login_dt else None,
                "daysElapsed": days_elapsed,  # None means never logged in
                "accountStatus": "active",
                "loginCount": user.get("loginCount", 0)
            })

        total = len(processed)

        # Sort
        valid_sort_fields = {"username", "gender", "lastLogin", "daysElapsed"}
        if sort_by not in valid_sort_fields:
            sort_by = "daysElapsed"

        reverse = sort_order != "asc"
        # None (never logged in) sorts as highest days (infinity) when descending
        processed.sort(
            key=lambda u: (u.get(sort_by) is not None, u.get(sort_by) or 0) if sort_by == "daysElapsed"
            else (u.get(sort_by) is None, u.get(sort_by) or ""),
            reverse=reverse
        )

        # Paginate
        skip = (page - 1) * limit
        paginated = processed[skip:skip + limit]

        return {
            "users": paginated,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit if total > 0 else 0,
            "filters": {
                "username": username,
                "gender": gender,
                "minDays": min_days,
                "maxDays": max_days,
                "dateFrom": date_from,
                "dateTo": date_to
            },
            "sort": {
                "sortBy": sort_by,
                "sortOrder": sort_order
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching inactive users report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/inactive-users/summary")
async def get_inactive_users_summary(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get summary statistics for inactive users"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        today = datetime.utcnow()

        # Fetch active users with updatedAt
        projection = {"updatedAt": 1, "gender": 1, "_id": 0}
        cursor = db.users.find(
            {"accountStatus": "active", "updatedAt": {"$exists": True, "$ne": None}},
            projection
        )
        raw_users = await cursor.to_list(length=10000)

        # Process in Python
        total_active = len(raw_users)
        inactive_15_30 = 0
        inactive_30_60 = 0
        inactive_60_plus = 0
        never_logged_in = 0
        total_days = 0
        max_days = 0
        gender_counts = {}

        for user in raw_users:
            updated_at = _parse_updated_at(user.get("updatedAt"))
            if updated_at is None:
                days = 999
                never_logged_in += 1
            else:
                if updated_at.tzinfo is not None:
                    updated_at = updated_at.replace(tzinfo=None)
                days = (today - updated_at).days

            total_days += days
            if days > max_days:
                max_days = days

            if 15 <= days < 30:
                inactive_15_30 += 1
            elif 30 <= days < 60:
                inactive_30_60 += 1
            elif days >= 60:
                inactive_60_plus += 1

            # Gender breakdown for inactive users (15+ days)
            if days >= 15:
                g = user.get("gender") or "Unknown"
                gender_counts[g] = gender_counts.get(g, 0) + 1

        avg_days = total_days / total_active if total_active > 0 else 0

        return {
            "summary": {
                "totalActive": total_active,
                "inactive15_30": inactive_15_30,
                "inactive30_60": inactive_30_60,
                "inactive60_plus": inactive_60_plus,
                "neverLoggedIn": never_logged_in,
                "avgDaysInactive": round(avg_days, 1),
                "maxDaysInactive": max_days
            },
            "genderBreakdown": gender_counts,
            "lastUpdated": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error fetching inactive users summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/inactive-users/{username}/send-reminder")
async def send_test_reminder(
    username: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Send a test login reminder to a specific inactive user"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        user = await db.users.find_one({"username": username, "accountStatus": "active"})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Calculate days inactive
        today = datetime.utcnow()
        updated_at = _parse_updated_at(user.get("updatedAt"))
        if updated_at is None:
            days_inactive = 999
        else:
            if updated_at.tzinfo is not None:
                updated_at = updated_at.replace(tzinfo=None)
            days_inactive = (today - updated_at).days

        if days_inactive < 15:
            raise HTTPException(status_code=400, detail="User is not inactive enough (< 15 days)")

        # Queue test reminder
        from services.notification_service import NotificationService
        notification_service = NotificationService(db)

        template_data = {
            "firstName": user.get("firstName", username),
            "daysInactive": days_inactive,
            "lastLoginDate": updated_at.strftime("%Y-%m-%d") if updated_at else "Never",
            "newMatchesCount": 0,
            "unreadMessagesCount": 0,
            "profileViewsCount": 0,
            "escalationLevel": "warning"
        }

        await notification_service.queue_notification(
            username=username,
            trigger="admin_login_reminder",
            channels=["email"],
            template_data=template_data,
            priority="medium"
        )

        logger.info(f"Test reminder sent to {username} by admin {current_user.get('username')}")

        return {
            "success": True,
            "message": f"Test reminder sent to {username}",
            "username": username,
            "daysInactive": days_inactive,
            "sentAt": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending test reminder to {username}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
