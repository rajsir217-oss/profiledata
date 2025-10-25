"""
Minimal FastAPI Backend - Works with or without MongoDB
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("🚀 Starting FastAPI application...")
    logger.info("✅ Application ready")
    yield
    logger.info("👋 Shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Matrimonial API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS - Allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Matrimonial API",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "matrimonial-api",
        "version": "1.0.0"
    }

# Import and include existing routers
try:
    from routes import router as main_router
    app.include_router(main_router)
    logger.info("✅ Main routes loaded")
except Exception as e:
    logger.warning(f"⚠️ Could not load main routes: {e}")

try:
    from auth.auth_routes import router as auth_router
    app.include_router(auth_router)
    logger.info("✅ Auth routes loaded")
except Exception as e:
    logger.warning(f"⚠️ Could not load auth routes: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
