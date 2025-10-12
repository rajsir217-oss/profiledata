# fastapi_backend/models.py
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, source, handler):
        from pydantic_core import core_schema
        return core_schema.no_info_plain_validator_function(cls.validate)

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, handler):
        return {"type": "string"}

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    contactNumber: Optional[str] = None
    contactEmail: Optional[EmailStr] = None
    dob: Optional[str] = None
    sex: Optional[str] = None
    height: Optional[str] = None
    castePreference: Optional[str] = None
    eatingPreference: Optional[str] = None
    location: Optional[str] = None
    education: Optional[str] = None  # Legacy field for backward compatibility
    educationHistory: List[dict] = []  # New structured education array
    workExperience: List[dict] = []  # New work experience array
    workingStatus: Optional[str] = None
    workplace: Optional[str] = None
    linkedinUrl: Optional[str] = None  # Private PII field
    citizenshipStatus: Optional[str] = "Citizen"
    familyBackground: Optional[str] = None
    aboutYou: Optional[str] = None
    partnerPreference: Optional[str] = None
    images: List[str] = []
    themePreference: Optional[str] = "light-blue"  # User's preferred theme
    
    # Legal consent fields
    agreedToAge: bool = False
    agreedToTerms: bool = False
    agreedToPrivacy: bool = False
    agreedToGuidelines: bool = False
    agreedToDataProcessing: bool = False
    agreedToMarketing: bool = False
    termsAgreedAt: Optional[datetime] = None
    privacyAgreedAt: Optional[datetime] = None
    consentIpAddress: Optional[str] = None
    consentUserAgent: Optional[str] = None

    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').isalnum():
            raise ValueError('Username must be alphanumeric with optional underscores')
        return v

    @validator('sex')
    def validate_sex(cls, v):
        if v and v not in ['Male', 'Female', '']:
            raise ValueError('Sex must be Male, Female, or empty')
        return v

    @validator('eatingPreference')
    def validate_eating(cls, v):
        if v and v not in ['Vegetarian', 'Eggetarian', 'Non-Veg', 'Others', '']:
            raise ValueError('Invalid eating preference')
        return v

    @validator('citizenshipStatus')
    def validate_citizenship(cls, v):
        if v and v not in ['Citizen', 'Greencard', '']:
            raise ValueError('Invalid citizenship status')
        return v

    @validator('themePreference')
    def validate_theme(cls, v):
        valid_themes = ['light-blue', 'dark', 'light-pink', 'light-gray', 'ultra-light-gray']
        if v and v not in valid_themes:
            raise ValueError(f'Theme must be one of: {", ".join(valid_themes)}')
        return v

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserInDB(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    password: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class UserResponse(UserBase):
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class PiiRequest(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    requesterUsername: str
    requestedUsername: str
    requestType: str  # "contact_info" or "images"
    message: Optional[str] = None
    status: str = "pending"  # "pending", "approved", "rejected"
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    respondedAt: Optional[datetime] = None
    responseMessage: Optional[str] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Favorite(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    userUsername: str  # Who added to favorites
    favoriteUsername: str  # Who was added to favorites
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Shortlist(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    userUsername: str  # Who added to shortlist
    shortlistedUsername: str  # Who was shortlisted
    notes: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Exclusion(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    userUsername: str  # Who excluded the profile
    excludedUsername: str  # Who was excluded
    reason: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Message(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    fromUsername: str
    toUsername: str
    content: str
    isRead: bool = False
    isVisible: bool = True  # False if blocked/rejected/unfavorited
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    readAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class MessageCreate(BaseModel):
    toUsername: str
    content: str = Field(..., min_length=1, max_length=1000)

class ConversationResponse(BaseModel):
    username: str
    lastMessage: Optional[str] = None
    lastMessageTime: Optional[datetime] = None
    unreadCount: int = 0
    userProfile: Optional[dict] = None

class ProfileView(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    profileUsername: str  # Profile being viewed
    viewedByUsername: str  # Who viewed the profile
    viewCount: int = 1  # Number of times this user viewed the profile
    firstViewedAt: datetime = Field(default_factory=datetime.utcnow)
    lastViewedAt: datetime = Field(default_factory=datetime.utcnow)
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class ProfileViewCreate(BaseModel):
    profileUsername: str
    viewedByUsername: str

# ===== PII REQUEST & ACCESS MODELS =====

class PIIRequestType(str):
    """Enum for PII request types"""
    IMAGES = "images"
    CONTACT_INFO = "contact_info"
    DOB = "dob"

class PIIRequestStatus(str):
    """Enum for PII request status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class PIIRequest(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    requesterUsername: str  # Who is requesting
    profileUsername: str  # Whose data is requested
    requestType: str  # 'images', 'contact_info', 'dob'
    status: str = "pending"  # 'pending', 'approved', 'rejected', 'cancelled'
    message: Optional[str] = None  # Optional message from requester
    requestedAt: datetime = Field(default_factory=datetime.utcnow)
    respondedAt: Optional[datetime] = None
    expiresAt: Optional[datetime] = None  # Optional expiration
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class PIIRequestCreate(BaseModel):
    profileUsername: str
    requestTypes: List[str]  # Can request multiple types at once
    message: Optional[str] = Field(None, max_length=500)

class PIIRequestResponse(BaseModel):
    status: str
    message: Optional[str] = None
    respondedAt: Optional[datetime] = None

class PIIAccess(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    granterUsername: str  # Who granted access
    grantedToUsername: str  # Who received access
    accessType: str  # 'images', 'contact_info', 'dob'
    grantedAt: datetime = Field(default_factory=datetime.utcnow)
    expiresAt: Optional[datetime] = None  # Optional time-limited access
    isActive: bool = True  # Can be revoked
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class PIIAccessCreate(BaseModel):
    grantedToUsername: str
    accessTypes: List[str]
    expiresAt: Optional[datetime] = None

class UserPreferencesUpdate(BaseModel):
    themePreference: str

    @validator('themePreference')
    def validate_theme(cls, v):
        valid_themes = ['light-blue', 'dark', 'light-pink', 'light-gray', 'ultra-light-gray']
        if v not in valid_themes:
            raise ValueError(f'Theme must be one of: {", ".join(valid_themes)}')
        return v

class UserPreferencesResponse(BaseModel):
    themePreference: str
