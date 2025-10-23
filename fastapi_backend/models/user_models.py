# fastapi_backend/models.py
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
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
    # Basic Information
    username: str = Field(..., min_length=3, max_length=50)
    profileId: Optional[str] = Field(None, min_length=8, max_length=8)  # 8-char unique alphanumeric ID
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    contactNumber: Optional[str] = None
    contactEmail: Optional[EmailStr] = None
    dateOfBirth: Optional[str] = None  # Renamed from dob
    gender: Optional[str] = None  # Renamed from sex
    height: Optional[str] = None  # Format: "5'8\"" or "5 ft 8 in"
    
    # Preferences & Cultural Information
    religion: Optional[str] = None  # For both India and USA
    languagesSpoken: List[str] = []  # Multiple languages user speaks
    castePreference: Optional[str] = "None"  # Default "None", relevant for India
    eatingPreference: Optional[str] = "None"  # Default "None"
    
    # Residential Information (Mandatory)
    countryOfOrigin: str = "US"  # "IN" or "US" - Mandatory
    countryOfResidence: str = "US"  # "IN" or "US" - Mandatory
    state: str = Field(..., description="State/Province - Mandatory")
    location: Optional[str] = None  # City/Town
    
    # USA-specific field
    citizenshipStatus: Optional[str] = "Citizen"  # Relevant for USA only
    
    # India-specific fields (optional)
    caste: Optional[str] = None
    motherTongue: Optional[str] = None
    familyType: Optional[str] = None
    familyValues: Optional[str] = None
    
    # Educational Information
    education: Optional[str] = None  # Legacy field for backward compatibility
    educationHistory: List[dict] = []  # New structured education array
    
    # Professional & Work Related Information
    workExperience: List[dict] = []  # New work experience array
    workLocation: Optional[str] = None  # Work city/location
    linkedinUrl: Optional[str] = None  # Private PII field
    # Note: workingStatus is automatically derived from workExperience
    
    # About Me and Partner Information
    familyBackground: Optional[str] = None
    aboutMe: Optional[str] = None  # Renamed from aboutYou
    partnerPreference: Optional[str] = None  # Free-text partner description
    
    # Partner Matching Criteria (Structured)
    partnerCriteria: Optional[dict] = None  # Structured matching preferences
    # Expected structure:
    # {
    #   "ageRange": {"min": 25, "max": 35},
    #   "heightRange": {"min": "5'4\"", "max": "6'0\""},
    #   "educationLevel": ["Bachelor's", "Master's", "PhD"],
    #   "profession": ["Engineer", "Doctor", "Business"],
    #   "languages": ["English", "Hindi"],
    #   "religion": ["Hindu", "Christian"],
    #   "caste": "Any",
    #   "location": ["Bangalore", "Mumbai", "California"],
    #   "eatingPreference": ["Vegetarian", "Eggetarian"],
    #   "familyType": ["Nuclear Family", "Joint Family"],
    #   "familyValues": ["Traditional", "Moderate", "Liberal"]
    # }
    
    # Images and Theme
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
    
    # ===== PHASE 1: ESSENTIAL META FIELDS =====
    # Verification Status
    idVerified: bool = False
    idVerifiedAt: Optional[datetime] = None
    idVerifiedBy: Optional[str] = None  # Admin username
    emailVerified: bool = False
    emailVerifiedAt: Optional[datetime] = None
    phoneVerified: bool = False
    phoneVerifiedAt: Optional[datetime] = None
    
    # Premium Status
    isPremium: bool = False
    premiumStatus: str = "free"  # "free", "premium", "elite", "vip"
    premiumActivatedAt: Optional[datetime] = None
    premiumExpiresAt: Optional[datetime] = None
    
    # Profile Quality
    profileCompleteness: int = 0  # 0-100 percentage
    trustScore: int = 50  # 0-100, starts at 50 (neutral)
    lastActiveAt: Optional[datetime] = None
    
    # ===== PHASE 2: ENHANCED TRUST =====
    # Professional Verification
    employmentVerified: bool = False
    employmentVerifiedAt: Optional[datetime] = None
    employmentVerificationSource: Optional[str] = None
    educationVerified: bool = False
    educationVerifiedAt: Optional[datetime] = None
    educationVerificationSource: Optional[str] = None
    
    # Background & Safety
    backgroundCheckStatus: str = "none"  # "none", "pending", "passed", "failed"
    backgroundCheckCompletedAt: Optional[datetime] = None
    
    # Profile Quality Score
    profileQualityScore: int = 0  # 0-100
    
    # Moderation
    moderationStatus: str = "approved"  # "pending", "approved", "flagged", "suspended"
    moderatedBy: Optional[str] = None
    moderatedAt: Optional[datetime] = None
    
    # ===== PHASE 3: GAMIFICATION =====
    # Badges & Achievements
    badges: List[str] = []  # ["early_adopter", "popular", "responsive", "complete_profile"]
    achievementPoints: int = 0
    
    # Profile Ranking
    profileRank: Optional[str] = None  # "Rising Star", "Top 1%", "Most Viewed"
    isFeatured: bool = False
    featuredUntil: Optional[datetime] = None
    isStaffPick: bool = False
    
    # Engagement Metrics
    profileViews: int = 0
    profileViewsThisMonth: int = 0
    uniqueViewersCount: int = 0
    responseRate: float = 0.0  # 0-100%
    replyTimeAverage: Optional[int] = None  # Minutes
    activeDays: int = 0
    shortlistCount: int = 0
    favoriteCount: int = 0
    
    # Admin Controls
    metaFieldsVisibility: dict = {}  # Controls which meta fields are visible {"idVerified": true, "isPremium": false}
    metaFieldsVisibleToPublic: bool = False  # Default hidden, admin can enable

    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').isalnum():
            raise ValueError('Username must be alphanumeric with optional underscores')
        return v

    @validator('gender')
    def validate_gender(cls, v):
        if v and v not in ['Male', 'Female', '']:
            raise ValueError('Gender must be Male, Female, or empty')
        return v
    
    @validator('countryOfOrigin', 'countryOfResidence')
    def validate_country(cls, v):
        if v and v not in ['IN', 'US']:
            raise ValueError('Country must be IN (India) or US (United States)')
        return v
    
    @validator('height')
    def validate_height(cls, v):
        if v:
            # Accept formats: "5'8\"", "5 ft 8 in", "170cm", etc.
            import re
            patterns = [
                r"^\d+['\"]\s*\d*['\"]?$",  # 5'8" or 5'8
                r"^\d+\s*ft\s*\d*\s*in$",  # 5 ft 8 in
                r"^\d+(\.\d+)?\s*(cm|m|inches?)$"  # 170cm, 1.7m, 68inches
            ]
            if not any(re.match(p, v.strip(), re.IGNORECASE) for p in patterns):
                raise ValueError('Height must be in format: 5\'8", 5 ft 8 in, 170cm, or similar')
        return v
    
    @validator('religion')
    def validate_religion(cls, v):
        valid_religions = [
            'Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 
            'Jewish', 'Parsi', 'Other', 'Prefer not to say', 'No Religion'
        ]
        if v and v not in valid_religions:
            raise ValueError(f'Religion must be one of: {", ".join(valid_religions)}')
        return v
    
    @validator('languagesSpoken')
    def validate_languages(cls, v):
        if v and len(v) > 10:
            raise ValueError('Maximum 10 languages allowed')
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
    
    @validator('premiumStatus')
    def validate_premium_status(cls, v):
        if v and v not in ['free', 'premium', 'elite', 'vip']:
            raise ValueError('Premium status must be: free, premium, elite, or vip')
        return v
    
    @validator('backgroundCheckStatus')
    def validate_background_check(cls, v):
        if v and v not in ['none', 'pending', 'passed', 'failed']:
            raise ValueError('Background check status must be: none, pending, passed, or failed')
        return v
    
    @validator('moderationStatus')
    def validate_moderation_status(cls, v):
        if v and v not in ['pending', 'approved', 'flagged', 'suspended']:
            raise ValueError('Moderation status must be: pending, approved, flagged, or suspended')
        return v
    
    @validator('trustScore', 'profileCompleteness', 'profileQualityScore')
    def validate_score(cls, v):
        if v and (v < 0 or v > 100):
            raise ValueError('Score must be between 0 and 100')
        return v
    
    @validator('responseRate')
    def validate_response_rate(cls, v):
        if v and (v < 0 or v > 100):
            raise ValueError('Response rate must be between 0 and 100')
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

class PIIRequestApprove(BaseModel):
    responseMessage: Optional[str] = None
    durationDays: Optional[int] = None  # Days until access expires, None = permanent
    pictureDurations: Optional[Dict[str, Any]] = None  # Individual durations for each picture {0: 'onetime', 1: 3, 2: 'permanent', ...}

class PIIRequestReject(BaseModel):
    responseMessage: Optional[str] = None

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

# ===== TESTIMONIALS =====

class TestimonialCreate(BaseModel):
    """Model for creating a new testimonial"""
    content: str = Field(..., min_length=10, max_length=500)
    rating: Optional[int] = Field(5, ge=1, le=5)
    isAnonymous: Optional[bool] = False

class TestimonialResponse(BaseModel):
    """Model for testimonial response"""
    id: str
    username: str
    displayName: str  # Either real name or "Anonymous User"
    avatar: Optional[str] = None
    content: str
    rating: int
    isAnonymous: bool
    status: str  # pending, approved, rejected
    createdAt: datetime
    
    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}
