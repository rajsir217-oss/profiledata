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
    
    # Firebase Configuration
    # Check backend Firebase admin credentials (for server-side push notifications)
    firebase_project = os.getenv("FIREBASE_PROJECT_ID")
    firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY")
    firebase_client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    
    # Backend is configured if all required credentials are present
    firebase_backend_configured = bool(firebase_project and firebase_private_key and firebase_client_email)
    
    if firebase_backend_configured:
        status_text = "Backend configured (server-side push)"
        note = "Note: Browser push notifications configured separately in frontend"
    else:
        status_text = "Backend not configured"
        note = "Check browser console for frontend Firebase status"
    
    health_data["services"]["firebase"] = {
        "configured": firebase_backend_configured,
        "details": f"{status_text}. {note}"
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
