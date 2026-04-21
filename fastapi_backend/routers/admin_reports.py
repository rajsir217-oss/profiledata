"""
Admin Reports API - Ultra-Optimized version
Gender by Age distribution and other analytics
Admin-only endpoints for viewing user statistics
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, Dict, List, Any, Tuple
from datetime import datetime
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from pydantic import BaseModel
import logging
import re
import json
from functools import lru_cache
from collections import defaultdict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/reports", tags=["admin-reports"])

# Constants
MAX_USERS_PER_QUERY = 1000
MAX_USERS_PER_GROUP = 100
MAX_RESULTS_PER_REPORT = 50
MIN_AGE = 18
MAX_AGE = 79

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

def _build_gender_filter(gender: Optional[str]) -> Dict[str, Any]:
    """Build MongoDB gender filter query"""
    match_query = {"accountStatus": "active"}
    if gender and gender.lower() in ["male", "female"]:
        match_query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}
    return match_query

def _safe_gender_count(user: dict) -> Tuple[str, int]:
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
        "gender": user.get("gender") or None
    }
    base_data.update(extra_fields)
    return UserSummary(**base_data)

def _get_age_group_math(age: int) -> Optional[Tuple[int, str]]:
    """Mathematical age group calculation - O(1) complexity"""
    if age < MIN_AGE or age > MAX_AGE:
        return None
    
    # Special case for 18-19 (2-year group)
    if age <= 19:
        return (18, "18-19")
    
    # For ages 20+, use 3-year groups starting at 20
    if age >= 20:
        group_start = ((age - 20) // 3) * 3 + 20
        group_end = min(group_start + 2, MAX_AGE)
        return (group_start, f"{group_start}-{group_end}")
    
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

def _add_user_to_group(group: Dict[str, Any], user: dict, **extra_fields):
    """Add user to group if under limit"""
    if len(group["users"]) < MAX_USERS_PER_GROUP:
        group["users"].append(_create_user_summary(user, **extra_fields))

def _format_group_results(groups: Dict[str, Dict[str, Any]], 
                         key_field: str, 
                         additional_fields: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Format group results consistently across all reports"""
    formatted_results = []
    additional_fields = additional_fields or {}
    
    for key, data in sorted(groups.items(), key=lambda x: x[1]["count"], reverse=True)[:MAX_RESULTS_PER_REPORT]:
        result = {
            key_field: key,
            "count": data["count"],
            "maleCount": data["maleCount"],
            "femaleCount": data["femaleCount"],
            "users": [user.dict() if hasattr(user, 'dict') else user for user in data["users"]]
        }
        result.update(additional_fields)
        formatted_results.append(result)
    
    return formatted_results

def _process_users_by_category(users: List[Dict[str, Any]], 
                               category_extractor: callable,
                               category_key: str,
                               **extra_fields) -> Dict[str, Dict[str, Any]]:
    """Process users and group them by category with unified logic"""
    groups = defaultdict(_create_group_data)
    
    for user in users:
        try:
            # Extract category
            category = category_extractor(user)
            
            # Update counts
            _update_group_counts(groups[category], user)
            
            # Add user if under limit
            _add_user_to_group(groups[category], user, **extra_fields)
            
        except Exception as e:
            logger.debug(f"Error processing user {user.get('username')}: {e}")
            continue
    
    return dict(groups)

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
        match_query = _build_gender_filter(gender)
        
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
            {"$match": {"calculatedAge": {"$ne": None, "$gte": MIN_AGE, "$lte": 100}}},
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
        
        # Group into age ranges efficiently using mathematical approach
        age_groups = defaultdict(_create_group_data)
        
        for result in individual_ages:
            age = result["_id"]
            age_group = _get_age_group_math(age)
            
            if not age_group:
                continue
            
            group_id, range_label = age_group
            
            # Initialize group with age-specific data
            if group_id not in age_groups:
                age_groups[group_id].update({
                    "ageGroup": group_id,
                    "ageRange": range_label
                })
            
            # Update counts
            age_groups[group_id]["count"] += result["count"]
            age_groups[group_id]["maleCount"] += result["maleCount"]
            age_groups[group_id]["femaleCount"] += result["femaleCount"]
            
            # Add users (with limit)
            remaining_slots = MAX_USERS_PER_GROUP - len(age_groups[group_id]["users"])
            if remaining_slots > 0:
                age_groups[group_id]["users"].extend(result["users"][:remaining_slots])
        
        # Convert to sorted list
        grouped_results = []
        for group_id in sorted(age_groups.keys()):
            grouped_results.append(dict(age_groups[group_id]))
        
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
        match_query = _build_gender_filter(gender)
        
        # Get active users with location data and optional gender filter
        users_cursor = db.users.find(
            match_query,
            {"location": 1, "gender": 1, "profileId": 1, "username": 1, "firstName": 1, "lastName": 1}
        )
        users = await users_cursor.to_list(MAX_USERS_PER_QUERY)
        
        def extract_location(user: dict) -> str:
            """Extract and decrypt location from user"""
            encrypted_location = user.get("location")
            if not encrypted_location:
                return "Unknown"
            
            try:
                decrypted_location = encryptor.decrypt(encrypted_location)
                if not decrypted_location or decrypted_location.strip() == "":
                    return "Unknown"
                return decrypted_location
            except Exception as decrypt_err:
                logger.debug(f"⚠️ Could not decrypt location for user {user.get('username')}")
                return "Unknown"
        
        # Process users by location
        location_groups = _process_users_by_category(
            users, 
            extract_location, 
            "location"
        )
        
        # Remove "Unknown" location if present
        location_groups.pop("Unknown", None)
        
        # Format results
        formatted_results = _format_group_results(location_groups, "location")
        
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
        match_query = _build_gender_filter(gender)
        
        # Get users with profession data and optional gender filter
        users_cursor = db.users.find(
            match_query,
            {"occupation": 1, "workExperience": 1, "gender": 1, "profileId": 1, "username": 1, "firstName": 1, "lastName": 1}
        )
        users = await users_cursor.to_list(MAX_USERS_PER_QUERY)
        
        def extract_profession(user: dict) -> str:
            """Extract and categorize profession from user"""
            profession_text = _extract_profession_from_user(user)
            return _categorize_profession(profession_text)
        
        # Process users by profession
        profession_groups = _process_users_by_category(
            users, 
            extract_profession, 
            "profession",
            occupation=_extract_profession_from_user
        )
        
        # Format results with additional fields
        formatted_results = _format_group_results(
            profession_groups, 
            "profession", 
            {"group": lambda x: x}  # Add group field same as profession
        )
        
        # Update group field to match profession
        for result in formatted_results:
            result["group"] = result["profession"]
        
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


