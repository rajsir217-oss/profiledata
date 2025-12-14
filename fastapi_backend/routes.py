# fastapi_backend/routes.py
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends, Request, Query, Body
from fastapi.responses import JSONResponse, FileResponse, Response
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, date
import time
import logging
import uuid
import hashlib
import json
import httpx
import re
from pathlib import Path
from urllib.parse import urlparse
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
from auth.jwt_auth import JWTManager, get_current_user_dependency as get_current_user, get_current_user_optional, get_current_user_from_token
from l3v3l_matching_engine import matching_engine
from l3v3l_ml_enhancer import ml_enhancer
from config import settings
from utils import get_full_image_url, save_multiple_files
from crypto_utils import get_encryptor

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger(__name__)

# Helper function for case-insensitive username lookup
def get_username_query(username: str):
    """Create a case-insensitive MongoDB query for username"""
    return {"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}

# Helper function for safe JSON loading
def safe_json_loads(value: Any) -> Any:
    """Safely load JSON string, return None or default if invalid or None"""
    if not value:
        return None
    if not isinstance(value, str):
        return value
    if not value.strip():
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        logger.warning(f"⚠️ Invalid JSON received: {value}")
        return None

# Helper function to decrypt PII contact info
def _decrypt_contact_info(value: str) -> str:
    """Decrypt contact info (email/phone) if encrypted"""
    if not value:
        return value
    
    # Check if it looks encrypted (Fernet encrypted values start with gAAAAA)
    if value.startswith("gAAAAA"):
        try:
            encryptor = get_encryptor()
            return encryptor.decrypt(value)
        except Exception as e:
            logger.warning(f"Failed to decrypt contact info: {str(e)}")
            return value
    
    return value

# Cloudflare Turnstile CAPTCHA verification
async def verify_turnstile(token: str) -> bool:
    """
    Verify Cloudflare Turnstile CAPTCHA token
    
    Args:
        token: The turnstile token from frontend
        
    Returns:
        bool: True if verification passed, False otherwise
    """
    if not token:
        return False
    
    # Allow test keys to pass in development
    if token == "XXXX.DUMMY.TOKEN.XXXX":
        logger.info("✅ Turnstile: Using test/dummy token (development mode)")
        return True
    
    # Skip verification if no secret key configured
    if not settings.turnstile_secret_key:
        logger.warning("⚠️ Turnstile secret key not configured - skipping verification")
        return True
    
    verify_url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    verify_data = {
        "secret": settings.turnstile_secret_key,
        "response": token
    }
    
    try:
        async with httpx.AsyncClient() as client:
            verify_response = await client.post(verify_url, json=verify_data, timeout=10.0)
            result = verify_response.json()
            
            if result.get("success"):
                logger.info("✅ Turnstile CAPTCHA verification successful")
                return True
            else:
                error_codes = result.get("error-codes", [])
                logger.warning(f"❌ Turnstile verification failed: {error_codes}")
                return False
    except Exception as e:
        logger.error(f"❌ Turnstile verification error: {e}")
        # Fail open in case of API issues (better UX, but log the error)
        return True

# Compatibility aliases for old code
def get_password_hash(password: str) -> str:
    return PasswordManager.hash_password(password)

# MongoDB projection for dashboard card display (only fetch needed fields)
# Note: MongoDB requires ONLY inclusions OR ONLY exclusions (_id is exception)
DASHBOARD_USER_PROJECTION = {
    "_id": 0,  # Special case: _id can be excluded with inclusions
    # Include only fields needed for dashboard/search cards
    "username": 1,
    "firstName": 1,
    "lastName": 1,
    "age": 1,
    "birthMonth": 1,
    "birthYear": 1,
    "dateOfBirth": 1,
    "gender": 1,
    "location": 1,
    "region": 1,
    "occupation": 1,
    "education": 1,
    "educationHistory": 1,  # Structured education array
    "workExperience": 1,    # Structured work experience array
    "bio": 1,
    "aboutMe": 1,
    "about": 1,
    "description": 1,
    "aboutYou": 1,
    "profileImage": 1,
    "images": 1,
    "publicImages": 1,
    "contactEmail": 1,
    "contactNumber": 1,
    "lastActive": 1,
    "onlineStatus": 1,
    # Additional fields for search results
    "height": 1,
    "heightInches": 1,
    "religion": 1,
    "eatingPreference": 1,
    "bodyType": 1,
    "matchScore": 1,
    "compatibilityLevel": 1,
    # All other fields automatically excluded (MongoDB inclusion projection)
}

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

def _extract_image_path(url_or_path: str) -> str:
    if not url_or_path:
        return ''
    if isinstance(url_or_path, str) and url_or_path.startswith('http'):
        parsed = urlparse(url_or_path)
        return parsed.path
    if isinstance(url_or_path, str) and url_or_path.startswith('uploads/'):
        return '/' + url_or_path
    if isinstance(url_or_path, str) and not url_or_path.startswith('/') and url_or_path.startswith(f"{settings.upload_dir}/"):
        return '/' + url_or_path
    return url_or_path

def _compute_public_image_paths(existing_images: List[str], public_images: List[str]) -> List[str]:
    normalized_images = {_extract_image_path(img) for img in (existing_images or []) if img}
    normalized_public = [_extract_image_path(img) for img in (public_images or []) if img]
    return [p for p in normalized_public if p in normalized_images]

def _is_admin_user(user_doc: Dict[str, Any]) -> bool:
    if not user_doc:
        return False
    role = (user_doc.get("role") or "").lower()
    role_name = (user_doc.get("role_name") or "").lower()
    username = (user_doc.get("username") or "").lower()
    return role == "admin" or role_name == "admin" or username == "admin"

async def _has_images_access(db, requester_username: str, owner_username: str, image_filename: str = None) -> bool:
    """Check if requester has access to owner's images.
    
    If image_filename is provided, also checks per-image access rules including one-time views.
    """
    if not requester_username:
        return False
    if requester_username.lower() == owner_username.lower():
        return True

    requester_user = await db.users.find_one(get_username_query(requester_username), {"role": 1, "role_name": 1, "username": 1})
    if _is_admin_user(requester_user):
        return True

    # Get ALL active access records (there may be multiple)
    access_docs = await db.pii_access.find({
        "granterUsername": owner_username,
        "grantedToUsername": requester_username,
        "accessType": "images",
        "isActive": True
    }).sort("grantedAt", -1).to_list(10)  # Most recent first
    
    if not access_docs:
        return False
    
    # Use the most recent access doc for general checks
    access_doc = access_docs[0]

    # Check global expiry first
    expires_at = access_doc.get("expiresAt")
    if expires_at:
        try:
            expires_dt = expires_at
            if isinstance(expires_at, str):
                expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if expires_dt <= datetime.utcnow():
                await db.pii_access.update_one({"_id": access_doc.get("_id")}, {"$set": {"isActive": False}})
                return False
        except Exception:
            pass
    
    # If no specific image requested, just check general access
    if not image_filename:
        return True
    
    # Find the image index by matching filename in owner's images
    owner = await db.users.find_one(
        get_username_query(owner_username),
        {"images": 1}
    )
    if not owner:
        return False
    
    owner_images = owner.get("images", [])
    image_index = None
    for idx, img in enumerate(owner_images):
        if img and img.split('/')[-1] == image_filename:
            image_index = str(idx)
            break
    
    if image_index is None:
        # Image not found in owner's images, deny access
        return False
    
    # Check ALL access records for this image - if ANY grants access, allow it
    for access_doc in access_docs:
        picture_durations = access_doc.get("pictureDurations", {})
        if not picture_durations:
            # No per-image rules in this record, general access applies
            return True
        
        # Check if this specific image has access rules in this record
        image_access = picture_durations.get(image_index)
        if not image_access:
            # No rule for this image in this record, try next
            continue
        
        duration = image_access.get("duration")
        duration_str = str(duration) if duration else ""
        
        # Check one-time view
        if duration_str == "onetime":
            viewed_at = image_access.get("viewedAt")
            if viewed_at is None:
                # Not yet viewed - access granted
                return True
            # Already viewed in this record, try next record
            continue
        
        # Check permanent access
        if duration_str == "permanent":
            return True
        
        # Check time-based expiry (numeric days)
        if duration_str.isdigit() or isinstance(duration, int):
            image_expires_at = image_access.get("expiresAt")
            if image_expires_at:
                try:
                    expires_dt = image_expires_at
                    if isinstance(image_expires_at, str):
                        expires_dt = datetime.fromisoformat(image_expires_at.replace('Z', '+00:00'))
                    if expires_dt > datetime.utcnow():
                        # Not expired yet - access granted
                        return True
                except Exception:
                    pass
            else:
                # No expiresAt set, assume access granted
                return True
    
    # No access record grants access to this image
    logger.info(f"🚫 No active access for image {image_index} by {requester_username}")
    return False


async def _mark_image_as_viewed(db, requester_username: str, owner_username: str, image_filename: str):
    """Mark a one-time view image as viewed after serving."""
    # Get ALL active access records
    access_docs = await db.pii_access.find({
        "granterUsername": owner_username,
        "grantedToUsername": requester_username,
        "accessType": "images",
        "isActive": True
    }).sort("grantedAt", -1).to_list(10)
    
    if not access_docs:
        return
    
    # Find the image index
    owner = await db.users.find_one(
        get_username_query(owner_username),
        {"images": 1}
    )
    if not owner:
        return
    
    owner_images = owner.get("images", [])
    image_index = None
    for idx, img in enumerate(owner_images):
        if img and img.split('/')[-1] == image_filename:
            image_index = str(idx)
            break
    
    if image_index is None:
        return
    
    # Find the access record with unviewed one-time access for this image
    for access_doc in access_docs:
        picture_durations = access_doc.get("pictureDurations", {})
        if not picture_durations:
            continue
        
        image_access = picture_durations.get(image_index)
        if not image_access:
            continue
        
        # Only mark one-time views that haven't been viewed yet
        if image_access.get("duration") == "onetime" and image_access.get("viewedAt") is None:
            logger.info(f"📸 Marking one-time view as used: image {image_index} for {requester_username}")
            await db.pii_access.update_one(
                {"_id": access_doc["_id"]},
                {"$set": {f"pictureDurations.{image_index}.viewedAt": datetime.utcnow()}}
            )
            return  # Only mark one record

@router.get("/media/{filename}")
async def get_protected_media(
    filename: str,
    token: Optional[str] = Query(None, description="JWT token for img src requests"),
    current_user: dict = Depends(get_current_user_optional),
    db = Depends(get_database)
):
    """Serve uploaded media only to authorized active members.

    Access rules:
    - owner/admin always
    - if image is marked in owner's publicImages: any active member
    - else: requires active pii_access grant with accessType='images'
    
    Supports token via query param for <img src> tags that can't send headers.
    """
    # If no user from header, try token from query param
    if not current_user and token:
        try:
            current_user = await get_current_user_from_token(token, db)
        except Exception:
            pass
    
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    
    requester_username = current_user.get("username")
    if not requester_username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    # Locate owner by filename across known fields
    safe_filename = re.escape(filename)
    owner = await db.users.find_one(
        {
            "$or": [
                {"images": {"$regex": safe_filename}},
                {"publicImages": {"$regex": safe_filename}},
                {"profileImage": {"$regex": safe_filename}}
            ]
        },
        {"username": 1, "images": 1, "publicImages": 1, "profileImage": 1}
    )
    if not owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    owner_username = owner.get("username")
    if not owner_username:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    # Determine if this image is public
    public_list = owner.get("publicImages", [])
    is_public = any((p or "").split('/')[-1] == filename for p in public_list)

    is_one_time_view = False
    has_full_access = True
    if not is_public:
        # Pass filename to check per-image access rules including one-time views
        has_access = await _has_images_access(db, requester_username, owner_username, filename)
        if not has_access:
            # Instead of blocking, serve the image but mark as no-access for frontend to blur
            has_full_access = False
            logger.info(f"🔒 Serving blurred image {filename} to {requester_username} (access expired/denied)")
        else:
            # Check if this is a one-time view that needs to be marked as used
            is_one_time_view = True  # Will be checked and marked after serving

    # Serve from GCS if enabled, else local filesystem
    if settings.use_gcs and settings.gcs_bucket_name:
        try:
            from google.cloud import storage
            client = storage.Client()
            bucket = client.bucket(settings.gcs_bucket_name)
            blob = bucket.blob(f"uploads/{filename}")
            if not blob.exists():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
            data = blob.download_as_bytes()
            
            # Mark one-time view as used after serving
            if is_one_time_view:
                await _mark_image_as_viewed(db, requester_username, owner_username, filename)
            
            # Add header to indicate access status for frontend blurring
            headers = {"X-Image-Access": "full" if has_full_access else "blur"}
            return Response(content=data, media_type="application/octet-stream", headers=headers)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to serve GCS media {filename}: {e}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch media")

    file_path = Path(settings.upload_dir) / filename
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    
    # Mark one-time view as used after serving
    if is_one_time_view:
        await _mark_image_as_viewed(db, requester_username, owner_username, filename)
    
    # Add header to indicate access status for frontend blurring
    headers = {"X-Image-Access": "full" if has_full_access else "blur"}
    return FileResponse(path=str(file_path), headers=headers)

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

def parse_date_of_birth(dob_str):
    """
    Parse dateOfBirth string to extract (birthMonth, birthYear)
    
    Handles various formats:
    - ISO: "1990-05-15" or "1990-05-15T00:00:00"
    - Slash: "05/15/1990" or "5/15/1990"
    
    Returns:
        tuple: (birthMonth, birthYear) or (None, None)
    """
    if not dob_str:
        return None, None
    
    try:
        import re
        dob_str = str(dob_str).strip()
        
        # ISO format: "1990-05-15" or "1990-05-15T00:00:00"
        if '-' in dob_str:
            parts = dob_str.split('T')[0].split('-')
            if len(parts) >= 2:
                year = int(parts[0])
                month = int(parts[1])
                return month, year
        
        # Slash format: "05/15/1990" (MM/DD/YYYY)
        if '/' in dob_str:
            parts = dob_str.split('/')
            if len(parts) == 3:
                month = int(parts[0])
                year = int(parts[2])
                return month, year
        
    except (ValueError, IndexError, AttributeError):
        pass
    
    return None, None

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    # Basic Information
    username: str = Form(...),
    password: str = Form(...),
    firstName: Optional[str] = Form(None),
    lastName: Optional[str] = Form(None),
    contactNumber: Optional[str] = Form(None),
    contactEmail: Optional[str] = Form(None),
    smsOptIn: Optional[bool] = Form(False),  # SMS notifications opt-in
    birthMonth: Optional[int] = Form(None),  # Birth month (1-12)
    birthYear: Optional[int] = Form(None),   # Birth year
    dateOfBirth: Optional[str] = Form(None),  # Alternative format (backward compatibility)
    gender: Optional[str] = Form(None),  # Renamed from sex
    height: Optional[str] = Form(None),  # Format: "5'8\"" or "5 ft 8 in"
    # Preferences & Cultural Information
    religion: Optional[str] = Form(None),
    languagesSpoken: Optional[str] = Form(None),  # JSON string array
    castePreference: Optional[str] = Form("None"),
    eatingPreference: Optional[str] = Form("None"),
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
    # Profile Creator Metadata
    profileCreatedBy: Optional[str] = Form(None),  # Self, Parent, Sibling, Friend, etc.
    creatorFullName: Optional[str] = Form(None),  # Creator's full name
    creatorRelationship: Optional[str] = Form(None),  # Relationship to profile owner
    creatorNotes: Optional[str] = Form(None),  # Why profile was created by someone else
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
    
    # Validate birth month and year (REQUIRED for age calculation)
    # Support both new format (birthMonth/birthYear) and legacy format (dateOfBirth)
    if not birthMonth or not birthYear:
        # Try parsing dateOfBirth if provided (backward compatibility)
        if dateOfBirth:
            logger.debug(f"Parsing dateOfBirth for user '{username}': {dateOfBirth}")
            parsed_month, parsed_year = parse_date_of_birth(dateOfBirth)
            if parsed_month and parsed_year:
                birthMonth = parsed_month
                birthYear = parsed_year
                logger.info(f"✅ Parsed dateOfBirth for user '{username}': {birthMonth}/{birthYear}")
            else:
                logger.warning(f"⚠️ Registration failed: Could not parse dateOfBirth for user '{username}': {dateOfBirth}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid dateOfBirth format. Use YYYY-MM-DD or MM/DD/YYYY"
                )
        else:
            logger.warning(f"⚠️ Registration failed: User '{username}' missing birth date")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Birth month and year (or dateOfBirth) are required to create a profile"
            )
    
    # Validate birth month range
    if birthMonth < 1 or birthMonth > 12:
        logger.warning(f"⚠️ Registration failed: Invalid birth month {birthMonth} for user '{username}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Birth month must be between 1 and 12"
        )
    
    # Validate birth year (reasonable range: 1924-2007 for ages 18-100)
    current_year = datetime.now().year
    min_year = current_year - 100
    max_year = current_year - 18
    if birthYear < min_year or birthYear > max_year:
        logger.warning(f"⚠️ Registration failed: Invalid birth year {birthYear} for user '{username}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Birth year must be between {min_year} and {max_year} (ages 18-100)"
        )
    
    logger.info(f"✅ Birth date validated for user '{username}': {birthMonth}/{birthYear}")
    
    # Check if username already exists (case-insensitive)
    logger.debug(f"Checking if username '{username}' exists...")
    existing_user = await db.users.find_one(get_username_query(username))
    if existing_user:
        logger.warning(f"⚠️ Registration failed: Username '{username}' already exists")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists"
        )
    
    # Check if email already exists (must check encrypted value since DB stores encrypted emails)
    encryptor = get_encryptor()
    if contactEmail:
        logger.debug(f"Checking if email exists...")
        try:
            encrypted_email = encryptor.encrypt(contactEmail)
            existing_email = await db.users.find_one({"contactEmail": encrypted_email})
            if existing_email:
                logger.warning(f"⚠️ Registration failed: Email already registered")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered"
                )
        except Exception as e:
            logger.warning(f"⚠️ Could not check email uniqueness: {e}")
            # Continue with registration - better to allow than block on encryption error
    
    # Check if phone number already exists (must check encrypted value)
    if contactNumber:
        logger.debug(f"Checking if phone number exists...")
        try:
            encrypted_phone = encryptor.encrypt(contactNumber)
            existing_phone = await db.users.find_one({"contactNumber": encrypted_phone})
            if existing_phone:
                logger.warning(f"⚠️ Registration failed: Phone number already registered")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Phone number already registered"
                )
        except Exception as e:
            logger.warning(f"⚠️ Could not check phone uniqueness: {e}")
            # Continue with registration - better to allow than block on encryption error
    
    # Validate and save images
    image_paths = []
    logger.info(f"📸 Images received: {len(images) if images else 0}")
    for i, img in enumerate(images):
        logger.info(f"  Image {i+1}: filename={img.filename}, content_type={img.content_type}, size={img.size if hasattr(img, 'size') else 'unknown'}")
    
    if images and len(images) > 0:
        logger.info(f"📸 Processing {len(images)} image(s) for user '{username}'")
        if len(images) > 6:
            logger.warning(f"⚠️ User '{username}' attempted to upload {len(images)} images (max 6)")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 6 images allowed"
            )
        try:
            image_paths = await save_multiple_files(images)
            logger.info(f"✅ Successfully saved {len(image_paths)} image(s) for user '{username}'")
            logger.info(f"📂 Image paths: {image_paths}")
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
    now = datetime.utcnow().isoformat()
    
    # Auto-calculate workingStatus from workExperience (if it gets passed later)
    # For now, set to "No" by default during registration
    workingStatus = "No"  # Will be updated when workExperience is added
    
    # Create user document
    logger.info(f"Creating user document for '{username}' with profileId '{profile_id}'...")
    user_doc = {
        "username": username,
        "profileId": profile_id,
        "password": hashed_password,
        "firstName": firstName,
        "lastName": lastName,
        "contactNumber": contactNumber,
        "contactEmail": contactEmail,
        "smsOptIn": smsOptIn,  # SMS notifications opt-in
        "birthMonth": birthMonth,
        "birthYear": birthYear,
        "gender": gender,  # Renamed from sex
        "height": height,
        "heightInches": parse_height_to_inches(height),  # Numeric for searching
        # Preferences & Cultural Information
        "religion": religion,
        "languagesSpoken": safe_json_loads(languagesSpoken),
        "castePreference": castePreference,
        "eatingPreference": eatingPreference,
        # Residential Information
        "countryOfOrigin": countryOfOrigin,
        "countryOfResidence": countryOfResidence,
        "country": countryOfResidence,  # Alias for L3V3L scoring
        "state": state,
        "location": location,
        "city": location,  # Alias for L3V3L scoring
        # USA-specific field
        "citizenshipStatus": citizenshipStatus if countryOfResidence == "US" else None,
        # India-specific fields
        "caste": caste,
        "motherTongue": motherTongue,
        "familyType": familyType,
        "familyValues": familyValues,
        # Educational Information
        "educationHistory": safe_json_loads(educationHistory),
        # Professional & Work Related Information
        "workExperience": safe_json_loads(workExperience),
        "workingStatus": workingStatus,  # Auto-set to "No" initially
        "linkedinUrl": linkedinUrl,
        # About Me and Partner Information
        "familyBackground": familyBackground,
        "aboutMe": aboutMe,  # Renamed from aboutYou
        "partnerPreference": partnerPreference,
        "partnerCriteria": safe_json_loads(partnerCriteria),
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
        # Profile Creator Metadata
        "profileCreatedBy": profileCreatedBy,
        "creatorInfo": {
            "fullName": creatorFullName,
            "relationship": creatorRelationship,
            "notes": creatorNotes
        } if profileCreatedBy and profileCreatedBy != "Self" else None,
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
        # Role & Permissions
        "role_name": "free_user",  # Default role for new users
        # Account status - UNIFIED FIELD (replaces old status.status)
        "accountStatus": "pending_email_verification",
        # Activity tracking (keep for last seen)
        "status": {
            "last_seen": None  # Track user activity
        },
        "emailVerificationToken": None,  # Will be set when email is sent
        "emailVerificationTokenExpiry": None,
        "emailVerificationSentAt": None,
        "emailVerificationAttempts": 0,
        "onboardingCompleted": False,
        "onboardingCompletedAt": None,
        # Verification Status (NEW)
        "emailVerified": False,
        "emailVerifiedAt": None,
        "phoneVerified": False,
        "phoneVerifiedAt": None,
        # Admin Approval (NEW)
        "adminApprovalStatus": "pending",
        "adminApprovedBy": None,
        "adminApprovedAt": None,
        "adminRejectionReason": None,
        # Messaging stats (initialized to 0)
        "messagesSent": 0,
        "messagesReceived": 0,
        "pendingReplies": 0
    }
    
    # 🔒 ENCRYPT PII fields before saving
    try:
        encryptor = get_encryptor()
        user_doc = encryptor.encrypt_user_pii(user_doc)
        logger.debug(f"🔒 PII fields encrypted for new user '{username}'")
    except Exception as encrypt_err:
        logger.warning(f"⚠️ Encryption skipped during registration (encryption may not be enabled): {encrypt_err}")
        # Continue without encryption if not configured
    
    # Insert into database
    try:
        logger.info(f"💾 Inserting user '{username}' into database...")
        logger.info(f"📸 Images being saved to database: {user_doc.get('images', [])}")
        result = await db.users.insert_one(user_doc)
        logger.info(f"✅ User '{username}' successfully registered with ID: {result.inserted_id}")
    except Exception as e:
        logger.error(f"❌ Database insert error for user '{username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )
    
    # Get the created user
    created_user = await db.users.find_one({"_id": result.inserted_id})
    
    # Send verification email (using plain text email from form, before encryption)
    if contactEmail:
        try:
            from services.email_verification_service import EmailVerificationService
            email_service = EmailVerificationService(db)
            email_sent = await email_service.send_verification_email(
                username=username,
                email=contactEmail,  # Use form parameter (plain text)
                first_name=firstName or username
            )
            if email_sent:
                logger.info(f"📧 Verification email sent to {contactEmail}")
            else:
                logger.warning(f"⚠️ Failed to send verification email to {contactEmail}")
        except Exception as e:
            logger.error(f"❌ Error sending verification email: {e}", exc_info=True)
            # Don't fail registration if email fails
    
    # Send welcome push notification
    try:
        from services.notification_service import NotificationService
        from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
        
        notification_service = NotificationService(db)
        await notification_service.enqueue_notification(
            NotificationQueueCreate(
                username=username,
                trigger=NotificationTrigger.NEW_PROFILE_CREATED,
                channels=[NotificationChannel.PUSH],
                templateData={
                    "firstName": firstName or username,
                    "username": username
                }
            )
        )
        logger.info(f"🔔 Welcome push notification queued for {username}")
    except Exception as e:
        logger.error(f"❌ Failed to queue welcome notification: {e}")
        # Don't fail registration if notification fails
    
    # Remove password from response
    created_user.pop("password", None)
    created_user.pop("_id", None)
    
    # 🔓 DECRYPT PII fields for response
    try:
        encryptor = get_encryptor()
        created_user = encryptor.decrypt_user_pii(created_user)
        logger.debug(f"🔓 PII fields decrypted for registration response")
    except Exception as decrypt_err:
        logger.warning(f"⚠️ Decryption skipped in registration response: {decrypt_err}")
    
    # Remove consent metadata (backend-only fields)
    remove_consent_metadata(created_user)
    
    # Convert image paths to full URLs
    created_user["images"] = [get_full_image_url(img) for img in created_user.get("images", [])]
    
    return {
        "message": "User registered successfully. Please check your email to verify your account.",
        "user": created_user
    }

@router.post("/login")
async def login_user(login_data: LoginRequest, db = Depends(get_database)):
    """Login user and return access token"""
    logger.info(f"🔑 Login attempt for username: {login_data.username}")
    
    # Verify Cloudflare Turnstile CAPTCHA (human verification)
    if login_data.captchaToken:
        captcha_valid = await verify_turnstile(login_data.captchaToken)
        if not captcha_valid:
            logger.warning(f"❌ CAPTCHA verification failed for username: {login_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CAPTCHA verification failed. Please try again."
            )
        logger.info(f"✅ CAPTCHA verified for username: {login_data.username}")
    else:
        # CAPTCHA token not provided (could be from old clients or direct API calls)
        logger.warning(f"⚠️ No CAPTCHA token provided for username: {login_data.username}")
        # For now, allow login without CAPTCHA (backward compatibility)
        # In production, uncomment the lines below to require CAPTCHA:
        # raise HTTPException(
        #     status_code=status.HTTP_400_BAD_REQUEST,
        #     detail="CAPTCHA verification required"
        # )
    
    # Find user in database (works for both admin and regular users) - case-insensitive
    logger.debug(f"Looking up user '{login_data.username}' in database...")
    user = await db.users.find_one(get_username_query(login_data.username))
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
    
    # Check MFA if enabled
    mfa = user.get("mfa", {})
    mfa_warning = None  # To store warning message if MFA requirements not met
    
    if mfa.get("mfa_enabled"):
        logger.debug(f"MFA is enabled for user '{login_data.username}'")
        mfa_channel = mfa.get("mfa_type", "email")
        
        # Validate MFA requirements based on channel
        mfa_requirements_met = True
        mfa_missing_items = []
        
        if mfa_channel == "sms":
            # Check if user has phone number
            phone = user.get("contactNumber")
            logger.info(f"🔍 Login MFA check - Raw phone: {phone}")
            if phone:
                phone = _decrypt_contact_info(phone)
                logger.info(f"🔓 Login MFA check - Decrypted phone: {phone}")
            if not phone or (isinstance(phone, str) and not phone.strip()):
                mfa_requirements_met = False
                mfa_missing_items.append("phone number")
                logger.warning(f"⚠️ Login MFA check: No valid phone number for {login_data.username}")
            
            # Check if SMS opt-in is enabled
            sms_opt_in = user.get("smsOptIn", True)
            if not sms_opt_in:
                mfa_requirements_met = False
                mfa_missing_items.append("SMS notifications enabled")
                logger.warning(f"⚠️ Login MFA check: SMS opt-in disabled for {login_data.username}")
        
        elif mfa_channel == "email":
            # Check if user has email
            email = user.get("contactEmail") or user.get("email", "")
            if email:
                email = _decrypt_contact_info(email)
            if not email or not email.strip():
                mfa_requirements_met = False
                mfa_missing_items.append("email address")
        
        # If MFA requirements are not met, skip MFA entirely and add warning
        if not mfa_requirements_met:
            logger.warning(f"⚠️ MFA enabled for {login_data.username} but requirements not met: {', '.join(mfa_missing_items)}")
            mfa_warning = {
                "mfa_channel": mfa_channel,
                "missing_items": mfa_missing_items,
                "message": f"MFA is enabled but you need to add: {', '.join(mfa_missing_items)}. Please update your profile to enable MFA protection."
            }
            # Skip MFA verification entirely - proceed to login below
        else:
            # MFA requirements ARE met - proceed with normal MFA flow
            if not login_data.mfa_code:
                # MFA required but not provided - return special status with details
                # Get masked contact info
                if mfa_channel == "sms":
                    phone = user.get("contactNumber", "")
                    # DECRYPT phone if encrypted (production PII encryption)
                    phone = _decrypt_contact_info(phone)
                    contact_masked = f"{phone[:3]}***{phone[-2:]}" if phone and len(phone) > 5 else "***"
                else:  # email
                    email = user.get("contactEmail") or user.get("email", "")
                    # DECRYPT email if encrypted (production PII encryption)
                    email = _decrypt_contact_info(email)
                    contact_masked = f"{email[0]}***@{email.split('@')[1]}" if email and '@' in email else "***"
                
                logger.info(f"🔒 MFA required for user '{login_data.username}' - returning MFA_REQUIRED")
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": "MFA_REQUIRED",
                        "mfa_channel": mfa_channel,
                        "contact_masked": contact_masked
                    }
                )
            
            # Verify MFA code based on type (only runs if mfa_code was provided)
            mfa_type = mfa.get("mfa_type", "email")
            logger.debug(f"Verifying MFA code for user '{login_data.username}' (type: {mfa_type})")
            
            if mfa_type in ["sms", "email"]:
                # SMS/Email-based MFA - verify OTP from database
                from services.sms_service import OTPManager
                otp_manager = OTPManager(db)
                verify_result = await otp_manager.verify_otp(
                    identifier=login_data.username,
                    code=login_data.mfa_code,
                    purpose="mfa",
                    mark_as_used=True
                )
                
                if not verify_result["success"]:
                    # Check if it's a backup code
                    backup_codes = mfa.get("mfa_backup_codes", [])
                    backup_code_valid = False
                    
                    if "-" in login_data.mfa_code and len(login_data.mfa_code) == 9:
                        for idx, hashed_code in enumerate(backup_codes):
                            if PasswordManager.verify_password(login_data.mfa_code, hashed_code):
                                # Remove used backup code
                                backup_codes.pop(idx)
                                await db.users.update_one(
                                    {"username": login_data.username},
                                    {"$set": {"mfa.mfa_backup_codes": backup_codes}}
                                )
                                backup_code_valid = True
                                logger.info(f"✅ Backup code used for login: {login_data.username}")
                                break
                    
                    if not backup_code_valid:
                        logger.warning(f"⚠️ Invalid MFA code for user '{login_data.username}'")
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid MFA code"
                        )
            
            logger.info(f"✅ MFA verification successful for user '{login_data.username}'")
    
    # Create access token with role
    logger.debug(f"Creating access token for user '{login_data.username}'")
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    
    # Determine user role - admin gets "admin" role, others get "user"
    user_role = "admin" if user["username"] == "admin" else user.get("role", "user")
    
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user_role
        }, 
        expires_delta=access_token_expires
    )
    
    # Remove password and _id from response
    user.pop("password", None)
    user.pop("_id", None)
    
    # Remove consent metadata (backend-only fields)
    remove_consent_metadata(user)

    existing_images = user.get("images", [])
    normalized_images = [_extract_image_path(img) for img in existing_images if img]
    normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
    full_public_urls = [get_full_image_url(p) for p in normalized_public]
    user["publicImages"] = full_public_urls

    try:
        from urllib.parse import urlparse

        def extract_path(url_or_path: str) -> str:
            if not url_or_path:
                return ''
            if isinstance(url_or_path, str) and url_or_path.startswith('http'):
                parsed = urlparse(url_or_path)
                return parsed.path
            if isinstance(url_or_path, str) and url_or_path.startswith('uploads/'):
                return '/' + url_or_path
            return url_or_path

        db_user = await db.users.find_one(get_username_query(login_data.username), {"images": 1, "publicImages": 1})
        db_images = db_user.get("images", []) if db_user else []
        db_public_images = db_user.get("publicImages", []) if db_user else []

        normalized_images = {extract_path(img) for img in db_images if img}
        normalized_public = [extract_path(img) for img in db_public_images if img]
        normalized_public = [p for p in normalized_public if p in normalized_images]

        user["publicImages"] = [get_full_image_url(p) for p in normalized_public]
    except Exception as e:
        logger.warning(f"⚠️ Failed to compute publicImages for {login_data.username}: {e}")
        user["publicImages"] = []
    
    logger.info(f"✅ Login successful for user '{login_data.username}'")
    response = {
        "message": "Login successful",
        "user": user,
        "access_token": access_token,
        "token_type": "bearer"
    }
    
    # Add MFA warning if present
    if mfa_warning:
        response["mfa_warning"] = mfa_warning
    
    return response

