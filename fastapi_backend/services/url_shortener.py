"""
URL Shortener Service for SMS Invitations
Generates short URLs to avoid carrier blocking
"""
import secrets
import string
from datetime import datetime
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from config import Settings

settings = Settings()


class URLShortener:
    """Service for creating and resolving short URLs"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.short_urls
        
    async def create_short_url(self, long_url: str, custom_code: Optional[str] = None) -> str:
        """
        Create a shortened URL
        
        Args:
            long_url: The full URL to shorten
            custom_code: Optional custom short code (e.g., 'usv-abc123')
            
        Returns:
            The complete short URL (e.g., 'https://yourdomain.com/s/abc123')
        """
        # Generate short code if not provided
        if custom_code:
            short_code = custom_code
        else:
            short_code = self._generate_short_code()
        
        # Check if code already exists
        existing = await self.collection.find_one({"shortCode": short_code})
        if existing:
            # If same URL, return existing
            if existing.get("longUrl") == long_url:
                return self._build_short_url(short_code)
            else:
                # Generate new code
                short_code = self._generate_short_code()
        
        # Store in database
        short_url_doc = {
            "shortCode": short_code,
            "longUrl": long_url,
            "createdAt": datetime.utcnow(),
            "clicks": 0,
            "lastAccessed": None
        }
        
        await self.collection.insert_one(short_url_doc)
        
        return self._build_short_url(short_code)
    
    async def resolve_short_url(self, short_code: str) -> Optional[str]:
        """
        Resolve a short code to its original URL
        
        Args:
            short_code: The short code (e.g., 'abc123')
            
        Returns:
            The original long URL, or None if not found
        """
        doc = await self.collection.find_one({"shortCode": short_code})
        
        if doc:
            # Update click count and last accessed
            await self.collection.update_one(
                {"shortCode": short_code},
                {
                    "$inc": {"clicks": 1},
                    "$set": {"lastAccessed": datetime.utcnow()}
                }
            )
            return doc.get("longUrl")
        
        return None
    
    def _generate_short_code(self, length: int = 6) -> str:
        """Generate a random short code"""
        # Use alphanumeric characters (case-sensitive for more combinations)
        chars = string.ascii_letters + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    def _build_short_url(self, short_code: str) -> str:
        """Build the complete short URL"""
        base_url = settings.app_url.rstrip('/')
        return f"{base_url}/s/{short_code}"


async def get_url_shortener(db: AsyncIOMotorDatabase) -> URLShortener:
    """Factory function to get URL shortener instance"""
    return URLShortener(db)
