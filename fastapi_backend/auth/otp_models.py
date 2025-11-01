"""
OTP and Phone/Email Verification Models
Supports dual-channel OTP (Email + SMS)
"""
from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional, Literal
from datetime import datetime
import re


class OTPSendCodeRequest(BaseModel):
    """Request to send OTP code via Email or SMS"""
    channel: Literal["email", "sms"] = Field(default="email", description="Delivery channel: email or sms")
    email: Optional[EmailStr] = Field(None, description="Email address (required for email channel)")
    phone: Optional[str] = Field(None, description="Phone number (required for sms channel)")
    
    @validator('phone')
    def validate_phone(cls, v):
        if v is None:
            return v
        # Remove spaces, dashes, parentheses
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        
        # Check if it's a valid format (10 or 11 digits)
        if not re.match(r'^\+?1?\d{10}$', cleaned):
            raise ValueError('Invalid phone number format. Use format: +1234567890 or 1234567890')
        
        return cleaned
    
    @validator('email')
    def validate_channel_requirements(cls, v, values):
        """Ensure required field is provided based on channel"""
        channel = values.get('channel', 'email')
        phone = values.get('phone')
        
        if channel == 'email' and not v:
            raise ValueError('Email is required when channel is "email"')
        if channel == 'sms' and not phone:
            raise ValueError('Phone is required when channel is "sms"')
        
        return v


# Legacy model for backward compatibility
class PhoneSendCodeRequest(BaseModel):
    """Request to send phone verification code (Legacy - use OTPSendCodeRequest)"""
    phone: str = Field(..., description="Phone number to verify")
    
    @validator('phone')
    def validate_phone(cls, v):
        # Remove spaces, dashes, parentheses
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        
        # Check if it's a valid format (10 or 11 digits)
        if not re.match(r'^\+?1?\d{10}$', cleaned):
            raise ValueError('Invalid phone number format. Use format: +1234567890 or 1234567890')
        
        return cleaned


class OTPVerifyCodeRequest(BaseModel):
    """Request to verify OTP code (Email or SMS)"""
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    
    @validator('code')
    def validate_code(cls, v):
        if not v.isdigit():
            raise ValueError('Code must contain only digits')
        return v


# Legacy model for backward compatibility
class PhoneVerifyCodeRequest(BaseModel):
    """Request to verify phone code (Legacy - use OTPVerifyCodeRequest)"""
    phone: str = Field(..., description="Phone number being verified")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    
    @validator('code')
    def validate_code(cls, v):
        if not v.isdigit():
            raise ValueError('Code must contain only digits')
        return v


class MFASendCodeRequest(BaseModel):
    """Request to send MFA code"""
    username: str = Field(..., description="Username requesting MFA code")
    channel: Optional[Literal["email", "sms"]] = Field(None, description="Preferred channel (uses user's preference if not specified)")


class MFAVerifyCodeRequest(BaseModel):
    """Request to verify MFA code"""
    username: str = Field(..., description="Username")
    code: str = Field(..., min_length=6, max_length=9, description="6-digit MFA code or backup code")
    
    @validator('code')
    def validate_code(cls, v):
        # Allow either 6-digit code or backup code format (XXXX-XXXX)
        if not (v.isdigit() or (len(v) == 9 and v[4] == '-')):
            raise ValueError('Code must be 6 digits or backup code format (XXXX-XXXX)')
        return v


class MFAEnableRequest(BaseModel):
    """Request to enable MFA"""
    channel: Literal["email", "sms"] = Field(default="email", description="MFA channel: email or sms")
    phone: Optional[str] = Field(None, description="Phone number for SMS MFA")
    email: Optional[EmailStr] = Field(None, description="Email address for Email MFA")
    verification_code: str = Field(..., min_length=6, max_length=6, description="Code to verify contact ownership")
    
    @validator('phone')
    def validate_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        if not re.match(r'^\+?1?\d{10}$', cleaned):
            raise ValueError('Invalid phone number format')
        return cleaned
    
    @validator('email')
    def validate_channel_requirements(cls, v, values):
        """Ensure required field is provided based on channel"""
        channel = values.get('channel', 'email')
        phone = values.get('phone')
        
        if channel == 'email' and not v:
            raise ValueError('Email is required when channel is "email"')
        if channel == 'sms' and not phone:
            raise ValueError('Phone is required when channel is "sms"')
        
        return v


class MFADisableRequest(BaseModel):
    """Request to disable MFA"""
    password: str = Field(..., description="Current password for verification")
    code: Optional[str] = Field(None, description="Current MFA code if available")


class OTPResponse(BaseModel):
    """Response after sending OTP (Email or SMS)"""
    success: bool
    message: str
    channel: Optional[Literal["email", "sms"]] = None
    contact_masked: Optional[str] = None  # Masked email or phone
    phone_masked: Optional[str] = None  # Legacy - for backward compatibility
    email_masked: Optional[str] = None  # Legacy - for backward compatibility
    expires_at: Optional[datetime] = None
    mock_code: Optional[str] = None  # Only in development


class VerificationResponse(BaseModel):
    """Response after verification"""
    success: bool
    message: str
    verified: bool = False
    channel: Optional[Literal["email", "sms"]] = None


# Legacy for backward compatibility
class PhoneVerificationResponse(BaseModel):
    """Response after phone verification (Legacy - use VerificationResponse)"""
    success: bool
    message: str
    phone_verified: bool = False


class MFAStatusResponse(BaseModel):
    """MFA status response"""
    mfa_enabled: bool
    mfa_channel: Optional[Literal["email", "sms"]] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_masked: Optional[str] = None
    phone_masked: Optional[str] = None  # Legacy
    enabled_at: Optional[datetime] = None
    backup_codes_count: int = 0


class OTPPreferenceRequest(BaseModel):
    """Request to update OTP channel preference"""
    channel: Literal["email", "sms"] = Field(..., description="Preferred OTP channel")
    

class OTPPreferenceResponse(BaseModel):
    """Response after updating OTP preference"""
    success: bool
    message: str
    channel: Literal["email", "sms"]


class BackupCodesResponse(BaseModel):
    """Backup codes for MFA recovery"""
    codes: list[str]
    generated_at: datetime
    message: str = "Save these codes in a secure place. Each code can only be used once."
