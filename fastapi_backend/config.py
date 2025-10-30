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
    # Database Configuration
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "matrimonialDB"
    redis_url: Optional[str] = "redis://localhost:6379"
    
    # Authentication
    secret_key: str = "default_secret_key_for_testing"  # Default for testing
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Application URLs
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    app_url: Optional[str] = "http://localhost:3000"
    
    # Storage Configuration
    upload_dir: str = "uploads"
    use_gcs: bool = False  # Set to True in production
    gcs_bucket_name: Optional[str] = None
    gcs_project_id: Optional[str] = None
    
    # SMTP Email Configuration
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = "L3V3L Dating"
    
    # SMS Configuration (Twilio)
    sms_provider: Optional[str] = "twilio"
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
    
    # Logging Configuration
    log_level: Optional[str] = "INFO"
    log_file: Optional[str] = "logs/app.log"

    # Optional alternate connection strings for Cloud Run deployments
    gcp_mongodb_url: Optional[str] = None
    gcp_redis_url: Optional[str] = None

<<<<<<< HEAD
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"  # Ignore extra fields in .env
    )
=======
    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = 'utf-8'
        case_sensitive = False
>>>>>>> dev

settings = Settings()
