# fastapi_backend/middleware/session_validation.py
"""
Server-Side Session Validation Middleware

This middleware validates session validity on every authenticated API call.
It checks:
1. Session exists and is not revoked
2. Session has not exceeded the 8-hour hard limit
3. Session has not been inactive for more than 30 minutes (inactivity timeout)

This provides server-side enforcement of session timeouts, complementing
the client-side sessionManager.js implementation.
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Session timeout configuration (aligned with frontend sessionManager.js)
SESSION_HARD_LIMIT_HOURS = 8  # 8 hours - maximum session duration
SESSION_INACTIVITY_MINUTES = 30  # 30 minutes - aligned with frontend


async def validate_session_middleware(request: Request, call_next):
    """
    Middleware to validate session on every authenticated API call.
    
    This provides server-side enforcement of session timeouts as a safety net
    for cases where client-side JavaScript may be throttled or manipulated.
    """
    # Skip validation for non-authenticated endpoints
    skip_paths = [
        "/health",
        "/",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh-token",
        "/api/auth/refresh",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/verify-email",
        "/api/verification/",
        "/api/auth/otp/",
        "/s/",  # Short URLs
        "/socket.io",
    ]
    
    # Check if path should be skipped
    path = request.url.path
    if any(path.startswith(skip) or path == skip.rstrip('/') for skip in skip_paths):
        return await call_next(request)
    
    # Check for Authorization header
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        # No auth header - let the endpoint handle authentication
        return await call_next(request)
    
    token = auth_header.split(" ")[1]
    
    try:
        # Get database
        from database import get_database
        db = get_database()
        
        # Find session by token
        session = await db.sessions.find_one({
            "token": token,
            "revoked": False
        })
        
        if not session:
            # Session not found or revoked - let JWT auth handle this
            # (could be a valid token that just doesn't have a session record)
            return await call_next(request)
        
        # Check hard limit (8 hours from session creation)
        created_at = session.get("created_at")
        if created_at:
            time_since_login = datetime.utcnow() - created_at
            if time_since_login.total_seconds() > (SESSION_HARD_LIMIT_HOURS * 3600):
                logger.warning(
                    f"Session exceeded {SESSION_HARD_LIMIT_HOURS}-hour hard limit for user: "
                    f"{session.get('username')} (session age: {time_since_login})"
                )
                
                # Revoke the session
                await db.sessions.update_one(
                    {"_id": session["_id"]},
                    {
                        "$set": {
                            "revoked": True,
                            "revoked_at": datetime.utcnow(),
                            "revoked_reason": f"Session exceeded {SESSION_HARD_LIMIT_HOURS}-hour hard limit"
                        }
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "detail": "SESSION_EXPIRED_HARD_LIMIT",
                        "message": f"Your session has expired ({SESSION_HARD_LIMIT_HOURS} hour limit). Please log in again."
                    },
                    headers={"WWW-Authenticate": "Bearer"}
                )
        
        # Check inactivity timeout (30 minutes since last activity)
        last_activity = session.get("last_activity")
        if last_activity:
            time_since_activity = datetime.utcnow() - last_activity
            if time_since_activity.total_seconds() > (SESSION_INACTIVITY_MINUTES * 60):
                logger.warning(
                    f"Session inactive for {SESSION_INACTIVITY_MINUTES}+ minutes for user: "
                    f"{session.get('username')} (inactive for: {time_since_activity})"
                )
                
                # Revoke the session
                await db.sessions.update_one(
                    {"_id": session["_id"]},
                    {
                        "$set": {
                            "revoked": True,
                            "revoked_at": datetime.utcnow(),
                            "revoked_reason": f"Session inactive for {SESSION_INACTIVITY_MINUTES}+ minutes"
                        }
                    }
                )
                
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "detail": "SESSION_EXPIRED_INACTIVITY",
                        "message": f"Your session has expired due to {SESSION_INACTIVITY_MINUTES} minutes of inactivity. Please log in again."
                    },
                    headers={"WWW-Authenticate": "Bearer"}
                )
        
        # Session is valid - update last_activity timestamp
        await db.sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"last_activity": datetime.utcnow()}}
        )
        
    except Exception as e:
        # Log error but don't block the request
        # Let the endpoint's own auth handle validation
        logger.error(f"Session validation middleware error: {e}")
    
    # Continue to the endpoint
    return await call_next(request)
