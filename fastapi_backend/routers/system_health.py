# fastapi_backend/routers/system_health.py
from fastapi import APIRouter, Depends
from datetime import datetime
import os
import time
from database import get_database
from redis_manager import redis_manager, redis_host, redis_port
from config import settings, current_env
from crypto_utils import get_encryptor
import logging

# Import build info
try:
    from build_info import get_build_info
except ImportError:
    def get_build_info():
        return {
            'buildTime': 'unknown',
            'buildDate': 'unknown',
            'version': '1.0.0',
            'environment': 'unknown'
        }

logger = logging.getLogger(__name__)

router = APIRouter()

# Store startup time
startup_time = time.time()

@router.get("/health")
async def get_system_health(db = Depends(get_database)):
    """Get system health status for all backend services"""
    
    # Get build information
    build_info = get_build_info()
    
    health_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "environment": current_env or os.getenv("APP_ENVIRONMENT", "local"),
        "backend_url": settings.backend_url,
        "version": build_info.get('version', '1.0.0'),
        "uptime": format_uptime(time.time() - startup_time),
        "buildInfo": build_info,
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


@router.get("/health/encryption")
async def get_encryption_health():
    """
    Check PII encryption configuration and health
    
    Returns encryption status, configuration, and test results
    """
    health_status = {
        "timestamp": datetime.utcnow().isoformat(),
        "encryption_enabled": False,
        "configuration": {},
        "test_results": {},
        "warnings": []
    }
    
    # Check if encryption key is configured
    encryption_key = settings.encryption_key
    
    if not encryption_key:
        health_status["encryption_enabled"] = False
        health_status["warnings"].append("ENCRYPTION_KEY not configured - PII data is NOT encrypted!")
        health_status["configuration"]["status"] = "disabled"
        return health_status
    
    health_status["encryption_enabled"] = True
    health_status["configuration"]["status"] = "enabled"
    health_status["configuration"]["key_length"] = len(encryption_key)
    health_status["configuration"]["key_prefix"] = encryption_key[:10] + "..." if len(encryption_key) > 10 else "***"
    
    # Test encryption/decryption
    try:
        encryptor = get_encryptor()
        
        # Test data
        test_data = "test@example.com"
        
        # Encrypt
        encrypted = encryptor.encrypt(test_data)
        health_status["test_results"]["encryption"] = "success"
        health_status["test_results"]["encrypted_format"] = encrypted[:20] + "..." if len(encrypted) > 20 else encrypted
        
        # Decrypt
        decrypted = encryptor.decrypt(encrypted)
        health_status["test_results"]["decryption"] = "success"
        
        # Verify round-trip
        if decrypted == test_data:
            health_status["test_results"]["round_trip"] = "success"
            health_status["test_results"]["overall_status"] = "healthy"
        else:
            health_status["test_results"]["round_trip"] = "failed"
            health_status["test_results"]["overall_status"] = "unhealthy"
            health_status["warnings"].append("Round-trip encryption test failed!")
        
        # Check encrypted fields configuration
        encrypted_fields = list(encryptor.ENCRYPTED_FIELDS)
        health_status["configuration"]["encrypted_fields"] = encrypted_fields
        health_status["configuration"]["field_count"] = len(encrypted_fields)
        
    except Exception as e:
        health_status["test_results"]["overall_status"] = "error"
        health_status["test_results"]["error"] = str(e)
        health_status["warnings"].append(f"Encryption test failed: {e}")
        logger.error(f"Encryption health check failed: {e}", exc_info=True)
    
    # Recommendations
    if health_status["encryption_enabled"]:
        health_status["recommendations"] = [
            "✅ Encryption is enabled and working",
            "🔐 Ensure encryption key is backed up securely",
            "📊 Monitor decryption errors in application logs",
            "🔄 Schedule key rotation every 6-12 months"
        ]
    else:
        health_status["recommendations"] = [
            "❌ Enable encryption immediately for production!",
            "🔑 Generate encryption key: python crypto_utils.py",
            "📝 Add to .env: ENCRYPTION_KEY=<generated-key>",
            "🔄 Run migration: python migrations/encrypt_existing_pii.py"
        ]
    
    return health_status


