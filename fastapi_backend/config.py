# fastapi_backend/config.py
from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path

# Get the directory where this config file is located
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "matrimonialDB"
    secret_key: str = "default_secret_key_for_testing"  # Default for testing
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    upload_dir: str = "uploads"
    
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
    
    # App Configuration
    app_url: Optional[str] = "http://localhost:3000"
    
    # Google Cloud Storage Configuration
    gcs_bucket_name: Optional[str] = None
    gcs_project_id: Optional[str] = None
    use_gcs: bool = False  # Set to True in production

    # Optional alternate connection strings for Cloud Run deployments
    gcp_mongodb_url: Optional[str] = None
    gcp_redis_url: Optional[str] = None

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = 'utf-8'
        case_sensitive = False

settings = Settings()