# Month labels for formatting periodLabel
_MONTH_LABELS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]


@router.get("/member-acquisition")
async def get_member_acquisition_report(
    gender: Optional[str] = Query(None, description="Filter by gender: male, female, or None for all"),
    year: Optional[int] = Query(None, description="Filter by approval year; omit for all years"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get user count by month of admin approval (adminApprovedAt), grouped by month,
    with optional gender and year filters. Returns data for horizontal bar chart.
    """
    _check_admin_access(current_user)
    logger.info(f"📊 Admin report: member-acquisition, gender={gender}, year={year}")

    try:
        match_query: Dict[str, Any] = {
            "accountStatus": "active",
            "adminApprovedAt": {"$exists": True, "$nin": [None, ""]}
        }
        if gender and gender.lower() in ["male", "female"]:
            match_query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}

        # Coerce adminApprovedAt (ISO string or datetime) into a Date, then group by year/month.
        pipeline: List[Dict[str, Any]] = [
            {"$match": match_query},
            {"$addFields": {
                "approvedDateParsed": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$adminApprovedAt"}, "date"]},
                        "then": "$adminApprovedAt",
                        "else": {
                            "$dateFromString": {
                                "dateString": {"$toString": "$adminApprovedAt"},
                                "onError": None,
                                "onNull": None
                            }
                        }
                    }
                },
                "normalizedGender": {"$toLower": {"$ifNull": ["$gender", "other"]}}
            }},
            {"$match": {"approvedDateParsed": {"$ne": None}}},
            {"$addFields": {
                "approvedYear": {"$year": "$approvedDateParsed"},
                "approvedMonth": {"$month": "$approvedDateParsed"}
            }}
        ]

        if year is not None:
            pipeline.append({"$match": {"approvedYear": year}})

        pipeline += [
            {"$group": {
                "_id": {"year": "$approvedYear", "month": "$approvedMonth"},
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
            {"$sort": {"_id.year": 1, "_id.month": 1}},
            {"$limit": 240}
        ]

        raw_results = await db.users.aggregate(pipeline).to_list(240)

        formatted_results = []
        for item in raw_results:
            key = item["_id"] or {}
            y = key.get("year")
            m = key.get("month")
            if not y or not m or m < 1 or m > 12:
                continue
            period = f"{y:04d}-{m:02d}"
            period_label = f"{_MONTH_LABELS[m]} {y}"
            formatted_results.append({
                "period": period,
                "periodLabel": period_label,
                "year": y,
                "month": m,
                "count": item.get("count", 0),
                "maleCount": item.get("maleCount", 0),
                "femaleCount": item.get("femaleCount", 0),
                "users": (item.get("users") or [])[:100]
            })

        total_count = sum(r["count"] for r in formatted_results)
        filter_desc = f"{gender or 'all'}|year={year if year is not None else 'all'}"

        logger.info(
            f"📊 Member acquisition report: {len(formatted_results)} months, "
            f"{total_count} users (filter={filter_desc})"
        )

        return ReportResponse(
            success=True,
            filter=filter_desc,
            totalCount=total_count,
            data=formatted_results
        )

    except Exception as e:
        logger.error(f"❌ Error generating member acquisition report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating member acquisition report: {str(e)}"
        )


@router.get("/member-acquisition/years")
async def get_member_acquisition_years(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get distinct years in which members were admin-approved.
    Used to populate the Year filter dropdown on the Member Acquisition report.
    """
    _check_admin_access(current_user)

    try:
        pipeline = [
            {"$match": {
                "accountStatus": "active",
                "adminApprovedAt": {"$exists": True, "$nin": [None, ""]}
            }},
            {"$addFields": {
                "approvedDateParsed": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$adminApprovedAt"}, "date"]},
                        "then": "$adminApprovedAt",
                        "else": {
                            "$dateFromString": {
                                "dateString": {"$toString": "$adminApprovedAt"},
                                "onError": None,
                                "onNull": None
                            }
                        }
                    }
                }
            }},
            {"$match": {"approvedDateParsed": {"$ne": None}}},
            {"$group": {"_id": {"$year": "$approvedDateParsed"}}},
            {"$sort": {"_id": -1}}
        ]

        raw = await db.users.aggregate(pipeline).to_list(50)
        years = [item["_id"] for item in raw if item.get("_id")]

        return {"success": True, "years": years}

    except Exception as e:
        logger.error(f"❌ Error fetching member acquisition years: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching member acquisition years: {str(e)}"
        )
