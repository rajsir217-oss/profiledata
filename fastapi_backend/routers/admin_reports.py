"""
Admin Reports API - Gender by Age distribution and other analytics
Admin-only endpoints for viewing user statistics
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from datetime import datetime
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/reports", tags=["admin-reports"])


def _is_admin(current_user: dict) -> bool:
    """Check if user is admin - checks role, role_name, and username (case-insensitive)"""
    if not current_user:
        return False
    role = (current_user.get("role") or "").lower()
    role_name = (current_user.get("role_name") or "").lower()
    username = (current_user.get("username") or "").lower()
    return role == "admin" or role_name == "admin" or username == "admin"


@router.get("/gender-by-age")
async def get_gender_by_age_report(
    gender: Optional[str] = None,  # "male", "female", or None for all
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get user count by age, optionally filtered by gender.
    Returns data for line chart visualization.
    """
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    logger.info(f"📊 Admin report: gender-by-age, filter={gender}")
    
    # Build match query
    match_query = {"accountStatus": "active"}
    if gender and gender.lower() in ["male", "female"]:
        match_query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}
    
    # Calculate current year/month for age calculation
    now = datetime.now()
    current_year = now.year
    current_month = now.month
    
    # Aggregation pipeline to calculate age and group by it
    pipeline = [
        {"$match": match_query},
        # Calculate age from birthYear and birthMonth
        {"$addFields": {
            "calculatedAge": {
                "$cond": {
                    "if": {"$and": [
                        {"$ne": ["$birthYear", None]},
                        {"$gt": ["$birthYear", 0]}
                    ]},
                    "then": {
                        "$subtract": [
                            {"$subtract": [current_year, "$birthYear"]},
                            {
                                "$cond": {
                                    "if": {"$and": [
                                        {"$ne": ["$birthMonth", None]},
                                        {"$lt": [current_month, "$birthMonth"]}
                                    ]},
                                    "then": 1,
                                    "else": 0
                                }
                            }
                        ]
                    },
                    "else": None
                }
            }
        }},
        # Filter out users without valid age
        {"$match": {"calculatedAge": {"$ne": None, "$gte": 18, "$lte": 100}}},
        # Group by age
        {"$group": {
            "_id": "$calculatedAge",
            "count": {"$sum": 1},
            "users": {"$push": {
                "profileId": "$profileId",
                "username": "$username",
                "firstName": "$firstName",
                "lastName": "$lastName",
                "gender": "$gender"
            }}
        }},
        # Sort by age
        {"$sort": {"_id": 1}},
        # Project final shape
        {"$project": {
            "_id": 0,
            "age": "$_id",
            "count": 1,
            "users": {"$slice": ["$users", 100]}  # Limit users per age to 100
        }}
    ]
    
    try:
        results = await db.users.aggregate(pipeline).to_list(100)
        
        # Calculate totals
        total_count = sum(r["count"] for r in results)
        
        logger.info(f"📊 Report generated: {len(results)} age groups, {total_count} total users")
        
        return {
            "success": True,
            "filter": gender or "all",
            "totalCount": total_count,
            "data": results
        }
    except Exception as e:
        logger.error(f"❌ Error generating report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating report: {str(e)}"
        )


@router.get("/summary")
async def get_reports_summary(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get summary statistics for admin dashboard.
    """
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    try:
        # Get counts by gender
        male_count = await db.users.count_documents({
            "accountStatus": "active",
            "gender": {"$regex": "^male$", "$options": "i"}
        })
        female_count = await db.users.count_documents({
            "accountStatus": "active",
            "gender": {"$regex": "^female$", "$options": "i"}
        })
        total_active = await db.users.count_documents({"accountStatus": "active"})
        total_pending = await db.users.count_documents({"accountStatus": "pending_admin_approval"})
        
        return {
            "success": True,
            "summary": {
                "totalActive": total_active,
                "totalPending": total_pending,
                "maleCount": male_count,
                "femaleCount": female_count,
                "otherCount": total_active - male_count - female_count
            }
        }
    except Exception as e:
        logger.error(f"❌ Error getting summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting summary: {str(e)}"
        )
