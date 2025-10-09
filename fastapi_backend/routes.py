# fastapi_backend/routes.py
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends, Request, Query
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import datetime, timedelta
from models import (
    UserCreate, UserResponse, LoginRequest, Token, 
    MessageCreate, ConversationResponse, ProfileViewCreate,
    PIIRequest, PIIRequestCreate, PIIRequestResponse, 
    PIIAccess, PIIAccessCreate
)
from database import get_database
from utils import save_multiple_files, get_full_image_url
from config import settings
from auth.password_utils import PasswordManager
from auth.jwt_auth import JWTManager

# Compatibility aliases for old code
def get_password_hash(password: str) -> str:
    return PasswordManager.hash_password(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return PasswordManager.verify_password(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta=None) -> str:
    return JWTManager.create_access_token(data, expires_delta)
import logging

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger(__name__)

# Helper function to safely serialize datetime
def safe_datetime_serialize(dt):
    """Safely serialize datetime to ISO format string"""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    if isinstance(dt, str):
        return dt  # Already a string
    return str(dt)

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    username: str = Form(...),
    password: str = Form(...),
    firstName: Optional[str] = Form(None),
    lastName: Optional[str] = Form(None),
    contactNumber: Optional[str] = Form(None),
    contactEmail: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    sex: Optional[str] = Form(None),
    height: Optional[str] = Form(None),
    castePreference: Optional[str] = Form(None),
    eatingPreference: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    education: Optional[str] = Form(None),
    workingStatus: Optional[str] = Form(None),
    workplace: Optional[str] = Form(None),
    citizenshipStatus: Optional[str] = Form("Citizen"),
    familyBackground: Optional[str] = Form(None),
    aboutYou: Optional[str] = Form(None),
    partnerPreference: Optional[str] = Form(None),
    # New dating-app specific fields
    relationshipStatus: Optional[str] = Form(None),
    lookingFor: Optional[str] = Form(None),
    interests: Optional[str] = Form(None),
    languages: Optional[str] = Form(None),
    drinking: Optional[str] = Form(None),
    smoking: Optional[str] = Form(None),
    religion: Optional[str] = Form(None),
    bodyType: Optional[str] = Form(None),
    occupation: Optional[str] = Form(None),
    incomeRange: Optional[str] = Form(None),
    hasChildren: Optional[str] = Form(None),
    wantsChildren: Optional[str] = Form(None),
    pets: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    db = Depends(get_database)
):
    """Register a new user with profile details and images"""
    logger.info(f"📝 Registration attempt for username: {username}")
    logger.debug(f"Registration data - Email: {contactEmail}, Name: {firstName} {lastName}")
    
    # Validate username length
    if len(username) < 3:
        logger.warning(f"⚠️ Registration failed: Username '{username}' too short")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long"
        )
    
    # Validate password length
    if len(password) < 6:
        logger.warning(f"⚠️ Registration failed: Password too short for user '{username}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )
    
    # Check if username already exists
    logger.debug(f"Checking if username '{username}' exists...")
    existing_user = await db.users.find_one({"username": username})
    if existing_user:
        logger.warning(f"⚠️ Registration failed: Username '{username}' already exists")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists"
        )
    
    # Check if email already exists
    if contactEmail:
        logger.debug(f"Checking if email '{contactEmail}' exists...")
        existing_email = await db.users.find_one({"contactEmail": contactEmail})
        if existing_email:
            logger.warning(f"⚠️ Registration failed: Email '{contactEmail}' already registered")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
    
    # Validate and save images
    image_paths = []
    if images and len(images) > 0:
        logger.info(f"📸 Processing {len(images)} image(s) for user '{username}'")
        if len(images) > 5:
            logger.warning(f"⚠️ Registration failed: User '{username}' tried to upload {len(images)} images (max 5)")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 5 images allowed"
            )
        try:
            image_paths = await save_multiple_files(images)
            logger.info(f"✅ Successfully saved {len(image_paths)} image(s) for user '{username}'")
        except Exception as e:
            logger.error(f"❌ Error saving images for user '{username}': {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save images: {str(e)}"
            )
    
    # Hash password
    logger.debug(f"Hashing password for user '{username}'")
    hashed_password = get_password_hash(password)
    
    # Create user document
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    
    user_data = {
        "username": username,
        "password": hashed_password,
        "firstName": firstName,
        "lastName": lastName,
        "contactNumber": contactNumber,
        "contactEmail": contactEmail,
        "dob": dob,
        "sex": sex,
        "height": height,
        "castePreference": castePreference,
        "eatingPreference": eatingPreference,
        "location": location,
        "education": education,
        "workingStatus": workingStatus,
        "workplace": workplace,
        "citizenshipStatus": citizenshipStatus,
        "familyBackground": familyBackground,
        "aboutYou": aboutYou,
        "partnerPreference": partnerPreference,
        # New dating-app fields
        "relationshipStatus": relationshipStatus,
        "lookingFor": lookingFor,
        "interests": interests,
        "languages": languages,
        "drinking": drinking,
        "smoking": smoking,
        "religion": religion,
        "bodyType": bodyType,
        "occupation": occupation,
        "incomeRange": incomeRange,
        "hasChildren": hasChildren,
        "wantsChildren": wantsChildren,
        "pets": pets,
        "bio": bio,
        "images": image_paths,
        "createdAt": now,
        "updatedAt": now,
        # User account status (pending activation by admin)
        "status": {
            "status": "pending",  # pending, active, suspended, banned
            "reason": None,
            "updatedAt": now,
            "updatedBy": None
        },
        # Messaging stats (initialized to 0)
        "messagesSent": 0,
        "messagesReceived": 0,
        "pendingReplies": 0
    }
    
    # Insert into database
    try:
        logger.info(f"💾 Inserting user '{username}' into database...")
        result = await db.users.insert_one(user_data)
        logger.info(f"✅ User '{username}' successfully registered with ID: {result.inserted_id}")
    except Exception as e:
        logger.error(f"❌ Database insert error for user '{username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )
    
    # Get the created user
    created_user = await db.users.find_one({"_id": result.inserted_id})
    
    # Remove password from response
    created_user.pop("password", None)
    created_user.pop("_id", None)
    
    # Convert image paths to full URLs
    created_user["images"] = [get_full_image_url(img) for img in created_user.get("images", [])]
    
    return {
        "message": "User registered successfully",
        "user": created_user
    }

@router.post("/login")
async def login_user(login_data: LoginRequest, db = Depends(get_database)):
    """Login user and return access token"""
    logger.info(f"🔑 Login attempt for username: {login_data.username}")
    
    # Special handling for hardcoded admin account
    if login_data.username == "admin":
        logger.info("🔐 Admin login attempt detected")
        
        # Check hardcoded admin password
        # In production, this should be stored securely in environment variables
        ADMIN_PASSWORD = "admin"  # Hardcoded admin password
        
        if login_data.password == ADMIN_PASSWORD:
            logger.info("✅ Admin login successful (hardcoded credentials)")
            
            # Create access token
            access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
            access_token = create_access_token(
                data={"sub": "admin"}, expires_delta=access_token_expires
            )
            
            # Return admin user data
            return {
                "message": "Admin login successful",
                "user": {
                    "username": "admin",
                    "firstName": "Admin",
                    "lastName": "User",
                    "contactEmail": "admin@system.com",
                    "role": "admin"
                },
                "access_token": access_token,
                "token_type": "bearer"
            }
        else:
            logger.warning("⚠️ Admin login failed: Invalid password")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid credentials"
            )
    
    # Regular user login)
    
    # Find user
    logger.debug(f"Looking up user '{login_data.username}' in database...")
    user = await db.users.find_one({"username": login_data.username})
    if not user:
        logger.warning(f"⚠️ Login failed: Username '{login_data.username}' not found")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credentials"
        )
    
    # Verify password
    logger.debug(f"Verifying password for user '{login_data.username}'")
    if not verify_password(login_data.password, user["password"]):
        logger.warning(f"⚠️ Login failed: Invalid password for user '{login_data.username}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credentials"
        )
    
    # Create access token
    logger.debug(f"Creating access token for user '{login_data.username}'")
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    # Remove password and _id from response
    user.pop("password", None)
    user.pop("_id", None)
    
    # Convert image paths to full URLs
    user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
    
    logger.info(f"✅ Login successful for user '{login_data.username}'")
    return {
        "message": "Login successful",
        "user": user,
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get("/profile/{username}")
async def get_user_profile(username: str, requester: str = None, db = Depends(get_database)):
    """Get user profile by username with PII masking"""
    logger.info(f"👤 Profile request for username: {username} (requester: {requester})")
    
    # Find user
    logger.debug(f"Fetching profile for user '{username}'...")
    user = await db.users.find_one({"username": username})
    if not user:
        logger.warning(f"⚠️ Profile not found for username: {username}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Remove password and _id from response
    user.pop("password", None)
    user.pop("_id", None)
    
    # Convert image paths to full URLs
    user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
    
    # Apply PII masking if requester is not the profile owner
    from pii_security import mask_user_pii, check_access_granted
    
    access_granted = False
    if requester:
        access_granted = await check_access_granted(db, requester, username)
        logger.info(f"🔐 PII access for {requester} viewing {username}: {access_granted}")
    
    user = mask_user_pii(user, requester, access_granted)
    
    logger.info(f"✅ Profile successfully retrieved for user '{username}' (PII masked: {user.get('piiMasked', False)})")
    return user

@router.put("/profile/{username}")
async def update_user_profile(
    username: str,
    firstName: Optional[str] = Form(None),
    lastName: Optional[str] = Form(None),
    contactNumber: Optional[str] = Form(None),
    contactEmail: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    sex: Optional[str] = Form(None),
    height: Optional[str] = Form(None),
    castePreference: Optional[str] = Form(None),
    eatingPreference: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    education: Optional[str] = Form(None),
    workingStatus: Optional[str] = Form(None),
    workplace: Optional[str] = Form(None),
    citizenshipStatus: Optional[str] = Form(None),
    familyBackground: Optional[str] = Form(None),
    aboutYou: Optional[str] = Form(None),
    partnerPreference: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    db = Depends(get_database)
):
    """Update user profile"""
    logger.info(f"📝 Update request for user '{username}'")
    
    # Find user
    logger.debug(f"Looking up user '{username}' for update...")
    user = await db.users.find_one({"username": username})
    if not user:
        logger.warning(f"⚠️ Update failed: User '{username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prepare update data
    update_data = {}
    if firstName is not None:
        update_data["firstName"] = firstName
    if lastName is not None:
        update_data["lastName"] = lastName
    if contactNumber is not None:
        update_data["contactNumber"] = contactNumber
    if contactEmail is not None:
        update_data["contactEmail"] = contactEmail
    if dob is not None:
        update_data["dob"] = dob
    if sex is not None:
        update_data["sex"] = sex
    if height is not None:
        update_data["height"] = height
    if castePreference is not None:
        update_data["castePreference"] = castePreference
    if eatingPreference is not None:
        update_data["eatingPreference"] = eatingPreference
    if location is not None:
        update_data["location"] = location
    if education is not None:
        update_data["education"] = education
    if workingStatus is not None:
        update_data["workingStatus"] = workingStatus
    if workplace is not None:
        update_data["workplace"] = workplace
    if citizenshipStatus is not None:
        update_data["citizenshipStatus"] = citizenshipStatus
    if familyBackground is not None:
        update_data["familyBackground"] = familyBackground
    if aboutYou is not None:
        update_data["aboutYou"] = aboutYou
    if partnerPreference is not None:
        update_data["partnerPreference"] = partnerPreference
    
    # Handle new images
    if images and len(images) > 0:
        logger.info(f"📸 Processing {len(images)} new image(s) for user '{username}'")
        try:
            new_image_paths = await save_multiple_files(images)
            # Append new images to existing ones
            existing_images = user.get("images", [])
            update_data["images"] = existing_images + new_image_paths
            logger.info(f"✅ Added {len(new_image_paths)} new image(s)")
        except Exception as e:
            logger.error(f"❌ Error saving images: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save images: {str(e)}"
            )
    
    # Update timestamp
    from datetime import datetime
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    
    # Update in database
    try:
        logger.info(f"💾 Updating profile for user '{username}'...")
        result = await db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            logger.warning(f"⚠️ No changes made to user '{username}' profile")
        else:
            logger.info(f"✅ Profile updated successfully for user '{username}'")
        
        # Get updated user
        updated_user = await db.users.find_one({"username": username})
        updated_user.pop("password", None)
        updated_user.pop("_id", None)
        updated_user["images"] = [get_full_image_url(img) for img in updated_user.get("images", [])]
        
        return {
            "message": "Profile updated successfully",
            "user": updated_user
        }
    except Exception as e:
        logger.error(f"❌ Database update error for user '{username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
        )

@router.get("/admin/users")
async def get_all_users(db = Depends(get_database)):
    """Get all users - Admin only endpoint"""
    logger.info("🔐 Admin request: Get all users")
    
    try:
        # Fetch all users
        logger.debug("Fetching all users from database...")
        users_cursor = db.users.find({})
        users = await users_cursor.to_list(length=None)
        
        # Remove sensitive data
        for user in users:
            user.pop("password", None)
            user.pop("_id", None)
            # Convert image paths to full URLs
            user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
        
        logger.info(f"✅ Retrieved {len(users)} users for admin")
        return {
            "users": users,
            "count": len(users)
        }
    except Exception as e:
        logger.error(f"❌ Error fetching users: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}"
        )

@router.post("/admin/change-password")
async def change_admin_password(
    current_password: str = Form(...),
    new_password: str = Form(...)
):
    """Change admin password"""
    logger.info("🔐 Admin password change request")
    
    # Verify current password
    ADMIN_PASSWORD = "admin"  # Current hardcoded password
    
    if current_password != ADMIN_PASSWORD:
        logger.warning("⚠️ Admin password change failed: Invalid current password")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate new password
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long"
        )
    
    # In a real application, you would:
    # 1. Store the new password in a secure location (database, env file, secrets manager)
    # 2. Hash the password before storing
    # 3. Update the ADMIN_PASSWORD variable or configuration
    
    # For now, we'll just log it and return success
    # NOTE: This is a placeholder - you need to implement actual password storage
    logger.info(f"✅ Admin password would be changed to: {new_password}")
    logger.warning("⚠️ Password change not persisted - implement storage mechanism")
    
    return {
        "message": "Password change successful. Note: This is a demo - password not persisted across server restarts.",
        "warning": "Implement persistent storage for production use"
    }

@router.post("/access-request")
async def create_pii_access_request(
    requester: str = Form(...),
    requested_user: str = Form(...),
    message: Optional[str] = Form(None),
    db = Depends(get_database)
):
    """Create PII access request"""
    logger.info(f"🔐 Access request: {requester} → {requested_user}")
    
    from pii_security import create_access_request
    result = await create_access_request(db, requester, requested_user, message)
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    logger.info(f"✅ Access request created: {requester} → {requested_user}")
    return result

@router.get("/access-requests/{username}")
async def get_access_requests(username: str, type: str = "received"):
    """Get access requests for user (received or sent)"""
    logger.info(f"📋 Fetching {type} access requests for {username}")
    
    try:
        if type == "received":
            requests_cursor = db.access_requests.find({"requestedUserId": username})
        else:
            requests_cursor = db.access_requests.find({"requesterId": username})
        
        requests = await requests_cursor.to_list(100)
        
        for req in requests:
            req['_id'] = str(req['_id'])
        
        logger.info(f"✅ Found {len(requests)} {type} requests for {username}")
        return {"requests": requests}
    except Exception as e:
        logger.error(f"❌ Error fetching requests: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/access-request/{request_id}/respond")
async def respond_to_request(
    request_id: str,
    response: str = Form(...),
    responder: str = Form(...),
    db = Depends(get_database)
):
    """Respond to access request (approve/deny)"""
    logger.info(f"📝 Response to request {request_id}: {response} by {responder}")
    
    from pii_security import respond_to_access_request
    result = await respond_to_access_request(db, request_id, response, responder)
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    logger.info(f"✅ Request {request_id} {response} by {responder}")
    return result

@router.delete("/profile/{username}")
async def delete_user_profile(username: str, db = Depends(get_database)):
    """Delete user profile"""
    logger.info(f"🗑️ Delete request for user '{username}'")
    
    # Find user
    logger.debug(f"Looking up user '{username}' for deletion...")
    user = await db.users.find_one({"username": username})
    if not user:
        logger.warning(f"⚠️ Delete failed: User '{username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete user images from filesystem
    images = user.get("images", [])
    if images:
        logger.info(f"🗑️ Deleting {len(images)} image(s) for user '{username}'")
        import os
        from pathlib import Path
        for img_path in images:
            try:
                # Remove leading slash and construct full path
                file_path = Path(img_path.lstrip('/'))
                if file_path.exists():
                    file_path.unlink()
                    logger.debug(f"Deleted image: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete image {img_path}: {e}")
    
    # Delete user from database
    try:
        logger.info(f"💾 Deleting user '{username}' from database...")
        result = await db.users.delete_one({"username": username})
        
        if result.deleted_count == 0:
            logger.error(f"❌ Failed to delete user '{username}' from database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete profile"
            )
        
        logger.info(f"✅ User '{username}' successfully deleted")
        return {
            "message": f"Profile for user '{username}' has been permanently deleted"
        }
    except Exception as e:
        logger.error(f"❌ Database delete error for user '{username}': {e}", exc_info=True)
# Search endpoint for advanced user search
@router.get("/search")
async def search_users(
    keyword: str = "",
    gender: str = "",
    ageMin: int = 0,
    ageMax: int = 0,
    heightMin: int = 0,
    heightMax: int = 0,
    location: str = "",
    education: str = "",
    occupation: str = "",
    religion: str = "",
    caste: str = "",
    eatingPreference: str = "",
    drinking: str = "",
    smoking: str = "",
    relationshipStatus: str = "",
    bodyType: str = "",
    newlyAdded: bool = False,
    status: str = "",
    sortBy: str = "newest",
    sortOrder: str = "desc",
    page: int = 1,
    limit: int = 20,
    db = Depends(get_database)
):
    """Advanced search for users with filters"""
    logger.info(f"🔍 Search request - keyword: '{keyword}', status: '{status}', page: {page}, limit: {limit}")

    # Build query
    query = {}
    
    # Status filter - only show active users by default
    if status:
        query["status.status"] = {"$regex": f"^{status}$", "$options": "i"}
    else:
        # Default to active users only if no status specified
        query["status.status"] = {"$regex": "^active$", "$options": "i"}

    # Text search
    if keyword:
        query["$or"] = [
            {"firstName": {"$regex": keyword, "$options": "i"}},
            {"lastName": {"$regex": keyword, "$options": "i"}},
            {"username": {"$regex": keyword, "$options": "i"}},
            {"location": {"$regex": keyword, "$options": "i"}},
            {"education": {"$regex": keyword, "$options": "i"}},
            {"occupation": {"$regex": keyword, "$options": "i"}},
            {"aboutYou": {"$regex": keyword, "$options": "i"}},
            {"bio": {"$regex": keyword, "$options": "i"}},
            {"interests": {"$regex": keyword, "$options": "i"}}
        ]

    # Gender filter
    if gender:
        query["sex"] = gender

    # Age filter
    if ageMin > 0 or ageMax > 0:
        from datetime import datetime, timedelta
        now = datetime.now()

        if ageMax > 0:
            max_date = now - timedelta(days=ageMax * 365.25)
            query["dob"] = {"$lte": max_date.strftime("%Y-%m-%d")}

        if ageMin > 0:
            min_date = now - timedelta(days=ageMin * 365.25)
            if "dob" in query:
                query["dob"]["$gte"] = min_date.strftime("%Y-%m-%d")
            else:
                query["dob"] = {"$gte": min_date.strftime("%Y-%m-%d")}

    # Height filter
    if heightMin > 0 or heightMax > 0:
        height_query = {}
        if heightMin > 0:
            height_query["$gte"] = heightMin
        if heightMax > 0:
            height_query["$lte"] = heightMax
        query["height"] = height_query

    # Other filters
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if education:
        query["education"] = education
    if occupation:
        query["occupation"] = occupation
    if religion:
        query["religion"] = religion
    if caste:
        query["castePreference"] = caste
    if eatingPreference:
        query["eatingPreference"] = eatingPreference
    if drinking:
        query["drinking"] = drinking
    if smoking:
        query["smoking"] = smoking
    if relationshipStatus:
        query["relationshipStatus"] = relationshipStatus
    if bodyType:
        query["bodyType"] = bodyType

    # Newly added filter (last 7 days)
    if newlyAdded:
        from datetime import datetime, timedelta
        seven_days_ago = datetime.now() - timedelta(days=7)
        query["createdAt"] = {"$gte": seven_days_ago.isoformat()}

    # Sort options
    sort_options = {
        "newest": [("createdAt", -1)],
        "oldest": [("createdAt", 1)],
        "name": [("firstName", 1)],
        "age": [("dob", -1)],
        "location": [("location", 1)]
    }

    sort = sort_options.get(sortBy, sort_options["newest"])
    if sortOrder == "asc":
        sort = [(field, 1) if direction == -1 else (field, -1) for field, direction in sort]

    # Calculate skip for pagination
    skip = (page - 1) * limit

    try:
        # Execute search
        logger.info(f"🔍 Executing search with query: {query}")
        users_cursor = db.users.find(query).sort(sort).skip(skip).limit(limit)
        users = await users_cursor.to_list(length=limit)

        # Get total count for pagination
        total = await db.users.count_documents(query)

        # Remove sensitive data
        for user in users:
            user.pop("password", None)
            user.pop("_id", None)
            user["images"] = [get_full_image_url(img) for img in user.get("images", [])]

        logger.info(f"✅ Search completed - found {len(users)} users (total: {total})")
        return {
            "users": users,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"❌ Search execution error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

# Saved searches endpoints
@router.get("/{username}/saved-searches")
async def get_saved_searches(username: str, db = Depends(get_database)):
    """Get user's saved searches"""
    logger.info(f"📋 Getting saved searches for user '{username}'")

    try:
        # Find user to verify existence
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get saved searches for this user
        searches_cursor = db.saved_searches.find({"username": username}).sort("createdAt", -1)
        searches = await searches_cursor.to_list(length=None)

        for search in searches:
            search["id"] = str(search.pop("_id", ""))

        logger.info(f"✅ Retrieved {len(searches)} saved searches for user '{username}'")
        return {
            "savedSearches": searches,
            "count": len(searches)
        }
    except Exception as e:
        logger.error(f"❌ Error fetching saved searches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{username}/saved-searches")
async def save_search(username: str, search_data: dict, db = Depends(get_database)):
    """Save a search for future use"""
    logger.info(f"💾 Saving search for user '{username}': {search_data.get('name', 'unnamed')}")

    try:
        # Find user to verify existence
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Create saved search document
        from datetime import datetime
        saved_search = {
            "username": username,
            "name": search_data["name"],
            "criteria": search_data["criteria"],
            "createdAt": datetime.utcnow().isoformat()
        }

        # Insert into database
        result = await db.saved_searches.insert_one(saved_search)
        saved_search["id"] = str(result.inserted_id)
        saved_search.pop("_id", None)

        logger.info(f"✅ Saved search '{search_data.get('name')}' for user '{username}'")
        return {
            "message": "Search saved successfully",
            "savedSearch": saved_search
        }
    except Exception as e:
        logger.error(f"❌ Error saving search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{username}/saved-searches/{search_id}")
async def delete_saved_search(username: str, search_id: str, db = Depends(get_database)):
    """Delete a saved search"""
    logger.info(f"🗑️ Deleting saved search {search_id} for user '{username}'")

    try:
        from bson import ObjectId
        # Find and delete the saved search
        result = await db.saved_searches.delete_one({
            "_id": ObjectId(search_id),
            "username": username
        })

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Saved search not found")

        logger.info(f"✅ Deleted saved search {search_id} for user '{username}'")
        return {
            "message": "Saved search deleted successfully"
        }
    except Exception as e:
        logger.error(f"❌ Error deleting saved search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ===== PII REQUEST SYSTEM =====

@router.post("/pii-request")
async def create_pii_request(
    requester: str = Form(...),
    requested_user: str = Form(...),
    request_type: str = Form(...),  # "contact_info" or "images"
    message: Optional[str] = Form(None),
    db = Depends(get_database)
):
    """Create a PII access request"""
    logger.info(f"🔐 PII request: {requester} → {requested_user} ({request_type})")

    # Check if request already exists and is pending
    existing_request = await db.pii_requests.find_one({
        "requesterUsername": requester,
        "requestedUsername": requested_user,
        "requestType": request_type,
        "status": "pending"
    })

    if existing_request:
        logger.warning(f"⚠️ Duplicate PII request: {requester} → {requested_user}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pending request already exists"
        )

    # Create PII request
    pii_request = {
        "requesterUsername": requester,
        "requestedUsername": requested_user,
        "requestType": request_type,
        "message": message,
        "status": "pending",
        "createdAt": datetime.utcnow().isoformat()
    }

    try:
        result = await db.pii_requests.insert_one(pii_request)
        logger.info(f"✅ PII request created: {requester} → {requested_user}")
        return {"message": "PII request sent successfully", "requestId": str(result.inserted_id)}
    except Exception as e:
        logger.error(f"❌ Error creating PII request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pii-requests/{username}")
async def get_pii_requests(username: str, type: str = "received", db = Depends(get_database)):
    """Get PII requests for user (received or sent)"""
    logger.info(f"📋 Fetching {type} PII requests for {username}")

    try:
        if type == "received":
            requests_cursor = db.pii_requests.find({"requestedUsername": username})
        else:
            requests_cursor = db.pii_requests.find({"requesterUsername": username})

        requests = await requests_cursor.to_list(100)

        for req in requests:
            req['id'] = str(req.pop('_id', ''))

        logger.info(f"✅ Found {len(requests)} {type} PII requests for {username}")
        return {"requests": requests}
    except Exception as e:
        logger.error(f"❌ Error fetching PII requests: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/pii-request/{request_id}/respond")
async def respond_to_pii_request(
    request_id: str,
    response: str = Form(...),  # "approve" or "reject"
    responder: str = Form(...),
    response_message: Optional[str] = Form(None),
    db = Depends(get_database)
):
    """Respond to PII request (approve/reject)"""
    logger.info(f"📝 PII request response {request_id}: {response} by {responder}")

    from bson import ObjectId
    result = await db.pii_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": response,
                "respondedAt": datetime.utcnow().isoformat(),
                "responseMessage": response_message
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PII request not found")

    logger.info(f"✅ PII request {request_id} {response} by {responder}")
    return {"message": f"PII request {response}d successfully"}

# ===== FAVORITES MANAGEMENT =====

@router.post("/favorites/{target_username}")
async def add_to_favorites(username: str, target_username: str, db = Depends(get_database)):
    """Add user to favorites"""
    logger.info(f"⭐ Adding {target_username} to {username}'s favorites")

    # Check if already in favorites
    existing = await db.favorites.find_one({
        "userUsername": username,
        "favoriteUsername": target_username
    })

    if existing:
        logger.warning(f"⚠️ Already in favorites: {username} → {target_username}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already in favorites"
        )

    # Check if target user exists
    target_user = await db.users.find_one({"username": target_username})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Add to favorites
    favorite = {
        "userUsername": username,
        "favoriteUsername": target_username,
        "createdAt": datetime.utcnow().isoformat()
    }

    try:
        await db.favorites.insert_one(favorite)
        logger.info(f"✅ Added to favorites: {username} → {target_username}")
        return {"message": "Added to favorites successfully"}
    except Exception as e:
        logger.error(f"❌ Error adding to favorites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/favorites/{target_username}")
async def remove_from_favorites(target_username: str, username: str = Query(...), db = Depends(get_database)):
    """Remove user from favorites"""
    logger.info(f"⭐ Removing {target_username} from {username}'s favorites")

    result = await db.favorites.delete_one({
        "userUsername": username,
        "favoriteUsername": target_username
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")

    logger.info(f"✅ Removed from favorites: {username} → {target_username}")
    return {"message": "Removed from favorites successfully"}

@router.get("/favorites/{username}")
async def get_favorites(username: str, db = Depends(get_database)):
    """Get user's favorites list"""
    logger.info(f"📋 Getting favorites for {username}")

    try:
        favorites_cursor = db.favorites.find({"userUsername": username})
        favorites = await favorites_cursor.to_list(100)

        # Get full user details for each favorite
        favorite_users = []
        for fav in favorites:
            user = await db.users.find_one({"username": fav["favoriteUsername"]})
            if user:
                user.pop("password", None)
                user.pop("_id", None)
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                user["addedToFavoritesAt"] = fav["createdAt"]
                favorite_users.append(user)

        logger.info(f"✅ Found {len(favorite_users)} favorites for {username}")
        return {"favorites": favorite_users}
    except Exception as e:
        logger.error(f"❌ Error fetching favorites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ===== SHORTLIST MANAGEMENT =====

@router.post("/shortlist/{target_username}")
async def add_to_shortlist(
    username: str,
    target_username: str,
    notes: Optional[str] = Form(None),
    db = Depends(get_database)
):
    """Add user to shortlist"""
    logger.info(f"📝 Adding {target_username} to {username}'s shortlist")

    # Check if already in shortlist
    existing = await db.shortlists.find_one({
        "userUsername": username,
        "shortlistedUsername": target_username
    })

    if existing:
        logger.warning(f"⚠️ Already in shortlist: {username} → {target_username}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already in shortlist"
        )

    # Check if target user exists
    target_user = await db.users.find_one({"username": target_username})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Add to shortlist
    shortlist_item = {
        "userUsername": username,
        "shortlistedUsername": target_username,
        "notes": notes,
        "createdAt": datetime.utcnow().isoformat()
    }

    try:
        await db.shortlists.insert_one(shortlist_item)
        logger.info(f"✅ Added to shortlist: {username} → {target_username}")
        return {"message": "Added to shortlist successfully"}
    except Exception as e:
        logger.error(f"❌ Error adding to shortlist: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shortlist/{username}")
async def get_shortlist(username: str, db = Depends(get_database)):
    """Get user's shortlist"""
    logger.info(f"📋 Getting shortlist for {username}")

    try:
        shortlist_cursor = db.shortlists.find({"userUsername": username})
        shortlist = await shortlist_cursor.to_list(100)

        # Get full user details for each shortlisted user
        shortlisted_users = []
        for item in shortlist:
            user = await db.users.find_one({"username": item["shortlistedUsername"]})
            if user:
                user.pop("password", None)
                user.pop("_id", None)
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                user["notes"] = item.get("notes")
                user["addedToShortlistAt"] = item["createdAt"]
                shortlisted_users.append(user)

        logger.info(f"✅ Found {len(shortlisted_users)} shortlisted users for {username}")
        return {"shortlist": shortlisted_users}
    except Exception as e:
        logger.error(f"❌ Error fetching shortlist: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ===== EXCLUSIONS MANAGEMENT =====

@router.post("/exclusions/{target_username}")
async def add_to_exclusions(
    username: str,
    target_username: str,
    reason: Optional[str] = Form(None),
    db = Depends(get_database)
):
    """Add user to exclusions"""
    logger.info(f"❌ Adding {target_username} to {username}'s exclusions")

    # Check if already excluded
    existing = await db.exclusions.find_one({
        "userUsername": username,
        "excludedUsername": target_username
    })

    if existing:
        logger.warning(f"⚠️ Already excluded: {username} → {target_username}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already excluded"
        )

    # Add to exclusions
    exclusion = {
        "userUsername": username,
        "excludedUsername": target_username,
        "reason": reason,
        "createdAt": datetime.utcnow().isoformat()
    }

    try:
        await db.exclusions.insert_one(exclusion)
        logger.info(f"✅ Added to exclusions: {username} → {target_username}")
        return {"message": "Added to exclusions successfully"}
    except Exception as e:
        logger.error(f"❌ Error adding to exclusions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/exclusions/{username}")
async def get_exclusions(username: str, db = Depends(get_database)):
    """Get user's exclusions list"""
    logger.info(f"📋 Getting exclusions for {username}")

    try:
        exclusions_cursor = db.exclusions.find({"userUsername": username})
        exclusions = await exclusions_cursor.to_list(100)

        logger.info(f"✅ Found {len(exclusions)} exclusions for {username}")
        return {"exclusions": [exc["excludedUsername"] for exc in exclusions]}
    except Exception as e:
        logger.error(f"❌ Error fetching exclusions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/exclusions/{target_username}")
async def remove_from_exclusions(
    target_username: str,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Remove user from exclusions"""
    logger.info(f"🗑️ Removing {target_username} from exclusions for {username}")

    # Check if target user exists
    target_user = await db.users.find_one({"username": target_username})
    if not target_user:
        logger.warning(f"⚠️ Remove from exclusions failed: Target user '{target_username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )

    # Check if user exists
    user = await db.users.find_one({"username": username})
    if not user:
        logger.warning(f"⚠️ Remove from exclusions failed: User '{username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    try:
        # Find and delete the exclusion record
        result = await db.exclusions.delete_one({
            "userUsername": username,
            "excludedUsername": target_username
        })

        if result.deleted_count == 0:
            logger.warning(f"⚠️ Exclusion entry not found: {target_username} for user {username}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exclusion entry not found"
            )

        logger.info(f"✅ Removed '{target_username}' from exclusions for '{username}'")
        return {"message": "Removed from exclusions successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error removing from exclusions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove from exclusions: {str(e)}"
        )

# ===== MESSAGING SYSTEM =====

@router.get("/messages/poll/{username}")
async def poll_messages(
    username: str,
    since: str = Query(None, description="ISO timestamp of last received message"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of messages to return"),
    db = Depends(get_database)
):
    """Poll for new messages since a timestamp with validation and error handling"""
    from redis_manager import get_redis_manager
    
    try:
        # Validation
        if not username or len(username) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid username"
            )
        
        # Verify user exists
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{username}' not found"
            )
        
        # Validate timestamp format if provided
        if since:
            try:
                datetime.fromisoformat(since.replace('Z', '+00:00'))
            except ValueError:
                logger.warning(f"⚠️ Invalid timestamp format: {since}, ignoring")
                since = None
        
        redis = get_redis_manager()
        
        # Get new messages from Redis
        new_messages = redis.get_new_messages_since(username, since, limit=limit)
        
        if new_messages:
            logger.info(f"📬 Polling: '{username}' - found {len(new_messages)} new messages since {since}")
        else:
            logger.debug(f"📭 Polling: '{username}' - no new messages")
        
        return {
            "messages": new_messages,
            "count": len(new_messages),
            "timestamp": datetime.now().isoformat(),
            "success": True
        }
        
    except HTTPException:
        raise
    except redis.RedisError as e:
        logger.error(f"❌ Redis error polling messages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Message service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"❌ Unexpected error polling messages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/messages")
async def send_message(
    from_username: str = Form(...),
    to_username: str = Form(...),
    content: str = Form(...),
    db = Depends(get_database)
):
    """Send a message to another user"""
    logger.info(f"💬 Message from {from_username} to {to_username}")

    if len(content.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty"
        )

    if len(content) > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message too long (max 1000 characters)"
        )

    # Check if recipient exists
    recipient = await db.users.find_one({"username": to_username})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    # Create message
    message_id = f"{from_username}_{to_username}_{datetime.utcnow().timestamp()}"
    message = {
        "_id": message_id,
        "fromUsername": from_username,
        "toUsername": to_username,
        "content": content.strip(),
        "isRead": False,
        "createdAt": datetime.utcnow().isoformat()
    }

    try:
        # Store in MongoDB
        await db.messages.insert_one(message)
        
        # Send via Redis for real-time delivery
        from redis_manager import get_redis_manager
        redis = get_redis_manager()
        redis.send_message(from_username, to_username, content.strip(), message_id)
        
        logger.info(f"✅ Message sent: {from_username} → {to_username} (MongoDB + Redis)")
        return {"message": "Message sent successfully", "id": message_id}
    except Exception as e:
        logger.error(f"❌ Error sending message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/messages/{username}")
async def get_messages(username: str, db = Depends(get_database)):
    """Get messages for user"""
    logger.info(f"📬 Getting messages for {username}")

    try:
        # Get all messages where user is sender or recipient
        messages_cursor = db.messages.find({
            "$or": [
                {"fromUsername": username},
                {"toUsername": username}
            ]
        }).sort("createdAt", -1)

        messages = await messages_cursor.to_list(200)

        # Mark messages as read if user is recipient
        for msg in messages:
            if msg["toUsername"] == username and not msg["isRead"]:
                await db.messages.update_one(
                    {"_id": msg["_id"]},
                    {
                        "$set": {
                            "isRead": True,
                            "readAt": datetime.utcnow().isoformat()
                        }
                    }
                )

        # Convert ObjectId to string
        for msg in messages:
            msg['id'] = str(msg.pop('_id', ''))

        logger.info(f"✅ Found {len(messages)} messages for {username}")
        return {"messages": messages}
    except Exception as e:
        logger.error(f"❌ Error fetching messages: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversations/{username}")
async def get_conversations(username: str, db = Depends(get_database)):
    """Get list of conversations for user"""
    logger.info(f"💭 Getting conversations for {username}")

    try:
        # Get unique conversations
        pipeline = [
            {
                "$match": {
                    "$or": [
                        {"fromUsername": username},
                        {"toUsername": username}
                    ]
                }
            },
            {
                "$group": {
                    "_id": {
                        "$cond": [
                            {"$eq": ["$fromUsername", username]},
                            "$toUsername",
                            "$fromUsername"
                        ]
                    },
                    "lastMessage": {"$last": "$$ROOT"},
                    "unreadCount": {
                        "$sum": {
                            "$cond": [
                                {"$and": [
                                    {"$eq": ["$toUsername", username]},
                                    {"$eq": ["$isRead", False]}
                                ]},
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {"$sort": {"lastMessage.createdAt": -1}}
        ]

        conversations = await db.messages.aggregate(pipeline).to_list(50)

        # Get user details for each conversation
        for conv in conversations:
            other_username = conv["_id"]
            user = await db.users.find_one({"username": other_username})
            if user:
                user.pop("password", None)
                user.pop("_id", None)
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                conv["otherUser"] = user
                conv["lastMessage"]["id"] = str(conv["lastMessage"].pop("_id", ""))
            else:
                conv["otherUser"] = {"username": other_username, "firstName": "Unknown"}

        logger.info(f"✅ Found {len(conversations)} conversations for {username}")
        return {"conversations": conversations}
    except Exception as e:
        logger.error(f"❌ Error fetching conversations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENHANCED MESSAGING WITH PRIVACY =====

async def check_message_visibility(username1: str, username2: str, db) -> bool:
    """Check if messages should be visible between two users"""
    # Check if either user has excluded/blocked the other
    exclusion = await db.exclusions.find_one({
        "$or": [
            {"userUsername": username1, "excludedUsername": username2},
            {"userUsername": username2, "excludedUsername": username1}
        ]
    })
    
    if exclusion:
        return False
    
    # Check if either user has unfavorited the other (removed from favorites)
    # If they were in favorites and removed, hide messages
    favorite1 = await db.favorites.find_one({
        "userUsername": username1,
        "favoriteUsername": username2
    })
    favorite2 = await db.favorites.find_one({
        "userUsername": username2,
        "favoriteUsername": username1
    })
    
    # If neither has favorited the other, messages are still visible
    # Only hide if explicitly excluded
    return True

@router.post("/api/messages/send")
async def send_message_enhanced(
    message_data: MessageCreate,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Send a message with privacy checks"""
    logger.info(f"💬 Enhanced message from {username} to {message_data.toUsername}")
    
    # Check if recipient exists
    recipient = await db.users.find_one({"username": message_data.toUsername})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Check if messaging is allowed (not blocked/excluded)
    is_visible = await check_message_visibility(username, message_data.toUsername, db)
    
    # Create message
    message = {
        "fromUsername": username,
        "toUsername": message_data.toUsername,
        "content": message_data.content.strip(),
        "isRead": False,
        "isVisible": is_visible,
        "createdAt": datetime.utcnow()
    }
    
    try:
        result = await db.messages.insert_one(message)
        
        # Send via Redis for real-time delivery (only if message is visible)
        if is_visible:
            from redis_manager import get_redis_manager
            redis = get_redis_manager()
            message_id = str(result.inserted_id)
            redis.send_message(username, message_data.toUsername, message_data.content.strip(), message_id)
            logger.info(f"📡 Message sent via Redis for real-time delivery")
        
        # Convert to serializable format
        message_response = {
            "id": str(result.inserted_id),
            "from_username": message["fromUsername"],  # Changed to match frontend expectation
            "to_username": message["toUsername"],      # Changed to match frontend expectation
            "message": message["content"],             # Changed to match frontend expectation
            "timestamp": message["createdAt"].isoformat(),  # Changed to match frontend expectation
            "is_read": message["isRead"]               # Changed to match frontend expectation
        }
        logger.info(f"✅ Enhanced message sent: {username} → {message_data.toUsername}")
        return {"message": "Message sent successfully", "data": message_response}
    except Exception as e:
        logger.error(f"❌ Error sending message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/messages/conversation/{other_username}")
async def get_conversation(
    other_username: str,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Get conversation with specific user (with privacy checks)"""
    logger.info(f"💭 Getting conversation between {username} and {other_username}")
    
    # Check if current user is admin
    current_user = await db.users.find_one({"username": username})
    is_admin = current_user and current_user.get("username") == "admin"
    
    try:
        # Check visibility
        is_visible = await check_message_visibility(username, other_username, db)
        
        # Build query
        query = {
            "$or": [
                {"fromUsername": username, "toUsername": other_username},
                {"fromUsername": other_username, "toUsername": username}
            ]
        }
        
        # If not admin and not visible, filter out invisible messages
        if not is_admin and not is_visible:
            query["isVisible"] = True
        
        messages_cursor = db.messages.find(query).sort("createdAt", 1)
        messages = await messages_cursor.to_list(500)
        
        # Mark messages as read
        for msg in messages:
            if msg["toUsername"] == username and not msg.get("isRead", False):
                await db.messages.update_one(
                    {"_id": msg["_id"]},
                    {"$set": {"isRead": True, "readAt": datetime.utcnow()}}
                )
        
        # Convert ObjectId to string
        for msg in messages:
            msg['id'] = str(msg.pop('_id', ''))
            msg['createdAt'] = msg['createdAt'].isoformat() if isinstance(msg['createdAt'], datetime) else msg['createdAt']
        
        # Get other user's profile
        other_user = await db.users.find_one({"username": other_username})
        if other_user:
            other_user.pop("password", None)
            other_user["_id"] = str(other_user["_id"])
            other_user["images"] = [get_full_image_url(img) for img in other_user.get("images", [])]
        
        logger.info(f"✅ Found {len(messages)} messages in conversation")
        return {
            "messages": messages,
            "otherUser": other_user,
            "isVisible": is_visible or is_admin
        }
    except Exception as e:
        logger.error(f"❌ Error fetching conversation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/messages/conversations")
async def get_conversations_enhanced(
    username: str = Query(...),
    db = Depends(get_database)
):
    """Get list of all conversations with privacy checks"""
    logger.info(f"💬 Getting conversations for {username}")
    
    # Check if current user is admin
    current_user = await db.users.find_one({"username": username})
    is_admin = current_user and current_user.get("username") == "admin"
    
    try:
        # Get unique conversations
        pipeline = [
            {
                "$match": {
                    "$or": [
                        {"fromUsername": username},
                        {"toUsername": username}
                    ],
                    "isVisible": True if not is_admin else {"$in": [True, False]}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$cond": [
                            {"$eq": ["$fromUsername", username]},
                            "$toUsername",
                            "$fromUsername"
                        ]
                    },
                    "lastMessage": {"$last": "$$ROOT"},
                    "unreadCount": {
                        "$sum": {
                            "$cond": [
                                {"$and": [
                                    {"$eq": ["$toUsername", username]},
                                    {"$eq": ["$isRead", False]}
                                ]},
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {"$sort": {"lastMessage.createdAt": -1}}
        ]
        
        conversations = await db.messages.aggregate(pipeline).to_list(100)
        
        # Get user details and check visibility
        result = []
        for conv in conversations:
            other_username = conv["_id"]
            
            # Check visibility
            is_visible = await check_message_visibility(username, other_username, db)
            if not is_visible and not is_admin:
                continue
            
            user = await db.users.find_one({"username": other_username})
            if user:
                user.pop("password", None)
                user["_id"] = str(user["_id"])
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                
                # Serialize datetime
                last_msg_time = conv["lastMessage"]["createdAt"]
                if isinstance(last_msg_time, datetime):
                    last_msg_time = last_msg_time.isoformat()
                
                conv_data = {
                    "username": other_username,
                    "userProfile": user,
                    "lastMessage": conv["lastMessage"].get("content", ""),
                    "lastMessageTime": last_msg_time,
                    "unreadCount": conv["unreadCount"],
                    "isVisible": is_visible
                }
                result.append(conv_data)
        
        logger.info(f"✅ Found {len(result)} conversations for {username}")
        return {"conversations": result}
    except Exception as e:
        logger.error(f"❌ Error fetching conversations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/shortlist/{target_username}")
async def remove_from_shortlist(target_username: str, username: str = Query(...), db = Depends(get_database)):
    """Remove user from shortlist"""
    logger.info(f"🗑️ Removing {target_username} from shortlist for {username}")

    # Check if target user exists
    target_user = await db.users.find_one({"username": target_username})
    if not target_user:
        logger.warning(f"⚠️ Remove from shortlist failed: Target user '{target_username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )

    # Check if user exists
    user = await db.users.find_one({"username": username})
    if not user:
        logger.warning(f"⚠️ Remove from shortlist failed: User '{username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    try:
        # Find and delete the shortlist record
        result = await db.shortlists.delete_one({
            "userUsername": username,
            "shortlistedUsername": target_username
        })

        if result.deleted_count == 0:
            logger.warning(f"⚠️ Shortlist entry not found: {target_username} for user {username}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shortlist entry not found"
            )

        logger.info(f"✅ Removed '{target_username}' from shortlist for '{username}'")
        return {"message": "Removed from shortlist successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error removing from shortlist: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove from shortlist: {str(e)}"
        )

# Dashboard Endpoints
@router.post("/views/{target_username}")
async def track_profile_view(target_username: str, viewer_username: str, db = Depends(get_database)):
    """Track when someone views a profile"""
    logger.info(f"👁️ Tracking view: {viewer_username} viewed {target_username}")
    
    try:
        # Check if view already exists
        existing = await db.profile_views.find_one({
            "viewedUsername": target_username,
            "viewerUsername": viewer_username
        })
        
        if existing:
            # Update timestamp
            await db.profile_views.update_one(
                {"_id": existing["_id"]},
                {"$set": {"viewedAt": datetime.utcnow()}}
            )
        else:
            # Create new view record
            await db.profile_views.insert_one({
                "viewedUsername": target_username,
                "viewerUsername": viewer_username,
                "viewedAt": datetime.utcnow()
            })
        
        logger.info(f"✅ Tracked view: {viewer_username} → {target_username}")
        return {"message": "Profile view tracked"}
    except Exception as e:
        logger.error(f"❌ Error tracking view: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/views/{username}")
async def get_profile_viewers(username: str, db = Depends(get_database)):
    """Get list of users who viewed this profile"""
    logger.info(f"👁️ Getting viewers for {username}")
    
    try:
        viewers = await db.profile_views.find(
            {"viewedUsername": username}
        ).sort("viewedAt", -1).to_list(100)
        
        # Get viewer details
        viewer_usernames = [v["viewerUsername"] for v in viewers]
        viewer_users = await db.users.find(
            {"username": {"$in": viewer_usernames}}
        ).to_list(100)
        
        viewer_dict = {u["username"]: u for u in viewer_users}
        
        result = []
        for viewer in viewers:
            user_data = viewer_dict.get(viewer["viewerUsername"], {})
            result.append({
                "username": viewer["viewerUsername"],
                "firstName": user_data.get("firstName"),
                "lastName": user_data.get("lastName"),
                "age": calculate_age(user_data.get("dob")),
                "location": user_data.get("location"),
                "occupation": user_data.get("occupation"),
                "profileImage": get_full_image_url(user_data.get("profileImage")),
                "viewedAt": safe_datetime_serialize(viewer.get("viewedAt"))
            })
        
        logger.info(f"✅ Found {len(result)} viewers for {username}")
        return {"viewers": result}
    except Exception as e:
        logger.error(f"❌ Error getting viewers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/their-favorites/{username}")
async def get_users_who_favorited_me(username: str, db = Depends(get_database)):
    """Get users who have favorited the current user"""
    logger.info(f"💖 Getting users who favorited {username}")
    
    try:
        # Find all favorites where current user is the target
        favorites = await db.favorites.find(
            {"favoritedUsername": username}
        ).sort("createdAt", -1).to_list(100)
        
        # Get user details
        user_usernames = [f["userUsername"] for f in favorites]
        users = await db.users.find(
            {"username": {"$in": user_usernames}}
        ).to_list(100)
        
        user_dict = {u["username"]: u for u in users}
        
        result = []
        for fav in favorites:
            user_data = user_dict.get(fav["userUsername"], {})
            result.append({
                "username": fav["userUsername"],
                "firstName": user_data.get("firstName"),
                "lastName": user_data.get("lastName"),
                "age": calculate_age(user_data.get("dob")),
                "location": user_data.get("location"),
                "occupation": user_data.get("occupation"),
                "profileImage": get_full_image_url(user_data.get("profileImage")),
                "addedAt": safe_datetime_serialize(fav.get("createdAt"))
            })
        
        logger.info(f"✅ Found {len(result)} users who favorited {username}")
        return {"users": result}
    except Exception as e:
        logger.error(f"❌ Error getting users who favorited: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/their-shortlists/{username}")
async def get_users_who_shortlisted_me(username: str, db = Depends(get_database)):
    """Get users who have shortlisted the current user"""
    logger.info(f"📝 Getting users who shortlisted {username}")
    
    try:
        # Find all shortlists where current user is the target
        shortlists = await db.shortlists.find(
            {"shortlistedUsername": username}
        ).sort("createdAt", -1).to_list(100)
        
        # Get user details
        user_usernames = [s["userUsername"] for s in shortlists]
        users = await db.users.find(
            {"username": {"$in": user_usernames}}
        ).to_list(100)
        
        user_dict = {u["username"]: u for u in users}
        
        result = []
        for shortlist in shortlists:
            user_data = user_dict.get(shortlist["userUsername"], {})
            result.append({
                "username": shortlist["userUsername"],
                "firstName": user_data.get("firstName"),
                "lastName": user_data.get("lastName"),
                "age": calculate_age(user_data.get("dob")),
                "location": user_data.get("location"),
                "occupation": user_data.get("occupation"),
                "profileImage": get_full_image_url(user_data.get("profileImage")),
                "addedAt": safe_datetime_serialize(shortlist.get("createdAt"))
            })
        
        logger.info(f"✅ Found {len(result)} users who shortlisted {username}")
        return {"users": result}
    except Exception as e:
        logger.error(f"❌ Error getting users who shortlisted: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ===== PROFILE VIEW TRACKING =====

@router.post("/profile-views")
async def track_profile_view(
    profile_view: ProfileViewCreate,
    db = Depends(get_database)
):
    """Track when a user views another user's profile"""
    logger.info(f"👁️ Profile view: {profile_view.viewedByUsername} viewed {profile_view.profileUsername}")
    
    # Don't track if user views their own profile
    if profile_view.profileUsername == profile_view.viewedByUsername:
        return {"message": "Self-view not tracked"}
    
    # Check if both users exist
    profile_user = await db.users.find_one({"username": profile_view.profileUsername})
    viewer_user = await db.users.find_one({"username": profile_view.viewedByUsername})
    
    if not profile_user:
        raise HTTPException(status_code=404, detail="Profile user not found")
    if not viewer_user:
        raise HTTPException(status_code=404, detail="Viewer user not found")
    
    try:
        # Check if this user has viewed this profile before
        existing_view = await db.profile_views.find_one({
            "profileUsername": profile_view.profileUsername,
            "viewedByUsername": profile_view.viewedByUsername
        })
        
        if existing_view:
            # Increment view count and update last viewed timestamp
            await db.profile_views.update_one(
                {"_id": existing_view["_id"]},
                {
                    "$set": {"lastViewedAt": datetime.utcnow()},
                    "$inc": {"viewCount": 1}
                }
            )
            new_count = existing_view.get("viewCount", 1) + 1
            logger.info(f"✅ Incremented profile view count to {new_count}")
            return {
                "message": "Profile view updated",
                "viewCount": new_count,
                "totalViews": new_count
            }
        else:
            # Create new profile view record
            view_data = {
                "profileUsername": profile_view.profileUsername,
                "viewedByUsername": profile_view.viewedByUsername,
                "viewCount": 1,
                "firstViewedAt": datetime.utcnow(),
                "lastViewedAt": datetime.utcnow(),
                "createdAt": datetime.utcnow()
            }
            
            result = await db.profile_views.insert_one(view_data)
            logger.info(f"✅ Profile view tracked: {profile_view.viewedByUsername} → {profile_view.profileUsername}")
            return {
                "message": "Profile view tracked",
                "id": str(result.inserted_id),
                "viewCount": 1
            }
    
    except Exception as e:
        logger.error(f"❌ Error tracking profile view: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/profile-views/{username}")
async def get_profile_views(
    username: str,
    limit: int = Query(50, ge=1, le=200),
    db = Depends(get_database)
):
    """Get list of users who viewed this profile"""
    logger.info(f"📊 Getting profile views for {username}")
    
    try:
        # Get all profile views for this user
        all_views = await db.profile_views.find({
            "profileUsername": username
        }).to_list(None)
        
        # Group by viewer to consolidate duplicates
        viewer_map = {}
        for view in all_views:
            viewer_username = view["viewedByUsername"]
            
            if viewer_username not in viewer_map:
                # First time seeing this viewer
                viewer_map[viewer_username] = {
                    "viewedByUsername": viewer_username,
                    "viewCount": view.get("viewCount", 1),
                    "lastViewedAt": view.get("lastViewedAt", view.get("viewedAt", view.get("createdAt"))),
                    "firstViewedAt": view.get("firstViewedAt", view.get("createdAt")),
                    "id": view["_id"]
                }
            else:
                # Duplicate viewer - consolidate
                existing = viewer_map[viewer_username]
                existing["viewCount"] += view.get("viewCount", 1)
                
                # Keep the most recent lastViewedAt
                current_last = view.get("lastViewedAt", view.get("viewedAt", view.get("createdAt")))
                if current_last > existing["lastViewedAt"]:
                    existing["lastViewedAt"] = current_last
                
                # Keep the earliest firstViewedAt
                current_first = view.get("firstViewedAt", view.get("createdAt"))
                if current_first < existing["firstViewedAt"]:
                    existing["firstViewedAt"] = current_first
        
        # Convert to list and sort by most recent
        consolidated_views = sorted(
            viewer_map.values(),
            key=lambda x: x["lastViewedAt"],
            reverse=True
        )[:limit]
        
        # Get viewer details for each unique viewer
        result = []
        total_view_count = 0
        
        for view in consolidated_views:
            viewer = await db.users.find_one({"username": view["viewedByUsername"]})
            if viewer:
                viewer.pop("password", None)
                viewer["_id"] = str(viewer["_id"])
                viewer["images"] = [get_full_image_url(img) for img in viewer.get("images", [])]
                
                view_count = view["viewCount"]
                total_view_count += view_count
                
                view_data = {
                    "id": str(view["id"]),
                    "viewedAt": view["lastViewedAt"].isoformat() if isinstance(view["lastViewedAt"], datetime) else view["lastViewedAt"],
                    "firstViewedAt": view["firstViewedAt"].isoformat() if isinstance(view["firstViewedAt"], datetime) else view["firstViewedAt"],
                    "viewCount": view_count,
                    "viewerProfile": viewer
                }
                result.append(view_data)
        
        # Get unique viewer count
        unique_viewers = len(result)
        
        # Calculate total views across all viewers
        # Use $ifNull to handle old records without viewCount field
        pipeline = [
            {"$match": {"profileUsername": username}},
            {
                "$group": {
                    "_id": None,
                    "totalViews": {
                        "$sum": {"$ifNull": ["$viewCount", 1]}
                    }
                }
            }
        ]
        total_result = await db.profile_views.aggregate(pipeline).to_list(1)
        total_views_all = total_result[0]["totalViews"] if total_result else 0
        
        logger.info(f"✅ Found {unique_viewers} unique viewers, {total_views_all} total views for {username}")
        return {
            "views": result,
            "uniqueViewers": unique_viewers,
            "totalViews": total_views_all,
            "recentViews": len(result)
        }
    
    except Exception as e:
        logger.error(f"❌ Error fetching profile views: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/profile-views/{username}/count")
async def get_profile_view_count(
    username: str,
    db = Depends(get_database)
):
    """Get total count of profile views"""
    logger.info(f"📈 Getting profile view count for {username}")
    
    try:
        total_views = await db.profile_views.count_documents({"profileUsername": username})
        unique_viewers = len(await db.profile_views.distinct("viewedByUsername", {"profileUsername": username}))
        
        logger.info(f"✅ Profile view stats for {username}: {total_views} total, {unique_viewers} unique")
        return {
            "totalViews": total_views,
            "uniqueViewers": unique_viewers
        }
    
    except Exception as e:
        logger.error(f"❌ Error getting profile view count: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ===== PII REQUEST & ACCESS MANAGEMENT =====

@router.post("/pii-requests")
async def create_pii_request(
    request_data: PIIRequestCreate,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Create PII access request(s)"""
    logger.info(f"🔒 PII request: {username} → {request_data.profileUsername} for {request_data.requestTypes}")
    
    # Validate users exist
    requester = await db.users.find_one({"username": username})
    profile_owner = await db.users.find_one({"username": request_data.profileUsername})
    
    if not requester:
        raise HTTPException(status_code=404, detail="Requester not found")
    if not profile_owner:
        raise HTTPException(status_code=404, detail="Profile owner not found")
    
    # Can't request own PII
    if username == request_data.profileUsername:
        raise HTTPException(status_code=400, detail="Cannot request access to your own profile")
    
    try:
        created_requests = []
        
        for request_type in request_data.requestTypes:
            # Check if request already exists and is pending
            existing = await db.pii_requests.find_one({
                "requesterUsername": username,
                "profileUsername": request_data.profileUsername,
                "requestType": request_type,
                "status": "pending"
            })
            
            if existing:
                logger.info(f"⚠️ Request already exists for {request_type}")
                continue
            
            # Check if access already granted
            has_access = await db.pii_access.find_one({
                "granterUsername": request_data.profileUsername,
                "grantedToUsername": username,
                "accessType": request_type,
                "isActive": True
            })
            
            if has_access:
                logger.info(f"✅ Access already granted for {request_type}")
                continue
            
            # Create new request
            pii_request = {
                "requesterUsername": username,
                "profileUsername": request_data.profileUsername,
                "requestType": request_type,
                "status": "pending",
                "message": request_data.message,
                "requestedAt": datetime.utcnow(),
                "createdAt": datetime.utcnow()
            }
            
            result = await db.pii_requests.insert_one(pii_request)
            created_requests.append({
                "id": str(result.inserted_id),
                "requestType": request_type
            })
        
        if not created_requests:
            return {"message": "No new requests created (already pending or access granted)"}
        
        logger.info(f"✅ Created {len(created_requests)} PII requests")
        return {
            "message": f"Created {len(created_requests)} PII request(s)",
            "requests": created_requests
        }
    
    except Exception as e:
        logger.error(f"❌ Error creating PII request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pii-requests/{username}/incoming")
async def get_incoming_pii_requests(
    username: str,
    status_filter: Optional[str] = Query(None),
    db = Depends(get_database)
):
    """Get PII requests received by this user (requests to view their data)"""
    logger.info(f"📥 Getting incoming PII requests for {username}")
    
    try:
        query = {"profileUsername": username}
        if status_filter:
            query["status"] = status_filter
        
        requests = await db.pii_requests.find(query).sort("requestedAt", -1).to_list(100)
        
        # Get requester details for each request
        result = []
        for req in requests:
            requester = await db.users.find_one({"username": req["requesterUsername"]})
            if requester:
                requester.pop("password", None)
                requester["_id"] = str(requester["_id"])
                requester["images"] = [get_full_image_url(img) for img in requester.get("images", [])]
                
                request_data = {
                    "id": str(req["_id"]),
                    "requestType": req["requestType"],
                    "status": req["status"],
                    "message": req.get("message"),
                    "requestedAt": req["requestedAt"].isoformat(),
                    "respondedAt": req.get("respondedAt").isoformat() if req.get("respondedAt") else None,
                    "requesterProfile": requester
                }
                result.append(request_data)
        
        logger.info(f"✅ Found {len(result)} incoming PII requests for {username}")
        return {"requests": result}
    
    except Exception as e:
        logger.error(f"❌ Error fetching incoming PII requests: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pii-requests/{username}/outgoing")
async def get_outgoing_pii_requests(
    username: str,
    status_filter: Optional[str] = Query(None),
    db = Depends(get_database)
):
    """Get PII requests sent by this user (requests they made)"""
    logger.info(f"📤 Getting outgoing PII requests for {username}")
    
    try:
        query = {"requesterUsername": username}
        if status_filter:
            query["status"] = status_filter
        
        requests = await db.pii_requests.find(query).sort("requestedAt", -1).to_list(100)
        
        # Get profile owner details for each request
        result = []
        for req in requests:
            profile_owner = await db.users.find_one({"username": req["profileUsername"]})
            if profile_owner:
                profile_owner.pop("password", None)
                profile_owner["_id"] = str(profile_owner["_id"])
                profile_owner["images"] = [get_full_image_url(img) for img in profile_owner.get("images", [])]
                
                request_data = {
                    "id": str(req["_id"]),
                    "requestType": req["requestType"],
                    "status": req["status"],
                    "message": req.get("message"),
                    "requestedAt": req["requestedAt"].isoformat(),
                    "respondedAt": req.get("respondedAt").isoformat() if req.get("respondedAt") else None,
                    "profileOwner": profile_owner
                }
                result.append(request_data)
        
        logger.info(f"✅ Found {len(result)} outgoing PII requests for {username}")
        return {"requests": result}
    
    except Exception as e:
        logger.error(f"❌ Error fetching outgoing PII requests: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/pii-requests/{request_id}/approve")
async def approve_pii_request(
    request_id: str,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Approve a PII request and grant access"""
    logger.info(f"✅ Approving PII request {request_id} by {username}")
    
    try:
        from bson import ObjectId
        
        # Get the request
        request = await db.pii_requests.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Verify the user is the profile owner
        if request["profileUsername"] != username:
            raise HTTPException(status_code=403, detail="Not authorized to approve this request")
        
        # Check if already approved
        if request["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Request already {request['status']}")
        
        # Update request status
        await db.pii_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "approved",
                    "respondedAt": datetime.utcnow()
                }
            }
        )
        
        # Grant access
        access_data = {
            "granterUsername": username,
            "grantedToUsername": request["requesterUsername"],
            "accessType": request["requestType"],
            "grantedAt": datetime.utcnow(),
            "isActive": True,
            "createdAt": datetime.utcnow()
        }
        
        await db.pii_access.insert_one(access_data)
        
        logger.info(f"✅ PII request approved and access granted")
        return {"message": "Request approved and access granted"}
    
    except Exception as e:
        logger.error(f"❌ Error approving PII request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/pii-requests/{request_id}/reject")
async def reject_pii_request(
    request_id: str,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Reject a PII request"""
    logger.info(f"❌ Rejecting PII request {request_id} by {username}")
    
    try:
        from bson import ObjectId
        
        # Get the request
        request = await db.pii_requests.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Verify the user is the profile owner
        if request["profileUsername"] != username:
            raise HTTPException(status_code=403, detail="Not authorized to reject this request")
        
        # Update request status
        await db.pii_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "rejected",
                    "respondedAt": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"✅ PII request rejected")
        return {"message": "Request rejected"}
    
    except Exception as e:
        logger.error(f"❌ Error rejecting PII request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/pii-requests/{request_id}")
async def cancel_pii_request(
    request_id: str,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Cancel a PII request (by requester)"""
    logger.info(f"🚫 Cancelling PII request {request_id} by {username}")
    
    try:
        from bson import ObjectId
        
        # Get the request
        request = await db.pii_requests.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Verify the user is the requester
        if request["requesterUsername"] != username:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this request")
        
        # Update request status
        await db.pii_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "cancelled",
                    "respondedAt": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"✅ PII request cancelled")
        return {"message": "Request cancelled"}
    
    except Exception as e:
        logger.error(f"❌ Error cancelling PII request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pii-access/{username}/granted")
async def get_granted_access(
    username: str,
    db = Depends(get_database)
):
    """Get list of users who have access to this user's PII"""
    logger.info(f"📊 Getting granted PII access for {username}")
    
    try:
        access_records = await db.pii_access.find({
            "granterUsername": username,
            "isActive": True
        }).sort("grantedAt", -1).to_list(100)
        
        # Group by user to consolidate multiple access types
        user_access_map = {}
        for access in access_records:
            granted_to = access["grantedToUsername"]
            
            if granted_to not in user_access_map:
                user_access_map[granted_to] = {
                    "username": granted_to,
                    "accessTypes": [],
                    "grantedAt": access["grantedAt"],
                    "accessIds": []
                }
            
            user_access_map[granted_to]["accessTypes"].append(access["accessType"])
            user_access_map[granted_to]["accessIds"].append(str(access["_id"]))
        
        # Get user details
        result = []
        for username_key, access_info in user_access_map.items():
            user = await db.users.find_one({"username": username_key})
            if user:
                user.pop("password", None)
                user["_id"] = str(user["_id"])
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                
                result.append({
                    "userProfile": user,
                    "accessTypes": access_info["accessTypes"],
                    "grantedAt": access_info["grantedAt"].isoformat(),
                    "accessIds": access_info["accessIds"]
                })
        
        logger.info(f"✅ Found {len(result)} users with granted access")
        return {"grantedAccess": result}
    
    except Exception as e:
        logger.error(f"❌ Error fetching granted access: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pii-access/{username}/received")
async def get_received_access(
    username: str,
    db = Depends(get_database)
):
    """Get list of users whose PII this user has access to"""
    logger.info(f"📊 Getting received PII access for {username}")
    
    try:
        access_records = await db.pii_access.find({
            "grantedToUsername": username,
            "isActive": True
        }).sort("grantedAt", -1).to_list(100)
        
        # Group by user
        user_access_map = {}
        for access in access_records:
            granter = access["granterUsername"]
            
            if granter not in user_access_map:
                user_access_map[granter] = {
                    "username": granter,
                    "accessTypes": [],
                    "grantedAt": access["grantedAt"],
                    "accessIds": []
                }
            
            user_access_map[granter]["accessTypes"].append(access["accessType"])
            user_access_map[granter]["accessIds"].append(str(access["_id"]))
        
        # Get user details
        result = []
        for username_key, access_info in user_access_map.items():
            user = await db.users.find_one({"username": username_key})
            if user:
                user.pop("password", None)
                user["_id"] = str(user["_id"])
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                
                result.append({
                    "userProfile": user,
                    "accessTypes": access_info["accessTypes"],
                    "grantedAt": access_info["grantedAt"].isoformat(),
                    "accessIds": access_info["accessIds"]
                })
        
        logger.info(f"✅ Found {len(result)} users who granted access")
        return {"receivedAccess": result}
    
    except Exception as e:
        logger.error(f"❌ Error fetching received access: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/pii-access/{access_id}")
async def revoke_pii_access(
    access_id: str,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Revoke PII access"""
    logger.info(f"🚫 Revoking PII access {access_id} by {username}")
    
    try:
        from bson import ObjectId
        
        # Get the access record
        access = await db.pii_access.find_one({"_id": ObjectId(access_id)})
        if not access:
            raise HTTPException(status_code=404, detail="Access record not found")
        
        # Verify the user is the granter
        if access["granterUsername"] != username:
            raise HTTPException(status_code=403, detail="Not authorized to revoke this access")
        
        # Revoke access
        await db.pii_access.update_one(
            {"_id": ObjectId(access_id)},
            {"$set": {"isActive": False}}
        )
        
        logger.info(f"✅ PII access revoked")
        return {"message": "Access revoked"}
    
    except Exception as e:
        logger.error(f"❌ Error revoking PII access: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pii-access/check")
async def check_pii_access(
    requester: str = Query(...),
    profile_owner: str = Query(...),
    access_type: str = Query(...),
    db = Depends(get_database)
):
    """Check if requester has access to profile owner's PII"""
    
    try:
        # Check for active access
        access = await db.pii_access.find_one({
            "granterUsername": profile_owner,
            "grantedToUsername": requester,
            "accessType": access_type,
            "isActive": True
        })
        
        has_access = access is not None
        
        # Check if expired
        if has_access and access.get("expiresAt"):
            if access["expiresAt"] < datetime.utcnow():
                has_access = False
                # Mark as inactive
                await db.pii_access.update_one(
                    {"_id": access["_id"]},
                    {"$set": {"isActive": False}}
                )
        
        return {
            "hasAccess": has_access,
            "accessType": access_type
        }
    
    except Exception as e:
        logger.error(f"❌ Error checking PII access: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/online-status/count")
async def get_online_count():
    """Get count of currently online users"""
    from redis_manager import get_redis_manager
    
    redis = get_redis_manager()
    users = redis.get_online_users()
    count = len(users)
    logger.info(f"Online users count: {count}")
    return {"onlineCount": count}

@router.get("/online-status/users")
async def get_online_users():
    """Get list of currently online users"""
    from redis_manager import get_redis_manager
    
    redis = get_redis_manager()
    users = redis.get_online_users()
    logger.info(f"Online users: {len(users)} - {users}")
    return {"onlineUsers": users, "count": len(users)}

@router.get("/online-status/{username}")
async def check_user_online(username: str):
    """Check if specific user is online"""
    from redis_manager import get_redis_manager
    
    redis = get_redis_manager()
    online = redis.is_user_online(username)
    logger.info(f"User '{username}' online status: {online}")
    return {"username": username, "online": online}

@router.post("/online-status/{username}/online")
async def mark_user_online(username: str):
    """Mark user as online"""
    from redis_manager import get_redis_manager
    
    redis = get_redis_manager()
    success = redis.set_user_online(username)
    return {"username": username, "online": success}

@router.post("/online-status/{username}/offline")
async def mark_user_offline(username: str):
    """Mark user as offline"""
    from redis_manager import get_redis_manager
    
    redis = get_redis_manager()
    success = redis.set_user_offline(username)
    return {"username": username, "offline": success}

@router.post("/online-status/{username}/refresh")
async def refresh_user_online(username: str):
    """Refresh user's online status (heartbeat)"""
    from redis_manager import get_redis_manager
    
    redis = get_redis_manager()
    success = redis.refresh_user_online(username)
    return {"username": username, "refreshed": success}

# Helper function for age calculation
def calculate_age(dob):
    """Calculate age from date of birth"""
    if not dob:
        return None
    try:
        if isinstance(dob, str):
            birth_date = datetime.strptime(dob, "%Y-%m-%d")
        else:
            birth_date = dob
        today = datetime.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return age
    except:
        return None