@router.get("/health/encryption/verify-database")
async def verify_database_encryption(db = Depends(get_database)):
    """
    Verify that database PII is actually encrypted (admin only - check in production)
    
    Samples 5 users and checks if their PII fields are encrypted
    """
    verification_result = {
        "timestamp": datetime.utcnow().isoformat(),
        "sampled_users": 0,
        "encrypted_count": 0,
        "unencrypted_count": 0,
        "details": [],
        "overall_status": "unknown"
    }
    
    # Check if encryption is enabled
    if not settings.encryption_key:
        verification_result["overall_status"] = "disabled"
        verification_result["error"] = "Encryption not configured"
        return verification_result
    
    try:
        encryptor = get_encryptor()
        encrypted_fields = list(encryptor.ENCRYPTED_FIELDS)
        
        # Sample 5 users
        users = await db.users.find({}).limit(5).to_list(length=5)
        verification_result["sampled_users"] = len(users)
        
        if not users:
            verification_result["overall_status"] = "no_data"
            return verification_result
        
        all_encrypted = True
        
        for user in users:
            username = user.get('username', 'unknown')
            user_status = {
                "username": username,
                "fields_checked": [],
                "encrypted": True
            }
            
            for field in encrypted_fields:
                if field in user and user[field]:
                    is_encrypted = encryptor.is_encrypted(user[field])
                    user_status["fields_checked"].append({
                        "field": field,
                        "encrypted": is_encrypted,
                        "sample": user[field][:20] + "..." if len(user[field]) > 20 else user[field]
                    })
                    
                    if not is_encrypted:
                        user_status["encrypted"] = False
                        all_encrypted = False
            
            if user_status["encrypted"]:
                verification_result["encrypted_count"] += 1
            else:
                verification_result["unencrypted_count"] += 1
            
            verification_result["details"].append(user_status)
        
        if all_encrypted:
            verification_result["overall_status"] = "fully_encrypted"
            verification_result["message"] = "✅ All sampled users have encrypted PII"
        else:
            verification_result["overall_status"] = "partially_encrypted"
            verification_result["message"] = "⚠️ Some users have unencrypted PII - run migration!"
    
    except Exception as e:
        verification_result["overall_status"] = "error"
        verification_result["error"] = str(e)
        logger.error(f"Database encryption verification failed: {e}", exc_info=True)
    
    return verification_result


@router.get("/health/storage")
async def get_storage_stats(db = Depends(get_database)):
    """
    Get MongoDB storage statistics by collection.
    Useful for monitoring free tier limits (512MB for M0).
    """
    storage_stats = {
        "timestamp": datetime.utcnow().isoformat(),
        "database": "matrimonialDB",
        "freeTierLimit": 512 * 1024 * 1024,  # 512MB in bytes
        "freeTierLimitFormatted": "512 MB",
        "collections": [],
        "totalSize": 0,
        "totalDocuments": 0,
        "recommendations": []
    }
    
    try:
        # Get database stats
        db_stats = await db.command("dbStats")
        storage_stats["totalSize"] = db_stats.get("dataSize", 0) + db_stats.get("indexSize", 0)
        storage_stats["dataSize"] = db_stats.get("dataSize", 0)
        storage_stats["indexSize"] = db_stats.get("indexSize", 0)
        storage_stats["storageSize"] = db_stats.get("storageSize", 0)
        
        # Calculate usage percentage
        usage_percent = (storage_stats["totalSize"] / storage_stats["freeTierLimit"]) * 100
        storage_stats["usagePercent"] = round(usage_percent, 2)
        storage_stats["totalSizeFormatted"] = format_bytes(storage_stats["totalSize"])
        storage_stats["dataSizeFormatted"] = format_bytes(storage_stats["dataSize"])
        storage_stats["indexSizeFormatted"] = format_bytes(storage_stats["indexSize"])
        
        # Get collection names
        collection_names = await db.list_collection_names()
        
        # Get stats for each collection
        for coll_name in sorted(collection_names):
            try:
                coll_stats = await db.command("collStats", coll_name)
                doc_count = coll_stats.get("count", 0)
                data_size = coll_stats.get("size", 0)
                index_size = coll_stats.get("totalIndexSize", 0)
                total_size = data_size + index_size
                avg_doc_size = coll_stats.get("avgObjSize", 0)
                
                storage_stats["collections"].append({
                    "name": coll_name,
                    "documents": doc_count,
                    "dataSize": data_size,
                    "dataSizeFormatted": format_bytes(data_size),
                    "indexSize": index_size,
                    "indexSizeFormatted": format_bytes(index_size),
                    "totalSize": total_size,
                    "totalSizeFormatted": format_bytes(total_size),
                    "avgDocSize": avg_doc_size,
                    "avgDocSizeFormatted": format_bytes(avg_doc_size),
                    "percentOfTotal": round((total_size / storage_stats["totalSize"] * 100), 2) if storage_stats["totalSize"] > 0 else 0
                })
                storage_stats["totalDocuments"] += doc_count
            except Exception as e:
                logger.warning(f"Could not get stats for collection {coll_name}: {e}")
        
        # Sort by size descending
        storage_stats["collections"].sort(key=lambda x: x["totalSize"], reverse=True)
        
        # Generate recommendations
        storage_stats["recommendations"] = generate_storage_recommendations(storage_stats)
        
        # Status indicator
        if usage_percent < 50:
            storage_stats["status"] = "healthy"
            storage_stats["statusColor"] = "green"
        elif usage_percent < 75:
            storage_stats["status"] = "warning"
            storage_stats["statusColor"] = "yellow"
        elif usage_percent < 90:
            storage_stats["status"] = "critical"
            storage_stats["statusColor"] = "orange"
        else:
            storage_stats["status"] = "danger"
            storage_stats["statusColor"] = "red"
        
    except Exception as e:
        logger.error(f"Failed to get storage stats: {e}", exc_info=True)
        storage_stats["error"] = str(e)
        storage_stats["status"] = "error"
    
    return storage_stats


