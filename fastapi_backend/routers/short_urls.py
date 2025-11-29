"""
Short URL Routes
Handles /s/{short_code} redirects
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from database import get_database
from services.url_shortener import URLShortener

router = APIRouter()


@router.get("/s/{short_code}")
async def redirect_short_url(
    short_code: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Redirect from short URL to long URL
    
    Example: /s/abc123 → https://domain.com/register2?invitation=...
    """
    shortener = URLShortener(db)
    long_url = await shortener.resolve_short_url(short_code)
    
    if not long_url:
        raise HTTPException(status_code=404, detail="Short URL not found")
    
    return RedirectResponse(url=long_url, status_code=302)
