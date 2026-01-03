"""
Promo Code System Models
Created: December 26, 2025
Purpose: Manage promo codes for communities, events, referrals, and campaigns
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class PromoCodeType(str, Enum):
    """Type of promo code"""
    COMMUNITY = "community"      # For community groups (Telugu Assoc, etc.)
    EVENT = "event"              # For events (Diwali 2025, Wedding Expo)
    REFERRAL = "referral"        # Personal referral codes for users
    CAMPAIGN = "campaign"        # Marketing campaigns


class DiscountType(str, Enum):
    """Type of discount"""
    PERCENTAGE = "percentage"    # e.g., 20% off
    FIXED = "fixed"              # e.g., $20 off
    NONE = "none"                # No discount (tracking only)


class PromoCodeBase(BaseModel):
    """Base promo code model"""
    code: str = Field(..., min_length=3, max_length=50, description="Unique promo code")
    name: str = Field(..., min_length=1, max_length=100, description="Display name")
    type: PromoCodeType = Field(default=PromoCodeType.REFERRAL, description="Type of promo code")
    description: Optional[str] = Field(None, max_length=500, description="Description")
    
    # Discount Configuration
    discountType: DiscountType = Field(default=DiscountType.NONE, description="Type of discount")
    discountValue: float = Field(default=0, ge=0, description="Discount value (percentage or fixed amount)")
    applicablePlans: List[str] = Field(default=[], description="Membership plans this applies to")
    defaultPlan: Optional[str] = Field(default="premium", description="Default membership plan for this promo code")
    
    # Per-plan custom pricing (overrides global plan prices)
    # Format: {"basic": 70, "premium": 100, "lifetime": 150}
    planPricing: Optional[Dict[str, float]] = Field(default=None, description="Custom pricing per plan for this promo code")
    
    # Validity
    validFrom: Optional[datetime] = Field(None, description="Start date")
    validUntil: Optional[datetime] = Field(None, description="Expiry date")
    maxUses: Optional[int] = Field(None, ge=1, description="Maximum uses (null = unlimited)")
    
    # Tags for filtering
    tags: List[str] = Field(default=[], description="Tags for categorization")


class PromoCodeCreate(PromoCodeBase):
    """Model for creating new promo code"""
    pass


class PromoCodeUpdate(BaseModel):
    """Model for updating promo code"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    discountType: Optional[DiscountType] = None
    discountValue: Optional[float] = Field(None, ge=0)
    applicablePlans: Optional[List[str]] = None
    defaultPlan: Optional[str] = None
    planPricing: Optional[Dict[str, float]] = None
    validFrom: Optional[datetime] = None
    validUntil: Optional[datetime] = None
    maxUses: Optional[int] = Field(None, ge=1)
    isActive: Optional[bool] = None
    tags: Optional[List[str]] = None


class PromoCodeDB(PromoCodeBase):
    """Database model for promo code"""
    id: Optional[str] = Field(None, alias="_id")
    
    # Usage tracking
    currentUses: int = Field(default=0, description="Current number of uses")
    isActive: bool = Field(default=True, description="Is code active")
    isArchived: bool = Field(default=False, description="Is code archived (soft delete)")
    archivedAt: Optional[datetime] = Field(None, description="When the code was archived")
    
    # Creator info
    createdBy: str = Field(..., description="Username who created this code")
    linkedToUser: Optional[str] = Field(None, description="For referral codes - whose code is this")
    
    # QR Code (for future use)
    qrCodeUrl: Optional[str] = Field(None, description="URL to QR code image")
    invitationLink: Optional[str] = Field(None, description="Full invitation link with promo code")
    
    # Analytics
    registrations: int = Field(default=0, description="Users who registered with this code")
    conversions: int = Field(default=0, description="Users who became paid members")
    revenue: float = Field(default=0, description="Total revenue from this code")
    
    # Timestamps
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PromoCodeResponse(PromoCodeDB):
    """Response model for promo code"""
    isExpired: bool = Field(default=False, description="Is code expired")
    usesRemaining: Optional[int] = Field(None, description="Remaining uses (null = unlimited)")
    
    class Config:
        populate_by_name = True


class PromoCodeListResponse(BaseModel):
    """Response model for list of promo codes"""
    promoCodes: List[PromoCodeResponse]
    total: int
    page: int
    pages: int


class PromoCodeStats(BaseModel):
    """Statistics for promo codes"""
    totalCodes: int = 0
    activeCodes: int = 0
    totalRegistrations: int = 0
    totalConversions: int = 0
    totalRevenue: float = 0
    topCodes: List[dict] = []  # Top performing codes
