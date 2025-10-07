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
    education: Optional[str] = None
    workingStatus: Optional[str] = None
    workplace: Optional[str] = None
    citizenshipStatus: Optional[str] = "Citizen"
    familyBackground: Optional[str] = None
    aboutYou: Optional[str] = None
    partnerPreference: Optional[str] = None
    images: List[str] = []

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
