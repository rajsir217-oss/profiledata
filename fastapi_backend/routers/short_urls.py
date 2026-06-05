"""
Short URL Routes
Handles /s/{short_code} redirects
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
import uuid
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.url_shortener import URLShortener

router = APIRouter()


@router.get("/api/short-links/health")
async def short_links_health_check(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Health probe for short link DB operations (insert/read/delete)."""
    probe_id = f"health-{uuid.uuid4().hex[:12]}"
    probe_doc = {
        "shortCode": probe_id,
        "longUrl": "https://healthcheck.local/short-links",
        "createdAt": datetime.utcnow(),
        "clicks": 0,
        "lastAccessed": None,
        "healthProbe": True,
        "createdBy": current_user.get("username")
    }

    try:
        insert_result = await db.short_urls.insert_one(probe_doc)
        found_doc = await db.short_urls.find_one({"_id": insert_result.inserted_id})

        if not found_doc:
            raise RuntimeError("Inserted probe document could not be read")

        delete_result = await db.short_urls.delete_one({"_id": insert_result.inserted_id})

        return {
            "status": "ok",
            "collection": "short_urls",
            "checks": {
                "insert": bool(insert_result.inserted_id),
                "read": True,
                "delete": delete_result.deleted_count == 1
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "collection": "short_urls",
                "error": str(e)
            }
        )
    finally:
        await db.short_urls.delete_many({"shortCode": probe_id, "healthProbe": True})


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
