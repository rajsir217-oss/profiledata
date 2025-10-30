"""
Notification System Models
Dating App Communication & Notification Module
"""

from datetime import datetime, time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class NotificationChannel(str, Enum):
    """Available notification channels"""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"


class NotificationPriority(str, Enum):
    """Notification priority levels"""
    CRITICAL = "critical"  # Always send, bypass quiet hours
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class NotificationTrigger(str, Enum):
    """Dating app notification triggers"""
    # Profile lifecycle
    NEW_PROFILE_CREATED = "new_profile_created"
    
    # Match-related
    NEW_MATCH = "new_match"
    MUTUAL_FAVORITE = "mutual_favorite"
    SHORTLIST_ADDED = "shortlist_added"
    MATCH_MILESTONE = "match_milestone"
    
    # Profile activity
    PROFILE_VIEW = "profile_view"
    FAVORITED = "favorited"
    PROFILE_VISIBILITY_SPIKE = "profile_visibility_spike"
    SEARCH_APPEARANCE = "search_appearance"
    
    # Messaging
    NEW_MESSAGE = "new_message"
    MESSAGE_READ = "message_read"
    CONVERSATION_COLD = "conversation_cold"
    
    # Privacy/PII
    PII_REQUEST = "pii_request"
    PII_GRANTED = "pii_granted"
    PII_DENIED = "pii_denied"
    PII_EXPIRING = "pii_expiring"
    SUSPICIOUS_LOGIN = "suspicious_login"
    
    # Engagement
    UNREAD_MESSAGES = "unread_messages"
    NEW_USERS_MATCHING = "new_users_matching"
    PROFILE_INCOMPLETE = "profile_incomplete"
    UPLOAD_PHOTOS = "upload_photos"
    
    # Digest emails
    WEEKLY_DIGEST = "weekly_digest"
    MONTHLY_DIGEST = "monthly_digest"


class FrequencyType(str, Enum):
    """Notification frequency options"""
    INSTANT = "instant"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"


class NotificationStatus(str, Enum):
    """Notification processing status"""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ============================================
# Notification Preferences Models
# ============================================

class QuietHours(BaseModel):
    """User quiet hours configuration"""
    enabled: bool = True
    start: str = Field(..., description="Time in HH:MM format (24h)")
    end: str = Field(..., description="Time in HH:MM format (24h)")
    timezone: str = Field(default="UTC", description="User timezone")
    exceptions: List[NotificationTrigger] = Field(
        default=[NotificationTrigger.PII_REQUEST, NotificationTrigger.SUSPICIOUS_LOGIN],
        description="Triggers that bypass quiet hours"
    )
    
    @validator('start', 'end')
    def validate_time_format(cls, v):
        """Validate time format"""
        try:
            time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError('Time must be in HH:MM format')


class RateLimit(BaseModel):
    """Rate limiting configuration"""
    max: int = Field(..., gt=0, description="Maximum notifications")
    period: str = Field(..., description="Time period: hourly, daily, weekly")


class SMSOptimization(BaseModel):
    """SMS cost optimization settings"""
    verifiedUsersOnly: bool = Field(
        default=True,
        description="Only send SMS for verified users"
    )
    minimumMatchScore: int = Field(
        default=80,
        ge=0,
        le=100,
        description="Minimum match score for SMS notifications"
    )
    priorityTriggersOnly: bool = Field(
        default=True,
        description="Only send SMS for high-priority triggers"
    )


class NotificationPreferences(BaseModel):
    """User notification preferences"""
    username: str = Field(..., description="User username")
    
    # Channel preferences per trigger
    channels: Dict[NotificationTrigger, List[NotificationChannel]] = Field(
        default_factory=dict,
        description="Notification channels per trigger type"
    )
    
    # Frequency control
    frequency: Dict[str, Any] = Field(
        default_factory=dict,
        description="Notification frequency settings"
    )
    
    # Quiet hours
    quietHours: QuietHours = Field(
        default_factory=lambda: QuietHours(
            enabled=True,
            start="22:00",
            end="08:00",
            timezone="UTC"
        )
    )
    
    # Rate limiting
    rateLimit: Dict[NotificationChannel, RateLimit] = Field(
        default_factory=lambda: {
            NotificationChannel.SMS: RateLimit(max=5, period="daily"),
            NotificationChannel.EMAIL: RateLimit(max=20, period="daily")
        }
    )
    
    # SMS optimization
    smsOptimization: SMSOptimization = Field(default_factory=SMSOptimization)
    
    # Engagement metrics
    engagement: Dict[str, Any] = Field(
        default_factory=lambda: {
            "emailOpenRate": 0.0,
            "emailClickRate": 0.0,
            "smsClickRate": 0.0,
            "lastEngagement": None
        }
    )
    
    # Metadata
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True