def format_bytes(size_bytes):
    """Format bytes into human-readable format"""
    if size_bytes == 0:
        return "0 B"
    
    units = ["B", "KB", "MB", "GB"]
    unit_index = 0
    size = float(size_bytes)
    
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    
    return f"{size:.2f} {units[unit_index]}"


def generate_storage_recommendations(stats):
    """Generate optimization recommendations based on storage stats"""
    recommendations = []
    collections = stats.get("collections", [])
    usage_percent = stats.get("usagePercent", 0)
    
    # Check for specific collections that can be optimized
    for coll in collections:
        name = coll["name"]
        size_mb = coll["totalSize"] / (1024 * 1024)
        
        # L3V3L scores - can be rebuilt on demand
        if name == "l3v3l_scores" and size_mb > 20:
            recommendations.append({
                "collection": name,
                "priority": "high",
                "issue": f"L3V3L scores taking {coll['totalSizeFormatted']}",
                "action": "Consider purging old scores or reducing calculation frequency",
                "command": "db.l3v3l_scores.deleteMany({ calculatedAt: { $lt: ISODate('30 days ago') } })"
            })
        
        # Notification queue - should be cleaned after processing
        if name == "notification_queue" and coll["documents"] > 1000:
            recommendations.append({
                "collection": name,
                "priority": "medium",
                "issue": f"{coll['documents']} items in notification queue",
                "action": "Clean up sent/failed notifications older than 7 days",
                "command": "db.notification_queue.deleteMany({ status: { $in: ['sent', 'failed'] }, updatedAt: { $lt: ISODate('7 days ago') } })"
            })
        
        # Notification log - archive or delete old logs
        if name == "notification_log" and size_mb > 10:
            recommendations.append({
                "collection": name,
                "priority": "medium",
                "issue": f"Notification logs taking {coll['totalSizeFormatted']}",
                "action": "Archive or delete logs older than 30 days",
                "command": "db.notification_log.deleteMany({ sentAt: { $lt: ISODate('30 days ago') } })"
            })
        
        # Activity logs - can grow large
        if name == "activity_logs" and size_mb > 20:
            recommendations.append({
                "collection": name,
                "priority": "medium",
                "issue": f"Activity logs taking {coll['totalSizeFormatted']}",
                "action": "Archive or delete logs older than 90 days",
                "command": "db.activity_logs.deleteMany({ timestamp: { $lt: ISODate('90 days ago') } })"
            })
        
        # Profile views - can be aggregated
        if name == "profile_views" and size_mb > 30:
            recommendations.append({
                "collection": name,
                "priority": "low",
                "issue": f"Profile views taking {coll['totalSizeFormatted']}",
                "action": "Consider aggregating old views into daily summaries",
                "command": "Archive views older than 30 days"
            })
        
        # Job execution history
        if name == "job_execution_history" and size_mb > 10:
            recommendations.append({
                "collection": name,
                "priority": "medium",
                "issue": f"Job history taking {coll['totalSizeFormatted']}",
                "action": "Delete old job execution records",
                "command": "db.job_execution_history.deleteMany({ startTime: { $lt: ISODate('30 days ago') } })"
            })
        
        # Weekly user stats - temporary data
        if name == "weekly_user_stats" and size_mb > 5:
            recommendations.append({
                "collection": name,
                "priority": "low",
                "issue": f"Weekly stats taking {coll['totalSizeFormatted']}",
                "action": "Delete stats older than 3 months",
                "command": "db.weekly_user_stats.deleteMany({ month: { $lt: '2025-10' } })"
            })
    
    # General recommendations based on usage
    if usage_percent > 75:
        recommendations.insert(0, {
            "collection": "ALL",
            "priority": "critical",
            "issue": f"Storage at {usage_percent:.1f}% capacity!",
            "action": "Immediate cleanup required to avoid hitting free tier limit",
            "command": "Review and clean large collections"
        })
    elif usage_percent > 50:
        recommendations.insert(0, {
            "collection": "ALL",
            "priority": "warning",
            "issue": f"Storage at {usage_percent:.1f}% capacity",
            "action": "Plan cleanup to maintain headroom",
            "command": "Schedule regular cleanup jobs"
        })
    
    return recommendations
