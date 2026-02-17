"""
Admin Reports API - Optimized version
Gender by Age distribution and other analytics
Admin-only endpoints for viewing user statistics
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, Dict, List, Any
from datetime import datetime
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from pydantic import BaseModel
import logging
import re
import json
from functools import lru_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/reports", tags=["admin-reports"])

# Pre-compiled regex patterns for profession categorization
PROFESSION_PATTERNS = {
    "Physicians & Doctors": re.compile(r"doctor|physician|medical|surgeon|pediatrician|dentist|optometrist|anesthesia|residency|fellowship", re.IGNORECASE),
    "Technology & Software": re.compile(r"software|developer|programmer|tech|biotech", re.IGNORECASE),
    "IT & Infrastructure": re.compile(r"it|support|system|network|admin|information technology", re.IGNORECASE),
    "Data & Analytics": re.compile(r"data|analyst|science|analytics|research scientist|quant", re.IGNORECASE),
    "Management & Leadership": re.compile(r"manager|management|lead|director|vice president|relationship manager", re.IGNORECASE),
    "Consulting": re.compile(r"consultant|consulting|advisor", re.IGNORECASE),
    "Engineering": re.compile(r"engineer|engineering|mechanical|civil|product manager", re.IGNORECASE),
    "Education": re.compile(r"teacher|professor|education|academic|student|medical student", re.IGNORECASE),
    "Sales & Marketing": re.compile(r"sales|marketing|business|revenue|human resources|hr", re.IGNORECASE),
    "Finance & Accounting": re.compile(r"finance|financial|accounting|banking", re.IGNORECASE),
    "Legal": re.compile(r"legal|lawyer|attorney|paralegal", re.IGNORECASE),
    "Healthcare": re.compile(r"nurse|healthcare|pharmacist|physical therapy|therapy|patient|optometrist", re.IGNORECASE),
    "Creative & Design": re.compile(r"design|creative|artist|writer|marketing", re.IGNORECASE),
    "Other Services": re.compile(r"transportation|dept of transportation|non profit", re.IGNORECASE)
}

# Age group configuration
AGE_GROUPS = [
    (18, 19), (20, 22), (23, 25), (26, 28), (29, 31),
    (32, 34), (35, 37), (38, 40), (41, 43), (44, 46),
    (47, 49), (50, 52), (53, 55), (56, 58), (59, 61),
    (62, 64), (65, 67), (68, 70), (71, 73), (74, 76), (77, 79)
]

# Response models
class ReportResponse(BaseModel):
    success: bool
    filter: str
    totalCount: int
    data: List[Dict[str, Any]]

class SummaryResponse(BaseModel):
    success: bool
    summary: Dict[str, int]

class UserSummary(BaseModel):
    profileId: str
    username: str
    firstName: str
    lastName: str
    gender: Optional[str] = None
    occupation: Optional[str] = None


@lru_cache(maxsize=1)
def get_encryptor_cached():
    """Cached encryptor instance to avoid repeated initialization"""
    from crypto_utils import get_encryptor
    return get_encryptor()

def _is_admin(current_user: dict) -> bool:
    """Check if user is admin - checks role, role_name, and username (case-insensitive)"""
    if not current_user:
        return False
    role = (current_user.get("role") or "").lower()
    role_name = (current_user.get("role_name") or "").lower()
    username = (current_user.get("username") or "").lower()
    return role == "admin" or role_name == "admin" or username == "admin"

def _check_admin_access(current_user: dict):
    """Centralized admin access check with consistent error handling"""
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

def _safe_gender_count(user: dict) -> tuple[str, int]:
    """Safely extract gender and return normalized gender and count increment"""
    gender = user.get("gender")
    if not gender or gender == "":
        return "other", 0
    gender_lower = str(gender).lower()
    if gender_lower == "male":
        return "male", 1
    elif gender_lower == "female":
        return "female", 1
    return "other", 0

def _create_user_summary(user: dict, **extra_fields) -> UserSummary:
    """Create standardized user summary object"""
    base_data = {
        "profileId": user.get("profileId", ""),
        "username": user.get("username", ""),
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "gender": user.get("gender") or None  # Handle None values properly
    }
    base_data.update(extra_fields)
    return UserSummary(**base_data)

def _get_age_group(age: int) -> Optional[tuple[int, str]]:
    """Efficient age group calculation using mathematical approach"""
    if age < 18 or age > 79:
        return None
    
    # Find the appropriate age group
    for i, (min_age, max_age) in enumerate(AGE_GROUPS):
        if min_age <= age <= max_age:
            return (min_age, f"{min_age}-{max_age}")
    return None

def _categorize_profession(profession_text: str) -> str:
    """Categorize profession using pre-compiled regex patterns"""
    if not profession_text or profession_text.strip() == "":
        return "Other"
    
    profession_lower = profession_text.lower()
    for category, pattern in PROFESSION_PATTERNS.items():
        if pattern.search(profession_lower):
            return category
    return "Other"

def _extract_profession_from_user(user: dict) -> str:
    """Extract profession text from user's occupation or workExperience"""
    # Try occupation field first
    profession_text = user.get("occupation", "")
    
    # If no occupation, try workExperience
    if not profession_text or profession_text.strip() == "":
        work_experience = user.get("workExperience", [])
        if work_experience and len(work_experience) > 0:
            try:
                if isinstance(work_experience, str):
                    work_exp = json.loads(work_experience)
                else:
                    work_exp = work_experience
                
                if work_exp and len(work_exp) > 0:
                    first_job = work_exp[0]
                    profession_text = (
                        first_job.get("position", "") or 
                        first_job.get("description", "") or 
                        first_job.get("company", "")
                    )
                    if profession_text is None:
                        profession_text = ""
            except Exception as e:
                logger.debug(f"Error parsing workExperience for user {user.get('username')}: {e}")
                profession_text = ""
    
    return profession_text or "Other"

