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
    Get user count by 3-year age groups (18-19, 20-22, 23-25, etc.), optionally filtered by gender.
    Returns data for bar chart visualization with age ranges.
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
    
    # Aggregation pipeline to calculate age and group by 3-year intervals
    pipeline = [
        {"$match": match_query},
        # Calculate age from birthYear and birthMonth
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
            # Normalize gender to lowercase for consistent grouping
            "normalizedGender": {"$toLower": {"$ifNull": ["$gender", "other"]}}
        }},
        # Filter out users without valid age
        {"$match": {"calculatedAge": {"$ne": None, "$gte": 18, "$lte": 100}}},
        # Group by individual age first (we'll group into 3-year intervals in Python)
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
        # Sort by age
        {"$sort": {"_id": 1}},
        {"$limit": 100}
    ]
    
    try:
        # Get individual age data first
        individual_ages = await db.users.aggregate(pipeline).to_list(100)
        
        # Group into 3-year intervals in Python
        age_groups = {}
        for result in individual_ages:
            age = result["_id"]
            count = result["count"]
            male_count = result["maleCount"]
            female_count = result["femaleCount"]
            users = result["users"]
            
            # Determine 3-year group
            if age <= 19:
                group = 18
                range_label = "18-19"
            elif age <= 22:
                group = 20
                range_label = "20-22"
            elif age <= 25:
                group = 23
                range_label = "23-25"
            elif age <= 28:
                group = 26
                range_label = "26-28"
            elif age <= 31:
                group = 29
                range_label = "29-31"
            elif age <= 34:
                group = 32
                range_label = "32-34"
            elif age <= 37:
                group = 35
                range_label = "35-37"
            elif age <= 40:
                group = 38
                range_label = "38-40"
            elif age <= 43:
                group = 41
                range_label = "41-43"
            elif age <= 46:
                group = 44
                range_label = "44-46"
            elif age <= 49:
                group = 47
                range_label = "47-49"
            elif age <= 52:
                group = 50
                range_label = "50-52"
            elif age <= 55:
                group = 53
                range_label = "53-55"
            elif age <= 58:
                group = 56
                range_label = "56-58"
            elif age <= 61:
                group = 59
                range_label = "59-61"
            elif age <= 64:
                group = 62
                range_label = "62-64"
            elif age <= 67:
                group = 65
                range_label = "65-67"
            elif age <= 70:
                group = 68
                range_label = "68-70"
            elif age <= 73:
                group = 71
                range_label = "71-73"
            elif age <= 76:
                group = 74
                range_label = "74-76"
            elif age <= 79:
                group = 77
                range_label = "77-79"
            else:
                continue  # Skip ages outside our range
            
            if group not in age_groups:
                age_groups[group] = {
                    "ageGroup": group,
                    "ageRange": range_label,
                    "count": 0,
                    "maleCount": 0,
                    "femaleCount": 0,
                    "users": []
                }
            
            age_groups[group]["count"] += count
            age_groups[group]["maleCount"] += male_count
            age_groups[group]["femaleCount"] += female_count
            age_groups[group]["users"].extend(users)
        
        # Convert to sorted list and limit users per group
        grouped_results = []
        for group in sorted(age_groups.keys()):
            group_data = age_groups[group]
            # Limit users to 100 per group
            group_data["users"] = group_data["users"][:100]
            grouped_results.append(group_data)
        
        # Calculate totals
        total_count = sum(r["count"] for r in grouped_results)
        
        logger.info(f"📊 Age distribution report generated: {len(grouped_results)} age groups (3-year intervals), {total_count} total users")
        
        return {
            "success": True,
            "filter": gender or "all",
            "totalCount": total_count,
            "data": grouped_results
        }
    except Exception as e:
        logger.error(f"❌ Error generating report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating report: {str(e)}"
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
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    logger.info("📊 Admin report: summary statistics")
    
    try:
        # Get overall gender statistics
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
        
        # Extract male and female counts
        male_count = 0
        female_count = 0
        other_count = 0
        
        for result in gender_results:
            gender = result["_id"]
            count = result["count"]
            if gender == "male":
                male_count = count
            elif gender == "female":
                female_count = count
            else:
                other_count += count
        
        total_count = male_count + female_count + other_count
        
        logger.info(f"📊 Summary report: {total_count} total users (M:{male_count}, F:{female_count}, Other:{other_count})")
        
        return {
            "success": True,
            "summary": {
                "maleCount": male_count,
                "femaleCount": female_count,
                "otherCount": other_count,
                "totalCount": total_count
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating summary report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating summary report: {str(e)}"
        )


@router.get("/by-location")
async def get_by_location_report(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get user count by location (city/state)
    Returns data for bar chart visualization
    """
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    logger.info("📊 Admin report: by-location")
    
    try:
        # Initialize encryptor for decryption
        from crypto_utils import get_encryptor
        encryptor = get_encryptor()
        
        # Get all active users with location data
        users_cursor = db.users.find(
            {"accountStatus": "active"},
            {"location": 1, "gender": 1, "profileId": 1, "username": 1, "firstName": 1, "lastName": 1}
        )
        users = await users_cursor.to_list(1000)
        
        # Decrypt locations and group them
        location_groups = {}
        for user in users:
            encrypted_location = user.get("location")
            if not encrypted_location:
                continue
                
            # Decrypt location
            try:
                decrypted_location = encryptor.decrypt(encrypted_location)
                if not decrypted_location or decrypted_location.strip() == "":
                    continue
            except Exception as decrypt_err:
                logger.debug(f"⚠️ Could not decrypt location for user {user.get('username')}: {decrypt_err}")
                continue
            
            # Group by location
            if decrypted_location not in location_groups:
                location_groups[decrypted_location] = {
                    "count": 0,
                    "maleCount": 0,
                    "femaleCount": 0,
                    "users": []
                }
            
            # Update counts
            location_groups[decrypted_location]["count"] += 1
            gender = user.get("gender", "").lower()
            if gender == "male":
                location_groups[decrypted_location]["maleCount"] += 1
            elif gender == "female":
                location_groups[decrypted_location]["femaleCount"] += 1
            
            # Add user to list (limit to 100 per location)
            if len(location_groups[decrypted_location]["users"]) < 100:
                location_groups[decrypted_location]["users"].append({
                    "profileId": user.get("profileId"),
                    "username": user.get("username"),
                    "firstName": user.get("firstName"),
                    "lastName": user.get("lastName"),
                    "gender": user.get("gender")
                })
        
        # Convert to sorted list
        formatted_results = []
        for location, data in sorted(location_groups.items(), key=lambda x: x[1]["count"], reverse=True)[:50]:
            formatted_results.append({
                "location": location,
                "count": data["count"],
                "maleCount": data["maleCount"],
                "femaleCount": data["femaleCount"],
                "users": data["users"]
            })
        
        total_count = sum(r["count"] for r in formatted_results)
        
        logger.info(f"📊 Location report generated: {len(formatted_results)} locations (decrypted), {total_count} total users")
        
        return {
            "success": True,
            "filter": "all",
            "totalCount": total_count,
            "data": formatted_results
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating location report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating location report: {str(e)}"
        )


@router.get("/by-profession")
async def get_by_profession_report(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get user count by profession with grouping
    Returns data for bar chart visualization
    """
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    logger.info("📊 Admin report: by-profession")
    
    try:
        # Get profession statistics using occupation and workExperience fields
        users_cursor = db.users.find(
            {"accountStatus": "active"},
            {"occupation": 1, "workExperience": 1, "gender": 1, "profileId": 1, "username": 1, "firstName": 1, "lastName": 1}
        )
        users = await users_cursor.to_list(1000)
        
        # Process each user to extract profession
        profession_groups = {}
        for user in users:
            # Get profession from occupation field first
            profession_text = user.get("occupation", "")
            
            # If no occupation, try to get from workExperience array
            if not profession_text:
                work_experience = user.get("workExperience", [])
                if work_experience and len(work_experience) > 0:
                    # workExperience is a JSON string, try to parse it
                    try:
                        import json
                        if isinstance(work_experience, str):
                            work_exp = json.loads(work_experience)
                        else:
                            work_exp = work_experience
                        
                        if work_exp and len(work_exp) > 0:
                            first_job = work_exp[0]
                            profession_text = first_job.get("position", "") or first_job.get("description", "") or first_job.get("company", "")
                            # Ensure profession_text is a string, not None
                            if profession_text is None:
                                profession_text = ""
                    except Exception as e:
                        logger.debug(f"Error parsing workExperience for user {user.get('username')}: {e}")
                        profession_text = ""
            
            if not profession_text or profession_text is None or profession_text.strip() == "":
                profession_text = "Other"
            
            # Categorize profession using regex patterns
            profession_lower = str(profession_text).lower()
            profession_category = "Other"
            
            import re
            if re.search(r"doctor|physician|medical|surgeon|pediatrician|dentist|optometrist|anesthesia|residency|fellowship", profession_lower):
                profession_category = "Physicians & Doctors"
            elif re.search(r"software|developer|programmer|tech|biotech", profession_lower):
                profession_category = "Technology & Software"
            elif re.search(r"it|support|system|network|admin|information technology", profession_lower):
                profession_category = "IT & Infrastructure"
            elif re.search(r"data|analyst|science|analytics|research scientist|quant", profession_lower):
                profession_category = "Data & Analytics"
            elif re.search(r"manager|management|lead|director|vice president|relationship manager", profession_lower):
                profession_category = "Management & Leadership"
            elif re.search(r"consultant|consulting|advisor", profession_lower):
                profession_category = "Consulting"
            elif re.search(r"engineer|engineering|mechanical|civil|product manager", profession_lower):
                profession_category = "Engineering"
            elif re.search(r"teacher|professor|education|academic|student|medical student", profession_lower):
                profession_category = "Education"
            elif re.search(r"sales|marketing|business|revenue|human resources|hr", profession_lower):
                profession_category = "Sales & Marketing"
            elif re.search(r"finance|financial|accounting|banking", profession_lower):
                profession_category = "Finance & Accounting"
            elif re.search(r"legal|lawyer|attorney|paralegal", profession_lower):
                profession_category = "Legal"
            elif re.search(r"nurse|healthcare|pharmacist|physical therapy|therapy|patient|optometrist", profession_lower):
                profession_category = "Healthcare"
            elif re.search(r"design|creative|artist|writer|marketing", profession_lower):
                profession_category = "Creative & Design"
            elif re.search(r"transportation|dept of transportation|non profit", profession_lower):
                profession_category = "Other Services"
            
            # Group by profession category
            if profession_category not in profession_groups:
                profession_groups[profession_category] = {
                    "count": 0,
                    "maleCount": 0,
                    "femaleCount": 0,
                    "users": []
                }
            
            # Update counts
            profession_groups[profession_category]["count"] += 1
            gender = str(user.get("gender", "")).lower()
            if gender == "male":
                profession_groups[profession_category]["maleCount"] += 1
            elif gender == "female":
                profession_groups[profession_category]["femaleCount"] += 1
            
            # Add user to list (limit to 100 per profession)
            if len(profession_groups[profession_category]["users"]) < 100:
                profession_groups[profession_category]["users"].append({
                    "profileId": user.get("profileId"),
                    "username": user.get("username"),
                    "firstName": user.get("firstName"),
                    "lastName": user.get("lastName"),
                    "gender": user.get("gender"),
                    "occupation": profession_text
                })
        
        # Convert to sorted list
        results = []
        for profession, data in sorted(profession_groups.items(), key=lambda x: x[1]["count"], reverse=True)[:50]:
            results.append({
                "_id": profession,
                "profession": profession,
                "group": profession,
                "count": data["count"],
                "maleCount": data["maleCount"],
                "femaleCount": data["femaleCount"],
                "users": data["users"]
            })
        
        # Results are already formatted
        formatted_results = results
        
        total_count = sum(r["count"] for r in formatted_results)
        
        logger.info(f"📊 Profession report generated: {len(formatted_results)} professions, {total_count} total users")
        
        return {
            "success": True,
            "filter": "all",
            "totalCount": total_count,
            "data": formatted_results
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating profession report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating profession report: {str(e)}"
        )