class NotificationPreferencesUpdate(BaseModel):
    """Update notification preferences"""
    channels: Optional[Dict[str, List[str]]] = None
    frequency: Optional[Dict[str, Any]] = None
    quietHours: Optional[QuietHours] = None
    rateLimit: Optional[Dict[str, RateLimit]] = None
    smsOptimization: Optional[SMSOptimization] = None


# ============================================
# Notification Queue Models
# ============================================

class NotificationQueueItem(BaseModel):
    """Item in notification queue"""
    id: Optional[str] = Field(None, alias="_id", description="Notification ID")
    username: str = Field(..., description="Recipient username")
    trigger: NotificationTrigger = Field(..., description="Notification trigger type")
    priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM)
    channels: List[NotificationChannel] = Field(..., description="Delivery channels")
    
    # Template data for variable substitution
    templateData: Dict[str, Any] = Field(
        default_factory=dict,
        description="Data for template variable substitution"
    )
    
    # Processing info
    status: NotificationStatus = Field(default=NotificationStatus.PENDING)
    scheduledFor: Optional[datetime] = Field(
        None,
        description="When to send (for batching/quiet hours)"
    )
    attempts: int = Field(default=0, description="Delivery attempts")
    lastAttempt: Optional[datetime] = None
    error: Optional[str] = None
    
    # Metadata
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True
        populate_by_name = True


class NotificationQueueCreate(BaseModel):
    """Create notification queue item"""
    username: str
    trigger: NotificationTrigger
    priority: NotificationPriority = NotificationPriority.MEDIUM
    channels: List[NotificationChannel]
    templateData: Dict[str, Any] = {}
    scheduledFor: Optional[datetime] = None


# ============================================
# Notification Log Models
# ============================================

class NotificationLog(BaseModel):
    """Log of sent notifications for analytics"""
    username: str = Field(..., description="Recipient username")
    trigger: NotificationTrigger = Field(..., description="Trigger type")
    channel: NotificationChannel = Field(..., description="Delivery channel")
    priority: NotificationPriority
    status: NotificationStatus = Field(default=NotificationStatus.SENT, description="Final delivery status")
    
    # Timing
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    sentAt: Optional[datetime] = None
    deliveredAt: Optional[datetime] = None
    openedAt: Optional[datetime] = None
    clickedAt: Optional[datetime] = None
    
    # Cost tracking (especially for SMS)
    cost: float = Field(default=0.0, description="Cost in USD")
    
    # Engagement
    opened: bool = Field(default=False)
    clicked: bool = Field(default=False)
    unsubscribed: bool = Field(default=False)
    
    # Content
    subject: Optional[str] = None
    preview: Optional[str] = Field(None, description="First 100 chars of content")
    
    # A/B testing
    abTestId: Optional[str] = None
    abTestVariant: Optional[str] = None
    
    class Config:
        use_enum_values = True


# ============================================
# Template Models
# ============================================

