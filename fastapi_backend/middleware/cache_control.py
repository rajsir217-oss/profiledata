"""
Cache Control Middleware for PCI Compliance

Sets appropriate Cache-Control headers based on route sensitivity:
- Non-sensitive routes: Cache-Control: no-cache
- Sensitive routes: Cache-Control: max-age=0, must-revalidate, no-cache, no-store, private

PCI Requirement: Prevent web cache poisoning by ensuring sensitive resources
are not cached in shared caches (CDN, proxies, etc.).
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)


class CacheControlMiddleware(BaseHTTPMiddleware):
    """
    Middleware to set Cache-Control headers for PCI compliance.
    
    Sensitive routes (auth, profile, payment, admin):
    - Cache-Control: max-age=0, must-revalidate, no-cache, no-store, private
    
    Non-sensitive routes (public pages, static assets):
    - Cache-Control: no-cache
    """
    
    # Routes that handle sensitive information
    SENSITIVE_ROUTES = {
        # Authentication routes
        "/login", "/register", "/register2", "/signin", "/signup",
        "/auth/login", "/auth/register", "/auth/signin", "/auth/signup",
        "/auth/forgot-password", "/auth/reset-password", "/auth/change-password",
        "/auth/mfa", "/auth/verify-otp", "/auth/phone-verify",
        
        # Profile and account routes
        "/profile", "/edit-profile", "/account", "/settings",
        "/api/users/profile", "/api/users/account", "/api/users/settings",
        
        # Payment routes
        "/payment", "/payments", "/checkout", "/billing",
        "/api/payments", "/api/paypal", "/api/clover", "/api/braintree",
        "/contribute", "/api/contribute",
        
        # Admin routes
        "/admin", "/api/admin", "/dashboard",
        
        # Virtual meets (paid feature)
        "/virtual-meets", "/api/virtual-meets",
        
        # PII and sensitive data
        "/pii", "/api/pii", "/notifications", "/api/notifications",
        
        # Upload routes (user content)
        "/upload", "/api/upload",
    }
    
    # Routes that are completely public (can be cached)
    PUBLIC_ROUTES = {
        "/", "/home", "/about", "/contact", "/terms", "/privacy",
        "/favicon.ico", "/robots.txt", "/sitemap.xml",
        "/static", "/css", "/js", "/images", "/assets",
    }
    
    async def dispatch(self, request: Request, call_next):
        # Get the response
        response = await call_next(request)
        
        # Set Cache-Control header based on route
        path = request.url.path.lower()
        
        if self._is_sensitive_route(path):
            # Sensitive routes - strict caching rules
            cache_control = "max-age=0, must-revalidate, no-cache, no-store, private"
            logger.debug(f"🔒 Setting strict cache control for sensitive route: {path}")
        elif self._is_public_route(path):
            # Public routes - minimal caching
            cache_control = "no-cache"
            logger.debug(f"🌐 Setting public cache control for route: {path}")
        else:
            # Default to safe caching for unknown routes
            cache_control = "no-cache"
            logger.debug(f"📋 Setting default cache control for route: {path}")
        
        # Set the header
        response.headers["Cache-Control"] = cache_control
        
        # Only set Pragma for HTTP/1.0 compatibility (PCI requirement)
        # Check if client is HTTP/1.0 by looking at the request
        http_version = request.scope.get('http_version', '1.1')
        if http_version == '1.0' and ("no-store" in cache_control or "no-cache" in cache_control):
            response.headers["Pragma"] = "no-cache"
        elif http_version != '1.0':
            # For HTTP/1.1+, remove Pragma header if it exists (PCI compliance)
            if "Pragma" in response.headers:
                del response.headers["Pragma"]
        
        return response
    
    def _is_sensitive_route(self, path: str) -> bool:
        """Check if route handles sensitive information."""
        # Check exact matches
        if path in self.SENSITIVE_ROUTES:
            return True
        
        # Check prefix matches
        for sensitive_path in self.SENSITIVE_ROUTES:
            if path.startswith(sensitive_path):
                return True
        
        # Check API patterns
        api_patterns = [
            "/api/users/",
            "/api/auth/",
            "/api/payments/",
            "/api/admin/",
            "/api/pii/",
            "/api/virtual-meets/",
            "/api/contribute/",
            "/api/upload",
        ]
        
        for pattern in api_patterns:
            if path.startswith(pattern):
                return True
        
        return False
    
    def _is_public_route(self, path: str) -> bool:
        """Check if route is completely public."""
        # Check exact matches
        if path in self.PUBLIC_ROUTES:
            return True
        
        # Check prefix matches
        for public_path in self.PUBLIC_ROUTES:
            if path.startswith(public_path):
                return True
        
        # Static file extensions
        static_extensions = [
            ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg",
            ".ico", ".woff", ".woff2", ".ttf", ".eot", ".txt",
            ".xml", ".json", ".webmanifest"
        ]
        
        if any(path.endswith(ext) for ext in static_extensions):
            return True
        
        return False


def add_cache_control_middleware(app):
    """
    Add the cache control middleware to the FastAPI app.
    
    This should be added AFTER other middleware but BEFORE route handlers.
    """
    app.add_middleware(CacheControlMiddleware)
    logger.info("✅ Cache Control middleware added for PCI compliance")