@router.get("/profile/{username}")
async def get_user_profile(
    username: str,
    requester: str = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get user profile by username with PII masking"""
    requester_username = current_user.get("username")
    logger.info(f"👤 Profile request for username: {username} (requester: {requester_username})")
    
    # Find user (case-insensitive)
    logger.debug(f"Fetching profile for user '{username}'...")
    user = await db.users.find_one(get_username_query(username))
    if not user:
        logger.warning(f"⚠️ Profile not found for username: {username}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Remove password and _id from response
    user.pop("password", None)
    user.pop("_id", None)
    
    # Debug: Log profileId presence
    logger.debug(f"📋 ProfileId in DB response: {user.get('profileId', 'NOT FOUND')}")
    logger.info(f"🔍 RELIGION RETRIEVE: Religion value from DB for user {username}: '{user.get('religion', 'NOT SET')}'")
    
    # 🔓 DECRYPT PII fields (if encrypted)
    try:
        encryptor = get_encryptor()
        user = encryptor.decrypt_user_pii(user)
        logger.debug(f"🔓 PII decrypted for {username}")
    except Exception as decrypt_err:
        logger.warning(f"⚠️ Decryption skipped (encryption may not be enabled): {decrypt_err}")
        # Continue without decryption if encryption not configured
    
    # Remove consent metadata (backend-only fields)
    remove_consent_metadata(user)

    existing_images = user.get("images", [])
    normalized_images = [_extract_image_path(img) for img in existing_images if img]
    normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
    full_public_urls = [get_full_image_url(p) for p in normalized_public]
    user["publicImages"] = full_public_urls
    
    # Calculate age from birthMonth and birthYear if not already set
    if not user.get("age") and user.get("birthMonth") and user.get("birthYear"):
        user["age"] = calculate_age(user.get("birthMonth"), user.get("birthYear"))
        logger.debug(f"🎂 Calculated age for {username}: {user.get('age')}")
    
    # Apply PII masking if requester is not the profile owner
    from pii_security import mask_user_pii, check_access_granted
    
    access_granted = False
    if requester_username:
        access_granted = await check_access_granted(db, requester_username, username)
        logger.info(f"🔐 PII access for {requester_username} viewing {username}: {access_granted}")
    
    user = mask_user_pii(user, requester_username, access_granted)

    has_image_access = await _has_images_access(db, requester_username, username)

    if has_image_access:
        user["images"] = [get_full_image_url(p) for p in normalized_images]
    else:
        user["images"] = full_public_urls
    
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
    request: Request,
    firstName: Optional[str] = Form(None),
    lastName: Optional[str] = Form(None),
    contactNumber: Optional[str] = Form(None),
    contactEmail: Optional[str] = Form(None),
    smsOptIn: Optional[bool] = Form(None),  # SMS notifications opt-in
    birthMonth: Optional[int] = Form(None),  # Birth month (1-12)
    birthYear: Optional[int] = Form(None),   # Birth year
    gender: Optional[str] = Form(None),
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
    educationHistory: Optional[str] = Form(None),  # JSON string
    workExperience: Optional[str] = Form(None),  # JSON string
    linkedinUrl: Optional[str] = Form(None),
    workingStatus: Optional[str] = Form(None),
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
    bio: Optional[str] = Form(None),  # NEW: Short tagline/bio
    # Profile Creator Metadata (for profiles created by others)
    profileCreatedBy: Optional[str] = Form(None),  # Self, Parent, Sibling, Friend, etc.
    creatorFullName: Optional[str] = Form(None),  # Creator's full name
    creatorRelationship: Optional[str] = Form(None),  # Relationship to profile owner
    creatorNotes: Optional[str] = Form(None),  # Why profile was created by someone else
    partnerPreference: Optional[str] = Form(None),
    partnerCriteria: Optional[str] = Form(None),  # NEW: JSON object with all criteria
    customAboutMe: Optional[str] = Form(None),  # User's custom About Me content (overrides auto-generated)
    images: List[UploadFile] = File(default=[]),
    imagesToDelete: Optional[str] = Form(None),
    imageOrder: Optional[str] = Form(None),  # NEW: JSON array of image URLs in desired order
    db = Depends(get_database)
):
    """Update user profile"""
    logger.info(f"📝 Update request for user '{username}'")
    
    # Find user (case-insensitive)
    logger.debug(f"Looking up user '{username}' for update...")
    user = await db.users.find_one(get_username_query(username))
    if not user:
        logger.warning(f"⚠️ Update failed: User '{username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate birth date if provided (REQUIRED for complete profiles)
    if birthMonth is not None or birthYear is not None:
        # If updating one, both must be provided
        if birthMonth is None or birthYear is None:
            # Check if user already has the missing field
            if not user.get('birthMonth') or not user.get('birthYear'):
                logger.warning(f"⚠️ Update failed: User '{username}' missing complete birth date")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Both birth month and year are required"
                )
        
        # Validate birth month range if provided
        check_month = birthMonth if birthMonth is not None else user.get('birthMonth')
        if check_month and (check_month < 1 or check_month > 12):
            logger.warning(f"⚠️ Update failed: Invalid birth month {check_month} for user '{username}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Birth month must be between 1 and 12"
            )
        
        # Validate birth year if provided
        check_year = birthYear if birthYear is not None else user.get('birthYear')
        if check_year:
            current_year = datetime.now().year
            min_year = current_year - 100
            max_year = current_year - 18
            if check_year < min_year or check_year > max_year:
                logger.warning(f"⚠️ Update failed: Invalid birth year {check_year} for user '{username}'")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Birth year must be between {min_year} and {max_year} (ages 18-100)"
                )
        
        logger.info(f"✅ Birth date validated for user '{username}' update")
    
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
    if smsOptIn is not None:
        update_data["smsOptIn"] = smsOptIn
    
    # Update birth month and year
    if birthMonth is not None:
        update_data["birthMonth"] = birthMonth
    if birthYear is not None:
        update_data["birthYear"] = birthYear
    
    # Handle gender field
    if gender is not None and gender.strip():
        update_data["gender"] = gender.strip()
    
    if height is not None and height.strip():
        update_data["height"] = height.strip()
        update_data["heightInches"] = parse_height_to_inches(height.strip())  # Numeric for searching
    
    # Regional/Cultural fields
    if religion is not None and religion.strip():
        update_data["religion"] = religion.strip()
        logger.info(f"🔍 RELIGION UPDATE: Setting religion to '{religion.strip()}' for user {username}")
    else:
        logger.warning(f"⚠️ RELIGION UPDATE: Religion field is None or empty for user {username}. Value: {religion}")
    if countryOfOrigin is not None and countryOfOrigin.strip():
        update_data["countryOfOrigin"] = countryOfOrigin.strip()
    if countryOfResidence is not None and countryOfResidence.strip():
        update_data["countryOfResidence"] = countryOfResidence.strip()
        # ALSO save as 'country' for L3V3L scoring compatibility
        update_data["country"] = countryOfResidence.strip()
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
        # ALSO save as 'city' for L3V3L scoring compatibility
        update_data["city"] = location.strip()
    
    # Education & Work
    if workingStatus is not None and workingStatus.strip():
        update_data["workingStatus"] = workingStatus.strip()
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
    
    # Bio / Tagline
    if bio is not None and bio.strip():
        update_data["bio"] = bio.strip()
    
    # Custom About Me (user-edited content that overrides auto-generated)
    # Note: "__RESET__" means "reset to auto-generated" - clear the field
    if customAboutMe is not None:
        if customAboutMe.strip() == "__RESET__":
            # Special value to reset - set to empty string (frontend checks for truthy)
            update_data["customAboutMe"] = ""
        elif customAboutMe.strip():
            update_data["customAboutMe"] = customAboutMe.strip()
    
    # Profile Creator Metadata
    if profileCreatedBy is not None:
        update_data["profileCreatedBy"] = profileCreatedBy
        # Only store creatorInfo if profile is NOT created by self
        if profileCreatedBy and profileCreatedBy != "me":
            update_data["creatorInfo"] = {
                "fullName": creatorFullName if creatorFullName else None,
                "relationship": creatorRelationship if creatorRelationship else None,
                "notes": creatorNotes if creatorNotes else None
            }
        else:
            # If changed to "me", clear creatorInfo
            update_data["creatorInfo"] = None
    
    if partnerPreference is not None and partnerPreference.strip():
        update_data["partnerPreference"] = partnerPreference.strip()
    
    # Handle new structured fields (JSON arrays/objects)
    logger.info(f"📚 educationHistory received: {educationHistory}")
    logger.info(f"💼 workExperience received: {workExperience}")
    
    if educationHistory is not None and educationHistory.strip():
        try:
            parsed_edu = json.loads(educationHistory)
            update_data["educationHistory"] = parsed_edu
            logger.info(f"✅ Parsed educationHistory: {len(parsed_edu)} entries")
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON for educationHistory: {educationHistory}, error: {e}")
    
    if workExperience is not None and workExperience.strip():
        try:
            parsed_work = json.loads(workExperience)
            update_data["workExperience"] = parsed_work
            logger.info(f"✅ Parsed workExperience: {len(parsed_work)} entries")
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON for workExperience: {workExperience}, error: {e}")
    
    if languagesSpoken is not None and languagesSpoken.strip():
        try:
            update_data["languagesSpoken"] = json.loads(languagesSpoken)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON for languagesSpoken: {languagesSpoken}")
    
    if partnerCriteria is not None and partnerCriteria.strip():
        try:
            parsed_criteria = json.loads(partnerCriteria)
            update_data["partnerCriteria"] = parsed_criteria
            logger.info(f"🎯 PARTNER CRITERIA UPDATE: Received and parsed partner criteria for user {username}")
            logger.info(f"   Keys: {list(parsed_criteria.keys())}")
            logger.info(f"   Religion: {parsed_criteria.get('religion', 'NOT SET')}")
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON for partnerCriteria: {partnerCriteria}")
    else:
        logger.warning(f"⚠️ PARTNER CRITERIA: Not received or empty for user {username}. Value: {partnerCriteria}")
    
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
            
            # Robust path normalization using pathlib
            from pathlib import Path
            from urllib.parse import urlparse
            
            def extract_filename(url_or_path):
                """
                Robustly extract just the filename from any URL or path format
                Returns None if extraction fails
                """
                if not url_or_path or not isinstance(url_or_path, str):
                    return None
                
                try:
                    # Handle URLs (http://localhost:8000/uploads/abc.jpeg or GCP URLs)
                    if url_or_path.startswith('http://') or url_or_path.startswith('https://'):
                        parsed = urlparse(url_or_path)
                        path = Path(parsed.path)  # Gets the path component
                        return path.name  # abc.jpeg
                    
                    # Handle relative paths (/uploads/abc.jpeg or uploads/abc.jpeg)
                    path = Path(url_or_path)
                    return path.name  # abc.jpeg
                    
                except Exception as e:
                    logger.error(f"Failed to extract filename from '{url_or_path}': {e}")
                    return None
            
            # Build mapping: filename -> original DB format
            # This preserves whether DB has relative paths or full URLs
            filename_to_db_path = {}
            for db_path in existing_images:
                filename = extract_filename(db_path)
                if filename:
                    filename_to_db_path[filename] = db_path
                else:
                    logger.warning(f"   ⚠️ Could not extract filename from DB path: {db_path}")
            
            logger.info(f"   📝 Mapped {len(filename_to_db_path)} filenames from DB")
            
            # Reorder images based on frontend request
            ordered_paths = []
            for frontend_url in ordered_urls:
                filename = extract_filename(frontend_url)
                if not filename:
                    logger.warning(f"   ⚠️ Could not extract filename from frontend URL: {frontend_url}")
                    continue
                    
                if filename in filename_to_db_path:
                    # Use original DB format (preserves local vs GCP format)
                    ordered_paths.append(filename_to_db_path[filename])
                    logger.debug(f"   ✓ Matched {filename} -> {filename_to_db_path[filename]}")
                else:
                    logger.warning(f"   ⚠️ Filename {filename} not found in existing images")
            
            # Validate we didn't lose any images
            if len(ordered_paths) != len(existing_images):
                logger.warning(f"   ⚠️ Image count mismatch: ordered={len(ordered_paths)}, existing={len(existing_images)}")
            
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

        try:
            from urllib.parse import urlparse

            def extract_path(url_or_path: str) -> str:
                if not url_or_path:
                    return ''
                if isinstance(url_or_path, str) and url_or_path.startswith('http'):
                    parsed = urlparse(url_or_path)
                    return parsed.path
                if isinstance(url_or_path, str) and url_or_path.startswith('uploads/'):
                    return '/' + url_or_path
                return url_or_path

            current_public = user.get("publicImages", [])
            normalized_images = {extract_path(img) for img in existing_images if img}
            normalized_public = [extract_path(img) for img in current_public if img]
            normalized_public = [p for p in normalized_public if p in normalized_images]
            update_data["publicImages"] = normalized_public
        except Exception as e:
            logger.warning(f"⚠️ Failed to normalize publicImages for {username}: {e}")
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
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    
    # Log what's being updated
    logger.info(f"📝 update_data keys: {list(update_data.keys())}")
    
    # 🔒 ENCRYPT PII fields before saving
    try:
        encryptor = get_encryptor()
        update_data = encryptor.encrypt_user_pii(update_data)
        logger.debug(f"🔒 PII encrypted before saving for {username}")
    except Exception as encrypt_err:
        logger.warning(f"⚠️ Encryption skipped (encryption may not be enabled): {encrypt_err}")
        # Continue without encryption if not configured
    
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
        
        # Log activity for profile edit
        try:
            from services.activity_logger import get_activity_logger
            from models.activity_models import ActivityType
            activity_logger = get_activity_logger()
            await activity_logger.log_activity(
                username=username,
                action_type=ActivityType.PROFILE_EDITED,
                metadata={
                    "fields_updated": list(update_data.keys()),
                    "field_count": len(update_data)
                },
                ip_address=request.client.host if request.client else None
            )
        except Exception as log_err:
            logger.warning(f"⚠️ Failed to log profile edit activity: {log_err}")
        
        # Dispatch event for notifications
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.PROFILE_UPDATED,
                actor_username=username,
                metadata={"fields_updated": list(update_data.keys())}
            )
        except Exception as dispatch_err:
            logger.warning(f"⚠️ Failed to dispatch profile update event: {dispatch_err}")
        
        # Get updated user
        updated_user = await db.users.find_one({"username": username})
        updated_user.pop("password", None)
        updated_user.pop("_id", None)
        
        # 🔓 DECRYPT PII fields for response
        try:
            encryptor = get_encryptor()
            updated_user = encryptor.decrypt_user_pii(updated_user)
        except Exception as decrypt_err:
            logger.warning(f"⚠️ Decryption skipped on response: {decrypt_err}")
        
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

# ===== PHOTO AUTO-SAVE ENDPOINTS =====

@router.post("/profile/{username}/upload-photos")
async def upload_photos(
    username: str,
    images: List[UploadFile] = File(...),
    existingImages: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Auto-upload photos for a user in edit mode
    Returns updated images array
    """
    logger.info(f"📤 Auto-upload request for user '{username}' with {len(images)} photo(s)")
    
    # Security: Verify user is authenticated and matches username (or is admin)
    current_username = current_user.get("username")
    user_role = current_user.get("role", "user")
    
    if current_username != username and user_role != "admin":
        logger.warning(f"⚠️ Unauthorized upload attempt by '{current_username}' for user '{username}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only upload photos to your own profile"
        )
    
    # Find user
    user = await db.users.find_one(get_username_query(username))
    if not user:
        logger.warning(f"⚠️ Upload failed: User '{username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Parse existing images
    existing_images_list = []
    if existingImages:
        try:
            existing_images_list = json.loads(existingImages)
            logger.info(f"📸 Existing images: {len(existing_images_list)}")
        except json.JSONDecodeError:
            logger.warning(f"⚠️ Invalid JSON for existingImages")
    
    # Validate total count (max 5 photos)
    total_images = len(existing_images_list) + len(images)
    if total_images > 5:
        logger.warning(f"⚠️ Upload rejected: Would exceed 5 photo limit ({total_images} total)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum 5 photos allowed. You have {len(existing_images_list)} and are trying to add {len(images)}."
        )
    
    # Validate file sizes (5MB each)
    for image in images:
        # Read file to check size
        content = await image.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB
            logger.warning(f"⚠️ Upload rejected: File '{image.filename}' exceeds 5MB")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{image.filename}' exceeds 5MB limit"
            )
        # Reset file pointer for save_multiple_files
        await image.seek(0)
    
    # Upload new images
    try:
        logger.info(f"💾 Saving {len(images)} new photo(s)...")
        new_image_paths = await save_multiple_files(images)
        logger.info(f"✅ Saved new photos: {new_image_paths}")
        
        # Combine with existing images
        all_images = existing_images_list + new_image_paths
        logger.info(f"📸 Total images after upload: {len(all_images)}")
        
        # Update user's images in database
        result = await db.users.update_one(
            {"username": username},
            {"$set": {
                "images": all_images,
                "updatedAt": datetime.utcnow().isoformat()
            }}
        )
        
        if result.modified_count == 0:
            logger.warning(f"⚠️ No changes made to user '{username}' images")
        
        logger.info(f"✅ Photos auto-uploaded successfully for user '{username}'")
        
        # Return full URLs
        full_urls = [get_full_image_url(img) for img in all_images]
        
        return {
            "images": full_urls,
            "message": f"{len(new_image_paths)} photo(s) uploaded successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Error uploading photos for user '{username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload photos: {str(e)}"
        )

@router.put("/profile/{username}/reorder-photos")
async def reorder_photos(
    username: str,
    imageOrder: Dict[str, List[str]] = Body(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Change profile picture by reordering photos
    First image in array becomes profile picture
    """
    logger.info(f"🔄 Reorder photos request for user '{username}'")
    
    # Security: Verify user is authenticated and matches username (or is admin)
    current_username = current_user.get("username")
    user_role = current_user.get("role", "user")
    
    if current_username != username and user_role != "admin":
        logger.warning(f"⚠️ Unauthorized reorder attempt by '{current_username}' for user '{username}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only reorder photos on your own profile"
        )
    
    # Find user
    user = await db.users.find_one(get_username_query(username))
    if not user:
        logger.warning(f"⚠️ Reorder failed: User '{username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get new image order
    new_order = imageOrder.get("imageOrder", [])
    if not new_order:
        logger.warning(f"⚠️ Reorder failed: No imageOrder provided")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="imageOrder array is required"
        )
    
    logger.info(f"🔄 New order ({len(new_order)} images): {new_order}")
    
    # Validate: new order must match existing images
    existing_images = user.get("images", [])
    logger.info(f"📸 Current images ({len(existing_images)}): {existing_images}")
    
    # Normalize URLs to paths for comparison
    from pathlib import Path
    from urllib.parse import urlparse
    
    def extract_path(url_or_path):
        """Normalize all image path formats to /uploads/filename.ext"""
        if not url_or_path:
            return ''
            
        # Handle full URLs: http://localhost:8000/uploads/file.jpg or /api/users/media/file.jpg
        if url_or_path.startswith('http'):
            parsed = urlparse(url_or_path)
            path = parsed.path
        else:
            path = url_or_path
        
        # Extract just the filename from various path formats
        # /api/users/media/file.jpg -> file.jpg
        # /uploads/file.jpg -> file.jpg
        # uploads/file.jpg -> file.jpg
        filename = path.split('/')[-1]
        
        # Return normalized path as /uploads/filename
        return f'/uploads/{filename}'
    
    # Normalize both for comparison
    normalized_new = sorted([extract_path(img) for img in new_order])
    normalized_existing = sorted([extract_path(img) for img in existing_images])
    
    logger.info(f"🔍 Raw new order from frontend: {new_order}")
    logger.info(f"🔍 Raw existing from DB: {existing_images}")
    logger.info(f"🔍 Normalized new order: {normalized_new}")
    logger.info(f"🔍 Normalized existing: {normalized_existing}")
    logger.info(f"🔍 Match? {normalized_new == normalized_existing}")
    
    if normalized_new != normalized_existing:
        logger.warning(f"⚠️ Reorder failed: imageOrder doesn't match existing images")
        logger.warning(f"   Provided sorted: {normalized_new}")
        logger.warning(f"   Expected sorted: {normalized_existing}")
        logger.warning(f"   Difference: {set(normalized_new) - set(normalized_existing)} | {set(normalized_existing) - set(normalized_new)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"imageOrder doesn't match current images. Provided: {len(normalized_new)} images, Expected: {len(normalized_existing)} images"
        )
    
    # Normalize new_order to relative paths (strip domain/protocol)
    normalized_order = [extract_path(img) for img in new_order]
    
    # Update user's images in database
    try:
        result = await db.users.update_one(
            {"username": username},
            {"$set": {
                "images": normalized_order,
                "updatedAt": datetime.utcnow().isoformat()
            }}
        )
        
        if result.modified_count == 0:
            logger.warning(f"⚠️ No changes made to user '{username}' photo order")
        
        logger.info(f"✅ Photos reordered successfully for user '{username}'")
        logger.info(f"📸 New profile picture: {normalized_order[0] if normalized_order else 'none'}")
        
        # Return full URLs
        full_urls = [get_full_image_url(img) for img in normalized_order]
        
        return {
            "images": full_urls,
            "message": "Profile picture updated successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Error reordering photos for user '{username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reorder photos: {str(e)}"
        )

@router.put("/profile/{username}/delete-photo")
async def delete_photo(
    username: str,
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Delete a single photo from user's profile
    Auto-saves deletion immediately
    """
    logger.info(f"🗑️ Delete photo request - URL username: '{username}'")
    
    # Get JWT username - current_user is a dict from the database with 'username' field
    # Extract username from the user dict (not from 'sub' field)
    if isinstance(current_user, dict):
        current_username = current_user.get("username") or current_user.get("_id")
        logger.info(f"🔐 JWT user dict keys: {list(current_user.keys())}")
    else:
        current_username = str(current_user)
    
    logger.info(f"🔐 JWT username: '{current_username}'")
    logger.info(f"🔐 URL username: '{username}'")
    
    # Case-insensitive username comparison
    if not current_username:
        logger.error(f"❌ Could not extract username from JWT token")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication error: Could not identify user"
        )
    
    # Allow admin or owner
    user_role = current_user.get("role", "free_user") if isinstance(current_user, dict) else "free_user"
    logger.info(f"🔐 User role: '{user_role}'")
    
    if current_username.lower() != username.lower() and user_role != "admin":
        logger.warning(f"⚠️ User '{current_username}' attempted to delete photos for '{username}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can only delete photos from your own profile"
        )
    
    logger.info(f"✅ Authorization passed")
    
    # Find user
    user = await db.users.find_one(get_username_query(username))
    if not user:
        logger.warning(f"⚠️ Delete failed: User '{username}' not found in database")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get photo to delete
    image_to_delete = data.get("imageToDelete")
    remaining_images = data.get("remainingImages", [])
    
    if not image_to_delete:
        logger.warning(f"⚠️ Delete failed: No imageToDelete provided")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="imageToDelete is required"
        )
    
    logger.info(f"🗑️ Deleting photo: {image_to_delete}")
    logger.info(f"📸 Remaining photos: {len(remaining_images)}")
    
    # Normalize path for comparison
    from pathlib import Path
    from urllib.parse import urlparse
    
    def extract_filename(url_or_path):
        """Extract just the filename from any image path format for comparison"""
        if not url_or_path:
            return ''
        
        # Strip query parameters (like ?token=...)
        if '?' in url_or_path:
            url_or_path = url_or_path.split('?')[0]
            
        # Handle full URLs: http://localhost:8000/uploads/file.jpg
        if url_or_path.startswith('http'):
            parsed = urlparse(url_or_path)
            url_or_path = parsed.path
        
        # Extract just the filename (last part after any /)
        # This handles all formats:
        # - /api/users/media/filename.jpg -> filename.jpg
        # - /uploads/profile_images/filename.jpg -> filename.jpg
        # - /media/filename.jpg -> filename.jpg
        # - filename.jpg -> filename.jpg
        return url_or_path.split('/')[-1]
    
    # Validate that image exists in user's images
    existing_images = user.get("images", [])
    normalized_to_delete = extract_filename(image_to_delete)
    normalized_existing = [extract_filename(img) for img in existing_images]
    
    logger.info(f"🔍 Normalized to delete: {normalized_to_delete}")
    logger.info(f"🔍 Normalized existing: {normalized_existing}")
    
    if normalized_to_delete not in normalized_existing:
        logger.warning(f"⚠️ Delete failed: Image not found in user's profile")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image not found in your profile"
        )
    
    # Delete physical file (optional - keep for safety, can delete later)
    try:
        file_path = Path("uploads") / normalized_to_delete
        if file_path.exists():
            logger.info(f"📁 Physical file would be at: {file_path}")
            # Optionally delete file: file_path.unlink()
            # For safety, keeping files for now
    except Exception as file_err:
        logger.warning(f"⚠️ Could not delete physical file: {file_err}")
    
    # Normalize remaining images
    normalized_remaining = [extract_filename(img) for img in remaining_images]

    current_public = user.get("publicImages", [])
    normalized_public = [extract_filename(img) for img in current_public]
    normalized_public = [p for p in normalized_public if p and p in normalized_remaining]
    
    # Update user's images in database
    try:
        result = await db.users.update_one(
            {"username": username},
            {"$set": {
                "images": normalized_remaining,
                "publicImages": normalized_public,
                "updatedAt": datetime.utcnow().isoformat()
            }}
        )
        
        if result.modified_count == 0:
            logger.warning(f"⚠️ No changes made to user '{username}' images")
        
        logger.info(f"✅ Photo deleted successfully for user '{username}'")
        logger.info(f"📸 Images before: {len(existing_images)}, after: {len(normalized_remaining)}")
        
        # Return full URLs
        full_urls = [get_full_image_url(img) for img in normalized_remaining]
        full_public_urls = [get_full_image_url(img) for img in normalized_public]
        
        return {
            "images": full_urls,
            "publicImages": full_public_urls,
            "message": "Photo deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Error deleting photo for user '{username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete photo: {str(e)}"
        )


