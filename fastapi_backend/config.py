# fastapi_backend/config.py
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional
import os
from pathlib import Path
from env_config import EnvironmentManager

# Auto-detect and load the right environment configuration
env_manager = EnvironmentManager()
current_env = env_manager.detect_environment()
env_manager.load_environment_config(current_env)

# Get the directory where this config file is located
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    # Environment
    env: str = "development"  # Options: "development", "production", "testing"
    
    # Database Configuration
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "matrimonialDB"
    redis_url: Optional[str] = "redis://localhost:6379"
    
    # Authentication
    secret_key: str = "default_secret_key_for_testing"  # Default for testing
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15  # Short-lived, refreshed automatically by session manager
    
    # Cloudflare Turnstile (CAPTCHA - 100% Free)
    turnstile_secret_key: str = ""
    
    # PII Encryption (Fernet symmetric encryption for data at rest)
    encryption_key: Optional[str] = None  # Generate with: python crypto_utils.py
    
    # Application URLs
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    app_url: Optional[str] = "http://localhost:3000"
    
    # Storage Configuration
    upload_dir: str = "uploads"
    use_gcs: bool = False  # Set to True in production
    gcs_bucket_name: Optional[str] = None
    gcs_project_id: Optional[str] = None
    
    # Email Configuration
    email_provider: Optional[str] = "resend"  # Options: "resend", "smtp"
    
    # Resend API (Recommended - 3k emails/month free)
    resend_api_key: Optional[str] = None
    
    # SMTP Email Configuration (Legacy/Backup)
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = "L3V3L MATCHES"
    reply_to_email: Optional[str] = None  # If set, adds Reply-To header (use for no-reply)
    
    # SMS Configuration
    sms_provider: Optional[str] = "twilio"  # Options: "simpletexting", "twilio", "auto"
    
    # SimpleTexting API
    simpletexting_api_token: Optional[str] = None
    simpletexting_account_phone: Optional[str] = None
    
    # Twilio API
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_from_phone: Optional[str] = None
    
    # Firebase Push Notifications (FCM)
    firebase_project_id: Optional[str] = None
    firebase_private_key_id: Optional[str] = None
    firebase_private_key: Optional[str] = None
    firebase_client_email: Optional[str] = None
    firebase_client_id: Optional[str] = None
    firebase_cert_url: Optional[str] = None
    
    # Feature Flags
    enable_notifications: Optional[bool] = True
    enable_scheduler: Optional[bool] = True
    enable_websockets: Optional[bool] = True
    debug_mode: Optional[bool] = False
    
    # ==========================================================================
    # PROFILE PICTURE VISIBILITY SETTING
    # ==========================================================================
    # 
    # When enabled (True): The profile picture (first image, index 0) is ALWAYS
    # visible to all logged-in members, regardless of the user's publicImages
    # settings or PII access grants. This follows industry standard practice
    # for matrimonial/dating platforms where users expect to see at least one
    # photo before engaging with a profile.
    #
    # When disabled (False): The profile picture follows the same privacy rules
    # as all other images - it will only be visible if:
    #   1. It's in the user's publicImages array, OR
    #   2. The viewer has been granted PII access to images
    #
    # INDUSTRY CONTEXT:
    # - Shaadi.com, BharatMatrimony, Jeevansathi: Profile photo always visible
    # - Dating apps (Tinder, Hinge, Bumble): All photos visible
    # - This setting provides flexibility to match your platform's privacy policy
    #
    # TO CHANGE THIS SETTING:
    # Option 1: Set in .env file: PROFILE_PICTURE_ALWAYS_VISIBLE=false
    # Option 2: Change the default value below
    #
    # AFFECTED CODE LOCATIONS:
    # - Backend: routes.py -> check_images_access() endpoint
    # - Backend: routes.py -> _has_images_access() function
    # - Frontend: Profile.js -> loadAccessibleImages() (reads from API response)
    #
    # ==========================================================================
    profile_picture_always_visible: Optional[bool] = True
    
    # AI Services (Free Tier Options)
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    ai_provider: Optional[str] = "groq"  # "gemini" or "groq"
    
    # Stripe Payment Configuration
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    
    # Logging Configuration
    log_level: Optional[str] = "INFO"
    log_file: Optional[str] = "logs/app.log"

    # Optional alternate connection strings for Cloud Run deployments
    gcp_mongodb_url: Optional[str] = None
    gcp_redis_url: Optional[str] = None

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"  # Ignore extra fields in .env
    )

settings = Settings()
