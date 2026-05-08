"""
Messenger Models
Created: May 3, 2025
Purpose: Pydantic models for the standalone L3V3L Messenger feature.
Covers conversations, messages (with media + delivery receipts), and device tokens.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ConversationType(str, Enum):
    DIRECT = "direct"
    GROUP = "group"
    PUBLIC_GROUP = "public_group"


class ContentType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    LOCATION = "location"


class MessageStatus(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class ModerationStatus(str, Enum):
    CLEAN = "clean"
    FLAGGED = "flagged"
    BLOCKED = "blocked"


class DevicePlatform(str, Enum):
    ANDROID = "android"
    IOS = "ios"
    WEB = "web"


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class MediaPayload(BaseModel):
    """Attached media metadata (stored alongside the message document)."""
    url: str
    thumbnailUrl: Optional[str] = None
    mimeType: str
    fileSize: int  # bytes
    fileName: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None  # seconds (audio / video)


class Participant(BaseModel):
    username: Optional[str] = None
    phoneHash: Optional[str] = None
    role: str = "member"  # "member" | "admin" (group only)
    joinedAt: datetime = Field(default_factory=datetime.utcnow)


class PublicParticipant(BaseModel):
    """Non-member participant in a public_group conversation (US Vedika)."""
    email: str
    displayName: Optional[str] = None
    addedBy: str  # member who first messaged them
    addedAt: datetime = Field(default_factory=datetime.utcnow)
    status: str = "invited"  # "invited" | "interested" | "registered" | "opted_out"
    lastEmailSentAt: Optional[datetime] = None
    registrationInterestId: Optional[str] = None  # link to registration_interests doc
    convertedUsername: Optional[str] = None  # populated after they become a member


class ReadReceipt(BaseModel):
    username: str
    readAt: datetime


class DeviceToken(BaseModel):
    token: str
    platform: DevicePlatform
    deviceName: Optional[str] = None
    lastActive: datetime = Field(default_factory=datetime.utcnow)
    createdAt: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Request / Create models
# ---------------------------------------------------------------------------

class ConversationCreate(BaseModel):
    """Create a new 1:1 or group conversation."""
    type: ConversationType = ConversationType.DIRECT
    participantUsernames: List[str] = Field(..., min_length=1)
    groupName: Optional[str] = None
    groupAvatar: Optional[str] = None
    isPublicGroup: bool = False  # US Vedika special flag
    publicParticipants: Optional[List[PublicParticipant]] = None


class MessageCreate(BaseModel):
    """Send a new message into a conversation."""
    conversationId: str
    contentType: ContentType = ContentType.TEXT
    content: str = ""  # text body or caption
    media: Optional[MediaPayload] = None
    replyTo: Optional[str] = None  # message _id being replied to
    # US Vedika public group extensions
    publicRecipients: Optional[List[Dict[str, Any]]] = None  # [{"email": "...", "displayName": "..."}]
    deliveryMode: Optional[str] = None  # "inapp" | "email" | "both"
    includeInvitation: Optional[bool] = None  # attach Registration Interest CTA


class MessageStatusUpdate(BaseModel):
    """Client reports delivery / read status."""
    messageIds: List[str]
    status: MessageStatus


class DeviceRegister(BaseModel):
    """Register a device for push notifications."""
    token: str
    platform: DevicePlatform
    deviceName: Optional[str] = None


class PublicReplyToken(BaseModel):
    """Token for reply-by-email tracking in US Vedika public group."""
    token: str  # uuid-v4
    conversationId: str
    publicEmail: str
    messageId: Optional[str] = None  # the message they're replying to (optional)
    expiresAt: datetime
    usedCount: int = 0
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class PublicRecipient(BaseModel):
    """Public email recipient for a message in US Vedika."""
    email: str
    displayName: Optional[str] = None


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class MessageResponse(BaseModel):
    id: str
    conversationId: str
    senderUsername: str
    contentType: str
    content: str
    media: Optional[MediaPayload] = None
    status: str = "sent"
    deliveredAt: Optional[datetime] = None
    readAt: Optional[datetime] = None
    readBy: List[ReadReceipt] = []
    replyTo: Optional[str] = None
    isForwarded: bool = False
    isDeleted: bool = False
    createdAt: datetime
    updatedAt: Optional[datetime] = None


class ConversationResponse(BaseModel):
    id: str
    type: str
    participants: List[Dict[str, Any]]
    groupName: Optional[str] = None
    groupAvatar: Optional[str] = None
    isPublicGroup: bool = False  # US Vedika special flag
    publicParticipants: Optional[List[PublicParticipant]] = None  # US Vedika public invitees
    lastMessageAt: Optional[datetime] = None
    lastMessagePreview: Optional[str] = None
    unreadCount: int = 0
    createdAt: datetime
    updatedAt: Optional[datetime] = None


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int


class MessageListResponse(BaseModel):
    messages: List[MessageResponse]
    total: int
    hasMore: bool = False
    cursor: Optional[str] = None  # last message _id for cursor pagination
