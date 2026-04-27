"""
App-wide Rate Limiter using slowapi
Provides per-user rate limiting with Redis backend (falls back to in-memory).

Usage in route files:
    from middleware.rate_limiter import limiter
    
    @router.get("/endpoint")
    @limiter.limit("30/minute")
    async def my_endpoint(request: Request, ...):
        ...

Rate limit tiers:
    - Default (app-wide): 120/minute
    - Auth (login/register): 10/minute
    - Search/browse: 30/minute
    - Profile resolution: 30/minute
    - Share profile (is.gd): 10/minute
    - OTP/verification: 5/minute
    - AI endpoints: 10/minute
"""
import os
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


def _get_user_or_ip(request: Request) -> str:
    """
    Identify the caller by JWT username if authenticated, otherwise by IP.
    This ensures rate limits are per-user for authenticated requests
    and per-IP for unauthenticated ones (login, register, etc.).
    """
    # Try to get username from request state (set by auth middleware)
    # or from the Authorization header's decoded JWT
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            from auth.jwt_auth import JWTManager
            token = auth_header.split(" ", 1)[1]
            payload = JWTManager.decode_token(token)
            username = payload.get("sub")
            if username:
                return f"user:{username}"
        except Exception:
            pass  # Token invalid/expired - fall back to IP

    return get_remote_address(request)


def _build_redis_uri() -> str:
    """Build Redis URI from environment, matching redis_manager.py config."""
    return os.getenv("REDIS_URL", "redis://localhost:6379")


def create_limiter() -> Limiter:
    """
    Create and configure the rate limiter.
    Uses Redis if available, falls back to in-memory storage.
    """
    redis_uri = _build_redis_uri()
    storage_uri = None

    # Try Redis first for multi-instance support (Cloud Run)
    try:
        import redis
        parsed_uri = redis_uri
        r = redis.Redis.from_url(parsed_uri, socket_connect_timeout=2)
        r.ping()
        storage_uri = parsed_uri
        logger.info(f"🛡️ Rate limiter using Redis backend")
    except Exception as e:
        logger.warning(f"⚠️ Rate limiter Redis unavailable ({e}), using in-memory storage")
        storage_uri = "memory://"

    return Limiter(
        key_func=_get_user_or_ip,
        default_limits=["120/minute"],
        storage_uri=storage_uri,
        strategy="fixed-window",
        headers_enabled=False,  # Disabled: decorator approach requires response: Response param on each endpoint
    )


# Singleton limiter instance
limiter = create_limiter()


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Custom handler for rate limit exceeded errors."""
    # Extract the limit info for a helpful message
    limit_value = str(exc.detail) if hasattr(exc, 'detail') else "Rate limit exceeded"
    
    logger.warning(
        f"🛡️ Rate limit exceeded: {_get_user_or_ip(request)} "
        f"on {request.method} {request.url.path} - {limit_value}"
    )
    
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please slow down and try again shortly.",
            "retry_after": exc.detail if hasattr(exc, 'detail') else "60 seconds"
        },
        headers={
            "Retry-After": "60",
        }
    )


# Pre-defined rate limit strings for common tiers
RATE_LIMITS = {
    "default": "120/minute",
    "auth": "10/minute",         # Login, register, password reset
    "search": "30/minute",       # Search, browse profiles
    "profile": "30/minute",      # Profile resolution, viewing
    "share": "10/minute",        # Share profile (external API calls)
    "otp": "5/minute",           # OTP, verification codes
    "ai": "10/minute",           # AI-powered endpoints
    "admin": "60/minute",        # Admin operations
    "upload": "20/minute",       # File uploads
    "stats": "60/minute",        # Platform stats, analytics (cached read-only)
}