class NotificationTemplate(BaseModel):
    """Notification template definition"""
    templateId: str = Field(..., description="Unique template identifier")
    trigger: NotificationTrigger
    channel: NotificationChannel
    
    # Template content
    subject: Optional[str] = Field(None, description="Email subject or SMS preview")
    bodyTemplate: str = Field(..., description="Template with {variable} placeholders")
    
    # Configuration
    maxLength: Optional[int] = Field(None, description="Max length (for SMS)")
    priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM)
    
    # Conditions
    conditions: Dict[str, Any] = Field(
        default_factory=dict,
        description="Conditions for sending"
    )
    
    # A/B testing
    abTestVariants: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Metadata
    active: bool = Field(default=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True


class NotificationTemplateCreate(BaseModel):
    """Create notification template"""
    templateId: str
    trigger: NotificationTrigger
    channel: NotificationChannel
    subject: Optional[str] = None
    bodyTemplate: str
    maxLength: Optional[int] = None
    priority: NotificationPriority = NotificationPriority.MEDIUM
    conditions: Dict[str, Any] = {}
    active: bool = True


# ============================================
# Analytics Models
# ============================================

class NotificationAnalytics(BaseModel):
    """Notification analytics summary"""
    username: Optional[str] = None  # None for global stats
    trigger: Optional[NotificationTrigger] = None
    channel: Optional[NotificationChannel] = None
    
    # Date range
    startDate: datetime
    endDate: datetime
    
    # Queue Metrics (for Event Queue Manager)
    queued: int = 0
    processing: int = 0
    success_24h: int = 0
    failed_24h: int = 0
    
    # Metrics
    totalSent: int = 0
    totalDelivered: int = 0
    totalOpened: int = 0
    totalClicked: int = 0
    totalUnsubscribed: int = 0
    totalFailed: int = 0
    
    # Rates
    deliveryRate: float = 0.0
    openRate: float = 0.0
    clickRate: float = 0.0
    
    # Cost
    totalCost: float = 0.0
    avgCostPerNotification: float = 0.0
    
    class Config:
        use_enum_values = True


# ============================================
# API Response Models
# ============================================

class NotificationResponse(BaseModel):
    """Standard notification API response"""
    success: bool
    message: str
    data: Optional[Any] = None
    error: Optional[str] = None


# ============================================
# Scheduled Notification Models
# ============================================

class ScheduleType(str, Enum):
    """Type of notification schedule"""
    ONE_TIME = "one_time"      # Send once at specific date/time
    RECURRING = "recurring"     # Send on recurring schedule


class RecurrencePattern(str, Enum):
    """Recurring schedule patterns"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"  # Custom cron expression


class RecipientType(str, Enum):
    """Type of recipients for scheduled notification"""
    ALL_USERS = "all_users"
    ACTIVE_USERS = "active_users"
    SPECIFIC_SEGMENT = "specific_segment"
    TEST = "test"  # Admin only


class ScheduledNotification(BaseModel):
    """Scheduled notification definition"""
    id: Optional[str] = Field(None, alias="_id")
    
    # Template info
    templateId: str = Field(..., description="Template to use")
    trigger: NotificationTrigger
    channel: NotificationChannel
    
    # Schedule configuration
    scheduleType: ScheduleType
    scheduledFor: Optional[datetime] = Field(None, description="One-time send datetime")
    recurrencePattern: Optional[RecurrencePattern] = Field(None)
    cronExpression: Optional[str] = Field(None, description="For custom recurring")
    timezone: str = Field(default="UTC")
    
    # Recipient configuration
    recipientType: RecipientType = RecipientType.ACTIVE_USERS
    recipientSegment: Optional[Dict[str, Any]] = Field(None, description="Filter for specific segment")
    maxRecipients: int = Field(default=0, description="0 = unlimited")
    
    # Template data overrides
    templateData: Dict[str, Any] = Field(default_factory=dict)
    
    # Status
    enabled: bool = Field(default=True)
    lastRun: Optional[datetime] = None
    nextRun: Optional[datetime] = None
    runCount: int = Field(default=0)
    
    # Metadata
    createdBy: str = Field(..., description="Admin username")
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True
        populate_by_name = True


class ScheduledNotificationCreate(BaseModel):
    """Create scheduled notification"""
    templateId: str
    trigger: NotificationTrigger
    channel: NotificationChannel
    scheduleType: ScheduleType
    scheduledFor: Optional[datetime] = None
    recurrencePattern: Optional[RecurrencePattern] = None
    cronExpression: Optional[str] = None
    timezone: str = "UTC"
    recipientType: RecipientType = RecipientType.ACTIVE_USERS
    recipientSegment: Optional[Dict[str, Any]] = None
    maxRecipients: int = 0
    templateData: Dict[str, Any] = {}
    enabled: bool = True
    
    class Config:
        use_enum_values = True


class ScheduledNotificationUpdate(BaseModel):
    """Update scheduled notification"""
    scheduledFor: Optional[datetime] = None
    recurrencePattern: Optional[RecurrencePattern] = None
    cronExpression: Optional[str] = None
    timezone: Optional[str] = None
    recipientType: Optional[RecipientType] = None
    recipientSegment: Optional[Dict[str, Any]] = None
    maxRecipients: Optional[int] = None
    templateData: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None
    
    class Config:
        use_enum_values = True
