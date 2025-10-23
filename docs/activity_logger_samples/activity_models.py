# fastapi_backend/models/activity_models.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class ActivityType(str, Enum):
    # Authentication
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    SESSION_EXPIRED = "session_expired"
    PASSWORD_CHANGED = "password_changed"
    FAILED_LOGIN = "failed_login"
    
    # Profile
    PROFILE_VIEWED = "profile_viewed"
    PROFILE_EDITED = "profile_edited"
    PHOTO_UPLOADED = "photo_uploaded"
    PHOTO_DELETED = "photo_deleted"
    PROFILE_VISIBILITY_CHANGED = "profile_visibility_changed"
    
    # Matching & Lists
    FAVORITE_ADDED = "favorite_added"
    FAVORITE_REMOVED = "favorite_removed"
    SHORTLIST_ADDED = "shortlist_added"
    SHORTLIST_REMOVED = "shortlist_removed"
    EXCLUSION_ADDED = "exclusion_added"
    TOP_MATCHES_VIEWED = "top_matches_viewed"
    L3V3L_MATCHES_VIEWED = "l3v3l_matches_viewed"
    
    # Messaging
    MESSAGE_SENT = "message_sent"
    MESSAGE_READ = "message_read"
    CONVERSATION_STARTED = "conversation_started"
    
    # Search
    SEARCH_PERFORMED = "search_performed"
    SEARCH_SAVED = "search_saved"
    FILTER_APPLIED = "filter_applied"
    
    # PII & Access
    PII_REQUEST_SENT = "pii_request_sent"
    PII_REQUEST_APPROVED = "pii_request_approved"
    PII_REQUEST_DENIED = "pii_request_denied"
    PII_ACCESS_REVOKED = "pii_access_revoked"
    IMAGE_ACCESS_REQUESTED = "image_access_requested"
    IMAGE_ACCESS_GRANTED = "image_access_granted"
    
    # Admin
    USER_STATUS_CHANGED = "user_status_changed"
    USER_DELETED = "user_deleted"
    ROLE_CHANGED = "role_changed"
    
    # System
    PAGE_VISITED = "page_visited"
    ERROR_OCCURRED = "error_occurred"

class ActivityLog(BaseModel):
    """Activity log entry"""
    id: Optional[str] = Field(None, alias="_id")
    username: str = Field(..., description="User who performed the action")
    action_type: ActivityType = Field(..., description="Type of activity")
    target_username: Optional[str] = Field(None, description="Target user (if applicable)")
    
    # Context data
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Action-specific data")
    ip_address: Optional[str] = Field(None, description="Masked IP address")
    user_agent: Optional[str] = Field(None, description="Browser/device info")
    page_url: Optional[str] = Field(None, description="Current page URL")
    referrer_url: Optional[str] = Field(None, description="Referrer URL")
    session_id: Optional[str] = Field(None, description="Session identifier")
    
    # Timing
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    duration_ms: Optional[int] = Field(None, description="Action duration in ms")
    
    # Privacy
    pii_logged: bool = Field(default=False, description="Contains PII data")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ActivityLogCreate(BaseModel):
    """Request model for creating activity log"""
    username: str
    action_type: ActivityType
    target_username: Optional[str] = None
    metadata: Dict[str, Any] = {}
    page_url: Optional[str] = None
    referrer_url: Optional[str] = None
    duration_ms: Optional[int] = None

class ActivityLogFilter(BaseModel):
    """Filter model for querying activity logs"""
    username: Optional[str] = None
    action_type: Optional[ActivityType] = None
    target_username: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    session_id: Optional[str] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=50, ge=1, le=100)

class ActivityStats(BaseModel):
    """Activity statistics"""
    total_activities: int
    unique_users: int
    top_actions: Dict[str, int]
    activity_by_hour: Dict[int, int]
    most_active_users: list