@router.put("/profile/{username}/public-images")
async def update_public_images(
    username: str,
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    current_username = current_user.get("username") if isinstance(current_user, dict) else str(current_user)
    user_role = current_user.get("role", "free_user") if isinstance(current_user, dict) else "free_user"

    if not current_username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Authentication error")
    if current_username.lower() != username.lower() and user_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    user = await db.users.find_one(get_username_query(username), {"images": 1})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    public_images = data.get("publicImages")
    if public_images is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="publicImages is required")
    if not isinstance(public_images, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="publicImages must be a list")

    from urllib.parse import urlparse

    def extract_path(url_or_path: str) -> str:
        if not url_or_path:
            return ''
        if isinstance(url_or_path, str) and url_or_path.startswith('http'):
            parsed = urlparse(url_or_path)
            return parsed.path
        if isinstance(url_or_path, str) and url_or_path.startswith('uploads/'):
            return '/' + url_or_path
        return url_or_path

    existing_images = user.get("images", [])
    normalized_images = {extract_path(img) for img in existing_images if img}

    normalized_public = [extract_path(img) for img in public_images if img]
    normalized_public = [p for p in normalized_public if p in normalized_images]

    await db.users.update_one(
        {"username": username},
        {"$set": {"publicImages": normalized_public, "updatedAt": datetime.utcnow().isoformat()}}
    )

    return {
        "publicImages": [get_full_image_url(img) for img in normalized_public],
        "message": "Public photos updated"
    }

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
        user = await db.users.find_one(get_username_query(username))
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
    valid_themes = ['light-blue', 'dark', 'light-pink', 'light-gray', 'ultra-light-gray', 'ultra-light-green', 'ultra-black', 'indian-wedding', 'newspaper']
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

