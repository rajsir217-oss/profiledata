"""
Poll Models
Pydantic models for the polling system
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
from bson import ObjectId


class PollType(str, Enum):
    """Types of polls"""
    SINGLE_CHOICE = "single_choice"      # User selects one option
    MULTIPLE_CHOICE = "multiple_choice"  # User can select multiple options
    RSVP = "rsvp"                        # Event RSVP (Yes/No/Maybe)
    OPEN_TEXT = "open_text"              # Free text response


class PollStatus(str, Enum):
    """Poll status"""
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class PollOption(BaseModel):
    """A single poll option"""
    id: str = Field(default_factory=lambda: str(ObjectId()))
    text: str
    order: int = 0


class PollCreate(BaseModel):
    """Request model for creating a poll"""
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    poll_type: PollType = PollType.RSVP
    options: Optional[List[str]] = None  # For single/multiple choice
    
    # Event details (for RSVP type)
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    event_location: Optional[str] = None
    event_details: Optional[str] = None
    
    # Settings
    collect_contact_info: bool = True  # Collect user's contact info with response
    allow_comments: bool = True        # Allow users to add comments
    anonymous: bool = False            # Anonymous responses
    
    # Scheduling
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    # Targeting
    target_all_users: bool = True
    target_usernames: Optional[List[str]] = None  # Specific users if not all


class PollUpdate(BaseModel):
    """Request model for updating a poll"""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    poll_type: Optional[PollType] = None
    options: Optional[List[str]] = None
    
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    event_location: Optional[str] = None
    event_details: Optional[str] = None
    
    collect_contact_info: Optional[bool] = None
    allow_comments: Optional[bool] = None
    anonymous: Optional[bool] = None
    
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[PollStatus] = None
    
    target_all_users: Optional[bool] = None
    target_usernames: Optional[List[str]] = None


class Poll(BaseModel):
    """Full poll model (from database)"""
    id: str = Field(alias="_id")
    title: str
    description: Optional[str] = None
    poll_type: PollType
    options: List[PollOption] = []
    
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    event_location: Optional[str] = None
    event_details: Optional[str] = None
    
    collect_contact_info: bool = True
    allow_comments: bool = True
    anonymous: bool = False
    
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: PollStatus = PollStatus.DRAFT
    
    target_all_users: bool = True
    target_usernames: List[str] = []
    
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Stats (populated when fetching)
    response_count: int = 0
    
    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None
        }


class PollResponseCreate(BaseModel):
    """Request model for submitting a poll response"""
    poll_id: str
    selected_options: List[str] = []  # Option IDs for choice-based polls
    rsvp_response: Optional[str] = None  # "yes", "no", "maybe" for RSVP
    text_response: Optional[str] = None  # For open text polls
    comment: Optional[str] = Field(None, max_length=1000)


class PollResponse(BaseModel):
    """Full poll response model (from database)"""
    id: str = Field(alias="_id")
    poll_id: str
    username: str
    
    # User info (collected at response time)
    user_full_name: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    
    # Response data
    selected_options: List[str] = []
    rsvp_response: Optional[str] = None
    text_response: Optional[str] = None
    comment: Optional[str] = None
    
    responded_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None
        }


class PollWithUserResponse(Poll):
    """Poll with user's response status"""
    user_has_responded: bool = False
    user_response: Optional[PollResponse] = None


class PollResultsSummary(BaseModel):
    """Summary of poll results (for admin)"""
    poll_id: str
    poll_title: str
    poll_type: PollType
    total_responses: int
    
    # For choice-based polls
    option_counts: Dict[str, int] = {}  # option_id -> count
    option_percentages: Dict[str, float] = {}  # option_id -> percentage
    
    # For RSVP polls
    rsvp_counts: Dict[str, int] = {}  # "yes"/"no"/"maybe" -> count
    
    # All responses (for admin view)
    responses: List[PollResponse] = []


class PollListResponse(BaseModel):
    """Response for listing polls"""
    polls: List[Poll]
    total: int
    page: int
    page_size: int
    has_more: bool
