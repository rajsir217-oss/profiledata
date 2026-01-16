# fastapi_backend/models/user_models.py
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
from enum import Enum

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

# ===== ENUMS =====

class ProfileCreatedBy(str, Enum):
    """Who created this profile"""
    ME = "me"
    PARENT = "parent"
    OTHER = "other"

class AccountStatus(str, Enum):
    """Account activation status"""
    PENDING_EMAIL_VERIFICATION = "pending_email_verification"
    PENDING_ADMIN_APPROVAL = "pending_admin_approval"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"

class AdminApprovalStatus(str, Enum):
    """Admin approval status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class PremiumStatus(str, Enum):
    """Premium subscription tier"""
    FREE = "free"
    PREMIUM = "premium"
    ELITE = "elite"
    VIP = "vip"

class BackgroundCheckStatus(str, Enum):
    """Background check status"""
    NONE = "none"
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"

class ModerationStatus(str, Enum):
    """Content moderation status"""
    PENDING = "pending"
    APPROVED = "approved"
    FLAGGED = "flagged"
    SUSPENDED = "suspended"

# ===== STRUCTURED SUB-MODELS =====

class EducationEntry(BaseModel):
    """Structured education history entry"""
    level: str = Field(..., description="Education level (e.g., Bachelor's, Master's)")
    degree: Optional[str] = Field(None, description="Degree name (e.g., BS, MS, MBA)")
    institution: str = Field(..., description="Institution name")
    fieldOfStudy: Optional[str] = Field(None, description="Field of study")
    startYear: Optional[int] = Field(None, ge=1950, le=2030)
    endYear: Optional[int] = Field(None, ge=1950, le=2030)
    
    class Config:
        json_schema_extra = {
            "example": {
                "level": "Bachelor's",
                "degree": "BS",
                "institution": "Stanford University",
                "fieldOfStudy": "Computer Science",
                "startYear": 2015,
                "endYear": 2019
            }
        }

class WorkEntry(BaseModel):
    """Structured work experience entry"""
    status: str = Field(..., description="Status: current, past")
    company: Optional[str] = Field(None, description="Company name")
    position: Optional[str] = Field(None, description="Job title/position")
    description: Optional[str] = Field(None, description="Job description")
    location: Optional[str] = Field(None, description="Work location")
    startDate: Optional[str] = Field(None, description="Start date")
    endDate: Optional[str] = Field(None, description="End date (null if current)")
    isCurrent: bool = Field(default=False, description="Is this current job?")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "current",
                "company": "Google",
                "position": "Software Engineer",
                "description": "Full-stack development",
                "location": "Mountain View, CA",
                "startDate": "2020-01",
                "isCurrent": True
            }
        }

class PartnerCriteria(BaseModel):
    """Structured partner matching criteria"""
    ageRange: Optional[Dict[str, int]] = Field(None, description="Min/max age: {'min': 25, 'max': 35}")
    heightRange: Optional[Dict[str, str]] = Field(None, description="Min/max height: {'min': '5\'4\"', 'max': '6\'0\"'}")
    educationLevel: Optional[List[str]] = Field(None, description="Accepted education levels")
    profession: Optional[List[str]] = Field(None, description="Preferred professions")
    languages: Optional[List[str]] = Field(None, description="Languages they should speak")
    religion: Optional[List[str]] = Field(None, description="Accepted religions")
    caste: Optional[str] = Field(None, description="Caste preference")
    location: Optional[List[str]] = Field(None, description="Preferred locations")
    eatingPreference: Optional[List[str]] = Field(None, description="Eating preferences")
    familyType: Optional[List[str]] = Field(None, description="Family type preferences")
    familyValues: Optional[List[str]] = Field(None, description="Family values")
    
    class Config:
        json_schema_extra = {
            "example": {
                "ageRange": {"min": 25, "max": 35},
                "heightRange": {"min": "5'4\"", "max": "6'0\""},
                "educationLevel": ["Bachelor's", "Master's"],
                "languages": ["English", "Hindi"],
                "religion": ["Any Religion"]
            }
        }

class UserBase(BaseModel):
    # Basic Information
    username: str = Field(..., min_length=3, max_length=50)
    profileId: Optional[str] = Field(None, min_length=8, max_length=8)  # 8-char unique alphanumeric ID
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    
    # Contact Information
    contactNumber: Optional[str] = Field(None, description="Phone number")
    phone: Optional[str] = Field(None, description="Alias for contactNumber (legacy)")
    contactEmail: Optional[EmailStr] = Field(None, description="Email address")
    
    # Profile Creation Context
    profileCreatedBy: str = Field(
        default="me", 
        description="Who created this profile: me, parent, other"
    )
    creatorInfo: Optional[dict] = Field(
        default=None,
        description="Information about the profile creator when profileCreatedBy is not 'me'"
    )
    # Expected structure: {
    #   "fullName": str,
    #   "relationship": str,
    #   "notes": str (optional)
    # }
    
    # Personal Information
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
    educationHistory: List[EducationEntry] = Field(
        default_factory=list,
        description="Structured education history"
    )
    
    # Professional & Work Related Information
    workExperience: List[WorkEntry] = Field(
        default_factory=list,
        description="Structured work experience"
    )
    linkedinUrl: Optional[str] = None  # Private PII field
    # Note: workingStatus is automatically derived from workExperience
    
    # About Me and Partner Information
    familyBackground: Optional[str] = None
    aboutMe: Optional[str] = None  # Renamed from aboutYou
    partnerPreference: Optional[str] = None  # Free-text partner description
    
    # Partner Matching Criteria (Structured)
    partnerCriteria: Optional[PartnerCriteria] = Field(
        None,
        description="Structured partner matching preferences"
    )
    
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
    # Account Activation & Onboarding
    accountStatus: str = Field(
        default=AccountStatus.PENDING_EMAIL_VERIFICATION.value,
        description="Account activation status"
    )
    emailVerificationToken: Optional[str] = None  # Unique token for email verification
    emailVerificationTokenExpiry: Optional[datetime] = None  # Token expires after 24 hours
    emailVerificationSentAt: Optional[datetime] = None
    emailVerificationAttempts: int = 0  # Track resend attempts
    onboardingCompleted: bool = False
    onboardingCompletedAt: Optional[datetime] = None
    
    # Verification Status
    idVerified: bool = False
    idVerifiedAt: Optional[datetime] = None
    idVerifiedBy: Optional[str] = None  # Admin username
    emailVerified: bool = False
    emailVerifiedAt: Optional[datetime] = None
    phoneVerified: bool = False
    phoneVerifiedAt: Optional[datetime] = None
    
    # Admin Approval
    adminApprovalStatus: str = Field(
        default=AdminApprovalStatus.PENDING.value,
        description="Admin approval status"
    )
    adminApprovedBy: Optional[str] = None  # Admin username who approved
    adminApprovedAt: Optional[datetime] = None
    adminRejectionReason: Optional[str] = None
    
    # Premium Status
    isPremium: bool = False
    premiumStatus: str = Field(
        default=PremiumStatus.FREE.value,
        description="Premium subscription tier"
    )
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
    backgroundCheckStatus: str = Field(
        default=BackgroundCheckStatus.NONE.value,
        description="Background check status"
    )
    backgroundCheckCompletedAt: Optional[datetime] = None
    
    # Profile Quality Score
    profileQualityScore: int = 0  # 0-100
    
    # Moderation
    moderationStatus: str = Field(
        default=ModerationStatus.APPROVED.value,
        description="Content moderation status"
    )
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

    @validator('phone', always=True)
    def sync_phone_with_contact_number(cls, v, values):
        """Sync phone and contactNumber fields for backward compatibility"""
        if v:
            values['contactNumber'] = v
        return v or values.get('contactNumber')
    
    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.replace('_', '').isalnum():
            raise ValueError('Username must be alphanumeric with optional underscores')
        return v
    
    @validator('profileCreatedBy')
    def validate_profile_created_by(cls, v):
        valid_values = [e.value for e in ProfileCreatedBy]
        if v not in valid_values:
            raise ValueError(f'profileCreatedBy must be one of: {", ".join(valid_values)}')
        return v
    
    @validator('contactNumber')
    def validate_phone_number(cls, v):
        if v:
            # Remove all non-digit characters
            digits = ''.join(filter(str.isdigit, v))
            # Accept 10-digit US numbers or 10+ digit international
            if len(digits) < 10 or len(digits) > 15:
                raise ValueError('Phone number must be 10-15 digits')
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
            
            # Validate reasonable height range (4'0" to 7'6" or 120cm to 230cm)
            if "'" in v or "ft" in v:
                # Extract feet and inches
                feet_match = re.search(r'(\d+)', v)
                if feet_match:
                    feet = int(feet_match.group(1))
                    if feet < 4 or feet > 7:
                        raise ValueError('Height must be between 4\'0" and 7\'6"')
            elif "cm" in v.lower():
                cm_match = re.search(r'(\d+)', v)
                if cm_match:
                    cm = int(cm_match.group(1))
                    if cm < 120 or cm > 230:
                        raise ValueError('Height must be between 120cm and 230cm')
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
        valid_themes = ['light-blue', 'dark', 'light-pink', 'light-gray', 'ultra-light-gray', 'ultra-light-green', 'ultra-black', 'indian-wedding', 'newspaper', 'cute-bubble']
        if v and v not in valid_themes:
            raise ValueError(f'Theme must be one of: {", ".join(valid_themes)}')
        return v
    
    @validator('accountStatus')
    def validate_account_status(cls, v):
        valid_values = [e.value for e in AccountStatus]
        if v not in valid_values:
            raise ValueError(f'accountStatus must be one of: {", ".join(valid_values)}')
        return v
    
    @validator('adminApprovalStatus')
    def validate_admin_approval_status(cls, v):
        valid_values = [e.value for e in AdminApprovalStatus]
        if v not in valid_values:
            raise ValueError(f'adminApprovalStatus must be one of: {", ".join(valid_values)}')
        return v
    
    @validator('premiumStatus')
    def validate_premium_status(cls, v):
        valid_values = [e.value for e in PremiumStatus]
        if v not in valid_values:
            raise ValueError(f'premiumStatus must be one of: {", ".join(valid_values)}')
        return v
    
    @validator('backgroundCheckStatus')
    def validate_background_check(cls, v):
        valid_values = [e.value for e in BackgroundCheckStatus]
        if v not in valid_values:
            raise ValueError(f'backgroundCheckStatus must be one of: {", ".join(valid_values)}')
        return v
    
    @validator('moderationStatus')
    def validate_moderation_status(cls, v):
        valid_values = [e.value for e in ModerationStatus]
        if v not in valid_values:
            raise ValueError(f'moderationStatus must be one of: {", ".join(valid_values)}')
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
    mfa_code: Optional[str] = None
    remember_me: Optional[bool] = False
    captchaToken: Optional[str] = None  # Cloudflare Turnstile CAPTCHA token

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
    DATE_OF_BIRTH = "date_of_birth"

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
    requestType: str  # 'images', 'contact_info', 'date_of_birth'
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
    accessType: str  # 'images', 'contact_info', 'date_of_birth'
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
        valid_themes = ['light-blue', 'dark', 'light-pink', 'light-gray', 'ultra-light-gray', 'ultra-light-green', 'ultra-black', 'indian-wedding', 'newspaper', 'cute-bubble']
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
