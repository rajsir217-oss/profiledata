# fastapi_backend/routes.py
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import timedelta
from models import UserCreate, UserResponse, LoginRequest, Token
from auth import get_password_hash, verify_password, create_access_token
from database import get_database
from utils import save_multiple_files, get_full_image_url
from config import settings
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
    images: List[UploadFile] = File(default=[])
):
    """Register a new user with profile details and images"""
    try:
        db = get_database()
    except Exception as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # Validate username length
    if len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long"
        )
    
    # Validate password length
    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )
    
    # Check if username already exists
    existing_user = await db.users.find_one({"username": username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists"
        )
    
    # Check if email already exists
    if contactEmail:
        existing_email = await db.users.find_one({"contactEmail": contactEmail})
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
    
    # Validate and save images
    image_paths = []
    if images and len(images) > 0:
        if len(images) > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 5 images allowed"
            )
        image_paths = await save_multiple_files(images)
    
    # Hash password
    hashed_password = get_password_hash(password)
    
    # Create user document
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
        "images": image_paths,
        "createdAt": None,
        "updatedAt": None
    }
    
    # Insert into database
    result = await db.users.insert_one(user_data)
    
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
    db = get_database()
    
    # Find user
    user = await db.users.find_one({"username": login_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credentials"
        )
    
    # Verify password
    if not verify_password(login_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credentials"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    # Remove password and _id from response
    user.pop("password", None)
    user.pop("_id", None)
    
    # Convert image paths to full URLs
    user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
    
    return {
        "message": "Login successful",
        "user": user,
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get("/profile/{username}")
async def get_user_profile(username: str):
    """Get user profile by username"""
    db = get_database()
    
    # Find user
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Remove password and _id from response
    user.pop("password", None)
    user.pop("_id", None)
    
    # Convert image paths to full URLs
    user["images"] = [get_full_image_url(img) for img in user.get("images", [])]
    
    return user