@router.put("/profile/{username}/consent")
async def update_user_consent(
    username: str,
    consent_data: dict,
    current_user: dict = Depends(get_current_user),
    request: Request = None,
    db = Depends(get_database)
):
    """
    Update user consent after policy changes (GDPR compliance)
    
    This endpoint allows users to re-consent after policy updates and
    maintains an audit trail of consent changes for legal compliance.
    """
    logger.info(f"📋 Consent update request for user '{username}'")
    
    # Extract current username from JWT
    current_username = current_user.get("username")
    if not current_username:
        logger.error(f"❌ Could not extract username from JWT token")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication error: Could not identify user"
        )
    
    # Only allow users to update their own consent (admins cannot consent for users)
    if current_username.lower() != username.lower():
        logger.warning(f"⚠️ User '{current_username}' attempted to update consent for '{username}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own consent preferences"
        )
    
    # Validate required fields
    required_consents = ['agreedToTerms', 'agreedToPrivacy', 'agreedToGuidelines', 'agreedToDataProcessing']
    for field in required_consents:
        if field not in consent_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required consent field: {field}"
            )
        if not isinstance(consent_data[field], bool):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Consent field '{field}' must be a boolean"
            )
    
    # Validate that all required consents are True
    if not all([consent_data.get(field) for field in required_consents]):
        logger.warning(f"⚠️ Consent update failed: User '{username}' did not agree to all required policies")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must agree to all required policies (Terms, Privacy, Guidelines, Data Processing)"
        )
    
    try:
        # Find user
        user = await db.users.find_one(get_username_query(username))
        if not user:
            logger.warning(f"⚠️ Consent update failed: User '{username}' not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        now = datetime.utcnow()
        
        # Prepare update data
        update_data = {
            "agreedToTerms": consent_data.get('agreedToTerms'),
            "agreedToPrivacy": consent_data.get('agreedToPrivacy'),
            "agreedToGuidelines": consent_data.get('agreedToGuidelines'),
            "agreedToDataProcessing": consent_data.get('agreedToDataProcessing'),
            "agreedToMarketing": consent_data.get('agreedToMarketing', False),
            "termsAgreedAt": now.isoformat(),
            "privacyAgreedAt": now.isoformat(),
            "consentVersion": consent_data.get('consentVersion', '1.0'),  # Track policy version
            "consentIpAddress": request.client.host if request else None,
            "consentUserAgent": request.headers.get("user-agent") if request else None,
            "consentUpdatedAt": now.isoformat(),
            "updatedAt": now.isoformat()
        }
        
        # Create audit trail entry
        consent_history_entry = {
            "timestamp": now.isoformat(),
            "agreedToTerms": consent_data.get('agreedToTerms'),
            "agreedToPrivacy": consent_data.get('agreedToPrivacy'),
            "agreedToGuidelines": consent_data.get('agreedToGuidelines'),
            "agreedToDataProcessing": consent_data.get('agreedToDataProcessing'),
            "agreedToMarketing": consent_data.get('agreedToMarketing', False),
            "consentVersion": consent_data.get('consentVersion', '1.0'),
            "ipAddress": request.client.host if request else None,
            "userAgent": request.headers.get("user-agent") if request else None
        }
        
        # Update user document
        result = await db.users.update_one(
            get_username_query(username),
            {
                "$set": update_data,
                "$push": {
                    "consentHistory": {
                        "$each": [consent_history_entry],
                        "$slice": -10  # Keep last 10 consent updates
                    }
                }
            }
        )
        
        if result.matched_count == 0:
            logger.warning(f"⚠️ Consent update failed: User '{username}' not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        logger.info(f"✅ Consent updated for user '{username}' (version: {consent_data.get('consentVersion', '1.0')})")
        
        return {
            "message": "Consent preferences updated successfully",
            "consentVersion": consent_data.get('consentVersion', '1.0'),
            "updatedAt": now.isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating consent for '{username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update consent: {str(e)}"
        )

@router.get("/admin/users")
async def get_all_users(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all users with pagination and filtering - Admin only endpoint"""
    logger.info(f"🔐 Admin request: Get users (page={page}, limit={limit}, search={search}, status_filter={status_filter}, role={role})")
    
    # 🛑 CRITICAL SECURITY CHECK
    if current_user.get("role") != "admin":
        logger.warning(f"⚠️ Unauthorized admin access attempt by user '{current_user.get('username')}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    try:
        # Build query filter using $and to combine multiple conditions
        query_conditions = []
        
        # Search filter (username, contactEmail, firstName, lastName)
        if search:
            search_regex = {"$regex": search, "$options": "i"}  # Case-insensitive
            query_conditions.append({
                "$or": [
                    {"username": search_regex},
                    {"contactEmail": search_regex},
                    {"firstName": search_regex},
                    {"lastName": search_regex}
                ]
            })
            logger.debug(f"🔍 Search filter applied: {search}")
        
        # Status filter - use accountStatus (unified field)
        if status_filter:
            query_conditions.append({"accountStatus": status_filter})
            logger.debug(f"📊 Status filter applied: {status_filter}")
        
        # Role filter
        if role:
            if role == "free_user":
                # Free users either have role_name='free_user' OR don't have role_name field
                query_conditions.append({
                    "$or": [
                        {"role_name": "free_user"},
                        {"role_name": {"$exists": False}},
                        {"role_name": None}
                    ]
                })
            else:
                query_conditions.append({"role_name": role})
            logger.debug(f"👤 Role filter applied: {role}")
        
        # Combine all conditions with $and
        query = {"$and": query_conditions} if query_conditions else {}
        
        # Get total count for pagination
        total_count = await db.users.count_documents(query)
        total_pages = (total_count + limit - 1) // limit  # Ceiling division
        
        # Fetch users with pagination
        skip = (page - 1) * limit
        users_cursor = db.users.find(query).skip(skip).limit(limit)
        users = await users_cursor.to_list(length=limit)
        
        # Remove sensitive data and decrypt PII
        for i, user in enumerate(users):
            user.pop("password", None)
            user.pop("_id", None)
            
            # 🔓 DECRYPT PII fields
            try:
                encryptor = get_encryptor()
                users[i] = encryptor.decrypt_user_pii(user)  # ✅ Assign back to list!
            except Exception as decrypt_err:
                logger.warning(f"⚠️ Decryption skipped for {user.get('username', 'unknown')}: {decrypt_err}")
            
            # Set default role_name to 'free_user' if not set
            if not users[i].get("role_name"):
                users[i]["role_name"] = "free_user"
            
            # Convert image paths to full URLs (admin sees all images)
            existing_images = users[i].get("images", [])
            normalized_public = _compute_public_image_paths(existing_images, users[i].get("publicImages", []))
            full_public_urls = [get_full_image_url(p) for p in normalized_public]
            users[i]["publicImages"] = full_public_urls
            users[i]["images"] = [get_full_image_url(img) for img in existing_images]
        
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
    new_password: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Change admin password"""
    # 🛑 Security Check
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    logger.info("🔐 Admin password change request")
    
    # Verify current password
    # TODO: Use a secure storage mechanism (DB/Vault) instead of hardcoding
    # This is a placeholder for the actual implementation
    
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
    requested_user: str = Form(...),
    message: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create PII access request"""
    requester = current_user["username"]
    logger.info(f"🔐 Access request: {requester} → {requested_user}")
    
    from pii_security import create_access_request
    result = await create_access_request(db, requester, requested_user, message)
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    logger.info(f"✅ Access request created: {requester} → {requested_user}")
    return result

@router.get("/access-requests/{username}")
async def get_access_requests(
    username: str, 
    type: str = "received",
    current_user: dict = Depends(get_current_user)
):
    """Get access requests for user (received or sent)"""
    # 🛑 Security Check
    if current_user["username"] != username and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

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
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Respond to access request (approve/deny)"""
    responder = current_user["username"]
    logger.info(f"📝 Response to request {request_id}: {response} by {responder}")
    
    from pii_security import respond_to_access_request
    result = await respond_to_access_request(db, request_id, response, responder)
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    logger.info(f"✅ Request {request_id} {response} by {responder}")
    return result

@router.delete("/profile/{username}")
async def delete_user_profile(
    username: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Delete user profile and ALL related data (CASCADE DELETE)
    
    This ensures complete data removal for privacy compliance (GDPR/CCPA).
    Deletes:
    - User profile
    - User images (from GCS or filesystem)
    - Favorites (both ways: user's favorites AND where user was favorited)
    - Shortlists (both ways: user's shortlists AND where user was shortlisted)
    - Exclusions (both ways: user's exclusions AND where user was excluded)
    - Messages (both sent and received)
    - Activity logs
    - Notifications
    - Audit logs
    - Event logs
    - Any other related data
    """
    logger.info(f"🗑️ CASCADE DELETE request for user '{username}'")
    
    # 🛑 CRITICAL SECURITY CHECK
    # Allow delete if:
    # 1. User is deleting their own profile
    # 2. User is an admin
    is_admin = current_user.get("role") == "admin" or current_user.get("role_name") == "admin"
    is_owner = current_user.get("username") == username
    
    if not (is_owner or is_admin):
        logger.warning(f"⚠️ Unauthorized delete attempt: User '{current_user.get('username')}' tried to delete '{username}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this profile"
        )
    
    # Find user (case-insensitive)
    logger.debug(f"Looking up user '{username}' for deletion...")
    user = await db.users.find_one(get_username_query(username))
    if not user:
        logger.warning(f"⚠️ Delete failed: User '{username}' not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    deletion_summary = {
        "username": username,
        "deleted_items": {}
    }
    
    try:
        # 1. Delete user images from GCS or filesystem
        images = user.get("images", [])
        if images:
            logger.info(f"🗑️ Deleting {len(images)} image(s) for user '{username}'")
            from config import settings
            
            if settings.use_gcs:
                # Delete from Google Cloud Storage
                try:
                    from services.gcs_storage import GCSStorage
                    gcs = GCSStorage()
                    for img_path in images:
                        try:
                            # Extract blob name from URL or path
                            blob_name = img_path.split('/')[-1] if '/' in img_path else img_path
                            await gcs.delete_file(blob_name)
                            logger.debug(f"Deleted GCS image: {blob_name}")
                        except Exception as e:
                            logger.warning(f"Failed to delete GCS image {img_path}: {e}")
                except Exception as e:
                    logger.warning(f"GCS deletion error: {e}")
            else:
                # Delete from local filesystem
                import os
                from pathlib import Path
                for img_path in images:
                    try:
                        file_path = Path(img_path.lstrip('/'))
                        if file_path.exists():
                            file_path.unlink()
                            logger.debug(f"Deleted local image: {file_path}")
                    except Exception as e:
                        logger.warning(f"Failed to delete local image {img_path}: {e}")
            
            deletion_summary["deleted_items"]["images"] = len(images)
        
        # 2. Delete favorites (where user favorited others)
        favorites_as_user = await db.favorites.delete_many({"userUsername": username})
        deletion_summary["deleted_items"]["favorites_as_user"] = favorites_as_user.deleted_count
        logger.info(f"🗑️ Deleted {favorites_as_user.deleted_count} favorites where '{username}' favorited others")
        
        # 3. Delete favorites (where user was favorited by others)
        favorites_by_others = await db.favorites.delete_many({"favoriteUsername": username})
        deletion_summary["deleted_items"]["favorited_by_others"] = favorites_by_others.deleted_count
        logger.info(f"🗑️ Deleted {favorites_by_others.deleted_count} favorites where others favorited '{username}'")
        
        # 4. Delete shortlists (where user shortlisted others)
        shortlists_as_user = await db.shortlists.delete_many({"userUsername": username})
        deletion_summary["deleted_items"]["shortlists_as_user"] = shortlists_as_user.deleted_count
        logger.info(f"🗑️ Deleted {shortlists_as_user.deleted_count} shortlists where '{username}' shortlisted others")
        
        # 5. Delete shortlists (where user was shortlisted by others)
        shortlists_by_others = await db.shortlists.delete_many({"shortlistedUsername": username})
        deletion_summary["deleted_items"]["shortlisted_by_others"] = shortlists_by_others.deleted_count
        logger.info(f"🗑️ Deleted {shortlists_by_others.deleted_count} shortlists where others shortlisted '{username}'")
        
        # 6. Delete exclusions (where user excluded others)
        exclusions_as_user = await db.exclusions.delete_many({"userUsername": username})
        deletion_summary["deleted_items"]["exclusions_as_user"] = exclusions_as_user.deleted_count
        logger.info(f"🗑️ Deleted {exclusions_as_user.deleted_count} exclusions where '{username}' excluded others")
        
        # 7. Delete exclusions (where user was excluded by others)
        exclusions_by_others = await db.exclusions.delete_many({"excludedUsername": username})
        deletion_summary["deleted_items"]["excluded_by_others"] = exclusions_by_others.deleted_count
        logger.info(f"🗑️ Deleted {exclusions_by_others.deleted_count} exclusions where others excluded '{username}'")
        
        # 8. Delete messages (sent by user)
        messages_sent = await db.messages.delete_many({"fromUsername": username})
        deletion_summary["deleted_items"]["messages_sent"] = messages_sent.deleted_count
        logger.info(f"🗑️ Deleted {messages_sent.deleted_count} messages sent by '{username}'")
        
        # 9. Delete messages (received by user)
        messages_received = await db.messages.delete_many({"toUsername": username})
        deletion_summary["deleted_items"]["messages_received"] = messages_received.deleted_count
        logger.info(f"🗑️ Deleted {messages_received.deleted_count} messages received by '{username}'")
        
        # 10. Delete activity logs
        activity_logs = await db.activity_logs.delete_many({"username": username})
        deletion_summary["deleted_items"]["activity_logs"] = activity_logs.deleted_count
        logger.info(f"🗑️ Deleted {activity_logs.deleted_count} activity logs for '{username}'")
        
        # 11. Delete notifications
        notifications = await db.notification_queue.delete_many({"username": username})
        deletion_summary["deleted_items"]["notifications"] = notifications.deleted_count
        logger.info(f"🗑️ Deleted {notifications.deleted_count} notifications for '{username}'")
        
        # 12. Delete notification logs
        notification_logs = await db.notification_log.delete_many({"username": username})
        deletion_summary["deleted_items"]["notification_logs"] = notification_logs.deleted_count
        logger.info(f"🗑️ Deleted {notification_logs.deleted_count} notification logs for '{username}'")
        
        # 13. Delete audit logs
        audit_logs = await db.audit_logs.delete_many({"username": username})
        deletion_summary["deleted_items"]["audit_logs"] = audit_logs.deleted_count
        logger.info(f"🗑️ Deleted {audit_logs.deleted_count} audit logs for '{username}'")
        
        # 14. Delete event logs
        event_logs = await db.event_logs.delete_many({
            "$or": [
                {"actor_username": username},
                {"target_username": username}
            ]
        })
        deletion_summary["deleted_items"]["event_logs"] = event_logs.deleted_count
        logger.info(f"🗑️ Deleted {event_logs.deleted_count} event logs involving '{username}'")
        
        # 15. Delete profile views (where user viewed others)
        profile_views_as_viewer = await db.profile_views.delete_many({"viewer_username": username})
        deletion_summary["deleted_items"]["profile_views_as_viewer"] = profile_views_as_viewer.deleted_count
        logger.info(f"🗑️ Deleted {profile_views_as_viewer.deleted_count} profile views by '{username}'")
        
        # 16. Delete profile views (where others viewed user)
        profile_views_as_viewed = await db.profile_views.delete_many({"viewed_username": username})
        deletion_summary["deleted_items"]["profile_views_as_viewed"] = profile_views_as_viewed.deleted_count
        logger.info(f"🗑️ Deleted {profile_views_as_viewed.deleted_count} profile views of '{username}'")
        
        # 17. Delete content violations
        violations = await db.content_violations.delete_many({"username": username})
        deletion_summary["deleted_items"]["violations"] = violations.deleted_count
        logger.info(f"🗑️ Deleted {violations.deleted_count} content violations for '{username}'")
        
        # 18. Delete verification tokens
        verification_tokens = await db.verification_tokens.delete_many({"username": username})
        deletion_summary["deleted_items"]["verification_tokens"] = verification_tokens.deleted_count
        logger.info(f"🗑️ Deleted {verification_tokens.deleted_count} verification tokens for '{username}'")
        
        # 19. Finally, delete the user profile itself
        logger.info(f"💾 Deleting user profile for '{username}' from database...")
        user_result = await db.users.delete_one({"username": username})
        
        if user_result.deleted_count == 0:
            logger.error(f"❌ Failed to delete user '{username}' from database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete profile"
            )
        
        deletion_summary["deleted_items"]["user_profile"] = 1
        
        # Calculate total items deleted
        total_deleted = sum(deletion_summary["deleted_items"].values())
        deletion_summary["total_items_deleted"] = total_deleted
        
        logger.info(f"✅ CASCADE DELETE completed for '{username}' - {total_deleted} total items deleted")
        logger.info(f"📊 Deletion summary: {deletion_summary['deleted_items']}")
        
        return {
            "message": f"Profile for user '{username}' and ALL related data has been permanently deleted",
            "summary": deletion_summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CASCADE DELETE error for user '{username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete profile and related data: {str(e)}"
        )
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
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Advanced search for users with filters"""
    logger.info(f"🔍 Search request - keyword: '{keyword}', status_filter: '{status_filter}', page: {page}, limit: {limit}")

    # Build query
    query = {}
    
    # Status filter - use accountStatus (unified field)
    if status_filter:
        query["accountStatus"] = {"$regex": f"^{status_filter}$", "$options": "i"}
    else:
        # Default to active users only (exclude paused, suspended, deactivated, pending)
        query["accountStatus"] = "active"

    # Text search
    # ⚠️ IMPORTANT: Don't search encrypted fields (location is encrypted, use region and city)
    if keyword:
        query["$or"] = [
            {"firstName": {"$regex": keyword, "$options": "i"}},
            {"lastName": {"$regex": keyword, "$options": "i"}},
            {"username": {"$regex": keyword, "$options": "i"}},
            {"region": {"$regex": keyword, "$options": "i"}},  # Search region, not location
            {"city": {"$regex": keyword, "$options": "i"}},  # Also search city field
            {"education": {"$regex": keyword, "$options": "i"}},
            {"occupation": {"$regex": keyword, "$options": "i"}},
            {"aboutYou": {"$regex": keyword, "$options": "i"}},
            {"bio": {"$regex": keyword, "$options": "i"}},
            {"interests": {"$regex": keyword, "$options": "i"}}
        ]

    # Gender filter
    if gender:
        query["gender"] = {"$regex": f"^{gender}$", "$options": "i"}  # Case-insensitive match

    # Age filter - Calculate dynamically from birthMonth and birthYear
    # This ensures age is always accurate and never stale
    # Store age filter for later use in aggregation pipeline
    age_filter_min = ageMin if ageMin > 0 else None
    age_filter_max = ageMax if ageMax > 0 else None

    # Height filter - now using heightInches (numeric field)
    # Include users who match OR don't have the field (lenient search)
    if heightMin > 0 or heightMax > 0:
        height_query = {}
        if heightMin > 0:
            height_query["$gte"] = heightMin
        if heightMax > 0:
            height_query["$lte"] = heightMax
        # Lenient: include users who match OR heightInches field doesn't exist
        if "$or" not in query:
            query["$or"] = []
        # Wrap existing $or conditions if they exist
        existing_or = query.pop("$or", [])
        query["$and"] = [
            {"$or": existing_or} if existing_or else {},
            {"$or": [
                {"heightInches": height_query},
                {"heightInches": {"$exists": False}},
                {"heightInches": None}
            ]}
        ]

    # Other filters
    # ⚠️ IMPORTANT: Can't search on encrypted location, search on region, city, and aboutYou instead
    if location:
        # Search in region, city, OR aboutYou field (all unencrypted) instead of location (encrypted)
        # aboutYou often contains location info like "I live in Indianapolis, IN"
        location_query = {"$or": [
            {"region": {"$regex": location, "$options": "i"}},
            {"city": {"$regex": location, "$options": "i"}},
            {"aboutYou": {"$regex": location, "$options": "i"}}
        ]}
        # Merge with existing query
        if "$and" in query:
            query["$and"].append(location_query)
        else:
            query["$and"] = [location_query]
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
        "age": [("birthYear", -1), ("birthMonth", -1)],
        "location": [("location", 1)]
    }

    sort = sort_options.get(sortBy, sort_options["newest"])
    if sortOrder == "asc":
        sort = [(field, 1) if direction == -1 else (field, -1) for field, direction in sort]

    # Calculate skip for pagination
    skip = (page - 1) * limit

    try:
        # Use aggregation pipeline if age filtering is needed (for dynamic calculation)
        # Otherwise use simple find for better performance
        if age_filter_min is not None or age_filter_max is not None:
            from datetime import datetime
            current_year = datetime.now().year
            current_month = datetime.now().month
            
            # Build aggregation pipeline
            pipeline = [
                # Stage 1: Match base query
                {"$match": query},
                
                # Stage 1.5: Project only needed fields (performance optimization)
                {"$project": DASHBOARD_USER_PROJECTION},
                
                # Stage 2: Add calculated age field
                {"$addFields": {
                    "calculatedAge": {
                        "$cond": {
                            "if": {"$and": [
                                {"$ne": ["$birthMonth", None]},
                                {"$ne": ["$birthYear", None]}
                            ]},
                            "then": {
                                # Calculate: current_year - birthYear, then subtract 1 if birthday hasn't occurred yet this year
                                "$subtract": [
                                    {"$subtract": [current_year, "$birthYear"]},
                                    {
                                        "$cond": {
                                            # If current month is before birth month, subtract 1 from age
                                            "if": {"$lt": [current_month, "$birthMonth"]},
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
                
                # Stage 3: Filter by calculated age (LENIENT - include users without age data)
                {"$match": {
                    "$or": [
                        # Match age range
                        {
                            "$and": [
                                {"calculatedAge": {"$gte": age_filter_min}} if age_filter_min else {},
                                {"calculatedAge": {"$lte": age_filter_max}} if age_filter_max else {},
                                {"calculatedAge": {"$ne": None}}  # Has age data
                            ]
                        },
                        # OR: No age data (lenient)
                        {"calculatedAge": None}
                    ]
                }},
                
                # Stage 4: Sort
                {"$sort": dict(sort)},
                
                # Stage 5: Facet for pagination and count
                {"$facet": {
                    "users": [
                        {"$skip": skip},
                        {"$limit": limit}
                    ],
                    "totalCount": [
                        {"$count": "count"}
                    ]
                }}
            ]
            
            # Execute aggregation
            logger.info(f"🔍 Executing search with aggregation (dynamic age calculation)")
            result = await db.users.aggregate(pipeline).to_list(1)
            
            if result and len(result) > 0:
                users = result[0].get("users", [])
                total_count = result[0].get("totalCount", [])
                total = total_count[0]["count"] if total_count else 0
            else:
                users = []
                total = 0
        else:
            # No age filtering - use simple find for better performance
            logger.info(f"🔍 Executing search with query: {query}")
            users_cursor = db.users.find(query, DASHBOARD_USER_PROJECTION).sort(sort).skip(skip).limit(limit)
            users = await users_cursor.to_list(length=limit)
            
            # Get total count for pagination
            total = await db.users.count_documents(query)

        # Remove sensitive data and decrypt PII
        for i, user in enumerate(users):
            user.pop("password", None)
            user.pop("_id", None)
            
            # 🔓 DECRYPT PII fields
            try:
                encryptor = get_encryptor()
                users[i] = encryptor.decrypt_user_pii(user)  # ✅ Assign back to list!
            except Exception as decrypt_err:
                logger.warning(f"⚠️ Decryption skipped for {user.get('username', 'unknown')}: {decrypt_err}")
            
            # Remove consent metadata (backend-only fields)
            remove_consent_metadata(users[i])

            existing_images = users[i].get("images", [])
            normalized_public = _compute_public_image_paths(existing_images, users[i].get("publicImages", []))
            full_public_urls = [get_full_image_url(p) for p in normalized_public]
            users[i]["publicImages"] = full_public_urls
            users[i]["images"] = full_public_urls
            
            # Calculate age dynamically from birthMonth and birthYear
            from datetime import datetime
            birth_month = users[i].get("birthMonth")
            birth_year = users[i].get("birthYear")
            if birth_month and birth_year:
                current_year = datetime.now().year
                current_month = datetime.now().month
                age = current_year - birth_year
                if current_month < birth_month:
                    age -= 1
                users[i]["age"] = age
            elif users[i].get("calculatedAge") is not None:
                # If age was calculated in aggregation, use it
                users[i]["age"] = users[i]["calculatedAge"]

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

        # Create saved search document - save ALL fields from frontend
        from datetime import datetime
        saved_search = {
            "username": username,
            **search_data,  # Save entire payload from frontend (criteria, minMatchScore, description, etc.)
            "createdAt": datetime.utcnow().isoformat()
        }
        
        logger.info(f"📝 Saving search: {saved_search.get('name')}")
        logger.info(f"   - Criteria: {saved_search.get('criteria')}")
        logger.info(f"   - minMatchScore: {saved_search.get('minMatchScore')}")
        logger.info(f"   - Description: {saved_search.get('description')}")

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

@router.put("/{username}/saved-searches/{search_id}")
async def update_saved_search(username: str, search_id: str, search_data: dict, db = Depends(get_database)):
    """Update a saved search (e.g., notification schedule, name, criteria)"""
    logger.info(f"✏️ Updating saved search {search_id} for user '{username}'")
    
    try:
        from bson import ObjectId
        from datetime import datetime
        
        # Verify user exists
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prepare update data
        update_data = {
            **search_data,
            "updatedAt": datetime.utcnow().isoformat()
        }
        
        # Remove id and _id fields if present (can't update _id)
        update_data.pop("id", None)
        update_data.pop("_id", None)
        
        logger.info(f"📝 Updating search '{search_data.get('name')}' with data: {update_data}")
        
        # If user is updating notification settings, clear any active admin override
        # (but preserve disabled status if admin disabled notifications)
        if "notifications" in search_data:
            existing = await db.saved_searches.find_one({"_id": ObjectId(search_id), "username": username})
            if existing:
                admin_override = existing.get("adminOverride", {})
                # Only clear override if it's not a disabled override
                if admin_override and not admin_override.get("disabled", False):
                    update_data["adminOverride"] = None
                    logger.info(f"🔄 Clearing admin override since user is updating their notification settings")
        
        # Update the saved search
        result = await db.saved_searches.update_one(
            {"_id": ObjectId(search_id), "username": username},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Saved search not found")
        
        logger.info(f"✅ Updated saved search {search_id} for user '{username}'")
        return {
            "message": "Saved search updated successfully",
            "updated": True
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating saved search: {e}", exc_info=True)
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

@router.put("/{username}/saved-searches/{search_id}/set-default")
async def set_default_saved_search(username: str, search_id: str, db = Depends(get_database)):
    """Set a saved search as default (unsets any other default)"""
    logger.info(f"⭐ Setting saved search {search_id} as default for user '{username}'")
    
    try:
        from bson import ObjectId
        
        # First, unset all other defaults for this user
        await db.saved_searches.update_many(
            {"username": username},
            {"$set": {"isDefault": False}}
        )
        
        # Now set this search as default
        result = await db.saved_searches.update_one(
            {
                "_id": ObjectId(search_id),
                "username": username
            },
            {"$set": {"isDefault": True}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Saved search not found")
        
        logger.info(f"✅ Set saved search {search_id} as default for user '{username}'")
        return {
            "message": "Default saved search set successfully",
            "searchId": search_id
        }
    except Exception as e:
        logger.error(f"❌ Error setting default saved search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{username}/saved-searches/default")
async def get_default_saved_search(username: str, db = Depends(get_database)):
    """Get the default saved search for a user"""
    logger.info(f"🔍 Getting default saved search for user '{username}'")
    
    try:
        # Find the default saved search
        default_search = await db.saved_searches.find_one({
            "username": username,
            "isDefault": True
        })
        
        if not default_search:
            return None
        
        # Convert ObjectId to string
        default_search['_id'] = str(default_search['_id'])
        
        logger.info(f"✅ Found default saved search for user '{username}': {default_search.get('name')}")
        return default_search
    except Exception as e:
        logger.error(f"❌ Error getting default saved search: {e}", exc_info=True)
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
async def add_to_favorites(
    target_username: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Add user to favorites"""
    username = current_user["username"]
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
        "createdAt": datetime.utcnow()  # Store as datetime, not ISO string
    }

    try:
        await db.favorites.insert_one(favorite)
        logger.info(f"✅ Added to favorites: {username} → {target_username}")
        
        # Dispatch event (handles notifications automatically)
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.FAVORITE_ADDED,
                actor_username=username,
                target_username=target_username
            )
        except Exception as event_err:
            logger.warning(f"⚠️ Failed to dispatch event: {event_err}")
        
        # Send push notification to target user
        try:
            from services.notification_service import NotificationService
            from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
            
            notification_service = NotificationService(db)
            # Get favoriter's name
            favoriter = await db.users.find_one({"username": username})
            favoriter_name = favoriter.get("firstName", username) if favoriter else username
            
            await notification_service.enqueue_notification(
                NotificationQueueCreate(
                    username=target_username,  # Person being favorited
                    trigger=NotificationTrigger.FAVORITED,
                    channels=[NotificationChannel.PUSH],
                    templateData={
                        "favoriter": username,
                        "favoritersName": favoriter_name
                    }
                )
            )
            logger.info(f"🔔 Favorited push notification queued for {target_username}")
        except Exception as e:
            logger.error(f"❌ Failed to queue favorited notification: {e}")
            # Don't fail the favorite operation if notification fails
        
        return {"message": "Added to favorites successfully"}
    except Exception as e:
        logger.error(f"❌ Error adding to favorites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/favorites/{target_username}")
async def remove_from_favorites(
    target_username: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Remove user from favorites"""
    username = current_user["username"]
    logger.info(f"⭐ Removing {target_username} from {username}'s favorites")

    result = await db.favorites.delete_one({
        "userUsername": username,
        "favoriteUsername": target_username
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")

    logger.info(f"✅ Removed from favorites: {username} → {target_username}")
    
    # Dispatch event
    try:
        from services.event_dispatcher import get_event_dispatcher, UserEventType
        dispatcher = get_event_dispatcher(db)
        await dispatcher.dispatch(
            event_type=UserEventType.FAVORITE_REMOVED,
            actor_username=username,
            target_username=target_username
        )
    except Exception as event_err:
        logger.warning(f"⚠️ Failed to dispatch event: {event_err}")
    
    return {"message": "Removed from favorites successfully"}

@router.post("/auth/request-password-reset")
async def request_password_reset(
    identifier: str = Body(..., embed=True),
    db = Depends(get_database)
):
    """Send password reset code to user's email/phone"""
    logger.info(f"🔐 Password reset requested for: {identifier}")
    
    # Try finding by username first (case-insensitive)
    user = await db.users.find_one(get_username_query(identifier))
    
    # If not found by username, search by email (handle encryption)
    if not user:
        logger.info(f"🔍 Username not found, searching by email: {identifier}")
        # Get all users and check decrypted email
        try:
            encryptor = get_encryptor()
            users_cursor = db.users.find({}, {"username": 1, "contactEmail": 1})
            users = await users_cursor.to_list(1000)
            logger.info(f"📊 Checking {len(users)} users for email match")
            
            for u in users:
                encrypted_email = u.get("contactEmail")
                if encrypted_email:
                    try:
                        decrypted_email = encryptor.decrypt(encrypted_email)
                        if decrypted_email and decrypted_email.lower() == identifier.lower():
                            logger.info(f"✅ Found user by email: {u['username']}")
                            user = await db.users.find_one(get_username_query(u["username"]))
                            break
                    except Exception as decrypt_err:
                        logger.debug(f"⚠️ Could not decrypt email for user {u.get('username')}: {decrypt_err}")
        except Exception as e:
            logger.error(f"❌ Error searching by email: {e}")
    
    if not user:
        # Don't reveal if user exists (security best practice)
        logger.warning(f"⚠️ Password reset requested for non-existent user: {identifier}")
        return {"message": "If account exists, reset code was sent"}
    
    # Generate 6-digit code
    import random
    code = f"{random.randint(100000, 999999)}"
    
    # Store code in database (expires in 15 minutes)
    await db.password_reset_codes.insert_one({
        "username": user["username"],
        "code": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=15),
        "used": False,
        "created_at": datetime.utcnow()
    })
    
    # Send email with reset code
    try:
        from services.email_sender import send_password_reset_email
        
        # Decrypt email to send to
        user_email = user.get("contactEmail")
        if user_email and encryptor.is_encrypted(user_email):
            user_email = encryptor.decrypt(user_email)
        
        user_name = user.get("firstName", user["username"])
        
        await send_password_reset_email(
            to_email=user_email,
            to_name=user_name,
            reset_code=code
        )
        logger.info(f"✅ Password reset email sent to {user_email}")
    except Exception as email_err:
        logger.error(f"❌ Failed to send password reset email: {email_err}")
        # Still return success (don't reveal if email failed)
    
    # Also log it for debugging
    logger.info(f"🔑 Password reset code for {user['username']}: {code}")
    
    return {"message": "Reset code sent successfully"}


@router.post("/auth/verify-reset-code")
async def verify_reset_code(
    identifier: str = Body(...),
    code: str = Body(...),
    db = Depends(get_database)
):
    """Verify the reset code"""
    logger.info(f"🔍 Verifying reset code for: {identifier}")
    
    # Try finding by username first (case-insensitive)
    user = await db.users.find_one(get_username_query(identifier))
    
    # If not found by username, search by email (handle encryption)
    if not user:
        encryptor = get_encryptor()
        users_cursor = db.users.find({}, {"username": 1, "contactEmail": 1})
        users = await users_cursor.to_list(1000)
        
        for u in users:
            encrypted_email = u.get("contactEmail")
            if encrypted_email:
                try:
                    decrypted_email = encryptor.decrypt(encrypted_email)
                    if decrypted_email and decrypted_email.lower() == identifier.lower():
                        user = await db.users.find_one({"username": u["username"]})
                        break
                except:
                    pass
    
    if not user:
        # Don't reveal if user exists - return generic error
        logger.warning(f"⚠️ Verify code attempted for non-existent user: {identifier}")
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Find valid code
    reset_code = await db.password_reset_codes.find_one({
        "username": user["username"],
        "code": code,
        "used": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not reset_code:
        logger.warning(f"❌ Invalid or expired reset code for: {identifier}")
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    logger.info(f"✅ Reset code verified for: {user['username']}")
    return {"message": "Code verified"}


@router.post("/auth/reset-password")
async def reset_password(
    identifier: str = Body(...),
    code: str = Body(...),
    new_password: str = Body(..., min_length=8),
    db = Depends(get_database)
):
    """Reset user's password"""
    logger.info(f"🔄 Resetting password for: {identifier}")
    
    # Try finding by username first
    user = await db.users.find_one({"username": identifier})
    
    # If not found by username, search by email (handle encryption)
    if not user:
        encryptor = get_encryptor()
        users_cursor = db.users.find({}, {"username": 1, "contactEmail": 1})
        users = await users_cursor.to_list(1000)
        
        for u in users:
            encrypted_email = u.get("contactEmail")
            if encrypted_email:
                try:
                    decrypted_email = encryptor.decrypt(encrypted_email)
                    if decrypted_email and decrypted_email.lower() == identifier.lower():
                        user = await db.users.find_one({"username": u["username"]})
                        break
                except:
                    pass
    
    if not user:
        # Don't reveal if user exists - return generic error
        logger.warning(f"⚠️ Password reset attempted for non-existent user: {identifier}")
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Verify code again
    reset_code = await db.password_reset_codes.find_one({
        "username": user["username"],
        "code": code,
        "used": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not reset_code:
        logger.warning(f"❌ Invalid or expired reset code for: {identifier}")
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Hash new password
    hashed_password = PasswordManager.hash_password(new_password)
    
    # Update password
    await db.users.update_one(
        {"username": user["username"]},
        {"$set": {"password": hashed_password}}
    )
    
    # Mark code as used
    await db.password_reset_codes.update_one(
        {"_id": reset_code["_id"]},
        {"$set": {"used": True}}
    )
    
    logger.info(f"✅ Password reset successfully for user: {user['username']}")
    
    return {"message": "Password reset successfully"}

@router.get("/favorites/{username}")
async def get_favorites(
    username: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get user's favorites list - OPTIMIZED with field projection"""
    # 🛑 Security Check: Only owner or admin can view favorites
    if current_user["username"] != username and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view these favorites")
        
    logger.info(f"📋 Getting favorites for {username}")

    try:
        favorites_cursor = db.favorites.find({"userUsername": username}).sort("displayOrder", 1)
        favorites = await favorites_cursor.to_list(100)

        # Get ONLY needed user fields (not all 162+ fields!)
        favorite_users = []
        for fav in favorites:
            user = await db.users.find_one(
                {"username": fav["favoriteUsername"]},
                DASHBOARD_USER_PROJECTION  # ✅ Only fetch needed fields
            )
            if user:
                # 🔓 DECRYPT PII fields
                try:
                    encryptor = get_encryptor()
                    user = encryptor.decrypt_user_pii(user)
                except Exception as decrypt_err:
                    logger.warning(f"⚠️ Decryption skipped for {fav['favoriteUsername']}: {decrypt_err}")
                
                remove_consent_metadata(user)
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                full_public_urls = [get_full_image_url(p) for p in normalized_public]
                user["publicImages"] = full_public_urls
                user["images"] = full_public_urls
                user["addedToFavoritesAt"] = fav["createdAt"]
                favorite_users.append(user)

        logger.info(f"✅ Found {len(favorite_users)} favorites for {username} (optimized query)")
        return {"favorites": favorite_users}
    except Exception as e:
        logger.error(f"❌ Error fetching favorites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/favorites/{username}/reorder")
async def reorder_favorites(
    username: str, 
    order: List[str], 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update the display order of favorites"""
    # 🛑 Security Check
    if current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not authorized")
        
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
    target_username: str,
    notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Add user to shortlist"""
    username = current_user["username"]
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
        "createdAt": datetime.utcnow()  # Store as datetime, not ISO string
    }

    try:
        await db.shortlists.insert_one(shortlist_item)
        logger.info(f"✅ Added to shortlist: {username} → {target_username}")
        
        # Dispatch event (handles notifications automatically)
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.SHORTLIST_ADDED,
                actor_username=username,
                target_username=target_username,
                metadata={"notes": notes}
            )
        except Exception as event_err:
            logger.warning(f"⚠️ Failed to dispatch event: {event_err}")
        
        # Send push notification to target user
        try:
            from services.notification_service import NotificationService
            from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
            
            notification_service = NotificationService(db)
            # Get shortlister's name
            shortlister = await db.users.find_one({"username": username})
            shortlister_name = shortlister.get("firstName", username) if shortlister else username
            
            await notification_service.enqueue_notification(
                NotificationQueueCreate(
                    username=target_username,  # Person being shortlisted
                    trigger=NotificationTrigger.SHORTLIST_ADDED,
                    channels=[NotificationChannel.PUSH],
                    templateData={
                        "shortlister": username,
                        "shortlisterName": shortlister_name
                    }
                )
            )
            logger.info(f"🔔 Shortlist push notification queued for {target_username}")
        except Exception as e:
            logger.error(f"❌ Failed to queue shortlist notification: {e}")
            # Don't fail the shortlist operation if notification fails
        
        return {"message": "Added to shortlist successfully"}
    except Exception as e:
        logger.error(f"❌ Error adding to shortlist: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shortlist/{username}")
async def get_shortlist(
    username: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get user's shortlist - OPTIMIZED with field projection"""
    # 🛑 Security Check
    if current_user["username"] != username and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    logger.info(f"📋 Getting shortlist for {username}")

    try:
        shortlist_cursor = db.shortlists.find({"userUsername": username}).sort("displayOrder", 1)
        shortlist = await shortlist_cursor.to_list(100)

        # Get ONLY needed user fields (not all 162+ fields!)
        shortlisted_users = []
        for item in shortlist:
            user = await db.users.find_one(
                {"username": item["shortlistedUsername"]},
                DASHBOARD_USER_PROJECTION  # ✅ Only fetch needed fields
            )
            if user:
                # 🔓 DECRYPT PII fields
                try:
                    encryptor = get_encryptor()
                    user = encryptor.decrypt_user_pii(user)
                except Exception as decrypt_err:
                    logger.warning(f"⚠️ Decryption skipped for {item['shortlistedUsername']}: {decrypt_err}")
                
                remove_consent_metadata(user)
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                full_public_urls = [get_full_image_url(p) for p in normalized_public]
                user["publicImages"] = full_public_urls
                user["images"] = full_public_urls
                user["notes"] = item.get("notes")
                user["addedToShortlistAt"] = item["createdAt"]
                shortlisted_users.append(user)

        logger.info(f"✅ Found {len(shortlisted_users)} shortlisted users for {username} (optimized query)")
        return {"shortlist": shortlisted_users}
    except Exception as e:
        logger.error(f"❌ Error fetching shortlist: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/shortlist/{username}/reorder")
async def reorder_shortlist(
    username: str, 
    order: List[str], 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update the display order of shortlist"""
    # 🛑 Security Check
    if current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not authorized")

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
    target_username: str,
    reason: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Add user to exclusions"""
    username = current_user["username"]
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
        "createdAt": datetime.utcnow()  # Store as datetime, not ISO string
    }

    try:
        await db.exclusions.insert_one(exclusion)
        logger.info(f"✅ Added to exclusions: {username} → {target_username}")
        
        # Dispatch event (no notification - privacy)
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.USER_EXCLUDED,
                actor_username=username,
                target_username=target_username,
                metadata={"reason": reason}
            )
        except Exception as event_err:
            logger.warning(f"⚠️ Failed to dispatch event: {event_err}")
        
        return {"message": "Added to exclusions successfully"}
    except Exception as e:
        logger.error(f"❌ Error adding to exclusions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/exclusions/{username}")
async def get_exclusions(
    username: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get user's exclusions list - OPTIMIZED with field projection"""
    # 🛑 Security Check
    if current_user["username"] != username and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    logger.info(f"📋 Getting exclusions for {username}")

    try:
        exclusions_cursor = db.exclusions.find({"userUsername": username}).sort("displayOrder", 1)
        exclusions = await exclusions_cursor.to_list(100)

        # Get ONLY needed user fields (not all 162+ fields!)
        excluded_users = []
        for exc in exclusions:
            user = await db.users.find_one(
                {"username": exc["excludedUsername"]},
                DASHBOARD_USER_PROJECTION  # ✅ Only fetch needed fields
            )
            if user:
                # 🔓 DECRYPT PII fields
                try:
                    encryptor = get_encryptor()
                    user = encryptor.decrypt_user_pii(user)
                except Exception as decrypt_err:
                    logger.warning(f"⚠️ Decryption skipped for {exc['excludedUsername']}: {decrypt_err}")
                
                remove_consent_metadata(user)
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                full_public_urls = [get_full_image_url(p) for p in normalized_public]
                user["publicImages"] = full_public_urls
                user["images"] = full_public_urls
                user["excludedAt"] = exc.get("createdAt")
                excluded_users.append(user)

        logger.info(f"✅ Found {len(excluded_users)} exclusions for {username} (optimized query)")
        return {"exclusions": excluded_users}
    except Exception as e:
        logger.error(f"❌ Error fetching exclusions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/exclusions/{username}/reorder")
async def reorder_exclusions(
    username: str, 
    order: List[str], 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update the display order of exclusions"""
    # 🛑 Security Check
    if current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not authorized")

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
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Remove user from exclusions"""
    username = current_user["username"]
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
        
        # Dispatch event
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.USER_UNEXCLUDED,
                actor_username=username,
                target_username=target_username
            )
        except Exception as event_err:
            logger.warning(f"⚠️ Failed to dispatch event: {event_err}")
        
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
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get list of all conversations with privacy checks"""
    username = current_user["username"]
    logger.info(f"💬 ========== GET /messages/conversations called for username={username} ==========")
    
    # Check if current user is admin
    is_admin = current_user.get("role") == "admin"
    
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
            
            # 🔓 DECRYPT PII fields
            try:
                encryptor = get_encryptor()
                user = encryptor.decrypt_user_pii(user)
            except Exception as decrypt_err:
                logger.warning(f"⚠️ Decryption skipped for {other_username}: {decrypt_err}")
            
            # Only return public images for conversations
            existing_images = user.get("images", [])
            normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
            full_public_urls = [get_full_image_url(p) for p in normalized_public]
            user["publicImages"] = full_public_urls
            user["images"] = full_public_urls
            
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
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Poll for new messages since a timestamp with validation and error handling"""
    from redis_manager import get_redis_manager
    
    # 🛑 Security Check
    if current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not authorized to poll messages for this user")
        
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
    request: Request,
    from_username: str = Form(...),
    to_username: str = Form(...),
    content: str = Form(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Send a message to another user"""
    # 🛑 Security Check
    if current_user["username"] != from_username:
        raise HTTPException(status_code=403, detail="You can only send messages as yourself")

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
        
        # Log activity
        try:
            from services.activity_logger import get_activity_logger
            from models.activity_models import ActivityType
            activity_logger = get_activity_logger()
            await activity_logger.log_activity(
                username=from_username,
                action_type=ActivityType.MESSAGE_SENT,
                target_username=to_username,
                metadata={"message_length": len(content.strip())},
                ip_address=request.client.host if request.client else None
            )
        except Exception as log_err:
            logger.warning(f"⚠️ Failed to log message activity: {log_err}")
        
        # Dispatch event for notifications
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.MESSAGE_SENT,
                actor_username=from_username,
                target_username=to_username,
                metadata={"message_id": message_id}
            )
        except Exception as dispatch_err:
            logger.warning(f"⚠️ Failed to dispatch message event: {dispatch_err}")
        
        # Send push notification to recipient
        try:
            from services.notification_service import NotificationService
            from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
            
            notification_service = NotificationService(db)
            # Get sender's name
            sender = await db.users.find_one({"username": from_username})
            sender_name = sender.get("firstName", from_username) if sender else from_username
            
            # Truncate message preview (first 100 chars)
            message_preview = content.strip()[:100] + ("..." if len(content.strip()) > 100 else "")
            
            await notification_service.enqueue_notification(
                NotificationQueueCreate(
                    username=to_username,  # Recipient
                    trigger=NotificationTrigger.NEW_MESSAGE,
                    channels=[NotificationChannel.PUSH],
                    templateData={
                        "sender": from_username,
                        "senderName": sender_name,
                        "messagePreview": message_preview
                    }
                )
            )
            logger.info(f"🔔 New message push notification queued for {to_username}")
        except Exception as e:
            logger.error(f"❌ Failed to queue message notification: {e}")
            # Don't fail the message send if notification fails
        
        return {"message": "Message sent successfully", "id": message_id}
    except Exception as e:
        logger.error(f"❌ Error sending message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/messages/{username}")
async def get_messages(
    username: str, 
    request: Request, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get messages for user"""
    # 🛑 Security Check
    if current_user["username"] != username and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view messages for this user")

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

        # Mark messages as read if user is recipient and log activity
        read_count = 0
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
                read_count += 1
                
                # Log MESSAGE_READ activity for each message marked as read
                try:
                    from services.activity_logger import get_activity_logger
                    from models.activity_models import ActivityType
                    activity_logger = get_activity_logger()
                    await activity_logger.log_activity(
                        username=username,
                        action_type=ActivityType.MESSAGE_READ,
                        target_username=msg["fromUsername"],
                        metadata={"message_id": str(msg["_id"])},
                        ip_address=request.client.host if request.client else None
                    )
                except Exception as log_err:
                    logger.warning(f"⚠️ Failed to log message read activity: {log_err}")

        # Convert ObjectId to string
        for msg in messages:
            msg['id'] = str(msg.pop('_id', ''))

        if read_count > 0:
            logger.info(f"✅ Marked {read_count} messages as read for {username}")
        logger.info(f"✅ Found {len(messages)} messages for {username}")
        return {"messages": messages}
    except Exception as e:
        logger.error(f"❌ Error fetching messages: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversations/{username}")
async def get_conversations(
    username: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get list of conversations for user"""
    # 🛑 Security Check
    if current_user["username"] != username and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view conversations for this user")

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
                
                # 🔓 DECRYPT PII fields
                try:
                    encryptor = get_encryptor()
                    user = encryptor.decrypt_user_pii(user)
                except Exception as decrypt_err:
                    logger.warning(f"⚠️ Decryption skipped for {other_username}: {decrypt_err}")
                
                remove_consent_metadata(user)
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                full_public_urls = [get_full_image_url(p) for p in normalized_public]
                user["publicImages"] = full_public_urls
                user["images"] = full_public_urls
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
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get recent conversations with unread counts and online status"""
    # 🛑 Security Check
    if current_user["username"] != username and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

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
                # 🔓 DECRYPT PII fields
                try:
                    encryptor = get_encryptor()
                    user = encryptor.decrypt_user_pii(user)
                except Exception as decrypt_err:
                    logger.warning(f"⚠️ Decryption skipped for {other_username}: {decrypt_err}")
                
                # Check online status
                is_online = redis.is_user_online(other_username)
                
                # Use first public image for avatar
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                first_public = normalized_public[0] if normalized_public else None
                
                result.append({
                    "username": other_username,
                    "firstName": user.get("firstName", ""),
                    "lastName": user.get("lastName", ""),
                    "avatar": get_full_image_url(first_public) if first_public else None,
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
async def get_unread_count(
    username: str, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get total unread message count for user"""
    # 🛑 Security Check
    if current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not authorized")

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
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Send a message with privacy checks and profanity filtering"""
    username = current_user["username"]
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
    
    # PAUSE FEATURE: Check if recipient is paused
    if recipient.get("accountStatus") == "paused":
        pause_message = recipient.get("pauseMessage", "This user is taking a break")
        raise HTTPException(
            status_code=403,
            detail=f"⏸️ Cannot send message. {pause_message}"
        )
    
    # PAUSE FEATURE: Check if sender is paused
    sender = await db.users.find_one({"username": username})
    if sender and sender.get("accountStatus") == "paused":
        raise HTTPException(
            status_code=403,
            detail="⏸️ You cannot send messages while your account is paused. Please unpause your account first."
        )
    
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
            
            # 🔓 DECRYPT PII fields
            try:
                encryptor = get_encryptor()
                other_user = encryptor.decrypt_user_pii(other_user)
            except Exception as decrypt_err:
                logger.warning(f"⚠️ Decryption skipped for {other_username}: {decrypt_err}")
            
            # Only return public images
            existing_images = other_user.get("images", [])
            normalized_public = _compute_public_image_paths(existing_images, other_user.get("publicImages", []))
            full_public_urls = [get_full_image_url(p) for p in normalized_public]
            other_user["publicImages"] = full_public_urls
            other_user["images"] = full_public_urls
        
        logger.info(f"✅ Found {len(messages)} messages in conversation")
        return {
            "messages": messages,
            "otherUser": other_user,
            "isVisible": is_visible or is_admin
        }
    except Exception as e:
        logger.error(f"❌ Error fetching conversation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    username: str = Query(...),
    db = Depends(get_database)
):
    """
    Delete a message (only sender can delete their own messages)
    """
    try:
        from bson import ObjectId
        
        logger.info(f"🗑️ Delete message request: message_id={message_id}, username={username}")
        
        # Convert string ID to ObjectId
        try:
            msg_id = ObjectId(message_id)
        except Exception as e:
            logger.error(f"❌ Invalid message ID format: {message_id}")
            raise HTTPException(status_code=400, detail="Invalid message ID format")
        
        # Find the message
        message = await db.messages.find_one({"_id": msg_id})
        
        if not message:
            logger.warning(f"⚠️ Message not found: {message_id}")
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check if user is the sender
        if message.get("fromUsername") != username:
            logger.warning(f"⚠️ Unauthorized delete attempt: {username} tried to delete message from {message.get('fromUsername')}")
            raise HTTPException(status_code=403, detail="You can only delete your own messages")
        
        # Delete the message
        result = await db.messages.delete_one({"_id": msg_id})
        
        if result.deleted_count == 0:
            logger.error(f"❌ Failed to delete message: {message_id}")
            raise HTTPException(status_code=500, detail="Failed to delete message")
        
        logger.info(f"✅ Message deleted successfully: {message_id}")
        
        return {
            "success": True,
            "message": "Message deleted successfully",
            "messageId": message_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ===== SMS OPT-IN PREFERENCES =====

@router.get("/users/{username}/sms-optin")
async def get_sms_optin_status(
    username: str,
    db = Depends(get_database)
):
    """
    Get SMS opt-in status for a user (READ operation)
    """
    try:
        logger.info(f"📱 Getting SMS opt-in status for: {username}")
        
        user = await db.users.find_one({"username": username}, {"smsOptIn": 1, "contactNumber": 1})
        
        if not user:
            logger.warning(f"⚠️ User not found: {username}")
            raise HTTPException(status_code=404, detail="User not found")
        
        sms_optin = user.get("smsOptIn", False)
        has_phone = bool(user.get("contactNumber"))
        
        logger.info(f"✅ SMS opt-in status for {username}: {sms_optin}")
        
        return {
            "success": True,
            "username": username,
            "smsOptIn": sms_optin,
            "hasPhone": has_phone,
            "message": "SMS notifications enabled" if sms_optin else "SMS notifications disabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting SMS opt-in status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{username}/sms-optin")
async def update_sms_optin_status(
    username: str,
    smsOptIn: bool,
    db = Depends(get_database)
):
    """
    Update SMS opt-in status for a user (UPDATE operation)
    """
    try:
        logger.info(f"📱 Updating SMS opt-in for {username} to: {smsOptIn}")
        
        # Check if user exists
        user = await db.users.find_one({"username": username})
        if not user:
            logger.warning(f"⚠️ User not found: {username}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update SMS opt-in
        result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "smsOptIn": smsOptIn,
                    "updatedAt": datetime.utcnow().isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
            logger.warning(f"⚠️ No changes made for {username}")
        
        logger.info(f"✅ SMS opt-in updated for {username}: {smsOptIn}")
        
        return {
            "success": True,
            "username": username,
            "smsOptIn": smsOptIn,
            "message": f"SMS notifications {'enabled' if smsOptIn else 'disabled'} successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating SMS opt-in: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/users/{username}/sms-optin")
async def toggle_sms_optin(
    username: str,
    db = Depends(get_database)
):
    """
    Toggle SMS opt-in status (convenience endpoint)
    """
    try:
        logger.info(f"📱 Toggling SMS opt-in for: {username}")
        
        # Get current status
        user = await db.users.find_one({"username": username}, {"smsOptIn": 1})
        if not user:
            logger.warning(f"⚠️ User not found: {username}")
            raise HTTPException(status_code=404, detail="User not found")
        
        current_status = user.get("smsOptIn", False)
        new_status = not current_status
        
        # Update status
        await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "smsOptIn": new_status,
                    "updatedAt": datetime.utcnow().isoformat()
                }
            }
        )
        
        logger.info(f"✅ SMS opt-in toggled for {username}: {current_status} → {new_status}")
        
        return {
            "success": True,
            "username": username,
            "smsOptIn": new_status,
            "message": f"SMS notifications {'enabled' if new_status else 'disabled'}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error toggling SMS opt-in: {e}", exc_info=True)
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
        
        # Dispatch event
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.SHORTLIST_REMOVED,
                actor_username=username,
                target_username=target_username
            )
        except Exception as event_err:
            logger.warning(f"⚠️ Failed to dispatch event: {event_err}")
        
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
        
        # 🔓 DECRYPT PII fields for all users
        for user in viewer_users:
            try:
                encryptor = get_encryptor()
                decrypted_user = encryptor.decrypt_user_pii(user)
                viewer_dict[user["username"]] = decrypted_user
            except Exception as decrypt_err:
                logger.warning(f"⚠️ Decryption skipped for {user.get('username')}: {decrypt_err}")
        
        result = []
        for viewer in viewers:
            user_data = viewer_dict.get(viewer["viewerUsername"], {})
            # Use first public image for profileImage
            existing_images = user_data.get("images", [])
            normalized_public = _compute_public_image_paths(existing_images, user_data.get("publicImages", []))
            first_public = normalized_public[0] if normalized_public else None
            result.append({
                "username": viewer["viewerUsername"],
                "firstName": user_data.get("firstName"),
                "lastName": user_data.get("lastName"),
                "age": calculate_age(
                    birthMonth=user_data.get("birthMonth"),
                    birthYear=user_data.get("birthYear")
                ),
                "location": user_data.get("location"),
                "occupation": user_data.get("occupation"),
                "profileImage": get_full_image_url(first_public) if first_public else None,
                "viewedAt": safe_datetime_serialize(viewer.get("viewedAt"))
            })
        
        logger.info(f"✅ Found {len(result)} viewers for {username}")
        return {"viewers": result}
    except Exception as e:
        logger.error(f"❌ Error getting viewers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/their-favorites/{username}")
async def get_users_who_favorited_me(username: str, db = Depends(get_database)):
    """Get users who have favorited the current user (filtered by admin-configured days)"""
    logger.info(f"💖 Getting users who favorited {username}")
    
    try:
        # Get system settings for view history retention (applies to favorites too)
        settings = await db.system_settings.find_one({}) or {}
        view_history_days = settings.get("profile_view_history_days", 7)  # Default 7 days
        
        # Calculate cutoff date
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=view_history_days)
        
        logger.info(f"📅 Filtering favorites from last {view_history_days} days (since {cutoff_date.isoformat()})")
        
        # Find all favorites where current user is the target, within time window
        favorites = await db.favorites.find({
            "favoriteUsername": username,
            "createdAt": {"$gte": cutoff_date}
        }).sort("createdAt", -1).to_list(100)
        
        # Get user details - OPTIMIZED with field projection
        user_usernames = [f["userUsername"] for f in favorites]
        users = await db.users.find(
            {"username": {"$in": user_usernames}},
            DASHBOARD_USER_PROJECTION  # ✅ Only fetch needed fields
        ).to_list(100)
        
        # 🔓 DECRYPT PII fields for all users
        user_dict = {}
        for user in users:
            try:
                encryptor = get_encryptor()
                decrypted_user = encryptor.decrypt_user_pii(user)
                user_dict[user["username"]] = decrypted_user
            except Exception as decrypt_err:
                logger.warning(f"⚠️ Decryption skipped for {user.get('username')}: {decrypt_err}")
                user_dict[user["username"]] = user
        
        result = []
        for fav in favorites:
            user_data = user_dict.get(fav["userUsername"], {})
            # Use first public image for profileImage
            existing_images = user_data.get("images", [])
            normalized_public = _compute_public_image_paths(existing_images, user_data.get("publicImages", []))
            first_public = normalized_public[0] if normalized_public else None
            result.append({
                "username": fav["userUsername"],
                "firstName": user_data.get("firstName"),
                "lastName": user_data.get("lastName"),
                "age": calculate_age(
                    birthMonth=user_data.get("birthMonth"),
                    birthYear=user_data.get("birthYear")
                ),
                "location": user_data.get("location"),
                "occupation": user_data.get("occupation"),
                "profileImage": get_full_image_url(first_public) if first_public else None,
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
        
        # Get user details - OPTIMIZED with field projection
        user_usernames = [s["userUsername"] for s in shortlists]
        users = await db.users.find(
            {"username": {"$in": user_usernames}},
            DASHBOARD_USER_PROJECTION  # ✅ Only fetch needed fields
        ).to_list(100)
        
        # 🔓 DECRYPT PII fields for all users
        user_dict = {}
        for user in users:
            try:
                encryptor = get_encryptor()
                decrypted_user = encryptor.decrypt_user_pii(user)
                user_dict[user["username"]] = decrypted_user
            except Exception as decrypt_err:
                logger.warning(f"⚠️ Decryption skipped for {user.get('username')}: {decrypt_err}")
                user_dict[user["username"]] = user
        
        result = []
        for shortlist in shortlists:
            user_data = user_dict.get(shortlist["userUsername"], {})
            # Use first public image for profileImage
            existing_images = user_data.get("images", [])
            normalized_public = _compute_public_image_paths(existing_images, user_data.get("publicImages", []))
            first_public = normalized_public[0] if normalized_public else None
            result.append({
                "username": shortlist["userUsername"],
                "firstName": user_data.get("firstName"),
                "lastName": user_data.get("lastName"),
                "age": calculate_age(
                    birthMonth=user_data.get("birthMonth"),
                    birthYear=user_data.get("birthYear")
                ),
                "location": user_data.get("location"),
                "occupation": user_data.get("occupation"),
                "profileImage": get_full_image_url(first_public) if first_public else None,
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
    request: Request,
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
            
            # Log activity
            try:
                from services.activity_logger import get_activity_logger
                from models.activity_models import ActivityType
                activity_logger = get_activity_logger()
                await activity_logger.log_activity(
                    username=profile_view.viewedByUsername,
                    action_type=ActivityType.PROFILE_VIEWED,
                    target_username=profile_view.profileUsername,
                    metadata={"view_count": new_count, "first_view": False},
                    ip_address=request.client.host if request.client else None
                )
            except Exception as log_err:
                logger.warning(f"⚠️ Failed to log activity: {log_err}")
            
            # Dispatch event for notifications (only on first view to avoid spam)
            if new_count <= 3:  # Notify first 3 views only
                try:
                    from services.event_dispatcher import get_event_dispatcher, UserEventType
                    dispatcher = get_event_dispatcher(db)
                    await dispatcher.dispatch(
                        event_type=UserEventType.PROFILE_VIEWED,
                        actor_username=profile_view.viewedByUsername,
                        target_username=profile_view.profileUsername
                    )
                except Exception as dispatch_err:
                    logger.warning(f"⚠️ Failed to dispatch profile view event: {dispatch_err}")
            
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
            
            # Log activity
            try:
                from services.activity_logger import get_activity_logger
                from models.activity_models import ActivityType
                activity_logger = get_activity_logger()
                await activity_logger.log_activity(
                    username=profile_view.viewedByUsername,
                    action_type=ActivityType.PROFILE_VIEWED,
                    target_username=profile_view.profileUsername,
                    metadata={"view_count": 1, "first_view": True},
                    ip_address=request.client.host if request.client else None
                )
            except Exception as log_err:
                logger.warning(f"⚠️ Failed to log activity: {log_err}")
            
            # Dispatch event for notifications (first view)
            try:
                from services.event_dispatcher import get_event_dispatcher, UserEventType
                dispatcher = get_event_dispatcher(db)
                await dispatcher.dispatch(
                    event_type=UserEventType.PROFILE_VIEWED,
                    actor_username=profile_view.viewedByUsername,
                    target_username=profile_view.profileUsername
                )
            except Exception as dispatch_err:
                logger.warning(f"⚠️ Failed to dispatch profile view event: {dispatch_err}")
            
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
    """Get list of users who viewed this profile (filtered by admin-configured days)"""
    logger.info(f"📊 Getting profile views for {username}")
    
    try:
        # Get system settings for view history retention
        settings = await db.system_settings.find_one({}) or {}
        view_history_days = settings.get("profile_view_history_days", 7)  # Default 7 days
        
        # Calculate cutoff date
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=view_history_days)
        
        logger.info(f"📅 Filtering views from last {view_history_days} days (since {cutoff_date.isoformat()})")
        
        # Get profile views within the time window
        all_views = await db.profile_views.find({
            "profileUsername": username,
            "$or": [
                {"lastViewedAt": {"$gte": cutoff_date}},
                {"viewedAt": {"$gte": cutoff_date}},
                {"createdAt": {"$gte": cutoff_date}}
            ]
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
                
                # Decrypt ALL PII fields (contactEmail, contactNumber, location, linkedinUrl)
                pii_fields = {
                    'contactEmail': viewer.get("contactEmail"),
                    'contactNumber': viewer.get("contactNumber"),
                    'location': viewer.get("location"),
                    'linkedinUrl': viewer.get("linkedinUrl")
                }
                
                for field_name, field_value in pii_fields.items():
                    if field_value:
                        decrypted = _decrypt_contact_info(field_value)
                        
                        if field_name == "contactEmail" and decrypted:
                            # Mask email for privacy (show first 3 chars + domain)
                            if "@" in decrypted:
                                parts = decrypted.split("@")
                                viewer["contactEmail"] = f"{parts[0][:3]}***@{parts[1]}"
                            else:
                                viewer.pop("contactEmail", None)
                        
                        elif field_name == "contactNumber" and decrypted:
                            # Mask phone for privacy (show first 3 and last 2)
                            if len(decrypted) > 5:
                                viewer["contactNumber"] = f"{decrypted[:3]}***{decrypted[-2:]}"
                            else:
                                viewer.pop("contactNumber", None)
                        
                        elif field_name == "location" and decrypted:
                            # Keep location as-is (no masking needed for city/state)
                            viewer["location"] = decrypted
                        
                        elif field_name == "linkedinUrl" and decrypted:
                            # Keep LinkedIn URL as-is
                            viewer["linkedinUrl"] = decrypted
                
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
                # For images, check if all one-time views have expired
                if request_type == "images":
                    picture_durations = has_access.get("pictureDurations", {})
                    if picture_durations:
                        all_expired = True
                        for img_idx, img_access in picture_durations.items():
                            duration = img_access.get("duration", "")
                            viewed_at = img_access.get("viewedAt")
                            
                            # Handle both "one_time" and "onetime" formats
                            if duration in ("one_time", "onetime"):
                                if not viewed_at:
                                    all_expired = False
                                    break
                            elif duration == "permanent":
                                all_expired = False
                                break
                            else:
                                # Time-based: check if expired
                                expires_at = img_access.get("expiresAt")
                                if expires_at:
                                    if isinstance(expires_at, str):
                                        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                                    if expires_at > datetime.utcnow():
                                        all_expired = False
                                        break
                                else:
                                    all_expired = False
                                    break
                        
                        if all_expired:
                            logger.info(f"⏱️ Images access expired for {username} - allowing new request")
                            # Don't skip - allow new request since access expired
                        else:
                            logger.info(f"✅ Access already granted for {request_type}")
                            continue
                    else:
                        logger.info(f"✅ Access already granted for {request_type}")
                        continue
                else:
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
        
        # Dispatch event to trigger notification
        from services.event_dispatcher import get_event_dispatcher, UserEventType
        dispatcher = get_event_dispatcher(db)
        await dispatcher.dispatch(
            event_type=UserEventType.PII_REQUESTED,
            actor_username=username,
            target_username=request_data.profileUsername,
            metadata={"request_types": request_data.requestTypes}
        )
        
        logger.info(f"✅ Created {len(created_requests)} PII requests and dispatched notification event")
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
                
                # 🔓 Decrypt PII fields
                from crypto_utils import get_encryptor
                try:
                    encryptor = get_encryptor()
                    requester = encryptor.decrypt_user_pii(requester)
                except Exception as decrypt_err:
                    logger.warning(f"⚠️ Decryption skipped for {req['requesterUsername']}: {decrypt_err}")
                
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
        # Track seen users to deduplicate (show only latest request per user)
        seen_users = set()
        result = []
        for req in requests:
            # Handle both old field name (requestedUsername) and new field name (profileUsername)
            target_username = req.get("profileUsername") or req.get("requestedUsername")
            if not target_username:
                continue
            
            # Deduplicate: only show one request per target user (the most recent one)
            if target_username in seen_users:
                continue
            seen_users.add(target_username)
            
            profile_owner = await db.users.find_one({"username": target_username})
            if profile_owner:
                profile_owner.pop("password", None)
                profile_owner["_id"] = str(profile_owner["_id"])
                
                # 🔓 Decrypt PII fields
                from crypto_utils import get_encryptor
                try:
                    encryptor = get_encryptor()
                    profile_owner = encryptor.decrypt_user_pii(profile_owner)
                except Exception as decrypt_err:
                    logger.warning(f"⚠️ Decryption skipped for {req['profileUsername']}: {decrypt_err}")
                
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
        
        # Grant access - handle individual picture durations for image access
        access_data = {
            "granterUsername": username,
            "grantedToUsername": request["requesterUsername"],
            "accessType": request["requestType"],
            "grantedAt": datetime.utcnow(),
            "expiresAt": expires_at,
            "isActive": True,
            "createdAt": datetime.utcnow()
        }
        
        # Add picture-specific durations if provided (for image access)
        if approve_data.pictureDurations and request["requestType"] == "images":
            logger.info(f"📸 Processing individual picture durations: {approve_data.pictureDurations}")
            picture_access = {}
            
            for idx, duration in approve_data.pictureDurations.items():
                if duration == 'onetime':
                    picture_access[idx] = {
                        "duration": "onetime",
                        "viewedAt": None,  # Track when one-time view is used
                        "isExpired": False
                    }
                elif duration == 'permanent':
                    picture_access[idx] = {
                        "duration": "permanent",
                        "expiresAt": None
                    }
                elif isinstance(duration, (int, str)) and str(duration).isdigit():
                    days = int(duration)
                    picture_access[idx] = {
                        "duration": days,
                        "expiresAt": datetime.utcnow() + timedelta(days=days)
                    }
            
            access_data["pictureDurations"] = picture_access
            logger.info(f"🖼️ Picture access configured: {picture_access}")
        
        logger.info(f"📝 Inserting PII access record: {access_data}")
        await db.pii_access.insert_one(access_data)
        
        # Dispatch event for notifications
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.PII_GRANTED,
                actor_username=username,  # The granter
                target_username=request['requesterUsername']  # The requester (gets notified)
            )
        except Exception as dispatch_err:
            logger.warning(f"⚠️ Failed to dispatch PII granted event: {dispatch_err}")
        
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
        
        # Dispatch event for notifications
        try:
            from services.event_dispatcher import get_event_dispatcher, UserEventType
            dispatcher = get_event_dispatcher(db)
            await dispatcher.dispatch(
                event_type=UserEventType.PII_REJECTED,
                actor_username=username,  # The rejecter
                target_username=request['requesterUsername']  # The requester (gets notified)
            )
        except Exception as dispatch_err:
            logger.warning(f"⚠️ Failed to dispatch PII rejected event: {dispatch_err}")
        
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
        # Track active (non-expired) access per user per type
        user_access_map = {}
        for access in access_records:
            granted_to = access["grantedToUsername"]
            
            if granted_to not in user_access_map:
                user_access_map[granted_to] = {
                    "username": granted_to,
                    "accessTypes": set(),  # Use set to avoid duplicates
                    "activeTypes": set(),  # Track types with at least one active access
                    "grantedAt": access["grantedAt"],
                    "accessIds": [],
                    "expiredTypes": []
                }
            
            access_type = access["accessType"]
            user_access_map[granted_to]["accessTypes"].add(access_type)
            user_access_map[granted_to]["accessIds"].append(str(access["_id"]))
            
            # Check if images access has expired (all one-time views used)
            if access_type == "images":
                picture_durations = access.get("pictureDurations", {})
                if picture_durations:
                    # Check if all granted images have been viewed (one-time expired)
                    all_expired = True
                    for img_idx, img_access in picture_durations.items():
                        duration = img_access.get("duration", "")
                        viewed_at = img_access.get("viewedAt")
                        
                        # Convert duration to string for comparison
                        duration_str = str(duration) if duration else ""
                        
                        # Handle both "one_time" and "onetime" formats
                        if duration_str in ("one_time", "onetime"):
                            # One-time view: expired if viewedAt is set
                            if not viewed_at:
                                all_expired = False
                                break
                        elif duration_str == "permanent":
                            # Permanent access never expires
                            all_expired = False
                            break
                        elif duration_str.isdigit() or isinstance(duration, int):
                            # Time-based (1, 2, 3 days, etc.): check if expired
                            expires_at = img_access.get("expiresAt")
                            if expires_at:
                                from datetime import datetime
                                if isinstance(expires_at, str):
                                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                                if expires_at > datetime.utcnow():
                                    all_expired = False
                                    break
                            else:
                                # No expiresAt means not expired yet
                                all_expired = False
                                break
                        else:
                            # Unknown duration type - assume not expired
                            all_expired = False
                            break
                    
                    if not all_expired:
                        # This access record has at least one non-expired image
                        user_access_map[granted_to]["activeTypes"].add("images")
            else:
                # Non-image access types are always active if isActive=True
                user_access_map[granted_to]["activeTypes"].add(access_type)
        
        # Get user details - filter out users with NO active access types
        result = []
        for username_key, access_info in user_access_map.items():
            # Check if user has ANY active access types
            active_types = list(access_info["activeTypes"])
            
            # Skip this user if all their access types have expired
            if not active_types:
                logger.info(f"⏱️ Skipping {username_key} - all access types expired: {access_info['expiredTypes']}")
                continue
            
            user = await db.users.find_one({"username": username_key})
            if user:
                user.pop("password", None)
                user["_id"] = str(user["_id"])
                # Only return public images
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                full_public_urls = [get_full_image_url(p) for p in normalized_public]
                user["publicImages"] = full_public_urls
                user["images"] = full_public_urls
                
                result.append({
                    "userProfile": user,
                    "accessTypes": active_types,  # Only include active (non-expired) types
                    "grantedAt": access_info["grantedAt"].isoformat(),
                    "accessIds": access_info["accessIds"],
                    "expiredTypes": list(access_info["accessTypes"] - access_info["activeTypes"])
                })
        
        logger.info(f"✅ Found {len(result)} users with active granted access")
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
                # Only return public images
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                full_public_urls = [get_full_image_url(p) for p in normalized_public]
                user["publicImages"] = full_public_urls
                user["images"] = full_public_urls
                
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

@router.get("/pii-access/{username}/expired")
async def get_expired_access(
    username: str,
    db = Depends(get_database)
):
    """Get list of users whose access has expired (one-time views used, time-based expired)"""
    logger.info(f"📊 Getting expired PII access for {username}")
    
    try:
        # Get all active access records - we'll filter for expired ones
        access_records = await db.pii_access.find({
            "granterUsername": username,
            "isActive": True
        }).sort("grantedAt", -1).to_list(100)
        
        # Find users with ALL access types expired
        user_access_map = {}
        for access in access_records:
            granted_to = access["grantedToUsername"]
            
            if granted_to not in user_access_map:
                user_access_map[granted_to] = {
                    "username": granted_to,
                    "accessTypes": [],
                    "grantedAt": access["grantedAt"],
                    "accessIds": [],
                    "expiredTypes": []
                }
            
            access_type = access["accessType"]
            user_access_map[granted_to]["accessTypes"].append(access_type)
            user_access_map[granted_to]["accessIds"].append(str(access["_id"]))
            
            # Check if images access has expired
            if access_type == "images":
                picture_durations = access.get("pictureDurations", {})
                if picture_durations:
                    all_expired = True
                    for img_idx, img_access in picture_durations.items():
                        duration = img_access.get("duration", "")
                        viewed_at = img_access.get("viewedAt")
                        
                        # Convert duration to string for comparison
                        duration_str = str(duration) if duration else ""
                        
                        # Handle both "one_time" and "onetime" formats
                        if duration_str in ("one_time", "onetime"):
                            if not viewed_at:
                                all_expired = False
                                break
                        elif duration_str == "permanent":
                            all_expired = False
                            break
                        elif duration_str.isdigit() or isinstance(duration, int):
                            # Time-based (1, 2, 3 days, etc.): check if expired
                            expires_at = img_access.get("expiresAt")
                            if expires_at:
                                from datetime import datetime
                                if isinstance(expires_at, str):
                                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                                if expires_at > datetime.utcnow():
                                    all_expired = False
                                    break
                            else:
                                all_expired = False
                                break
                        else:
                            # Unknown duration type - assume not expired
                            all_expired = False
                            break
                    
                    if all_expired:
                        user_access_map[granted_to]["expiredTypes"].append("images")
        
        # Only include users where ALL access types have expired
        result = []
        for username_key, access_info in user_access_map.items():
            active_types = [t for t in access_info["accessTypes"] if t not in access_info["expiredTypes"]]
            
            # Only include if ALL types are expired
            if active_types:
                continue
            
            user = await db.users.find_one({"username": username_key})
            if user:
                user.pop("password", None)
                user["_id"] = str(user["_id"])
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                full_public_urls = [get_full_image_url(p) for p in normalized_public]
                user["publicImages"] = full_public_urls
                user["images"] = full_public_urls
                
                result.append({
                    "userProfile": user,
                    "accessTypes": access_info["expiredTypes"],
                    "grantedAt": access_info["grantedAt"].isoformat(),
                    "accessIds": access_info["accessIds"],
                    "reason": "expired"
                })
        
        logger.info(f"✅ Found {len(result)} users with expired access")
        return {"expiredAccess": result}
    
    except Exception as e:
        logger.error(f"❌ Error fetching expired access: {e}", exc_info=True)
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
                # Only return public images
                existing_images = user.get("images", [])
                normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
                full_public_urls = [get_full_image_url(p) for p in normalized_public]
                user["publicImages"] = full_public_urls
                user["images"] = full_public_urls
                
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


@router.get("/pii-access/check-images")
async def check_images_access(
    requester: str = Query(...),
    profile_owner: str = Query(...),
    db = Depends(get_database)
):
    """Check per-image access status for all images of a profile owner.
    
    Returns access status for each image, accounting for one-time views and expiry.
    """
    try:
        # Get owner's images
        owner = await db.users.find_one(get_username_query(profile_owner), {"images": 1, "publicImages": 1})
        if not owner:
            return {"images": [], "error": "User not found"}
        
        all_images = owner.get("images", [])
        public_images = owner.get("publicImages", [])
        
        # Check if requester is owner or admin
        if requester.lower() == profile_owner.lower():
            # Owner sees all their images
            return {
                "images": [{"index": i, "hasAccess": True, "reason": "owner"} for i in range(len(all_images))]
            }
        
        requester_user = await db.users.find_one(get_username_query(requester), {"role": 1, "role_name": 1})
        if _is_admin_user(requester_user):
            return {
                "images": [{"index": i, "hasAccess": True, "reason": "admin"} for i in range(len(all_images))]
            }
        
        # Check each image's access status
        image_access_list = []
        for idx, img in enumerate(all_images):
            filename = img.split('/')[-1] if img else None
            
            # Check if public
            is_public = any((p or "").split('/')[-1] == filename for p in public_images)
            if is_public:
                image_access_list.append({"index": idx, "hasAccess": True, "reason": "public"})
                continue
            
            # Check per-image access
            has_access = await _has_images_access(db, requester, profile_owner, filename)
            image_access_list.append({
                "index": idx, 
                "hasAccess": has_access, 
                "reason": "granted" if has_access else "no_access"
            })
        
        return {"images": image_access_list}
    
    except Exception as e:
        logger.error(f"❌ Error checking images access: {e}", exc_info=True)
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
async def get_online_users(db = Depends(get_database)):
    """Get list of currently online users with profile info"""
    from redis_manager import get_redis_manager
    
    redis = get_redis_manager()
    usernames = redis.get_online_users()
    logger.info(f"Online usernames: {len(usernames)} - {usernames}")
    
    if not usernames:
        return {"onlineUsers": [], "count": 0}
    
    # Fetch all user details in a SINGLE query using $in (much faster!)
    cursor = db.users.find(
        {"username": {"$in": usernames}},
        {"username": 1, "firstName": 1, "lastName": 1, "images": 1, "publicImages": 1, "role": 1, "_id": 0}
    )
    
    user_list = []
    async for user in cursor:
        # Use first public image for profileImage
        existing_images = user.get("images", [])
        normalized_public = _compute_public_image_paths(existing_images, user.get("publicImages", []))
        first_public = normalized_public[0] if normalized_public else None
        user_list.append({
            "username": user.get("username"),
            "firstName": user.get("firstName"),
            "lastName": user.get("lastName"),
            "profileImage": get_full_image_url(first_public) if first_public else None,
            "role": user.get("role", "free_user")
        })
    
    logger.info(f"Online users with profiles: {len(user_list)}")
    return {"onlineUsers": user_list, "count": len(user_list)}

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
def calculate_age(birthMonth=None, birthYear=None):
    """
    Calculate age from birth month and year
    
    Args:
        birthMonth: Birth month (1-12)
        birthYear: Birth year
    
    Returns:
        Age in years or None if insufficient data
    """
    from datetime import date
    today = date.today()
    
    if birthMonth and birthYear:
        age = today.year - birthYear
        if today.month < birthMonth:
            age -= 1
        return age
    
    return None


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
        
        # Get opposite gender users (heterosexual platform - only opposite gender matches)
        opposite_gender = "Female" if current_user.get('gender') == 'Male' else "Male"
        
        # Build query - only opposite gender (heterosexual matrimonial platform)
        query = {
            "username": {"$ne": username},  # Exclude self
            "gender": opposite_gender,  # Only opposite gender
            # PAUSE FEATURE: Exclude paused users from matching
            # Only match active users (exclude paused, suspended, pending, etc.)
            "accountStatus": "active"
        }
        
        # Get potential matches
        potential_matches = await db.users.find(query).to_list(1000)
        logger.info(f"📊 Query returned {len(potential_matches)} opposite gender users")
        
        # Get user's exclusions
        exclusions = await db.exclusions.find({"userUsername": username}).to_list(100)
        excluded_usernames = {exc['excludedUsername'] for exc in exclusions}
        logger.info(f"🚫 Excluding {len(excluded_usernames)} users")
        
        # Filter out excluded users
        potential_matches = [u for u in potential_matches if u['username'] not in excluded_usernames]
        
        logger.info(f"📊 Found {len(potential_matches)} potential matches after exclusions")
        
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
                # 🔓 DECRYPT PII fields before building profile
                try:
                    encryptor = get_encryptor()
                    candidate = encryptor.decrypt_user_pii(candidate)
                except Exception as decrypt_err:
                    logger.warning(f"⚠️ Decryption skipped for {candidate.get('username')}: {decrypt_err}")
                
                # Prepare profile data - consistent with SearchResultCard expectations
                profile = {
                    'username': candidate['username'],
                    'profileId': candidate.get('profileId'),
                    'firstName': candidate.get('firstName'),
                    'lastName': candidate.get('lastName'),
                    'age': calculate_age(
                        birthMonth=candidate.get('birthMonth'),
                        birthYear=candidate.get('birthYear')
                    ),
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
        
        logger.info(f"🎯 {len(matches_with_scores)} matches scored >= {min_score}%")
        
        # Sort by match score (descending)
        matches_with_scores.sort(key=lambda x: x['matchScore'], reverse=True)
        
        # Limit results
        top_matches = matches_with_scores[:limit]
        
        if top_matches:
            logger.info(f"✅ Returning {len(top_matches)} L3V3L matches for {username} (top score: {top_matches[0]['matchScore']}%)")
        else:
            logger.warning(f"⚠️ No matches found for {username} with min_score={min_score}%")
        
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
        # Note: component_scores has: gender, l3v3l_pillars, demographics, partner_preferences, 
        # habits_personality, career_education, physical_attributes, cultural_factors
        breakdown = {
            'gender': round(component_scores.get('gender', 0), 1),
            'l3v3l_pillars': round(component_scores.get('l3v3l_pillars', 0), 1),
            'demographics': round(component_scores.get('demographics', 0), 1),
            'partner_preferences': round(component_scores.get('partner_preferences', 0), 1),
            'habits_personality': round(component_scores.get('habits_personality', 0), 1),
            'career_education': round(component_scores.get('career_education', 0), 1),
            'physical_attributes': round(component_scores.get('physical_attributes', 0), 1),
            'cultural_factors': round(component_scores.get('cultural_factors', 0), 1)
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
                "default_theme": "cozy-light",
                "enable_l3v3l_for_all": True
            }
            logger.info("Using default settings")
            return default_settings
        
        return {
            "ticket_delete_days": settings.get("ticket_delete_days", 30),
            "default_theme": settings.get("default_theme", "cozy-light"),
            "enable_l3v3l_for_all": settings.get("enable_l3v3l_for_all", True)
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
    enable_l3v3l_for_all = data.get("enable_l3v3l_for_all", True)
    
    logger.info(f"⚙️ Updating system settings: ticket_delete_days={ticket_delete_days}, enable_l3v3l_for_all={enable_l3v3l_for_all}")
    
    try:
        # Upsert system settings
        result = await db.system_settings.update_one(
            {"_id": "global"},
            {
                "$set": {
                    "ticket_delete_days": ticket_delete_days,
                    "default_theme": default_theme,
                    "enable_l3v3l_for_all": enable_l3v3l_for_all,
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
