"""
Announcement/Marquee Models
Pydantic models for the announcement banner system
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AnnouncementType(str, Enum):
    """Types of announcements"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"
    MAINTENANCE = "maintenance"
    PROMOTION = "promotion"


class AnnouncementPriority(str, Enum):
    """Priority levels for announcements"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class AnnouncementTargetAudience(str, Enum):
    """Who should see the announcement"""
    ALL = "all"
    AUTHENTICATED = "authenticated"
    ADMINS = "admins"
    PREMIUM = "premium"
    FREE = "free"


class AnnouncementBase(BaseModel):
    """Base announcement fields"""
    message: str = Field(..., min_length=1, max_length=500, description="Announcement message")
    type: AnnouncementType = Field(default=AnnouncementType.INFO, description="Announcement type")
    priority: AnnouncementPriority = Field(default=AnnouncementPriority.MEDIUM, description="Priority level")
    targetAudience: AnnouncementTargetAudience = Field(default=AnnouncementTargetAudience.ALL, description="Target audience")
    link: Optional[str] = Field(None, description="Optional link URL")
    linkText: Optional[str] = Field(None, description="Link button text")
    dismissible: bool = Field(default=True, description="Can users dismiss this announcement")
    icon: Optional[str] = Field(None, description="Optional emoji icon")


class AnnouncementCreate(AnnouncementBase):
    """Create announcement request"""
    startDate: Optional[datetime] = Field(None, description="When to start showing (null = immediately)")
    endDate: Optional[datetime] = Field(None, description="When to stop showing (null = no expiry)")


class AnnouncementUpdate(BaseModel):
    """Update announcement request (all fields optional)"""
    message: Optional[str] = Field(None, min_length=1, max_length=500)
    type: Optional[AnnouncementType] = None
    priority: Optional[AnnouncementPriority] = None
    targetAudience: Optional[AnnouncementTargetAudience] = None
    link: Optional[str] = None
    linkText: Optional[str] = None
    dismissible: Optional[bool] = None
    icon: Optional[str] = None
    active: Optional[bool] = None
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None


class AnnouncementResponse(AnnouncementBase):
    """Announcement response with metadata"""
    id: str = Field(..., description="Announcement ID")
    active: bool = Field(..., description="Is announcement active")
    startDate: Optional[datetime] = Field(None, description="Start date")
    endDate: Optional[datetime] = Field(None, description="End date")
    createdBy: str = Field(..., description="Creator username")
    createdAt: datetime = Field(..., description="Creation timestamp")
    updatedAt: datetime = Field(..., description="Last update timestamp")
    viewCount: int = Field(default=0, description="Number of views")
    dismissCount: int = Field(default=0, description="Number of dismissals")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "63f1a2b3c4d5e6f7g8h9i0j1",
                "message": "🎉 New feature: Dark Mode is now available!",
                "type": "success",
                "priority": "medium",
                "targetAudience": "all",
                "link": "/preferences",
                "linkText": "Try it now",
                "dismissible": True,
                "icon": "🎉",
                "active": True,
                "startDate": "2025-11-26T00:00:00Z",
                "endDate": None,
                "createdBy": "admin",
                "createdAt": "2025-11-26T12:00:00Z",
                "updatedAt": "2025-11-26T12:00:00Z",
                "viewCount": 150,
                "dismissCount": 10
            }
        }


class AnnouncementDismissal(BaseModel):
    """Track user dismissals"""
    announcementId: str = Field(..., description="Announcement ID")
    username: str = Field(..., description="User who dismissed")
    dismissedAt: datetime = Field(default_factory=datetime.utcnow, description="Dismissal timestamp")


class AnnouncementStats(BaseModel):
    """Announcement statistics"""
    totalAnnouncements: int
    activeAnnouncements: int
    scheduledAnnouncements: int
    expiredAnnouncements: int
    totalViews: int
    totalDismissals: int
