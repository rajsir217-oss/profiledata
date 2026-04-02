"""
Virtual Meet Models
Pydantic models for the Virtual Meets system (RSVP-driven match list + 1:1 virtual room flow)
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum
from bson import ObjectId


class EventType(str, Enum):
    """Types of events for polls"""
    IN_PERSON = "in-person"
    VIRTUAL = "virtual"
    ZOOM_CALL = "zoom-call"
    HYBRID = "hybrid"


class PaymentStatus(str, Enum):
    """Payment status for virtual meet sessions"""
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    COMPLETED = "completed"
    REFUNDED = "refunded"


class RoomRequestStatus(str, Enum):
    """Status of a 1:1 room request"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class VirtualRoomStatus(str, Enum):
    """Status of a virtual room"""
    CONFIRMED = "confirmed"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


# ─── Session Models ───────────────────────────────────────────────────────────

class VirtualMeetSession(BaseModel):
    """Per-poll, per-user session tracking (payment status, access)"""
    id: Optional[str] = Field(None, alias="_id")
    poll_id: str
    username: str
    gender: str                                     # "Male" or "Female" (strict M/F)
    event_type: Optional[str] = None                # From poll's event_type
    payment_status: PaymentStatus = PaymentStatus.NOT_REQUIRED
    payment_amount: float = 5.00                    # Admin-configurable per event
    payment_id: Optional[str] = None                # Reference to payments collection
    payment_provider: Optional[str] = None          # "paypal" or "clover"
    paypal_order_id: Optional[str] = None
    clover_order_id: Optional[str] = None
    access_unlocked: bool = False
    rsvp_response: str = "yes"
    match_list_generated: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None
        }


# ─── Room Request Models ─────────────────────────────────────────────────────

class RoomRequestCreate(BaseModel):
    """Request body for sending a 1:1 room request"""
    target_username: str


class RoomRequestRespond(BaseModel):
    """Request body for accepting/declining a room request"""
    request_id: str
    action: str  # "accept" or "decline"
    note: Optional[str] = None


class CancelRoomRequest(BaseModel):
    """Request body for cancelling a confirmed room"""
    room_id: str


class AdminPairRequest(BaseModel):
    """Request body for admin bulk pairing"""
    user_a: str
    user_b: str


class VirtualRoomRequest(BaseModel):
    """Full room request model (from database)"""
    id: Optional[str] = Field(None, alias="_id")
    poll_id: str
    requester_username: str
    target_username: str
    status: RoomRequestStatus = RoomRequestStatus.PENDING
    room_id: Optional[str] = None
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None
    response_note: Optional[str] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None
        }


# ─── Virtual Room Models ─────────────────────────────────────────────────────

class VirtualRoom(BaseModel):
    """Confirmed 1:1 virtual room"""
    id: Optional[str] = Field(None, alias="_id")
    poll_id: str
    room_number: int                    # Auto-incremented per poll
    user_a: str                         # Requester
    user_b: str                         # Acceptor
    status: VirtualRoomStatus = VirtualRoomStatus.CONFIRMED
    zoom_link: Optional[str] = None     # Optional Zoom link (admin can provide)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None
        }


# ─── Payment Models ──────────────────────────────────────────────────────────

class VirtualMeetPaymentRequest(BaseModel):
    """Request body for initiating payment"""
    payment_method: str = "paypal"  # "paypal" or "clover"


class VirtualMeetPaymentConfirm(BaseModel):
    """Request body for confirming payment capture"""
    order_id: str
    payment_method: str = "paypal"  # "paypal" or "clover"


# ─── Admin Models ─────────────────────────────────────────────────────────────

class AdminPairRequest(BaseModel):
    """Request body for admin to manually pair two users"""
    user_a: str
    user_b: str


# ─── Response Models ──────────────────────────────────────────────────────────

class MatchProfile(BaseModel):
    """Profile data returned in the match list"""
    username: str
    full_name: str
    age: Optional[int] = None
    location: Optional[str] = None
    profession: Optional[str] = None
    profile_pic_url: Optional[str] = None
    request_status: Optional[str] = None  # null, "pending", "accepted", "declined"
    request_id: Optional[str] = None      # If there's an existing request


class IncomingRequest(BaseModel):
    """An incoming room request from another user"""
    request_id: str
    from_username: str
    full_name: str
    age: Optional[int] = None
    location: Optional[str] = None
    profession: Optional[str] = None
    profile_pic_url: Optional[str] = None
    requested_at: datetime


class RoomInfo(BaseModel):
    """Room information for the user"""
    room_id: str
    room_number: int
    partner_username: str
    partner_name: str
    partner_pic_url: Optional[str] = None
    status: str
    zoom_link: Optional[str] = None
    created_at: datetime


class VirtualMeetEventSummary(BaseModel):
    """Summary of a virtual meet event for the events list"""
    poll_id: str
    title: str
    event_type: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    event_timezone: Optional[str] = None
    event_location: Optional[str] = None
    status: str
    payment_required: bool = False
    payment_status: str = "not_required"
    payment_amount: float = 5.00
    access_unlocked: bool = False
    match_count: int = 0
    room_count: int = 0
    pending_requests_received: int = 0
    is_locked: bool = False


class MatchListResponse(BaseModel):
    """Response for the match list endpoint"""
    success: bool = True
    poll_id: str
    is_locked: bool = False
    matches: List[MatchProfile] = []
    my_requests_sent: List[str] = []            # Usernames
    my_requests_received: List[IncomingRequest] = []
    my_rooms: List[RoomInfo] = []


class AdminOverview(BaseModel):
    """Admin overview of a virtual meet event"""
    success: bool = True
    poll_id: str
    title: str
    total_participants: int = 0
    male_count: int = 0
    female_count: int = 0
    paid_count: int = 0
    unpaid_count: int = 0
    exempt_count: int = 0
    total_requests: int = 0
    accepted_requests: int = 0
    declined_requests: int = 0
    pending_requests: int = 0
    total_rooms: int = 0
    participants: List[dict] = []
    rooms: List[dict] = []
