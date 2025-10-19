# fastapi_backend/routes.py
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends, Request, Query, Body
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, date
import time
import logging
import uuid
import hashlib
import json
from pathlib import Path
from sse_starlette.sse import EventSourceResponse
from models import (
    UserCreate, UserResponse, LoginRequest, Token,
    Favorite, Shortlist, Exclusion, Message, MessageCreate,
    ProfileView, ProfileViewCreate, PIIRequest, PIIRequestCreate,
    PIIRequestResponse, PIIRequestApprove, PIIRequestReject,
    PIIAccess, PIIAccessCreate,
    UserPreferencesUpdate, UserPreferencesResponse,
    TestimonialCreate, TestimonialResponse
)
from database import get_database
from auth.password_utils import PasswordManager
from auth.jwt_auth import JWTManager, get_current_user_dependency as get_current_user
from l3v3l_matching_engine import matching_engine
from l3v3l_ml_enhancer import ml_enhancer
from config import settings
from utils import get_full_image_url, save_multiple_files

# Compatibility aliases for old code
def get_password_hash(password: str) -> str:
    return PasswordManager.hash_password(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return PasswordManager.verify_password(plain_password, hashed_password)

# Generate unique 8-character alphanumeric profileId
async def generate_unique_profile_id(db) -> str:
    import random
    import string
    
    while True:
        # Generate 8-char alphanumeric ID (mix of uppercase, lowercase, digits)
        profile_id = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        # Check if profileId already exists
        existing = await db.users.find_one({"profileId": profile_id})
        if not existing:
            return profile_id

def create_access_token(data: dict, expires_delta=None) -> str:
    return JWTManager.create_access_token(data, expires_delta)

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

# Helper function to remove consent metadata from user objects
def remove_consent_metadata(user_dict):
    """Remove consent-related metadata fields (backend-only, not shown to frontend)"""
    consent_fields = [
        "agreedToAge", "agreedToTerms", "agreedToPrivacy", "agreedToGuidelines",
        "agreedToDataProcessing", "agreedToMarketing",
        "termsAgreedAt", "privacyAgreedAt",
        "consentIpAddress", "consentUserAgent"
    ]
    for field in consent_fields:
        user_dict.pop(field, None)
    return user_dict

def parse_height_to_inches(height_str):
    """Convert height string '5'8"' or '5 ft 8 in' to total inches"""
    if not height_str:
        return None
    import re
    # Match formats: "5'8"" or "5 ft 8 in" or "5'8\""
    match = re.match(r"(\d+)['\s]+(ft\s+)?(\d+)[\"\s]*(in)?", str(height_str))
    if match:
        feet = int(match.group(1))
        inches = int(match.group(3))
        return feet * 12 + inches
    return None

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    # Basic Information
    username: str = Form(...),
    password: str = Form(...),
    firstName: Optional[str] = Form(None),
    lastName: Optional[str] = Form(None),
    contactNumber: Optional[str] = Form(None),
    contactEmail: Optional[str] = Form(None),
    dateOfBirth: Optional[str] = Form(None),  # Renamed from dob
    gender: Optional[str] = Form(None),  # Renamed from sex
    height: Optional[str] = Form(None),  # Format: "5'8\"" or "5 ft 8 in"
    # Preferences & Cultural Information
    religion: Optional[str] = Form(None),  # For both India and USA
    languagesSpoken: Optional[str] = Form(None),  # JSON string array of languages
    castePreference: Optional[str] = Form("None"),  # Default "None"
    eatingPreference: Optional[str] = Form("None"),  # Default "None"
    # Residential Information (Mandatory)
    countryOfOrigin: str = Form("US"),  # Mandatory, default US
    countryOfResidence: str = Form("US"),  # Mandatory, default US
    state: str = Form(...),  # Mandatory
    location: Optional[str] = Form(None),  # City/Town
    # USA-specific field
    citizenshipStatus: Optional[str] = Form("Citizen"),  # Relevant for USA only
    # India-specific fields (optional)
    caste: Optional[str] = Form(None),
    motherTongue: Optional[str] = Form(None),
    familyType: Optional[str] = Form(None),
    familyValues: Optional[str] = Form(None),
    # Educational Information
    educationHistory: Optional[str] = Form(None),  # JSON string array of education entries
    # Professional & Work Related Information
    workExperience: Optional[str] = Form(None),  # JSON string array of work experience entries
    workLocation: Optional[str] = Form(None),  # Renamed from workplace
    linkedinUrl: Optional[str] = Form(None),
    # About Me and Partner Information
    familyBackground: Optional[str] = Form(None),
    aboutMe: Optional[str] = Form(None),  # Renamed from aboutYou
    partnerPreference: Optional[str] = Form(None),
    # Partner Matching Criteria (JSON string)
    partnerCriteria: Optional[str] = Form(None),  # JSON string of structured criteria,
    # New dating-app specific fields
    relationshipStatus: Optional[str] = Form(None),
    lookingFor: Optional[str] = Form(None),
    interests: Optional[str] = Form(None),
    languages: Optional[str] = Form(None),
    drinking: Optional[str] = Form(None),
    smoking: Optional[str] = Form(None),
    # religion moved to main preferences section above
    bodyType: Optional[str] = Form(None),
    occupation: Optional[str] = Form(None),
    incomeRange: Optional[str] = Form(None),
    hasChildren: Optional[str] = Form(None),
    wantsChildren: Optional[str] = Form(None),
    pets: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    # Legal consent fields
    agreedToAge: bool = Form(False),
    agreedToTerms: bool = Form(False),
    agreedToPrivacy: bool = Form(False),
    agreedToGuidelines: bool = Form(False),
    agreedToDataProcessing: bool = Form(False),
    agreedToMarketing: bool = Form(False),
    images: List[UploadFile] = File(default=[]),
    request: Request = None,
    db = Depends(get_database)
):
    """Register a new user with profile details and images"""
    logger.info(f"📝 Registration attempt for username: {username}")
    logger.debug(f"Registration data - Email: {contactEmail}, Name: {firstName} {lastName}")
    
    # Validate legal consents (CRITICAL FOR LEGAL COMPLIANCE)
    if not agreedToAge:
        logger.warning(f"⚠️ Registration failed: User '{username}' did not confirm age")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must confirm that you are at least 18 years old"
        )
    
    if not agreedToTerms:
        logger.warning(f"⚠️ Registration failed: User '{username}' did not agree to Terms of Service")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must agree to the Terms of Service"
        )
    
    if not agreedToPrivacy:
        logger.warning(f"⚠️ Registration failed: User '{username}' did not agree to Privacy Policy")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must agree to the Privacy Policy"
        )
    
    if not agreedToGuidelines:
        logger.warning(f"⚠️ Registration failed: User '{username}' did not agree to Community Guidelines")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must agree to follow the Community Guidelines"
        )
    
    if not agreedToDataProcessing:
        logger.warning(f"⚠️ Registration failed: User '{username}' did not consent to data processing")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must consent to data processing for matchmaking purposes"
        )
    
    logger.info(f"✅ Legal consents validated for user '{username}'")
    
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
    
    # Generate unique profileId
    profile_id = await generate_unique_profile_id(db)
    logger.debug(f"Generated profileId: {profile_id} for user '{username}'")
    
    # Create user document
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    
    # Auto-calculate workingStatus from workExperience (if it gets passed later)
    # For now, set to "No" by default during registration
    workingStatus = "No"  # Will be updated when workExperience is added
    
    user_data = {
        # Basic Information
        "username": username,
        "profileId": profile_id,  # 8-char unique alphanumeric ID
        "password": hashed_password,
        "firstName": firstName,
        "lastName": lastName,
        "contactNumber": contactNumber,
        "contactEmail": contactEmail,
        "dateOfBirth": dateOfBirth,  # Renamed from dob
        "gender": gender,  # Renamed from sex
        "height": height,
        "heightInches": parse_height_to_inches(height),  # Numeric for searching
        # Preferences & Cultural Information
        "religion": religion,
        "languagesSpoken": json.loads(languagesSpoken) if languagesSpoken else [],
        "castePreference": castePreference,
        "eatingPreference": eatingPreference,
        # Residential Information
        "countryOfOrigin": countryOfOrigin,
        "countryOfResidence": countryOfResidence,
        "state": state,
        "location": location,
        # USA-specific field
        "citizenshipStatus": citizenshipStatus if countryOfResidence == "US" else None,
        # India-specific fields
        "caste": caste,
        "motherTongue": motherTongue,
        "familyType": familyType,
        "familyValues": familyValues,
        # Educational Information
        "educationHistory": json.loads(educationHistory) if educationHistory else [],
        # Professional & Work Related Information
        "workExperience": json.loads(workExperience) if workExperience else [],
        "workingStatus": workingStatus,  # Auto-set to "No" initially
        "workLocation": workLocation,
        "linkedinUrl": linkedinUrl,
        # About Me and Partner Information
        "familyBackground": familyBackground,
        "aboutMe": aboutMe,  # Renamed from aboutYou
        "partnerPreference": partnerPreference,
        "partnerCriteria": json.loads(partnerCriteria) if partnerCriteria else None,
        # New dating-app fields
        "relationshipStatus": relationshipStatus,
        "lookingFor": lookingFor,
        "interests": interests,
        "languages": languages,
        "drinking": drinking,
        "smoking": smoking,
        # religion now in main preferences section above
        "bodyType": bodyType,
        "occupation": occupation,
        "incomeRange": incomeRange,
        "hasChildren": hasChildren,
        "wantsChildren": wantsChildren,
        "pets": pets,
        "bio": bio,
        "images": image_paths,
        # Legal consent metadata (for audit trail and GDPR compliance)
        "agreedToAge": agreedToAge,
        "agreedToTerms": agreedToTerms,
        "agreedToPrivacy": agreedToPrivacy,
        "agreedToGuidelines": agreedToGuidelines,
        "agreedToDataProcessing": agreedToDataProcessing,
        "agreedToMarketing": agreedToMarketing,
        "termsAgreedAt": now,
        "privacyAgreedAt": now,
        "consentIpAddress": request.client.host if request else None,
        "consentUserAgent": request.headers.get("user-agent") if request else None,
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
    
    # Remove consent metadata (backend-only fields)
    remove_consent_metadata(created_user)
    
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
    
    # Remove consent metadata (backend-only fields)
    remove_consent_metadata(user)
    
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
    
    # Remove consent metadata (backend-only fields)
    remove_consent_metadata(user)
    
    # Convert image paths to full URLs
    user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
    
    # Apply PII masking if requester is not the profile owner
    from pii_security import mask_user_pii, check_access_granted
    
    access_granted = False
    if requester:
        access_granted = await check_access_granted(db, requester, username)
        logger.info(f"🔐 PII access for {requester} viewing {username}: {access_granted}")
    
    user = mask_user_pii(user, requester, access_granted)
    
    # Include visible meta fields if enabled
    if user.get('metaFieldsVisibleToPublic', False):
        user['visibleMetaFields'] = {
            'idVerified': user.get('idVerified', False),
            'emailVerified': user.get('emailVerified', False),
            'phoneVerified': user.get('phoneVerified', False),
            'employmentVerified': user.get('employmentVerified', False),
            'educationVerified': user.get('educationVerified', False),
            'backgroundCheckStatus': user.get('backgroundCheckStatus'),
            'isPremium': user.get('isPremium', False),
            'premiumStatus': user.get('premiumStatus', 'free'),
            'isFeatured': user.get('isFeatured', False),
            'isStaffPick': user.get('isStaffPick', False),
            'profileRank': user.get('profileRank'),
            'trustScore': user.get('trustScore', 50),
        }
    
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
    dateOfBirth: Optional[str] = Form(None),  # NEW: consistent naming
    sex: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),  # NEW: consistent naming
    height: Optional[str] = Form(None),
    # Regional/Cultural fields
    religion: Optional[str] = Form(None),  # NEW
    languagesSpoken: Optional[str] = Form(None),  # NEW: JSON array
    countryOfOrigin: Optional[str] = Form(None),  # NEW
    countryOfResidence: Optional[str] = Form(None),  # NEW
    state: Optional[str] = Form(None),  # NEW
    caste: Optional[str] = Form(None),  # NEW: India-specific
    motherTongue: Optional[str] = Form(None),  # NEW: India-specific
    familyType: Optional[str] = Form(None),  # NEW
    familyValues: Optional[str] = Form(None),  # NEW
    castePreference: Optional[str] = Form(None),
    eatingPreference: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    # Education & Work
    education: Optional[str] = Form(None),
    educationHistory: Optional[str] = Form(None),  # JSON string
    workExperience: Optional[str] = Form(None),  # JSON string
    workLocation: Optional[str] = Form(None),  # NEW
    linkedinUrl: Optional[str] = Form(None),
    workingStatus: Optional[str] = Form(None),
    workplace: Optional[str] = Form(None),
    citizenshipStatus: Optional[str] = Form(None),
    # Personal/Lifestyle fields
    relationshipStatus: Optional[str] = Form(None),  # NEW
    lookingFor: Optional[str] = Form(None),  # NEW
    bodyType: Optional[str] = Form(None),  # NEW
    drinking: Optional[str] = Form(None),  # NEW
    smoking: Optional[str] = Form(None),  # NEW
    hasChildren: Optional[str] = Form(None),  # NEW
    wantsChildren: Optional[str] = Form(None),  # NEW
    pets: Optional[str] = Form(None),  # NEW
    interests: Optional[str] = Form(None),  # NEW: comma-separated text
    languages: Optional[str] = Form(None),  # NEW: comma-separated text (different from languagesSpoken)
    # Background & About
    familyBackground: Optional[str] = Form(None),
    aboutYou: Optional[str] = Form(None),
    aboutMe: Optional[str] = Form(None),  # NEW: consistent naming
    partnerPreference: Optional[str] = Form(None),
    partnerCriteria: Optional[str] = Form(None),  # NEW: JSON object with all criteria
    images: List[UploadFile] = File(default=[]),
    imagesToDelete: Optional[str] = Form(None),
    imageOrder: Optional[str] = Form(None),  # NEW: JSON array of image URLs in desired order
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
    
    # Prepare update data - only update fields that are provided and not empty
    import json
    update_data = {}
    
    # Basic Information
    if firstName is not None and firstName.strip():
        update_data["firstName"] = firstName.strip()
    if lastName is not None and lastName.strip():
        update_data["lastName"] = lastName.strip()
    if contactNumber is not None and contactNumber.strip():
        update_data["contactNumber"] = contactNumber.strip()
    if contactEmail is not None and contactEmail.strip():
        update_data["contactEmail"] = contactEmail.strip()
    
    # Handle both old and new field names for date of birth
    if dateOfBirth is not None and dateOfBirth.strip():
        update_data["dateOfBirth"] = dateOfBirth.strip()
        update_data["dob"] = dateOfBirth.strip()  # Keep both for compatibility
    elif dob is not None and dob.strip():
        update_data["dob"] = dob.strip()
        update_data["dateOfBirth"] = dob.strip()  # Keep both for compatibility
    
    # Handle both old and new field names for gender
    if gender is not None and gender.strip():
        update_data["gender"] = gender.strip()
        update_data["sex"] = gender.strip()  # Keep both for compatibility
    elif sex is not None and sex.strip():
        update_data["sex"] = sex.strip()
        update_data["gender"] = sex.strip()  # Keep both for compatibility
    
    if height is not None and height.strip():
        update_data["height"] = height.strip()
        update_data["heightInches"] = parse_height_to_inches(height.strip())  # Numeric for searching
    
    # Regional/Cultural fields
    if religion is not None and religion.strip():
        update_data["religion"] = religion.strip()
    if countryOfOrigin is not None and countryOfOrigin.strip():
        update_data["countryOfOrigin"] = countryOfOrigin.strip()
    if countryOfResidence is not None and countryOfResidence.strip():
        update_data["countryOfResidence"] = countryOfResidence.strip()
    if state is not None and state.strip():
        update_data["state"] = state.strip()
    if caste is not None and caste.strip():
        update_data["caste"] = caste.strip()
    if motherTongue is not None and motherTongue.strip():
        update_data["motherTongue"] = motherTongue.strip()
    if familyType is not None and familyType.strip():
        update_data["familyType"] = familyType.strip()
    if familyValues is not None and familyValues.strip():
        update_data["familyValues"] = familyValues.strip()
    if castePreference is not None and castePreference.strip():
        update_data["castePreference"] = castePreference.strip()
    if eatingPreference is not None and eatingPreference.strip():
        update_data["eatingPreference"] = eatingPreference.strip()
    if location is not None and location.strip():
        update_data["location"] = location.strip()
    
    # Education & Work
    if education is not None and education.strip():
        update_data["education"] = education.strip()
    if workingStatus is not None and workingStatus.strip():
        update_data["workingStatus"] = workingStatus.strip()
    if workplace is not None and workplace.strip():
        update_data["workplace"] = workplace.strip()
    if workLocation is not None and workLocation.strip():
        update_data["workLocation"] = workLocation.strip()
    if citizenshipStatus is not None and citizenshipStatus.strip():
        update_data["citizenshipStatus"] = citizenshipStatus.strip()
    
    # Personal/Lifestyle fields
    if relationshipStatus is not None and relationshipStatus.strip():
        update_data["relationshipStatus"] = relationshipStatus.strip()
    if lookingFor is not None and lookingFor.strip():
        update_data["lookingFor"] = lookingFor.strip()
    if bodyType is not None and bodyType.strip():
        update_data["bodyType"] = bodyType.strip()
    if drinking is not None and drinking.strip():
        update_data["drinking"] = drinking.strip()
    if smoking is not None and smoking.strip():
        update_data["smoking"] = smoking.strip()
    if hasChildren is not None and hasChildren.strip():
        update_data["hasChildren"] = hasChildren.strip()
    if wantsChildren is not None and wantsChildren.strip():
        update_data["wantsChildren"] = wantsChildren.strip()
    if pets is not None and pets.strip():
        update_data["pets"] = pets.strip()
    if interests is not None and interests.strip():
        update_data["interests"] = interests.strip()
    if languages is not None and languages.strip():
        update_data["languages"] = languages.strip()
    
    # Background & About
    if familyBackground is not None and familyBackground.strip():
        update_data["familyBackground"] = familyBackground.strip()
    
    # Handle both old and new field names for about
    if aboutMe is not None and aboutMe.strip():
        update_data["aboutMe"] = aboutMe.strip()
        update_data["aboutYou"] = aboutMe.strip()  # Keep both for compatibility
    elif aboutYou is not None and aboutYou.strip():
        update_data["aboutYou"] = aboutYou.strip()
        update_data["aboutMe"] = aboutYou.strip()  # Keep both for compatibility
    
    if partnerPreference is not None and partnerPreference.strip():
        update_data["partnerPreference"] = partnerPreference.strip()
    
    # Handle new structured fields (JSON arrays/objects)
    if educationHistory is not None and educationHistory.strip():
        try:
            update_data["educationHistory"] = json.loads(educationHistory)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON for educationHistory: {educationHistory}")
    
    if workExperience is not None and workExperience.strip():
        try:
            update_data["workExperience"] = json.loads(workExperience)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON for workExperience: {workExperience}")
    
    if languagesSpoken is not None and languagesSpoken.strip():
        try:
            update_data["languagesSpoken"] = json.loads(languagesSpoken)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON for languagesSpoken: {languagesSpoken}")
    
    if partnerCriteria is not None and partnerCriteria.strip():
        try:
            update_data["partnerCriteria"] = json.loads(partnerCriteria)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON for partnerCriteria: {partnerCriteria}")
    
    if linkedinUrl is not None and linkedinUrl.strip():
        update_data["linkedinUrl"] = linkedinUrl.strip()
    
    logger.info(f"📝 Fields to update: {list(update_data.keys())}")
    
    # Handle image deletions and additions
    existing_images = user.get("images", [])
    images_modified = False
    
    # Handle image deletions
    if imagesToDelete:
        try:
            # Parse the imagesToDelete (could be JSON array or comma-separated)
            import json
            try:
                images_to_delete_list = json.loads(imagesToDelete)
            except:
                images_to_delete_list = [img.strip() for img in imagesToDelete.split(',') if img.strip()]
            
            if images_to_delete_list:
                logger.info(f"🗑️ Deleting {len(images_to_delete_list)} image(s) for user '{username}'")
                # Extract just the filename from full URLs to match against stored paths
                for img_to_delete in images_to_delete_list:
                    # Handle both full URLs and relative paths
                    if img_to_delete.startswith('http'):
                        # Extract the path after /uploads/
                        img_path = img_to_delete.split('/uploads/')[-1] if '/uploads/' in img_to_delete else img_to_delete
                    else:
                        img_path = img_to_delete
                    
                    # Remove from existing images if it matches
                    existing_images = [img for img in existing_images if img != img_path and not img.endswith(img_path)]
                    logger.debug(f"  Removed: {img_path}")
                
                images_modified = True
                logger.info(f"✅ Removed {len(images_to_delete_list)} image(s)")
        except Exception as e:
            logger.error(f"❌ Error deleting images: {e}", exc_info=True)
    
    # Handle new images
    if images and len(images) > 0:
        logger.info(f"📸 Processing {len(images)} new image(s) for user '{username}'")
        try:
            new_image_paths = await save_multiple_files(images)
            # Append new images to existing ones (after deletions)
            existing_images = existing_images + new_image_paths
            images_modified = True
            logger.info(f"✅ Added {len(new_image_paths)} new image(s)")
        except Exception as e:
            logger.error(f"❌ Error saving images: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save images: {str(e)}"
            )
    
    # Handle image reordering if provided
    if imageOrder and existing_images:
        try:
            # Parse imageOrder JSON array
            ordered_urls = json.loads(imageOrder)
            logger.info(f"🔄 Reordering {len(ordered_urls)} images from imageOrder")
            logger.info(f"   Current existing_images: {existing_images}")
            logger.info(f"   Requested order: {ordered_urls}")
            
            # Convert full URLs to relative paths for matching
            def extract_relative_path(url):
                """Extract relative path from full URL"""
                if '/uploads/' in url:
                    return url.split('/uploads/')[-1]
                return url
            
            # Create mapping of relative paths to maintain order
            ordered_paths = []
            for url in ordered_urls:
                rel_path = extract_relative_path(url)
                if rel_path in existing_images:
                    ordered_paths.append(rel_path)
                else:
                    logger.warning(f"   ⚠️ Image {rel_path} not found in existing_images")
            
            # Add any images that weren't in the order list (shouldn't happen, but safety)
            for img in existing_images:
                if img not in ordered_paths:
                    ordered_paths.append(img)
                    logger.warning(f"   ⚠️ Image {img} not in imageOrder, appending to end")
            
            # Check if order actually changed
            if ordered_paths != existing_images:
                existing_images = ordered_paths
                images_modified = True
                logger.info(f"✅ Images reordered successfully: {existing_images}")
            else:
                logger.info(f"ℹ️ Image order unchanged")
        except Exception as e:
            logger.error(f"❌ Failed to reorder images: {e}", exc_info=True)
            # Continue with original order if reordering fails
    
    # Update images field if modified
    if images_modified:
        update_data["images"] = existing_images
        logger.info(f"📸 Final image count: {len(existing_images)}")
        logger.info(f"📸 Images field in update_data: {existing_images}")
    else:
        logger.info(f"ℹ️ Images not modified, not updating images field")
    
    # Check if there's anything to update
    if not update_data:
        logger.warning(f"⚠️ No valid fields to update for user '{username}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields provided for update"
        )
    
    # Update timestamp
    from datetime import datetime
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    
    # Log what's being updated
    logger.info(f"📝 update_data keys: {list(update_data.keys())}")
    
    # Update in database
    try:
        logger.info(f"💾 Updating profile for user '{username}' with {len(update_data)} fields...")
        result = await db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            logger.error(f"❌ User '{username}' not found during update")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        logger.info(f"✅ Profile updated successfully for user '{username}' (modified: {result.modified_count} fields)")
        
        # Get updated user
        updated_user = await db.users.find_one({"username": username})
        updated_user.pop("password", None)
        updated_user.pop("_id", None)
        # Remove consent metadata (backend-only fields)
        remove_consent_metadata(updated_user)
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

