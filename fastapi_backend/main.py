# fastapi_backend/main.py
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from pathlib import Path
import logging
import time

from database import connect_to_mongo, close_mongo_connection
from routes import router
from config import settings

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
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down FastAPI application...")
    await close_mongo_connection()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
