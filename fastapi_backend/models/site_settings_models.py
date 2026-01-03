"""
Site Settings Models
Created: December 26, 2025
Purpose: Store configurable site settings like membership fees, plans, etc.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class MembershipPlan(BaseModel):
    """Individual membership plan configuration"""
    id: str = Field(..., description="Unique plan identifier (e.g., 'basic', 'premium')")
    name: str = Field(..., description="Display name")
    price: float = Field(..., ge=0, description="Plan price in USD")
    duration: Optional[int] = Field(None, description="Duration in months (null = lifetime)")
    features: List[str] = Field(default=[], description="List of features included")
    isActive: bool = Field(default=True, description="Is plan available for purchase")
    sortOrder: int = Field(default=0, description="Display order")


class MembershipConfig(BaseModel):
    """Membership configuration settings"""
    baseFee: float = Field(default=99.00, ge=0, description="Default membership fee")
    currency: str = Field(default="USD", description="Currency code")
    plans: List[MembershipPlan] = Field(default=[], description="Available membership plans")
    defaultPlanId: Optional[str] = Field(None, description="Default plan for new signups")
    trialDays: int = Field(default=0, ge=0, description="Free trial period in days")
    gracePeriodDays: int = Field(default=7, ge=0, description="Grace period after expiry")


class SiteSettings(BaseModel):
    """Main site settings document"""
    id: str = Field(default="site_settings", alias="_id")
    membership: MembershipConfig = Field(default_factory=MembershipConfig)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    updatedBy: Optional[str] = Field(None, description="Admin who last updated")
    
    class Config:
        populate_by_name = True


class MembershipConfigUpdate(BaseModel):
    """Model for updating membership configuration"""
    baseFee: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    plans: Optional[List[MembershipPlan]] = None
    defaultPlanId: Optional[str] = None
    trialDays: Optional[int] = Field(None, ge=0)
    gracePeriodDays: Optional[int] = Field(None, ge=0)
