# fastapi_backend/routes.py
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends, Request
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import datetime, timedelta
from models import UserCreate, UserResponse, LoginRequest, Token
from database import get_database
from utils import save_multiple_files, get_full_image_url
from config import settings
from auth import create_access_token, verify_password, get_password_hash  # Add missing auth imports
import logging

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger(__name__)

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
    images: List[UploadFile] = File(default=[])
):
    """Register a new user with profile details and images"""
    logger.info(f"📝 Registration attempt for username: {username}")
    logger.debug(f"Registration data - Email: {contactEmail}, Name: {firstName} {lastName}")
    
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error during registration: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
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
async def login_user(login_data: LoginRequest):
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
    
    # Regular user login
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error during login: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
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
async def get_user_profile(username: str, requester: str = None):
    """Get user profile by username with PII masking"""
    logger.info(f"👤 Profile request for username: {username} (requester: {requester})")
    
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error during profile fetch: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
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
    images: List[UploadFile] = File(default=[])
):
    """Update user profile"""
    logger.info(f"📝 Update request for user '{username}'")
    
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error during update: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
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
async def get_all_users():
    """Get all users - Admin only endpoint"""
    logger.info("🔐 Admin request: Get all users")
    
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
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
    message: Optional[str] = Form(None)
):
    """Create PII access request"""
    logger.info(f"🔐 Access request: {requester} → {requested_user}")
    
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
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
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
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
    responder: str = Form(...)
):
    """Respond to access request (approve/deny)"""
    logger.info(f"📝 Response to request {request_id}: {response} by {responder}")
    
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    from pii_security import respond_to_access_request
    result = await respond_to_access_request(db, request_id, response, responder)
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    logger.info(f"✅ Request {request_id} {response} by {responder}")
    return result

@router.delete("/profile/{username}")
async def delete_user_profile(username: str):
    """Delete user profile"""
    logger.info(f"🗑️ Delete request for user '{username}'")
    
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error during delete: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
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
    sortBy: str = "newest",
    sortOrder: str = "desc",
    page: int = 1,
    limit: int = 20
):
    """Advanced search for users with filters"""
    logger.info(f"🔍 Search request - keyword: '{keyword}', page: {page}, limit: {limit}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error during search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    # Build query
    query = {}

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
async def get_saved_searches(username: str):
    """Get user's saved searches"""
    logger.info(f"📋 Getting saved searches for user '{username}'")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
async def save_search(username: str, search_data: dict):
    """Save a search for future use"""
    logger.info(f"💾 Saving search for user '{username}': {search_data.get('name', 'unnamed')}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
async def delete_saved_search(username: str, search_id: str):
    """Delete a saved search"""
    logger.info(f"🗑️ Deleting saved search {search_id} for user '{username}'")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
    message: Optional[str] = Form(None)
):
    """Create a PII access request"""
    logger.info(f"🔐 PII request: {requester} → {requested_user} ({request_type})")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_pii_requests(username: str, type: str = "received"):
    """Get PII requests for user (received or sent)"""
    logger.info(f"📋 Fetching {type} PII requests for {username}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
    response_message: Optional[str] = Form(None)
):
    """Respond to PII request (approve/reject)"""
    logger.info(f"📝 PII request response {request_id}: {response} by {responder}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
async def add_to_favorites(username: str, target_username: str):
    """Add user to favorites"""
    logger.info(f"⭐ Adding {target_username} to {username}'s favorites")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
async def remove_from_favorites(username: str, target_username: str):
    """Remove user from favorites"""
    logger.info(f"⭐ Removing {target_username} from {username}'s favorites")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    result = await db.favorites.delete_one({
        "userUsername": username,
        "favoriteUsername": target_username
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")

    logger.info(f"✅ Removed from favorites: {username} → {target_username}")
    return {"message": "Removed from favorites successfully"}

@router.get("/favorites/{username}")
async def get_favorites(username: str):
    """Get user's favorites list"""
    logger.info(f"📋 Getting favorites for {username}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
    notes: Optional[str] = Form(None)
):
    """Add user to shortlist"""
    logger.info(f"📝 Adding {target_username} to {username}'s shortlist")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_shortlist(username: str):
    """Get user's shortlist"""
    logger.info(f"📋 Getting shortlist for {username}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
    reason: Optional[str] = Form(None)
):
    """Add user to exclusions"""
    logger.info(f"❌ Adding {target_username} to {username}'s exclusions")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_exclusions(username: str):
    """Get user's exclusions list"""
    logger.info(f"📋 Getting exclusions for {username}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
    username: str
):
    """Remove user from exclusions"""
    logger.info(f"🗑️ Removing {target_username} from exclusions for {username}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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

@router.post("/messages")
async def send_message(
    from_username: str = Form(...),
    to_username: str = Form(...),
    content: str = Form(...)
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

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    # Check if recipient exists
    recipient = await db.users.find_one({"username": to_username})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    # Create message
    message = {
        "fromUsername": from_username,
        "toUsername": to_username,
        "content": content.strip(),
        "isRead": False,
        "createdAt": datetime.utcnow().isoformat()
    }

    try:
        await db.messages.insert_one(message)
        logger.info(f"✅ Message sent: {from_username} → {to_username}")
        return {"message": "Message sent successfully"}
    except Exception as e:
        logger.error(f"❌ Error sending message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/messages/{username}")
async def get_messages(username: str):
    """Get messages for user"""
    logger.info(f"📬 Getting messages for {username}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_conversations(username: str):
    """Get list of conversations for user"""
    logger.info(f"💭 Getting conversations for {username}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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


@router.delete("/shortlist/{target_username}")
async def remove_from_shortlist(target_username: str, username: str):
    """Remove user from shortlist"""
    logger.info(f"🗑️ Removing {target_username} from shortlist for {username}")

    try:
        db = get_database()
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
