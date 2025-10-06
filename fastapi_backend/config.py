# fastapi_backend/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "matrimonialDB"
    secret_key: str = "default_secret_key_for_testing"  # Default for testing
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    upload_dir: str = "uploads"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
