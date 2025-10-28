# fastapi_backend/routers/system_health.py
from fastapi import APIRouter, Depends
from datetime import datetime
import os
import time
from database import get_database
from redis_manager import redis_manager, redis_host, redis_port
from config import settings, current_env
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Store startup time
startup_time = time.time()

@router.get("/health")
async def get_system_health(db = Depends(get_database)):
    """Get system health status for all backend services"""
    
    health_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "environment": current_env or os.getenv("APP_ENVIRONMENT", "local"),
        "backend_url": settings.backend_url,
        "version": "1.0.0",
        "uptime": format_uptime(time.time() - startup_time),
        "services": {}
    }
    
    # MongoDB Health
    try:
        await db.command('ping')
        mongo_details = f"{settings.mongodb_url.split('@')[-1]}" if '@' in settings.mongodb_url else settings.mongodb_url
        health_data["services"]["mongodb"] = {
            "healthy": True,
            "details": mongo_details
        }
    except Exception as e:
        logger.error(f"MongoDB health check failed: {e}")
        health_data["services"]["mongodb"] = {
            "healthy": False,
            "details": str(e)
        }
    
    # Redis Health
    try:
        # Check if Redis client exists and can ping
        redis_healthy = False
        if redis_manager.redis_client:
            redis_healthy = redis_manager.redis_client.ping()
        
        health_data["services"]["redis"] = {
            "healthy": redis_healthy,
            "details": f"{redis_host}:{redis_port}"
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        health_data["services"]["redis"] = {
            "healthy": False,
            "details": str(e)
        }
    
    # Firebase Configuration (frontend only)
    # Backend cannot check frontend env vars, so report based on backend env
    # Check if Firebase admin credentials exist (for backend push notifications)
    firebase_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    firebase_project = os.getenv("FIREBASE_PROJECT_ID")
    
    firebase_configured = bool(firebase_creds or firebase_project)
    
    health_data["services"]["firebase"] = {
        "configured": firebase_configured,
        "details": "Push notifications (backend)" if firebase_configured else "Not configured - check browser console for frontend status"
    }
    
    # Storage Type
    health_data["services"]["storage"] = {
        "type": "gcs" if settings.use_gcs else "local",
        "details": settings.gcs_bucket_name if settings.use_gcs else "uploads/"
    }
    
    return health_data

def format_uptime(seconds):
    """Format uptime in human-readable format"""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    
    return " ".join(parts) if parts else "< 1m"
