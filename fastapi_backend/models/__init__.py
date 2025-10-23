# fastapi_backend/models/__init__.py
"""
Models package - consolidates all model definitions
"""

# Import all user/core models from user_models.py
from .user_models import (
    PyObjectId,
    UserBase,
    UserCreate,
    UserInDB,
    UserResponse,
    Token,
    TokenData,
    LoginRequest,
    PiiRequest,
    Favorite,
    Shortlist,
    Exclusion,
    Message,
    MessageCreate,
    ConversationResponse,
    ProfileView,
    ProfileViewCreate,
    PIIRequestType,
    PIIRequestStatus,
    PIIRequest,
    PIIRequestCreate,
    PIIRequestResponse,
    PIIRequestApprove,
    PIIRequestReject,
    PIIAccess,
    PIIAccessCreate,
    UserPreferencesUpdate,
    UserPreferencesResponse,
    TestimonialCreate,
    TestimonialResponse
)

# Notification models are available via:
# from models.notification_models import ...

__all__ = [
    # Core
    'PyObjectId',
    
    # User models
    'UserBase',
    'UserCreate',
    'UserInDB',
    'UserResponse',
    
    # Auth
    'Token',
    'TokenData',
    'LoginRequest',
    
    # Legacy PII (for backward compatibility)
    'PiiRequest',
    
    # User interactions
    'Favorite',
    'Shortlist',
    'Exclusion',
    
    # Messages
    'Message',
    'MessageCreate',
    'ConversationResponse',
    
    # Profile views
    'ProfileView',
    'ProfileViewCreate',
    
    # PII Access
    'PIIRequestType',
    'PIIRequestStatus',
    'PIIRequest',
    'PIIRequestCreate',
    'PIIRequestResponse',
    'PIIRequestApprove',
    'PIIRequestReject',
    'PIIAccess',
    'PIIAccessCreate',
    
    # User preferences
    'UserPreferencesUpdate',
    'UserPreferencesResponse',
    
    # Testimonials
    'TestimonialCreate',
    'TestimonialResponse'
]
