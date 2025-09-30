# fastapi_backend/models.py
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

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
