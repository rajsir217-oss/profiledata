# fastapi_backend/main.py
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import socketio
import os
from pathlib import Path
import logging
import time

from database import connect_to_mongo, close_mongo_connection, get_database
from routes import router
from test_management import router as test_router
from auth.admin_routes import router as admin_router
from auth.auth_routes import router as auth_router
from auth.phone_routes import router as phone_router
from auth.mfa_routes import router as mfa_router
from auth.otp_routes import router as otp_router
from routes_dynamic_scheduler import router as dynamic_scheduler_router
from routes_meta_admin import router as meta_admin_router
from routes_image_access import router as image_access_router
from routes_pii_access import router as pii_access_router
from routers.notifications import router as notifications_router
from routers.notification_config_routes import router as notification_config_router
from routers.activity_logs import router as activity_logs_router
from routers.verification import router as verification_router
from routers.push_subscriptions import router as push_subscriptions_router
from routers.system_health import router as system_health_router
from routers.invitations import router as invitations_router
from routers.user_invitations import router as user_invitations_router
from routers.account_status import router as account_status_router
from routers.pause_analytics import router as pause_analytics_router
from routers.admin_notifications import router as admin_notifications_router
from routers.email_templates import router as email_templates_router
from routers.email_tracking import router as email_tracking_router
from routers.account_deletion import router as account_deletion_router
from routers.announcements import router as announcements_router
from routers.short_urls import router as short_urls_router
from config import settings
from websocket_manager import sio
from sse_manager import sse_manager
from unified_scheduler import initialize_unified_scheduler, shutdown_unified_scheduler
from services.storage_service import initialize_storage_service

# Configure logging
# Use LOG_LEVEL from config (INFO, DEBUG, WARNING, ERROR, CRITICAL)
log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.info(f"Logger initialized in {settings.log_level.upper()} mode")

async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting FastAPI application...")
    
    # Create uploads directory
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(exist_ok=True)
    logger.info(f"✅ Upload directory ready: {upload_dir}")
    
    # Initialize storage service (GCS or local)
    try:
        initialize_storage_service(
            use_gcs=settings.use_gcs,
            bucket_name=settings.gcs_bucket_name
        )
        logger.info(
            "✅ Storage service initialized (GCS: %s, bucket: %s)",
            settings.use_gcs,
            settings.gcs_bucket_name or "<local>"
        )
    except Exception as storage_error:
        logger.error("❌ Failed to initialize storage service: %s", storage_error, exc_info=True)
    
    # Connect to MongoDB
    await connect_to_mongo()
    
    # Connect to Redis
    from redis_manager import redis_manager
    redis_connected = redis_manager.connect()
    if redis_connected:
        logger.info("✅ Redis connected successfully")
    else:
        logger.warning("⚠️ Redis connection failed - online status features may not work")
    
    # Initialize SSE Manager
    await sse_manager.initialize()
    logger.info("✅ SSE Manager initialized for real-time messaging")
    
    # Initialize Job Templates for Dynamic Scheduler
    from job_templates.registry import initialize_templates
    initialize_templates()
    logger.info("✅ Job Templates initialized")
    
    # Initialize Unified Scheduler (handles both cleanup and tests)
    db = get_database()  # Don't await - it's not async
    await initialize_unified_scheduler(db)
    logger.info("✅ Unified Scheduler initialized")
    
    # Initialize Activity Logger
    from services.activity_logger import initialize_activity_logger
    await initialize_activity_logger(db)
    logger.info("✅ Activity Logger initialized")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down FastAPI application...")
    
    # Stop unified scheduler
    await shutdown_unified_scheduler()
    
    # Cleanup activity logger
    from services.activity_logger import get_activity_logger
    try:
        activity_logger = get_activity_logger()
        await activity_logger.cleanup()
        logger.info("✅ Activity Logger cleaned up")
    except:
        pass
    
    await close_mongo_connection()
    
    # Close SSE Manager
    await sse_manager.close()
    logger.info("🔌 SSE Manager closed")
    
    # Disconnect Redis
    from redis_manager import redis_manager
    redis_manager.disconnect()

app = FastAPI(
    title="Matrimonial Profile API",
    description="FastAPI backend for matrimonial profile management",
    version="1.0.0",
    lifespan=lifespan
)

# Mount static files for uploads (after app creation)
if os.path.exists(settings.upload_dir):
    from fastapi.staticfiles import StaticFiles
    app.mount(f"/{settings.upload_dir}", StaticFiles(directory=settings.upload_dir), name="uploads")
    logger.info(f"📁 Static files mounted at /{settings.upload_dir}")

# CORS middleware (must be added before other middleware)
env = os.getenv("ENV", "development")
frontend_url = os.getenv("FRONTEND_URL", "https://l3v3lmatches.com")

# Log environment for debugging
print(f"🔍 CORS Configuration:")
print(f"   ENV = {env}")
print(f"   FRONTEND_URL = {frontend_url}")

