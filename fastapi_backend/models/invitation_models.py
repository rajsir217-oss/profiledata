"""
Invitation System Models
Created: November 2, 2025
Purpose: Manage user invitations via email and SMS
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class InvitationStatus(str, Enum):
    """Status of invitation delivery"""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    ACCEPTED = "accepted"
    EXPIRED = "expired"


class InvitationChannel(str, Enum):
    """Communication channel for invitation"""
    EMAIL = "email"
    SMS = "sms"
    BOTH = "both"


class InvitationBase(BaseModel):
    """Base invitation model"""
    name: str = Field(..., min_length=1, max_length=100, description="Invitee name")
    email: EmailStr = Field(..., description="Invitee email address")
    phone: Optional[str] = Field(None, description="Invitee phone number for SMS")
    channel: InvitationChannel = Field(default=InvitationChannel.EMAIL, description="Invitation channel")
    customMessage: Optional[str] = Field(None, max_length=500, description="Custom invitation message")


class InvitationCreate(InvitationBase):
    """Model for creating new invitation"""
    sendImmediately: bool = Field(default=True, description="Send invitation immediately after creation")


class InvitationUpdate(BaseModel):
    """Model for updating invitation"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    customMessage: Optional[str] = Field(None, max_length=500)
    archived: Optional[bool] = None


class InvitationDB(InvitationBase):
    """Database model for invitation"""
    id: str = Field(alias="_id")
    invitedBy: str = Field(..., description="Username of admin who sent invitation")
    
    # Email tracking
    emailStatus: InvitationStatus = Field(default=InvitationStatus.PENDING)
    emailSentAt: Optional[datetime] = None
    emailDeliveredAt: Optional[datetime] = None
    emailFailedReason: Optional[str] = None
    
    # SMS tracking
    smsStatus: InvitationStatus = Field(default=InvitationStatus.PENDING)
    smsSentAt: Optional[datetime] = None
    smsDeliveredAt: Optional[datetime] = None
    smsFailedReason: Optional[str] = None
    
    # Registration tracking
    registeredAt: Optional[datetime] = None
    registeredUsername: Optional[str] = None
    
    # Metadata
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    archived: bool = Field(default=False)
    
    # Invitation link
    invitationToken: Optional[str] = Field(None, description="Unique token for invitation link")
    tokenExpiresAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True


class InvitationResponse(BaseModel):
    """Response model for invitation"""
    id: str
    name: str
    email: EmailStr
    phone: Optional[str]
    channel: InvitationChannel
    invitedBy: str
    
    emailStatus: InvitationStatus
    emailSentAt: Optional[datetime]
    emailDeliveredAt: Optional[datetime]
    
    smsStatus: InvitationStatus
    smsSentAt: Optional[datetime]
    smsDeliveredAt: Optional[datetime]
    
    registeredAt: Optional[datetime]
    registeredUsername: Optional[str]
    
    createdAt: datetime
    updatedAt: datetime
    archived: bool
    
    # Computed fields
    timeLapse: Optional[str] = Field(None, description="Time since invitation created")
    isExpired: bool = Field(default=False, description="Whether invitation has expired")


class InvitationListResponse(BaseModel):
    """Response model for list of invitations"""
    invitations: List[InvitationResponse]
    total: int
    archived: int
    pending: int
    accepted: int


class InvitationStats(BaseModel):
    """Statistics for invitation system"""
    totalInvitations: int
    pendingInvitations: int
    sentInvitations: int
    acceptedInvitations: int
    expiredInvitations: int
    archivedInvitations: int
    
    emailSuccessRate: float = Field(description="Percentage of successful email deliveries")
    smsSuccessRate: float = Field(description="Percentage of successful SMS deliveries")
    acceptanceRate: float = Field(description="Percentage of invitations that led to registration")
    
    averageTimeToAccept: Optional[str] = Field(None, description="Average time from invitation to registration")


class ResendInvitationRequest(BaseModel):
    """Request to resend invitation"""
    channel: InvitationChannel = Field(default=InvitationChannel.BOTH)
    customMessage: Optional[str] = Field(None, max_length=500)
