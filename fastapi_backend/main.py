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

from database import connect_to_mongo, close_mongo_connection
from routes import router
from test_management import router as test_router
from auth.admin_routes import router as admin_router
from auth.auth_routes import router as auth_router
from config import settings
from websocket_manager import sio
from sse_manager import sse_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting FastAPI application...")
    
    # Create uploads directory
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(exist_ok=True)
    logger.info(f"✅ Upload directory ready: {upload_dir}")
    
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
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down FastAPI application...")
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    duration = 0  # Initialize duration
    
    # Log incoming request
    logger.info(f"📨 Incoming {request.method} request to {request.url.path}")
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