if env == "production":
    # Production: Use actual domains
    cors_origins = [
        frontend_url,
        "https://l3v3lmatches.com",
        "https://www.l3v3lmatches.com",
        "https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app",
        "https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
    ]
    cors_regex = None  # No regex needed for production - explicit origins only
    print(f"🔒 Production CORS enabled for: {cors_origins}")
    logger.info(f"🔒 Production CORS enabled for: {cors_origins}")
else:
    # Development: Allow localhost
    cors_origins = [
        "http://localhost",           # Android Capacitor
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://192.168.1.246:3000",  # Mac local IP
    ]
    # Regex for dev to catch any localhost variations
    cors_regex = r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?"
    print(f"🔓 Development CORS enabled for: {cors_origins}")
    logger.info(f"🔓 Development CORS enabled for: {cors_origins}")

# Add CORS middleware with conditional regex
if cors_regex:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=cors_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
else:
    # Production - no regex, just explicit origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    duration = 0  # Initialize duration
    
    # Log incoming request with origin
    origin = request.headers.get("origin", "no-origin")
    logger.info(f"📨 Incoming {request.method} request to {request.url.path} from origin: {origin}")
    
    # Log CORS preflight requests specifically
    if request.method == "OPTIONS":
        logger.info(f"🔀 CORS preflight request from {origin}")
    
    logger.debug(f"Request headers: {dict(request.headers)}")
    
    try:
        response = await call_next(request)
        
        # Calculate request duration
        duration = time.time() - start_time
        # Log response
        status_emoji = "✅" if response.status_code < 400 else "❌"
        logger.info(f"{status_emoji} {request.method} {request.url.path} - Status: {response.status_code} - Duration: {duration:.3f}s")
        
        # Log response body (only for non-streaming responses)
        if hasattr(response, 'body') and response.body is not None:
            logger.debug(f"Response body: {response.body.decode('utf-8')}")
        
        return response
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"❌ Error processing {request.method} {request.url.path} - Duration: {duration:.3f}s - Error: {e}", exc_info=True)
        raise

# Include routers
app.include_router(router)
app.include_router(test_router, prefix="/api/tests", tags=["tests"])
app.include_router(admin_router)  # Admin routes (already has /api/admin prefix)
app.include_router(auth_router)   # Auth routes (already has /api/auth prefix)
app.include_router(phone_router)  # Phone verification routes (already has /api/auth/phone prefix)
app.include_router(mfa_router)    # MFA routes (already has /api/auth/mfa prefix)
app.include_router(otp_router)    # Unified OTP routes - Email + SMS (already has /api/auth/otp prefix)
app.include_router(dynamic_scheduler_router)  # Dynamic scheduler routes
app.include_router(meta_admin_router, prefix="/api", tags=["meta-admin"])  # Meta fields admin routes
app.include_router(image_access_router)  # Image access routes (already has /api/image-access prefix)
app.include_router(pii_access_router)  # PII access routes (already has /api/pii-access prefix)
app.include_router(notifications_router)  # Notification routes (already has /api/notifications prefix)
app.include_router(notification_config_router)  # Notification trigger configuration (already has /api/admin/notification-config prefix)
app.include_router(admin_notifications_router, prefix="/api/admin", tags=["admin-notifications"])  # Admin saved search notification management
app.include_router(activity_logs_router)  # Activity logs routes (already has /api/activity-logs prefix)
app.include_router(verification_router)  # Email verification routes (already has /api/verification prefix)
app.include_router(push_subscriptions_router)  # Push notification subscriptions (already has /api/push-subscriptions prefix)
app.include_router(invitations_router)  # Invitation routes (already has /api/invitations prefix)
app.include_router(user_invitations_router)  # User invitation routes (already has /api/user-invitations prefix)
app.include_router(account_status_router)  # Account status/pause routes (already has /api/account prefix)
app.include_router(pause_analytics_router)  # Pause analytics routes (already has /api/pause-analytics prefix)
app.include_router(email_templates_router, prefix="/api/users/email-templates", tags=["email-templates"])  # Email template management
app.include_router(system_health_router, prefix="/api/users/system", tags=["system"])  # System health routes
app.include_router(email_tracking_router)  # Email tracking routes (already has /api/email-tracking prefix)
app.include_router(account_deletion_router)  # Account deletion routes (already has /api/users/account prefix)
app.include_router(announcements_router, prefix="/api", tags=["announcements"])  # Announcement/marquee routes
app.include_router(short_urls_router)  # Short URL redirects (no prefix - uses /s/{code})

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "matrimonial-api",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    return {
        "message": "Matrimonial Profile API",
        "docs": "/docs",
        "health": "/health"
    }

# Wrap FastAPI app with Socket.IO
socket_app = socketio.ASGIApp(
    sio,
    app,
    socketio_path='/socket.io'
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