# ===== USER PREFERENCES ENDPOINTS =====

@router.get("/preferences")
async def get_user_preferences(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get current user's preferences (theme, etc.)"""
    username = current_user.get("username")
    logger.info(f"⚙️ Getting preferences for user '{username}'")
    
    try:
        user = await db.users.find_one({"username": username})
        if not user:
            logger.warning(f"⚠️ User '{username}' not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        preferences = {
            "themePreference": user.get("themePreference", "light-blue")
        }
        
        logger.info(f"✅ Retrieved preferences for '{username}': {preferences}")
        return preferences
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching preferences: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch preferences: {str(e)}"
        )

@router.put("/preferences")
async def update_user_preferences(
    preferences: dict,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update current user's preferences"""
    username = current_user.get("username")
    theme_preference = preferences.get("themePreference")
    
    logger.info(f"⚙️ Updating preferences for user '{username}': theme={theme_preference}")
    
    # Validate theme
    valid_themes = ['light-blue', 'dark', 'light-pink', 'light-gray', 'ultra-light-gray']
    if theme_preference and theme_preference not in valid_themes:
        logger.warning(f"⚠️ Invalid theme preference: {theme_preference}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid theme. Must be one of: {', '.join(valid_themes)}"
        )
    
    try:
        # Update user preferences
        update_data = {
            "themePreference": theme_preference,
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            logger.warning(f"⚠️ User '{username}' not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        logger.info(f"✅ Updated preferences for '{username}': theme={theme_preference}")
        return {
            "message": "Preferences updated successfully",
            "themePreference": theme_preference
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating preferences: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preferences: {str(e)}"
        )

@router.get("/admin/users")
async def get_all_users(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    role: Optional[str] = None,
    db = Depends(get_database)
):
    """Get all users with pagination and filtering - Admin only endpoint"""
    logger.info(f"🔐 Admin request: Get users (page={page}, limit={limit}, search={search}, status_filter={status_filter}, role={role})")
    
    try:
        # Build query filter
        query = {}
        
        # Search filter (username, email, firstName, lastName)
        if search:
            search_regex = {"$regex": search, "$options": "i"}  # Case-insensitive
            query["$or"] = [
                {"username": search_regex},
                {"email": search_regex},
                {"firstName": search_regex},
                {"lastName": search_regex}
            ]
            logger.debug(f"🔍 Search filter applied: {search}")
        
        # Status filter (status is nested: status.status)
        if status_filter:
            query["status.status"] = status_filter
            logger.debug(f"📊 Status filter applied: {status_filter}")
        
        # Role filter
        if role:
            query["role_name"] = role
            logger.debug(f"👤 Role filter applied: {role}")
        
        # Get total count for pagination
        total_count = await db.users.count_documents(query)
        total_pages = (total_count + limit - 1) // limit  # Ceiling division
        
        # Fetch users with pagination
        skip = (page - 1) * limit
        users_cursor = db.users.find(query).skip(skip).limit(limit)
        users = await users_cursor.to_list(length=limit)
        
        # Remove sensitive data
        for user in users:
            user.pop("password", None)
            user.pop("_id", None)
            # Convert image paths to full URLs
            user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
        
        logger.info(f"✅ Retrieved {len(users)} users (page {page}/{total_pages}, total: {total_count})")
        return {
            "users": users,
            "count": len(users),
            "total": total_count,
            "page": page,
            "totalPages": total_pages
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
    status_filter: str = "",
    sortBy: str = "newest",
    sortOrder: str = "desc",
    page: int = 1,
    limit: int = 20,
    db = Depends(get_database)
):
    """Advanced search for users with filters"""
    logger.info(f"🔍 Search request - keyword: '{keyword}', status_filter: '{status_filter}', page: {page}, limit: {limit}")

    # Build query
    query = {}
    
    # Status filter - only show active users by default
    if status_filter:
        query["status.status"] = {"$regex": f"^{status_filter}$", "$options": "i"}
    else:
        # Default to active users only if no status_filter specified
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
        query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}  # Case-insensitive match

    # Age filter - Calculate DOB range from age range
    # Note: Older age = earlier DOB, Younger age = later DOB
    if ageMin > 0 or ageMax > 0:
        from datetime import datetime, timedelta
        now = datetime.now()

        # ageMax (younger) → person born MORE RECENTLY → DOB >= max_date
        if ageMax > 0:
            max_date = now - timedelta(days=ageMax * 365.25)
            query["dob"] = {"$gte": max_date.strftime("%Y-%m-%d")}

        # ageMin (older) → person born LONGER AGO → DOB <= min_date
        if ageMin > 0:
            min_date = now - timedelta(days=ageMin * 365.25)
            if "dob" in query:
                query["dob"]["$lte"] = min_date.strftime("%Y-%m-%d")
            else:
                query["dob"] = {"$lte": min_date.strftime("%Y-%m-%d")}

    # Height filter - now using heightInches (numeric field)
    if heightMin > 0 or heightMax > 0:
        height_query = {}
        if heightMin > 0:
            height_query["$gte"] = heightMin
        if heightMax > 0:
            height_query["$lte"] = heightMax
        query["heightInches"] = height_query

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
            # Remove consent metadata (backend-only fields)
            remove_consent_metadata(user)
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
        favorites_cursor = db.favorites.find({"userUsername": username}).sort("displayOrder", 1)
        favorites = await favorites_cursor.to_list(100)

        # Get full user details for each favorite
        favorite_users = []
        for fav in favorites:
            user = await db.users.find_one({"username": fav["favoriteUsername"]})
            if user:
                user.pop("password", None)
                user.pop("_id", None)
                remove_consent_metadata(user)
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                user["addedToFavoritesAt"] = fav["createdAt"]
                favorite_users.append(user)

        logger.info(f"✅ Found {len(favorite_users)} favorites for {username}")
        return {"favorites": favorite_users}
    except Exception as e:
        logger.error(f"❌ Error fetching favorites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/favorites/{username}/reorder")
async def reorder_favorites(username: str, order: List[str], db = Depends(get_database)):
    """Update the display order of favorites"""
    logger.info(f"🔄 Reordering favorites for {username}")
    
    try:
        # Update each favorite with its new order index
        for index, favorite_username in enumerate(order):
            await db.favorites.update_one(
                {
                    "userUsername": username,
                    "favoriteUsername": favorite_username
                },
                {"$set": {"displayOrder": index}}
            )
        
        logger.info(f"✅ Reordered {len(order)} favorites for {username}")
        return {"message": "Favorites reordered successfully", "count": len(order)}
    except Exception as e:
        logger.error(f"❌ Error reordering favorites: {e}", exc_info=True)
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
        shortlist_cursor = db.shortlists.find({"userUsername": username}).sort("displayOrder", 1)
        shortlist = await shortlist_cursor.to_list(100)

        # Get full user details for each shortlisted user
        shortlisted_users = []
        for item in shortlist:
            user = await db.users.find_one({"username": item["shortlistedUsername"]})
            if user:
                user.pop("password", None)
                user.pop("_id", None)
                remove_consent_metadata(user)
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                user["notes"] = item.get("notes")
                user["addedToShortlistAt"] = item["createdAt"]
                shortlisted_users.append(user)

        logger.info(f"✅ Found {len(shortlisted_users)} shortlisted users for {username}")
        return {"shortlist": shortlisted_users}
    except Exception as e:
        logger.error(f"❌ Error fetching shortlist: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/shortlist/{username}/reorder")
async def reorder_shortlist(username: str, order: List[str], db = Depends(get_database)):
    """Update the display order of shortlist"""
    logger.info(f"🔄 Reordering shortlist for {username}")
    
    try:
        # Update each shortlist item with its new order index
        for index, shortlisted_username in enumerate(order):
            await db.shortlists.update_one(
                {
                    "userUsername": username,
                    "shortlistedUsername": shortlisted_username
                },
                {"$set": {"displayOrder": index}}
            )
        
        logger.info(f"✅ Reordered {len(order)} shortlist items for {username}")
        return {"message": "Shortlist reordered successfully", "count": len(order)}
    except Exception as e:
        logger.error(f"❌ Error reordering shortlist: {e}", exc_info=True)
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

    # AUTO-REMOVE from favorites and shortlist when adding to exclusions
    try:
        # Remove from favorites if present
        favorites_result = await db.favorites.delete_one({
            "userUsername": username,
            "favoriteUsername": target_username
        })
        if favorites_result.deleted_count > 0:
            logger.info(f"🗑️ Auto-removed {target_username} from {username}'s favorites (due to exclusion)")
        
        # Remove from shortlist if present
        shortlist_result = await db.shortlist.delete_one({
            "userUsername": username,
            "shortlistUsername": target_username
        })
        if shortlist_result.deleted_count > 0:
            logger.info(f"🗑️ Auto-removed {target_username} from {username}'s shortlist (due to exclusion)")
    except Exception as e:
        logger.warning(f"⚠️ Error auto-removing from favorites/shortlist: {e}")
    
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
        exclusions_cursor = db.exclusions.find({"userUsername": username}).sort("displayOrder", 1)
        exclusions = await exclusions_cursor.to_list(100)

        # Get full user details for each excluded user
        excluded_users = []
        for exc in exclusions:
            user = await db.users.find_one({"username": exc["excludedUsername"]})
            if user:
                user.pop("password", None)
                user.pop("_id", None)
                remove_consent_metadata(user)
                user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
                user["excludedAt"] = exc.get("createdAt")
                excluded_users.append(user)

        logger.info(f"✅ Found {len(excluded_users)} exclusions for {username}")
        return {"exclusions": excluded_users}
    except Exception as e:
        logger.error(f"❌ Error fetching exclusions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/exclusions/{username}/reorder")
async def reorder_exclusions(username: str, order: List[str], db = Depends(get_database)):
    """Update the display order of exclusions"""
    logger.info(f"🔄 Reordering exclusions for {username}")
    
    try:
        # Update each exclusion with its new order index
        for index, excluded_username in enumerate(order):
            await db.exclusions.update_one(
                {
                    "userUsername": username,
                    "excludedUsername": excluded_username
                },
                {"$set": {"displayOrder": index}}
            )
        
        logger.info(f"✅ Reordered {len(order)} exclusions for {username}")
        return {"message": "Exclusions reordered successfully", "count": len(order)}
    except Exception as e:
        logger.error(f"❌ Error reordering exclusions: {e}", exc_info=True)
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

# IMPORTANT: Specific routes MUST come before generic /{username} routes!
# Otherwise /messages/conversations matches /messages/{username} first

@router.get("/messages/conversations")
async def get_conversations_enhanced(
    username: str = Query(...),
    db = Depends(get_database)
):
    """Get list of all conversations with privacy checks"""
    logger.info(f"💬 ========== GET /messages/conversations called for username={username} ==========")
    
    # Check if current user is admin
    current_user = await db.users.find_one({"username": username})
    is_admin = current_user and current_user.get("username") == "admin"
    
    try:
        # Get unique conversations
        # For non-admin users, filter out explicitly hidden messages (isVisible=False)
        # But include messages where isVisible is True, null, or doesn't exist (old messages)
        if not is_admin:
            match_stage = {
                "$and": [
                    {"$or": [
                        {"fromUsername": username},
                        {"toUsername": username}
                    ]},
                    {"$or": [
                        {"isVisible": {"$ne": False}},  # Include True, null, undefined
                        {"isVisible": {"$exists": False}}  # Include old messages without field
                    ]}
                ]
            }
        else:
            # Admin sees all messages
            match_stage = {
                "$or": [
                    {"fromUsername": username},
                    {"toUsername": username}
                ]
            }
        
        pipeline = [
            {"$match": match_stage},
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
                logger.info(f"⚠️ Skipping conversation with {other_username} - not visible")
                continue
            
            user = await db.users.find_one({"username": other_username})
            if not user:
                logger.warning(f"⚠️ Skipping conversation with {other_username} - user not found in database")
                continue
            
            # Build user profile
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
        
        logger.info(f"✅ ========== Returning {len(result)} conversations for {username} ==========")
        response = {"conversations": result}
        logger.info(f"Response keys: {list(response.keys())}")
        return response
    except Exception as e:
        logger.error(f"❌ Error fetching conversations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
                remove_consent_metadata(user)
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

@router.get("/messages/recent/{username}")
async def get_recent_conversations(
    username: str, 
    limit: int = Query(10, ge=1, le=50, description="Maximum conversations to return"),
    db = Depends(get_database)
):
    """Get recent conversations with unread counts and online status"""
    from redis_manager import get_redis_manager
    logger.info(f"💬 Getting recent conversations for {username}")

    try:
        # Get unique conversations with aggregation
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
                "$sort": {"createdAt": -1}
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
                    "lastMessage": {"$first": "$$ROOT"},
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
            {"$sort": {"lastMessage.createdAt": -1}},
            {"$limit": limit}
        ]

        conversations = await db.messages.aggregate(pipeline).to_list(limit)
        redis = get_redis_manager()
        
        # Get user details and online status for each conversation
        result = []
        for conv in conversations:
            other_username = conv["_id"]
            user = await db.users.find_one({"username": other_username})
            
            if user:
                # Check online status
                is_online = redis.is_user_online(other_username)
                
                result.append({
                    "username": other_username,
                    "firstName": user.get("firstName", ""),
                    "lastName": user.get("lastName", ""),
                    "avatar": get_full_image_url(user.get("images", [None])[0]) if user.get("images") else None,
                    "lastMessage": conv["lastMessage"].get("content", ""),
                    "timestamp": conv["lastMessage"].get("createdAt", ""),
                    "unreadCount": conv.get("unreadCount", 0),
                    "isOnline": is_online
                })

        logger.info(f"✅ Found {len(result)} recent conversations for {username}")
        return {"conversations": result, "count": len(result)}
    except Exception as e:
        logger.error(f"❌ Error fetching conversations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/messages/unread-count/{username}")
async def get_unread_count(username: str, db = Depends(get_database)):
    """Get total unread message count for user"""
    logger.info(f"📊 Getting unread count for {username}")

    try:
        unread_count = await db.messages.count_documents({
            "toUsername": username,
            "isRead": False
        })
        
        logger.info(f"✅ User {username} has {unread_count} unread messages")
        return {"unreadCount": unread_count}
    except Exception as e:
        logger.error(f"❌ Error fetching unread count: {e}", exc_info=True)
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

@router.post("/messages/send")
async def send_message_enhanced(
    message_data: MessageCreate,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Send a message with privacy checks and profanity filtering"""
    logger.info(f"💬 Enhanced message from {username} to {message_data.toUsername}")
    
    # Check for profanity FIRST
    from profanity_filter import check_message_content
    content_check = check_message_content(message_data.content)
    
    if not content_check["is_clean"]:
        # Log violation
        logger.warning(
            f"⚠️ Profanity detected from {username}: "
            f"violations={content_check['violations']}, severity={content_check['severity']}"
        )
        
        # Record violation in database
        await db.content_violations.insert_one({
            "username": username,
            "type": "message_profanity",
            "content": message_data.content,
            "violations": content_check["violations"],
            "severity": content_check["severity"],
            "recipient": message_data.toUsername,
            "timestamp": datetime.utcnow()
        })
        
        # Check user's violation count
        violation_count = await db.content_violations.count_documents({
            "username": username,
            "type": "message_profanity"
        })
        
        # Enforce consequences based on violation count
        if violation_count >= 3:
            # 3rd strike - ban user
            await db.users.update_one(
                {"username": username},
                {"$set": {"status": {"status": "banned", "reason": "Repeated profanity violations"}}}
            )
            raise HTTPException(
                status_code=403,
                detail="Your account has been banned due to repeated violations of community guidelines."
            )
        elif violation_count >= 2:
            # 2nd strike - suspend for 7 days
            from datetime import timedelta
            suspend_until = datetime.utcnow() + timedelta(days=7)
            await db.users.update_one(
                {"username": username},
                {"$set": {"status": {"status": "suspended", "until": suspend_until.isoformat()}}}
            )
            raise HTTPException(
                status_code=403,
                detail="Your account has been suspended for 7 days due to inappropriate language. "
                       "This is your second violation. A third violation will result in permanent ban."
            )
        else:
            # 1st strike - reject message with warning
            raise HTTPException(
                status_code=400,
                detail="⚠️ Your message contains inappropriate content. Please maintain professional "
                       "communication. Repeated violations will result in account suspension or ban."
            )
    
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

@router.get("/violations/{username}")
async def get_user_violations(
    username: str,
    db = Depends(get_database)
):
    """Get user's content violation count and status"""
    logger.info(f"📊 Getting violation info for user '{username}'")
    
    # Count violations
    violation_count = await db.content_violations.count_documents({
        "username": username,
        "type": "message_profanity"
    })
    
    # Get user status
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    status = user.get("status", {})
    account_status = status.get("status", "active")
    
    # Determine warning level
    warning_level = "none"
    warning_message = ""
    
    if violation_count >= 3:
        warning_level = "banned"
        warning_message = "Account banned due to repeated violations"
    elif violation_count == 2:
        warning_level = "suspended"
        warning_message = f"Strike 2 of 3: Account suspended. Final warning before permanent ban."
    elif violation_count == 1:
        warning_level = "warning"
        warning_message = f"Strike 1 of 3: Warning issued. Please maintain professional communication."
    
    return {
        "username": username,
        "violationCount": violation_count,
        "warningLevel": warning_level,
        "warningMessage": warning_message,
        "accountStatus": account_status,
        "suspendedUntil": status.get("until") if account_status == "suspended" else None
    }

@router.get("/messages/conversation/{other_username}")
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

# NOTE: /messages/conversations endpoint has been moved to line 1821 
# to ensure it matches BEFORE /messages/{username} generic route

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
            {"favoriteUsername": username}
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
                remove_consent_metadata(viewer)
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
    approve_data: PIIRequestApprove = Body(default=PIIRequestApprove()),
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
        
        # Calculate expiry date if duration specified
        expires_at = None
        if approve_data.durationDays:
            expires_at = datetime.utcnow() + timedelta(days=approve_data.durationDays)
        
        # Update request status
        await db.pii_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "approved",
                    "respondedAt": datetime.utcnow(),
                    "responseMessage": approve_data.responseMessage
                }
            }
        )
        
        # Grant access
        access_data = {
            "granterUsername": username,
            "grantedToUsername": request["requesterUsername"],
            "accessType": request["requestType"],
            "grantedAt": datetime.utcnow(),
            "expiresAt": expires_at,
            "isActive": True,
            "createdAt": datetime.utcnow()
        }
        
        logger.info(f"📝 Inserting PII access record: {access_data}")
        await db.pii_access.insert_one(access_data)
        
        logger.info(f"✅ PII request approved and access granted (expires: {expires_at or 'never'})")
        logger.info(f"🔑 Access granted: {username} → {request['requesterUsername']} for {request['requestType']}")
        return {"message": "Request approved and access granted", "expiresAt": expires_at}
    
    except Exception as e:
        logger.error(f"❌ Error approving PII request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/pii-requests/{request_id}/reject")
async def reject_pii_request(
    request_id: str,
    username: str = Query(...),
    reject_data: PIIRequestReject = Body(default=PIIRequestReject()),
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
                    "respondedAt": datetime.utcnow(),
                    "responseMessage": reject_data.responseMessage
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

@router.get("/pii-access/{username}/revoked")
async def get_revoked_access(
    username: str,
    db = Depends(get_database)
):
    """Get list of users whose access was revoked by this user"""
    logger.info(f"📊 Getting revoked PII access for {username}")
    
    try:
        access_records = await db.pii_access.find({
            "granterUsername": username,
            "isActive": False
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
        
        logger.info(f"✅ Found {len(result)} users with revoked access")
        return {"grantedAccess": result}
    
    except Exception as e:
        logger.error(f"❌ Error fetching revoked access: {e}", exc_info=True)
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
                    "expiresAt": access.get("expiresAt"),  # ✅ Include expiry
                    "accessIds": [],
                    "accessDetails": {}
                }
            
            user_access_map[granter]["accessTypes"].append(access["accessType"])
            user_access_map[granter]["accessIds"].append(str(access["_id"]))
            # Store detailed access info for each type
            user_access_map[granter]["accessDetails"][access["accessType"]] = {
                "grantedAt": access["grantedAt"],
                "expiresAt": access.get("expiresAt"),
                "accessId": str(access["_id"])
            }
        
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
                    "expiresAt": access_info["expiresAt"].isoformat() if access_info.get("expiresAt") else None,
                    "accessIds": access_info["accessIds"],
                    "accessDetails": {
                        k: {
                            "grantedAt": v["grantedAt"].isoformat(),
                            "expiresAt": v["expiresAt"].isoformat() if v.get("expiresAt") else None,
                            "accessId": v["accessId"]
                        }
                        for k, v in access_info["accessDetails"].items()
                    }
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
        # ✅ ADMIN BYPASS - Admins have access to all PII
        requester_user = await db.users.find_one({"username": requester})
        if requester_user:
            is_admin = (
                requester_user.get('role_name') == 'admin' or 
                requester == 'admin'
            )
            if is_admin:
                logger.info(f"🔓 Admin '{requester}' granted PII access to {profile_owner}'s {access_type}")
                return {
                    "hasAccess": True,
                    "accessType": access_type,
                    "reason": "admin_access"
                }
        
        # Check for active access
        query = {
            "granterUsername": profile_owner,
            "grantedToUsername": requester,
            "accessType": access_type,
            "isActive": True
        }
        
        logger.info(f"🔍 Checking PII access with query: {query}")
        access = await db.pii_access.find_one(query)
        logger.info(f"🔍 Found access record: {access is not None}")
        
        has_access = access is not None
        
        # Check if expired
        if has_access and access.get("expiresAt"):
            logger.info(f"⏰ Access expires at: {access['expiresAt']} (now: {datetime.utcnow()})")
            if access["expiresAt"] < datetime.utcnow():
                logger.info(f"❌ Access has expired!")
                has_access = False
                # Mark as inactive
                await db.pii_access.update_one(
                    {"_id": access["_id"]},
                    {"$set": {"isActive": False}}
                )
        
        logger.info(f"✅ Final access decision for {requester} → {profile_owner}/{access_type}: {has_access}")
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
    return {"username": username, "isOnline": online}

@router.post("/online-status/{username}/online")
async def mark_user_online(username: str):
    """Mark user as online and broadcast to all clients"""
    from redis_manager import get_redis_manager
    from websocket_manager import sio, broadcast_online_count
    
    redis = get_redis_manager()
    success = redis.set_user_online(username)
    
    if success:
        # Broadcast to all connected clients via WebSocket
        await sio.emit('user_online', {'username': username})
        await broadcast_online_count()
        logger.info(f"🟢 Broadcasted online status for '{username}'")
    
    return {"username": username, "online": success}

@router.post("/online-status/{username}/offline")
async def mark_user_offline(username: str):
    """Mark user as offline and broadcast to all clients"""
    from redis_manager import get_redis_manager
    from websocket_manager import sio, broadcast_online_count
    
    redis = get_redis_manager()
    success = redis.set_user_offline(username)
    
    if success:
        # Broadcast to all connected clients via WebSocket
        await sio.emit('user_offline', {'username': username})
        await broadcast_online_count()
        logger.info(f"⚪ Broadcasted offline status for '{username}'")
    
    return {"username": username, "offline": success}

@router.post("/online-status/{username}/refresh")
async def refresh_user_online(username: str):
    """Refresh user's online status (heartbeat)"""
    from redis_manager import get_redis_manager
    
    redis = get_redis_manager()
    success = redis.refresh_user_online(username)
    return {"username": username, "refreshed": success}

# ==================== ROLE CONFIGURATION ====================

@router.get("/roles/config")
async def get_role_config(db = Depends(get_database)):
    """Get role configuration (limits, permissions)"""
    logger.info("📋 Getting role configuration")
    
    try:
        # Get from database or return defaults
        config = await db.role_config.find_one({"_id": "default"})
        
        if not config:
            # Return default configuration
            default_config = {
                "limits": {
                    "admin": {
                        "favorites_max": -1,
                        "shortlist_max": -1,
                        "messages_per_day": -1,
                        "profile_views_per_day": -1,
                        "pii_requests_per_month": -1,
                        "search_results_max": -1
                    },
                    "moderator": {
                        "favorites_max": 50,
                        "shortlist_max": 30,
                        "messages_per_day": 100,
                        "profile_views_per_day": 50,
                        "pii_requests_per_month": 20,
                        "search_results_max": 100
                    },
                    "premium_user": {
                        "favorites_max": 30,
                        "shortlist_max": 20,
                        "messages_per_day": 50,
                        "profile_views_per_day": 30,
                        "pii_requests_per_month": 10,
                        "search_results_max": 50
                    },
                    "free_user": {
                        "favorites_max": 10,
                        "shortlist_max": 5,
                        "messages_per_day": 5,
                        "profile_views_per_day": 20,
                        "pii_requests_per_month": 3,
                        "search_results_max": 20
                    }
                }
            }
            logger.info("✅ Returning default role configuration")
            return default_config
        
        # Remove MongoDB _id from response
        config.pop("_id", None)
        logger.info("✅ Returning stored role configuration")
        return config
        
    except Exception as e:
        logger.error(f"❌ Error fetching role config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/roles/config")
async def update_role_config(
    config: Dict[str, Any],
    username: str = Query(...),
    db = Depends(get_database)
):
    """Update role configuration (admin only)"""
    logger.info(f"🔄 Updating role configuration by {username}")
    
    try:
        # Check if user is admin
        user = await db.users.find_one({"username": username})
        if not user or username != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Validate config structure
        if "limits" not in config:
            raise HTTPException(status_code=400, detail="Config must contain 'limits' key")
        
        required_roles = ["admin", "moderator", "premium_user", "free_user"]
        for role in required_roles:
            if role not in config["limits"]:
                raise HTTPException(status_code=400, detail=f"Missing limits for role: {role}")
        
        # Save to database
        config["_id"] = "default"
        config["updatedAt"] = datetime.utcnow()
        config["updatedBy"] = username
        
        await db.role_config.replace_one(
            {"_id": "default"},
            config,
            upsert=True
        )
        
        logger.info(f"✅ Role configuration updated by {username}")
        return {"message": "Role configuration updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating role config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ==================== TESTIMONIALS ====================

@router.post("/testimonials")
async def create_testimonial(
    testimonial: TestimonialCreate,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Submit a new testimonial"""
    logger.info(f"📝 Creating testimonial from {username}")
    
    try:
        # Get user info
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create testimonial document
        testimonial_doc = {
            "username": username,
            "content": testimonial.content,
            "rating": testimonial.rating or 5,
            "isAnonymous": testimonial.isAnonymous or False,
            "status": "pending",  # Admin approval required
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.testimonials.insert_one(testimonial_doc)
        
        logger.info(f"✅ Testimonial created: {result.inserted_id}")
        return {
            "message": "Testimonial submitted successfully! It will be visible after admin approval.",
            "id": str(result.inserted_id)
        }
    except Exception as e:
        logger.error(f"❌ Error creating testimonial: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/testimonials")
async def get_testimonials(
    status: str = Query("approved", description="Filter by status: approved, pending, all"),
    limit: int = Query(50, ge=1, le=100),
    db = Depends(get_database)
):
    """Get testimonials (approved ones for public, all for admin)"""
    logger.info(f"📋 Getting testimonials with status={status}")
    
    try:
        # Build query
        query = {}
        if status != "all":
            query["status"] = status
        
        # Get testimonials
        testimonials_cursor = db.testimonials.find(query).sort("createdAt", -1).limit(limit)
        testimonials = await testimonials_cursor.to_list(limit)
        
        # Format response
        result = []
        for t in testimonials:
            # Get user info
            user = await db.users.find_one({"username": t["username"]})
            
            if t.get("isAnonymous"):
                display_name = "Anonymous User"
                avatar = None
            elif user:
                display_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user["username"]
                avatar = get_full_image_url(user.get("images", [None])[0]) if user.get("images") else None
            else:
                display_name = "Unknown User"
                avatar = None
            
            result.append({
                "id": str(t["_id"]),
                "username": t["username"] if not t.get("isAnonymous") else "anonymous",
                "displayName": display_name,
                "avatar": avatar,
                "content": t["content"],
                "rating": t.get("rating", 5),
                "isAnonymous": t.get("isAnonymous", False),
                "status": t["status"],
                "createdAt": t["createdAt"].isoformat() if isinstance(t["createdAt"], datetime) else t["createdAt"]
            })
        
        logger.info(f"✅ Found {len(result)} testimonials")
        return {"testimonials": result, "count": len(result)}
    except Exception as e:
        logger.error(f"❌ Error fetching testimonials: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/testimonials/{testimonial_id}/status")
async def update_testimonial_status(
    testimonial_id: str,
    status: str = Query(..., description="New status: approved, rejected"),
    username: str = Query(...),
    db = Depends(get_database)
):
    """Update testimonial status (admin only)"""
    logger.info(f"🔄 Updating testimonial {testimonial_id} status to {status}")
    
    try:
        # Check if user is admin
        user = await db.users.find_one({"username": username})
        if not user or username != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Validate status
        if status not in ["approved", "rejected", "pending"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        # Update testimonial
        from bson import ObjectId
        result = await db.testimonials.update_one(
            {"_id": ObjectId(testimonial_id)},
            {
                "$set": {
                    "status": status,
                    "updatedAt": datetime.utcnow(),
                    "updatedBy": username
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Testimonial not found")
        
        logger.info(f"✅ Testimonial {testimonial_id} status updated to {status}")
        return {"message": f"Testimonial {status} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating testimonial status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/testimonials/{testimonial_id}")
async def delete_testimonial(
    testimonial_id: str,
    username: str = Query(...),
    db = Depends(get_database)
):
    """Delete testimonial (user can delete own, admin can delete any)"""
    logger.info(f"🗑️ Deleting testimonial {testimonial_id}")
    
    try:
        from bson import ObjectId
        
        # Get testimonial
        testimonial = await db.testimonials.find_one({"_id": ObjectId(testimonial_id)})
        if not testimonial:
            raise HTTPException(status_code=404, detail="Testimonial not found")
        
        # Check permissions
        user = await db.users.find_one({"username": username})
        is_admin = user and username == "admin"
        is_owner = testimonial["username"] == username
        
        if not (is_admin or is_owner):
            raise HTTPException(status_code=403, detail="Not authorized to delete this testimonial")
        
        # Delete
        await db.testimonials.delete_one({"_id": ObjectId(testimonial_id)})
        
        logger.info(f"✅ Testimonial {testimonial_id} deleted")
        return {"message": "Testimonial deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting testimonial: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SSE Real-time Messaging Endpoints ====================

@router.get("/messages/stream/{username}")
async def stream_messages(username: str, request: Request):
    """
    SSE endpoint for real-time message streaming
    """
    from sse_manager import get_sse_manager
    
    logger.info(f"📡 SSE stream requested for user: {username}")
    
    async def event_generator():
        sse_manager = get_sse_manager()
        async for event in sse_manager.subscribe_to_user_channel(username):
            # Check if client disconnected
            if await request.is_disconnected():
                break
            yield event
    
    return EventSourceResponse(event_generator())

@router.get("/messages/unread-counts/{username}")
async def get_unread_counts(username: str):
    """
    Get unread message counts for all conversations
    """
    from redis_manager import get_redis_manager
    
    try:
        redis = get_redis_manager()
        
        # Get all conversations for this user
        conversations = redis.get_conversations(username)
        unread_counts = {}
        
        for conv_username in conversations:
            # Get unread count for each conversation
            messages = redis.get_conversation(username, conv_username)
            unread = sum(1 for msg in messages if not msg.get('read', False) and msg['from'] == conv_username)
            if unread > 0:
                unread_counts[conv_username] = unread
        
        logger.info(f"📊 Unread counts for {username}: {unread_counts}")
        return {"unread_counts": unread_counts}
    except Exception as e:
        logger.error(f"❌ Error getting unread counts: {e}")
        return {"unread_counts": {}}

# Helper function for age calculation
def calculate_age(dob):
    """Calculate age from date of birth"""
    if not dob:
        return None
    if isinstance(dob, str):
        try:
            dob = datetime.strptime(dob, "%Y-%m-%d").date()
        except:
            return None
    elif isinstance(dob, datetime):
        dob = dob.date()
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age


# ===== L3V3L MATCHING ALGORITHM =====

@router.get("/l3v3l-matches/{username}")
async def get_l3v3l_matches(
    username: str,
    limit: int = 20,
    min_score: float = 50.0,
    db = Depends(get_database)
):
    """
    Get L3V3L matches for a user using comprehensive AI-powered algorithm
    
    Considers:
    1. Gender compatibility (opposite gender)
    2. L3V3L Pillars alignment (values, personality)
    3. Demographics (location, background)
    4. Partner preferences match
    5. Habits & personality compatibility
    6. Career & education compatibility
    7. Physical attributes (height, age, education level)
    8. Cultural factors (religion, origin, traditions)
    9. ML-based predictions (if trained)
    """
    logger.info(f"🦋 Getting L3V3L matches for {username}")
    
    try:
        # Get current user
        current_user = await db.users.find_one({"username": username})
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        current_user['_id'] = str(current_user['_id'])
        
        # Get opposite gender users
        opposite_gender = "Female" if current_user.get('gender') == 'Male' else "Male"
        
        # Build query
        query = {
            "username": {"$ne": username},  # Exclude self
            "gender": opposite_gender,
            "status.status": {"$regex": "^active$", "$options": "i"}  # Only active users
        }
        
        # Get potential matches
        potential_matches = await db.users.find(query).to_list(1000)
        
        # Get user's exclusions
        exclusions = await db.exclusions.find({"userUsername": username}).to_list(100)
        excluded_usernames = {exc['excludedUsername'] for exc in exclusions}
        
        # Filter out excluded users
        potential_matches = [u for u in potential_matches if u['username'] not in excluded_usernames]
        
        logger.info(f"📊 Found {len(potential_matches)} potential matches")
        
        # Calculate match scores
        matches_with_scores = []
        for candidate in potential_matches:
            candidate['_id'] = str(candidate['_id'])
            
            # Calculate comprehensive match score
            match_result = matching_engine.calculate_match_score(current_user, candidate)
            
            # Add ML prediction if model is trained
            ml_score = 0
            if ml_enhancer.is_trained:
                ml_score = ml_enhancer.predict_compatibility(current_user, candidate)
                # Blend ML score with rule-based score (70% rule-based, 30% ML)
                match_result['total_score'] = (match_result['total_score'] * 0.7) + (ml_score * 100 * 0.3)
                match_result['ml_prediction'] = round(ml_score * 100, 2)
            
            # Filter by minimum score
            if match_result['total_score'] >= min_score:
                # Prepare profile data - consistent with SearchResultCard expectations
                profile = {
                    'username': candidate['username'],
                    'profileId': candidate.get('profileId'),
                    'firstName': candidate.get('firstName'),
                    'lastName': candidate.get('lastName'),
                    'age': calculate_age(candidate.get('dob')),  # MongoDB field is 'dob'
                    'dob': candidate.get('dob'),  # For age calculation fallback
                    'dateOfBirth': candidate.get('dob'),  # Also provide as dateOfBirth
                    'gender': candidate.get('gender'),
                    'height': candidate.get('height'),
                    'location': candidate.get('location'),
                    'state': candidate.get('state'),
                    'education': candidate.get('education'),
                    'occupation': candidate.get('occupation'),
                    'religion': candidate.get('religion'),
                    'bodyType': candidate.get('bodyType'),
                    'eatingPreference': candidate.get('eatingPreference'),
                    'images': [get_full_image_url(img) for img in candidate.get('images', [])],  # All images
                    'aboutMe': candidate.get('aboutMe', '')[:200] if candidate.get('aboutMe') else '',
                    'contactEmail': candidate.get('contactEmail'),
                    'contactNumber': candidate.get('contactNumber'),
                    # L3V3L specific data
                    'matchScore': match_result['total_score'],
                    'compatibilityLevel': match_result['compatibility_level'],
                    'matchReasons': match_result['match_reasons'],
                    'componentScores': match_result['component_scores']
                }
                
                if ml_enhancer.is_trained:
                    profile['mlPrediction'] = match_result.get('ml_prediction', 0)
                
                matches_with_scores.append(profile)
        
        # Sort by match score (descending)
        matches_with_scores.sort(key=lambda x: x['matchScore'], reverse=True)
        
        # Limit results
        top_matches = matches_with_scores[:limit]
        
        logger.info(f"✅ Returning {len(top_matches)} L3V3L matches for {username}")
        
        return {
            "matches": top_matches,
            "total_found": len(matches_with_scores),
            "algorithm_version": "1.0.0",
            "ml_enabled": ml_enhancer.is_trained
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting L3V3L matches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get matches: {str(e)}")


@router.get("/l3v3l-match-score/{username}/{other_username}")
async def get_match_score_between_users(
    username: str,
    other_username: str,
    db = Depends(get_database)
):
    """Get detailed match score between two specific users"""
    logger.info(f"🦋 Calculating match score: {username} <-> {other_username}")
    
    try:
        # Get both users
        user1 = await db.users.find_one({"username": username})
        user2 = await db.users.find_one({"username": other_username})
        
        if not user1 or not user2:
            raise HTTPException(status_code=404, detail="One or both users not found")
        
        user1['_id'] = str(user1['_id'])
        user2['_id'] = str(user2['_id'])
        
        # Calculate match score
        match_result = matching_engine.calculate_match_score(user1, user2)
        
        # Add ML prediction if available
        if ml_enhancer.is_trained:
            ml_score = ml_enhancer.predict_compatibility(user1, user2)
            match_result['ml_prediction'] = round(ml_score * 100, 2)
            # Blend scores
            match_result['blended_score'] = round(
                (match_result['total_score'] * 0.7) + (ml_score * 100 * 0.3), 2
            )
        
        logger.info(f"✅ Match score calculated: {match_result['total_score']}%")
        
        return {
            "user1": username,
            "user2": other_username,
            **match_result
        }
        
    except Exception as e:
        logger.error(f"❌ Error calculating match score: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/l3v3l-match-details/{viewer_username}/{target_username}")
async def get_l3v3l_match_details(
    viewer_username: str,
    target_username: str,
    db = Depends(get_database)
):
    """
    Get detailed L3V3L matching breakdown between viewer and target user
    Used when viewing a profile from L3V3L matches page
    Returns detailed scores for each matching dimension
    """
    logger.info(f"🦋 Getting L3V3L match details: {viewer_username} -> {target_username}")
    
    try:
        # Get both users
        viewer = await db.users.find_one({"username": viewer_username})
        target = await db.users.find_one({"username": target_username})
        
        if not viewer or not target:
            raise HTTPException(status_code=404, detail="One or both users not found")
        
        viewer['_id'] = str(viewer['_id'])
        target['_id'] = str(target['_id'])
        
        # Calculate comprehensive match score
        match_result = matching_engine.calculate_match_score(viewer, target)
        
        # Extract component scores for detailed breakdown
        component_scores = match_result.get('component_scores', {})
        
        # Build detailed breakdown with all dimensions
        breakdown = {
            'love': round(component_scores.get('l3v3l_values', {}).get('love_alignment', 0), 1),
            'loyalty': round(component_scores.get('l3v3l_values', {}).get('loyalty_alignment', 0), 1),
            'laughter': round(component_scores.get('l3v3l_values', {}).get('laughter_alignment', 0), 1),
            'vulnerability': round(component_scores.get('l3v3l_values', {}).get('vulnerability_alignment', 0), 1),
            'elevation': round(component_scores.get('l3v3l_values', {}).get('elevation_alignment', 0), 1),
            'demographics': round(component_scores.get('demographics_score', 0), 1),
            'career': round(component_scores.get('career_compatibility', 0), 1),
            'cultural': round(component_scores.get('cultural_compatibility', 0), 1),
            'physical': round(component_scores.get('physical_compatibility', 0), 1),
            'lifestyle': round(component_scores.get('habits_personality', 0), 1)
        }
        
        # Add ML prediction if available
        ml_score = None
        if ml_enhancer.is_trained:
            ml_score = ml_enhancer.predict_compatibility(viewer, target)
            blended_score = round(
                (match_result['total_score'] * 0.7) + (ml_score * 100 * 0.3), 2
            )
        else:
            blended_score = match_result['total_score']
        
        logger.info(f"✅ L3V3L match details: {blended_score}% overall")
        
        return {
            "matchScore": round(blended_score, 1),
            "compatibilityLevel": match_result.get('compatibility_level', 'Good Match'),
            "breakdown": breakdown,
            "matchReasons": match_result.get('match_reasons', []),
            "mlEnabled": ml_enhancer.is_trained,
            "mlScore": round(ml_score * 100, 2) if ml_score else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting L3V3L match details: {e}", exc_info=True)
        # Return None silently so frontend can gracefully handle missing data
        raise HTTPException(status_code=404, detail="Match details not available")

# ===== CONTACT US / SUPPORT TICKETS =====

@router.post("/contact")
async def submit_contact_ticket(
    name: str = Form(...),
    email: str = Form(...),
    subject: str = Form(...),
    category: str = Form(...),
    priority: str = Form("medium"),
    message: str = Form(...),
    username: Optional[str] = Form(None),
    status: str = Form("open"),
    attachments: List[UploadFile] = File(default=[]),
    db = Depends(get_database)
):
    """Submit a new support ticket with optional file attachments"""
    logger.info(f"📧 New contact ticket from {name} ({email})")
    
    try:
        import os
        import aiofiles
        from pathlib import Path
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads/contact_tickets")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Process attachments
        attachment_files = []
        if attachments and len(attachments) > 0:
            for file in attachments[:2]:  # Max 2 files
                if file.filename:
                    # Generate unique filename
                    file_ext = Path(file.filename).suffix
                    unique_filename = f"{datetime.utcnow().timestamp()}_{file.filename}"
                    file_path = upload_dir / unique_filename
                    
                    # Save file
                    async with aiofiles.open(file_path, 'wb') as f:
                        content = await file.read()
                        await f.write(content)
                    
                    attachment_files.append({
                        "filename": file.filename,
                        "stored_filename": unique_filename,
                        "file_path": str(file_path),
                        "size": len(content),
                        "content_type": file.content_type,
                        "uploaded_at": datetime.utcnow()
                    })
                    
                    logger.info(f"📎 Saved attachment: {file.filename} ({len(content)} bytes)")
        
        ticket = {
            "name": name,
            "email": email,
            "username": username,
            "subject": subject,
            "category": category,
            "priority": priority,
            "message": message,
            "status": status,
            "attachments": attachment_files,
            "adminReply": None,
            "userReplies": [],
            "repliedAt": None,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.contact_tickets.insert_one(ticket)
        logger.info(f"✅ Contact ticket created: {result.inserted_id}")
        
        # TODO: Send email notification to admin
        
        return {
            "message": "Your message has been received. We'll get back to you soon!",
            "ticketId": str(result.inserted_id)
        }
    except Exception as e:
        logger.error(f"❌ Error creating contact ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/contact/user/{username}")
async def get_user_tickets(
    username: str,
    db = Depends(get_database)
):
    """Get all tickets submitted by a user"""
    logger.info(f"📋 Getting tickets for user: {username}")
    
    try:
        tickets_cursor = db.contact_tickets.find({"username": username}).sort("createdAt", -1)
        tickets = await tickets_cursor.to_list(100)
        
        # Convert ObjectId to string
        for ticket in tickets:
            ticket["_id"] = str(ticket["_id"])
            if ticket.get("createdAt"):
                ticket["createdAt"] = ticket["createdAt"].isoformat()
            if ticket.get("updatedAt"):
                ticket["updatedAt"] = ticket["updatedAt"].isoformat()
            if ticket.get("repliedAt"):
                ticket["repliedAt"] = ticket["repliedAt"].isoformat()
        
        logger.info(f"✅ Found {len(tickets)} tickets for {username}")
        return tickets
    except Exception as e:
        logger.error(f"❌ Error getting user tickets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/contact/admin/all")
async def get_all_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db = Depends(get_database)
):
    """Get all support tickets (admin only)"""
    logger.info("📨 Admin fetching all contact tickets")
    
    try:
        # Build filter
        filter_dict = {}
        if status:
            filter_dict["status"] = status
        if category:
            filter_dict["category"] = category
        if priority:
            filter_dict["priority"] = priority
        
        tickets_cursor = db.contact_tickets.find(filter_dict).sort("createdAt", -1)
        tickets = await tickets_cursor.to_list(1000)
        
        # Convert ObjectId to string and format dates
        for ticket in tickets:
            ticket["_id"] = str(ticket["_id"])
            if ticket.get("createdAt"):
                ticket["createdAt"] = ticket["createdAt"].isoformat()
            if ticket.get("updatedAt"):
                ticket["updatedAt"] = ticket["updatedAt"].isoformat()
            if ticket.get("repliedAt"):
                ticket["repliedAt"] = ticket["repliedAt"].isoformat()
        
        logger.info(f"✅ Found {len(tickets)} tickets")
        return tickets
    except Exception as e:
        logger.error(f"❌ Error getting all tickets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/contact/{ticket_id}")
async def get_single_ticket(
    ticket_id: str,
    db = Depends(get_database)
):
    """Get a single ticket by ID with all replies"""
    logger.info(f"📄 Getting ticket {ticket_id}")
    
    try:
        from bson import ObjectId
        
        ticket = await db.contact_tickets.find_one({"_id": ObjectId(ticket_id)})
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Convert ObjectId to string
        ticket["_id"] = str(ticket["_id"])
        
        # Convert datetime to ISO format
        if ticket.get("createdAt"):
            ticket["createdAt"] = ticket["createdAt"].isoformat()
        if ticket.get("updatedAt"):
            ticket["updatedAt"] = ticket["updatedAt"].isoformat()
        if ticket.get("repliedAt"):
            ticket["repliedAt"] = ticket["repliedAt"].isoformat()
        
        # Convert userReplies timestamps
        if ticket.get("userReplies"):
            for reply in ticket["userReplies"]:
                if reply.get("timestamp"):
                    reply["timestamp"] = reply["timestamp"].isoformat()
        
        logger.info(f"✅ Retrieved ticket {ticket_id}")
        return ticket
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/contact/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    status: str = Body(..., embed=True),
    db = Depends(get_database)
):
    """Update ticket status (admin only)"""
    logger.info(f"🔄 Updating ticket {ticket_id} status to {status}")
    
    try:
        from bson import ObjectId
        
        # Validate status
        valid_statuses = ["open", "in_progress", "resolved", "closed"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        # Get ticket before update
        ticket = await db.contact_tickets.find_one({"_id": ObjectId(ticket_id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        update_data = {
            "status": status,
            "updatedAt": datetime.utcnow()
        }
        
        # Set deletion timestamp if ticket is resolved or closed
        if status in ["resolved", "closed"]:
            # Get system settings for delete delay
            settings = await db.system_settings.find_one({"_id": "global"})
            delete_days = settings.get("ticket_delete_days", 30) if settings else 30
            
            if delete_days == 0:
                # Immediate deletion - set to now
                update_data["scheduledDeleteAt"] = datetime.utcnow()
            else:
                # Scheduled deletion after N days
                update_data["scheduledDeleteAt"] = datetime.utcnow() + timedelta(days=delete_days)
            
            logger.info(f"📅 Ticket scheduled for deletion in {delete_days} days")
        
        result = await db.contact_tickets.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": update_data}
        )
        
        logger.info(f"✅ Ticket {ticket_id} status updated to {status}")
        return {"message": "Status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating ticket status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/contact/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: str,
    adminReply: str = Body(...),
    adminName: str = Body(...),
    db = Depends(get_database)
):
    """Send admin reply to ticket"""
    logger.info(f"💬 Admin {adminName} replying to ticket {ticket_id}")
    
    try:
        from bson import ObjectId
        
        result = await db.contact_tickets.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$set": {
                    "adminReply": adminReply,
                    "repliedAt": datetime.utcnow(),
                    "status": "in_progress",
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Get ticket details for email notification
        ticket = await db.contact_tickets.find_one({"_id": ObjectId(ticket_id)})
        
        # TODO: Send email notification to user with reply
        logger.info(f"📧 TODO: Send email to {ticket['email']} with reply")
        
        logger.info(f"✅ Reply sent to ticket {ticket_id}")
        return {"message": "Reply sent successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending reply: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/contact/{ticket_id}/user-reply")
async def user_reply_to_ticket(
    ticket_id: str,
    data: Dict[str, Any],
    db = Depends(get_database)
):
    """User replies to their own ticket"""
    user_reply = data.get("userReply")
    logger.info(f"💬 User replying to ticket {ticket_id}")
    
    try:
        from bson import ObjectId
        
        # Create reply object
        reply_obj = {
            "message": user_reply,
            "timestamp": datetime.utcnow()
        }
        
        # Append to userReplies array
        result = await db.contact_tickets.update_one(
            {"_id": ObjectId(ticket_id)},
            {
                "$push": {"userReplies": reply_obj},
                "$set": {
                    "status": "in_progress",
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        logger.info(f"✅ User reply added to ticket {ticket_id}")
        
        return {"message": "Reply sent successfully"}
    except Exception as e:
        logger.error(f"❌ Error adding user reply: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/contact/download/{ticket_id}/{filename}")
async def download_attachment(
    ticket_id: str,
    filename: str,
    db = Depends(get_database)
):
    """Download a ticket attachment"""
    logger.info(f"📥 Download request for {filename} from ticket {ticket_id}")
    
    try:
        from bson import ObjectId
        from pathlib import Path
        from fastapi.responses import FileResponse
        
        # Verify ticket exists and get attachment info
        ticket = await db.contact_tickets.find_one({"_id": ObjectId(ticket_id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Find the attachment
        attachment = None
        if ticket.get("attachments"):
            for att in ticket["attachments"]:
                if att.get("stored_filename") == filename:
                    attachment = att
                    break
        
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        file_path = Path(attachment.get("file_path"))
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on server")
        
        logger.info(f"✅ Serving file: {file_path}")
        return FileResponse(
            path=str(file_path),
            filename=attachment.get("filename"),
            media_type=attachment.get("content_type", "application/octet-stream")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error downloading attachment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/contact/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    db = Depends(get_database)
):
    """Delete a support ticket and its attachments (admin only)"""
    logger.info(f"🗑️ Deleting ticket {ticket_id}")
    
    try:
        from bson import ObjectId
        from pathlib import Path
        import os
        
        # Get ticket before deletion to clean up attachments
        ticket = await db.contact_tickets.find_one({"_id": ObjectId(ticket_id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Delete attachments if they exist
        if ticket.get("attachments"):
            logger.info(f"🗑️ Deleting {len(ticket['attachments'])} attachment(s)")
            for attachment in ticket['attachments']:
                try:
                    file_path = Path(attachment.get('file_path', ''))
                    if file_path.exists():
                        os.remove(file_path)
                        logger.info(f"✅ Deleted file: {file_path}")
                except Exception as file_err:
                    logger.error(f"⚠️ Failed to delete file {file_path}: {file_err}")
        
        # Delete the ticket
        result = await db.contact_tickets.delete_one({"_id": ObjectId(ticket_id)})
        
        logger.info(f"✅ Ticket {ticket_id} and attachments deleted")
        return {"message": "Ticket deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ===== SYSTEM SETTINGS =====

@router.get("/system-settings")
async def get_system_settings(db = Depends(get_database)):
    """Get global system settings (admin only)"""
    logger.info("📋 Loading system settings")
    
    try:
        settings = await db.system_settings.find_one({"_id": "global"})
        
        if not settings:
            # Return defaults if no settings exist
            default_settings = {
                "ticket_delete_days": 30,
                "default_theme": "cozy-light"
            }
            logger.info("Using default settings")
            return default_settings
        
        return {
            "ticket_delete_days": settings.get("ticket_delete_days", 30),
            "default_theme": settings.get("default_theme", "cozy-light")
        }
    except Exception as e:
        logger.error(f"❌ Error loading system settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/system-settings")
async def update_system_settings(
    data: Dict[str, Any],
    db = Depends(get_database)
):
    """Update global system settings (admin only)"""
    ticket_delete_days = data.get("ticket_delete_days", 30)
    default_theme = data.get("default_theme", "cozy-light")
    
    logger.info(f"⚙️ Updating system settings: ticket_delete_days={ticket_delete_days}")
    
    try:
        # Upsert system settings
        result = await db.system_settings.update_one(
            {"_id": "global"},
            {
                "$set": {
                    "ticket_delete_days": ticket_delete_days,
                    "default_theme": default_theme,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        logger.info("✅ System settings updated")
        return {"message": "Settings saved successfully"}
    except Exception as e:
        logger.error(f"❌ Error updating system settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ===== SCHEDULER JOBS MANAGEMENT =====
# ⚠️ DEPRECATED: These endpoints are deprecated and kept for backwards compatibility only.
# Please use /api/admin/scheduler/* endpoints from routes_dynamic_scheduler.py instead.
# The new Dynamic Scheduler provides template-based job management with better features.
# These legacy endpoints will be removed in a future version.

@router.get("/scheduler-jobs")
async def get_scheduler_jobs():
    """
    Get all scheduler jobs (admin only)
    
    ⚠️ DEPRECATED: This endpoint is deprecated. Please use /api/admin/scheduler/* endpoints instead.
    The new Dynamic Scheduler provides template-based job management with better features.
    """
    logger.warning("⚠️ Deprecated endpoint /scheduler-jobs called. Use /api/admin/scheduler/* instead.")
    
    try:
        from unified_scheduler import get_unified_scheduler
        scheduler = get_unified_scheduler()
        
        if not scheduler:
            return {
                "jobs": [],
                "_deprecated": True,
                "_migration_notice": "This API is deprecated. Please migrate to /api/admin/scheduler/* endpoints for the new Dynamic Scheduler."
            }
        
        return {
            "jobs": scheduler.get_job_status(),
            "_deprecated": True,
            "_migration_notice": "This API is deprecated. Please migrate to /api/admin/scheduler/* endpoints for the new Dynamic Scheduler."
        }
    except Exception as e:
        logger.error(f"❌ Error loading scheduler jobs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scheduler-jobs")
async def add_scheduler_job(data: Dict[str, Any]):
    """Add a new scheduler job (admin only)"""
    name = data.get("name")
    interval_seconds = data.get("interval_seconds", 3600)
    enabled = data.get("enabled", True)
    
    logger.info(f"➕ Adding scheduler job: {name}")
    
    try:
        from unified_scheduler import get_unified_scheduler
        scheduler = get_unified_scheduler()
        
        if not scheduler:
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        # Note: This is a placeholder. In production, you'd need to register actual job functions
        # For now, we'll just update the job's interval and status
        logger.warning("⚠️ Adding custom jobs requires code deployment. This is a placeholder.")
        
        return {"message": f"Job '{name}' configuration saved (requires code deployment for actual function)"}
    except Exception as e:
        logger.error(f"❌ Error adding scheduler job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/scheduler-jobs/{job_name}")
async def update_scheduler_job(job_name: str, data: Dict[str, Any]):
    """Update a scheduler job (admin only)"""
    interval_seconds = data.get("interval_seconds")
    
    logger.info(f"✏️ Updating scheduler job: {job_name}")
    
    try:
        from unified_scheduler import get_unified_scheduler
        scheduler = get_unified_scheduler()
        
        if not scheduler:
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        if job_name not in scheduler.jobs:
            raise HTTPException(status_code=404, detail=f"Job '{job_name}' not found")
        
        job = scheduler.jobs[job_name]
        if interval_seconds:
            job.interval_seconds = interval_seconds
            logger.info(f"✅ Updated interval for '{job_name}' to {interval_seconds}s")
        
        return {"message": f"Job '{job_name}' updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating scheduler job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/scheduler-jobs/{job_name}")
async def delete_scheduler_job(job_name: str):
    """Delete a scheduler job (admin only)"""
    logger.info(f"🗑️ Deleting scheduler job: {job_name}")
    
    try:
        from unified_scheduler import get_unified_scheduler
        scheduler = get_unified_scheduler()
        
        if not scheduler:
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        scheduler.remove_job(job_name)
        
        return {"message": f"Job '{job_name}' deleted successfully"}
    except Exception as e:
        logger.error(f"❌ Error deleting scheduler job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/scheduler-jobs/{job_name}/toggle")
async def toggle_scheduler_job(job_name: str, data: Dict[str, Any]):
    """Enable/disable a scheduler job (admin only)"""
    enabled = data.get("enabled", True)
    
    logger.info(f"{'✅' if enabled else '⏸️'} Toggling scheduler job: {job_name}")
    
    try:
        from unified_scheduler import get_unified_scheduler
        scheduler = get_unified_scheduler()
        
        if not scheduler:
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        if enabled:
            scheduler.enable_job(job_name)
        else:
            scheduler.disable_job(job_name)
        
        return {"message": f"Job '{job_name}' {'enabled' if enabled else 'disabled'} successfully"}
    except Exception as e:
        logger.error(f"❌ Error toggling scheduler job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scheduler-jobs/{job_name}/run")
async def run_scheduler_job(job_name: str, db = Depends(get_database)):
    """Manually run a scheduler job on demand (admin only)"""
    logger.info(f"▶️ Manual run requested for job: {job_name}")
    
    try:
        from unified_scheduler import get_unified_scheduler
        scheduler = get_unified_scheduler()
        
        if not scheduler:
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        # Check if job exists
        if job_name not in scheduler.jobs:
            raise HTTPException(status_code=404, detail=f"Job '{job_name}' not found")
        
        job = scheduler.jobs[job_name]
        
        # Run the job asynchronously in the background
        import asyncio
        asyncio.create_task(scheduler.run_job(job))
        
        logger.info(f"✅ Job '{job_name}' started manually")
        
        # Log the manual run to database
        try:
            await db.job_logs.insert_one({
                "job_name": job_name,
                "timestamp": datetime.utcnow(),
                "status": "started",
                "message": "Job started manually by admin",
                "details": None
            })
        except Exception as log_err:
            logger.warning(f"Failed to log manual run: {log_err}")
        
        return {
            "message": f"Job '{job_name}' started successfully",
            "status": "running"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error running scheduler job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scheduler-jobs/{job_name}/logs")
async def get_job_logs(job_name: str, db = Depends(get_database)):
    """Get execution logs for a specific scheduler job (admin only)"""
    logger.info(f"📋 Loading logs for job: {job_name}")
    
    try:
        from unified_scheduler import get_unified_scheduler
        scheduler = get_unified_scheduler()
        
        if not scheduler:
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        # Check if job exists
        if job_name not in scheduler.jobs:
            raise HTTPException(status_code=404, detail=f"Job '{job_name}' not found")
        
        # Get logs from database (job_logs collection)
        logs_cursor = db.job_logs.find(
            {"job_name": job_name}
        ).sort("timestamp", -1).limit(50)
        
        logs = []
        async for log in logs_cursor:
            logs.append({
                "timestamp": log.get("timestamp"),
                "status": log.get("status", "unknown"),
                "message": log.get("message", ""),
                "details": log.get("details")
            })
        
        logger.info(f"✅ Loaded {len(logs)} log entries for job: {job_name}")
        return {"logs": logs}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error loading job logs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