def _create_group_data() -> Dict[str, Any]:
    """Create standardized group data structure"""
    return {
        "count": 0,
        "maleCount": 0,
        "femaleCount": 0,
        "users": []
    }

def _update_group_counts(group: Dict[str, Any], user: dict):
    """Update group counts with user data"""
    gender, increment = _safe_gender_count(user)
    group["count"] += 1
    if gender == "male":
        group["maleCount"] += increment
    elif gender == "female":
        group["femaleCount"] += increment

def _limit_users_in_groups(groups: Dict[str, Dict[str, Any]], limit: int = 100):
    """Limit number of users in each group to prevent memory bloat"""
    for group in groups.values():
        group["users"] = group["users"][:limit]

@router.get("/gender-by-age")
async def get_gender_by_age_report(
    gender: Optional[str] = Query(None, description="Filter by gender: male, female, or None for all"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get user count by 3-year age groups (18-19, 20-22, 23-25, etc.), optionally filtered by gender.
    Returns data for bar chart visualization with age ranges.
    """
    _check_admin_access(current_user)
    logger.info(f"📊 Admin report: gender-by-age, filter={gender}")
    
    try:
        # Build match query
        match_query = {"accountStatus": "active"}
        if gender and gender.lower() in ["male", "female"]:
            match_query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}
        
        # Calculate current year/month for age calculation
        now = datetime.now()
        current_year = now.year
        current_month = now.month
        
        # Optimized aggregation pipeline
        pipeline = [
            {"$match": match_query},
            {"$addFields": {
                "calculatedAge": {
                    "$cond": {
                        "if": {
                            "$and": [
                                {"$ne": ["$birthYear", None]},
                                {"$gt": ["$birthYear", 0]}
                            ]
                        },
                        "then": {
                            "$subtract": [
                                {"$subtract": [current_year, "$birthYear"]},
                                {
                                    "$cond": {
                                        "if": {
                                            "$and": [
                                                {"$ne": ["$birthMonth", None]},
                                                {"$lt": [current_month, "$birthMonth"]}
                                            ]
                                        },
                                        "then": 1,
                                        "else": 0
                                    }
                                }
                            ]
                        },
                        "else": None
                    }
                },
                "normalizedGender": {"$toLower": {"$ifNull": ["$gender", "other"]}}
            }},
            {"$match": {"calculatedAge": {"$ne": None, "$gte": 18, "$lte": 100}}},
            {"$group": {
                "_id": "$calculatedAge",
                "count": {"$sum": 1},
                "maleCount": {
                    "$sum": {"$cond": [{"$eq": ["$normalizedGender", "male"]}, 1, 0]}
                },
                "femaleCount": {
                    "$sum": {"$cond": [{"$eq": ["$normalizedGender", "female"]}, 1, 0]}
                },
                "users": {"$push": {
                    "profileId": "$profileId",
                    "username": "$username",
                    "firstName": "$firstName",
                    "lastName": "$lastName",
                    "gender": "$gender"
                }}
            }},
            {"$sort": {"_id": 1}},
            {"$limit": 100}
        ]
        
        # Get individual age data
        individual_ages = await db.users.aggregate(pipeline).to_list(100)
        
        # Group into age ranges efficiently
        age_groups = {}
        for result in individual_ages:
            age = result["_id"]
            age_group = _get_age_group(age)
            
            if not age_group:
                continue
            
            group_id, range_label = age_group
            if group_id not in age_groups:
                age_groups[group_id] = {
                    "ageGroup": group_id,
                    "ageRange": range_label,
                    "count": 0,
                    "maleCount": 0,
                    "femaleCount": 0,
                    "users": []
                }
            
            # Update counts
            age_groups[group_id]["count"] += result["count"]
            age_groups[group_id]["maleCount"] += result["maleCount"]
            age_groups[group_id]["femaleCount"] += result["femaleCount"]
            age_groups[group_id]["users"].extend(result["users"])
        
        # Convert to sorted list and limit users
        grouped_results = []
        for group_id in sorted(age_groups.keys()):
            group_data = age_groups[group_id]
            group_data["users"] = group_data["users"][:100]  # Limit users per group
            grouped_results.append(group_data)
        
        total_count = sum(r["count"] for r in grouped_results)
        
        logger.info(f"📊 Age distribution report generated: {len(grouped_results)} age groups, {total_count} total users")
        
        return ReportResponse(
            success=True,
            filter=gender or "all",
            totalCount=total_count,
            data=grouped_results
        )
        
    except Exception as e:
        logger.error(f"❌ Error generating age report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating age report: {str(e)}"
        )

@router.get("/summary")
async def get_summary_report(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get overall summary statistics for pie charts
    Returns total male/female counts across all users
    """
    _check_admin_access(current_user)
    logger.info("📊 Admin report: summary statistics")
    
    try:
        # Optimized aggregation for summary
        pipeline = [
            {"$match": {"accountStatus": "active"}},
            {"$addFields": {
                "normalizedGender": {"$toLower": {"$ifNull": ["$gender", "other"]}}
            }},
            {"$group": {
                "_id": "$normalizedGender",
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        gender_results = await db.users.aggregate(pipeline).to_list(10)
        
        # Extract counts efficiently
        gender_counts = {"male": 0, "female": 0, "other": 0}
        
        for result in gender_results:
            gender = result["_id"]
            if gender in gender_counts:
                gender_counts[gender] = result["count"]
            else:
                gender_counts["other"] += result["count"]
        
        total_count = sum(gender_counts.values())
        
        logger.info(f"📊 Summary report: {total_count} total users (M:{gender_counts['male']}, F:{gender_counts['female']}, Other:{gender_counts['other']})")
        
        return SummaryResponse(
            success=True,
            summary={
                "maleCount": gender_counts["male"],
                "femaleCount": gender_counts["female"],
                "otherCount": gender_counts["other"],
                "totalCount": total_count
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Error generating summary report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating summary report: {str(e)}"
        )

@router.get("/by-location")
async def get_by_location_report(
    gender: Optional[str] = Query(None, description="Filter by gender: male, female, or None for all"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get user count by location (city/state)
    Returns data for bar chart visualization
    """
    _check_admin_access(current_user)
    logger.info(f"📊 Admin report: by-location, filter={gender}")
    
    try:
        encryptor = get_encryptor_cached()
        
        # Build match query for gender filter
        match_query = {"accountStatus": "active"}
        if gender and gender.lower() in ["male", "female"]:
            match_query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}
        
        # Get active users with location data and optional gender filter
        users_cursor = db.users.find(
            match_query,
            {"location": 1, "gender": 1, "profileId": 1, "username": 1, "firstName": 1, "lastName": 1}
        )
        users = await users_cursor.to_list(1000)
        
        # Process locations with decrypted data
        location_groups = {}
        for user in users:
            encrypted_location = user.get("location")
            if not encrypted_location:
                continue
            
            # Decrypt location safely
            try:
                decrypted_location = encryptor.decrypt(encrypted_location)
                if not decrypted_location or decrypted_location.strip() == "":
                    continue
            except Exception as decrypt_err:
                logger.debug(f"⚠️ Could not decrypt location for user {user.get('username')}")
                continue
            
            # Initialize group if needed
            if decrypted_location not in location_groups:
                location_groups[decrypted_location] = _create_group_data()
            
            # Update counts
            _update_group_counts(location_groups[decrypted_location], user)
            
            # Add user if under limit
            if len(location_groups[decrypted_location]["users"]) < 100:
                location_groups[decrypted_location]["users"].append(
                    _create_user_summary(user)
                )
        
        # Convert to sorted list
        formatted_results = []
        for location, data in sorted(location_groups.items(), key=lambda x: x[1]["count"], reverse=True)[:50]:
            formatted_results.append({
                "location": location,
                "count": data["count"],
                "maleCount": data["maleCount"],
                "femaleCount": data["femaleCount"],
                "users": [user.dict() if hasattr(user, 'dict') else user for user in data["users"]]
            })
        
        total_count = sum(r["count"] for r in formatted_results)
        
        logger.info(f"📊 Location report generated: {len(formatted_results)} locations, {total_count} total users")
        
        return ReportResponse(
            success=True,
            filter=gender or "all",
            totalCount=total_count,
            data=formatted_results
        )
        
    except Exception as e:
        logger.error(f"❌ Error generating location report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating location report: {str(e)}"
        )

@router.get("/by-profession")
async def get_by_profession_report(
    gender: Optional[str] = Query(None, description="Filter by gender: male, female, or None for all"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get user count by profession with grouping
    Returns data for bar chart visualization
    """
    _check_admin_access(current_user)
    logger.info(f"📊 Admin report: by-profession, filter={gender}")
    
    try:
        # Build match query for gender filter
        match_query = {"accountStatus": "active"}
        if gender and gender.lower() in ["male", "female"]:
            match_query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}
        
        # Get users with profession data and optional gender filter
        users_cursor = db.users.find(
            match_query,
            {"occupation": 1, "workExperience": 1, "gender": 1, "profileId": 1, "username": 1, "firstName": 1, "lastName": 1}
        )
        users = await users_cursor.to_list(1000)
        
        # Process professions
        profession_groups = {}
        for user in users:
            # Extract profession text
            profession_text = _extract_profession_from_user(user)
            
            # Categorize profession
            profession_category = _categorize_profession(profession_text)
            
            # Initialize group if needed
            if profession_category not in profession_groups:
                profession_groups[profession_category] = _create_group_data()
            
            # Update counts
            _update_group_counts(profession_groups[profession_category], user)
            
            # Add user if under limit
            if len(profession_groups[profession_category]["users"]) < 100:
                profession_groups[profession_category]["users"].append(
                    _create_user_summary(user, occupation=profession_text)
                )
        
        # Convert to sorted list
        formatted_results = []
        for profession, data in sorted(profession_groups.items(), key=lambda x: x[1]["count"], reverse=True)[:50]:
            formatted_results.append({
                "profession": profession,
                "group": profession,
                "count": data["count"],
                "maleCount": data["maleCount"],
                "femaleCount": data["femaleCount"],
                "users": [user.dict() if hasattr(user, 'dict') else user for user in data["users"]]
            })
        
        total_count = sum(r["count"] for r in formatted_results)
        
        logger.info(f"📊 Profession report generated: {len(formatted_results)} professions, {total_count} total users")
        
        return ReportResponse(
            success=True,
            filter=gender or "all",
            totalCount=total_count,
            data=formatted_results
        )
        
    except Exception as e:
        logger.error(f"❌ Error generating profession report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating profession report: {str(e)}"
        )
