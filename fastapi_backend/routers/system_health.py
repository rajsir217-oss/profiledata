# fastapi_backend/routers/system_health.py
from fastapi import APIRouter, Depends
from datetime import datetime
import os
import time
from database import get_database
from redis_manager import redis_manager
from config import settings
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
        "environment": settings.app_environment,
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
        redis_healthy = redis_manager.ping()
        health_data["services"]["redis"] = {
            "healthy": redis_healthy,
            "details": f"{settings.redis_host}:{settings.redis_port}"
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        health_data["services"]["redis"] = {
            "healthy": False,
            "details": str(e)
        }
    
    # Firebase Configuration (frontend only, check if configured)
    # Backend doesn't use Firebase directly, so we just report if it's expected
    health_data["services"]["firebase"] = {
        "configured": True,  # Assuming configured if in production
        "details": "Push notifications"
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
