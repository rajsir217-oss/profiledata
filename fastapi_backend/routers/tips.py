"""
Tips Router
API endpoints for managing tips (Tip of the Day + Help page integration)
Single source of truth for all tips across the platform.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from pydantic import BaseModel, Field
import logging

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user

router = APIRouter(prefix="/api/tips", tags=["tips"])
logger = logging.getLogger(__name__)


# ===== MODELS =====

class TipCreate(BaseModel):
    category: str = Field(..., description="Help section category (e.g., getting-started, search, profile)")
    icon: str = Field("💡", description="Emoji icon")
    tipText: str = Field(..., description="Tip content text")
    helpContext: Optional[str] = Field(None, description="Help section title for grouping")
    link: Optional[str] = Field(None, description="CTA link (e.g., /search, /edit-profile)")
    linkText: Optional[str] = Field(None, description="CTA button text (e.g., Try it now)")
    priority: int = Field(5, description="Display order (lower = higher priority)")
    active: bool = Field(True, description="Whether tip is active")
    showInTicker: bool = Field(True, description="Show in scrolling ticker as Tip of the Day")
    showInHelp: bool = Field(True, description="Show in Help page")


class TipUpdate(BaseModel):
    category: Optional[str] = None
    icon: Optional[str] = None
    tipText: Optional[str] = None
    helpContext: Optional[str] = None
    link: Optional[str] = None
    linkText: Optional[str] = None
    priority: Optional[int] = None
    active: Optional[bool] = None
    showInTicker: Optional[bool] = None
    showInHelp: Optional[bool] = None


# ===== HELP PAGE CATEGORIES =====

HELP_CATEGORIES = [
    {"id": "getting-started", "icon": "🚀", "title": "Getting Started"},
    {"id": "dashboard", "icon": "🎯", "title": "Your Dashboard"},
    {"id": "search", "icon": "🔍", "title": "Search & Filters"},
    {"id": "l3v3l", "icon": "🦋", "title": "L3V3L Matching"},
    {"id": "profile", "icon": "👤", "title": "Your Profile"},
    {"id": "connections", "icon": "💬", "title": "Connections & Chat"},
    {"id": "contact-access", "icon": "🔐", "title": "Contact & Photo Access"},
    {"id": "privacy", "icon": "🔒", "title": "Privacy & Safety"},
    {"id": "account", "icon": "⚙️", "title": "Account Settings"},
    {"id": "faq", "icon": "❓", "title": "FAQ"},
]


# ===== PUBLIC ENDPOINTS =====

@router.get("/categories")
async def get_tip_categories():
    """Get all help/tip categories"""
    return {"categories": HELP_CATEGORIES}


@router.get("/by-category")
async def get_tips_by_category(
    category: Optional[str] = Query(None, description="Filter by category"),
    help_only: bool = Query(False, description="Only return tips marked for Help page"),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get tips grouped by category (for Help page)"""
    query = {"active": True}
    if category:
        query["category"] = category
    if help_only:
        query["showInHelp"] = True

    tips = await db.tips.find(query).sort("priority", 1).to_list(500)

    # Group by category
    grouped = {}
    for tip in tips:
        cat = tip.get("category", "general")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append({
            "id": str(tip["_id"]),
            "icon": tip.get("icon", "💡"),
            "tipText": tip.get("tipText", ""),
            "link": tip.get("link"),
            "linkText": tip.get("linkText"),
            "priority": tip.get("priority", 5),
        })

    return {"tips": grouped, "categories": HELP_CATEGORIES}


@router.get("/tip-of-the-day")
async def get_tip_of_the_day(
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get today's tip (rotates daily based on day-of-year)"""
    tips = await db.tips.find(
        {"active": True, "showInTicker": True}
    ).sort("priority", 1).to_list(500)

    if not tips:
        return {"tip": None}

    # Rotate based on day of year
    day_of_year = datetime.utcnow().timetuple().tm_yday
    tip = tips[day_of_year % len(tips)]

    return {
        "tip": {
            "id": str(tip["_id"]),
            "icon": tip.get("icon", "💡"),
            "tipText": tip.get("tipText", ""),
            "category": tip.get("category", "general"),
            "link": tip.get("link"),
            "linkText": tip.get("linkText"),
        }
    }


# ===== ADMIN ENDPOINTS =====

@router.get("/admin/all")
async def get_all_tips_admin(
    current_user: dict = Depends(get_current_user),
    category: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all tips (admin only)"""
    role = current_user.get("role") or current_user.get("role_name")
    if role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if category:
        query["category"] = category

    tips = await db.tips.find(query).sort([("category", 1), ("priority", 1)]).to_list(1000)

    result = []
    for tip in tips:
        result.append({
            "id": str(tip["_id"]),
            "category": tip.get("category"),
            "icon": tip.get("icon", "💡"),
            "tipText": tip.get("tipText", ""),
            "helpContext": tip.get("helpContext"),
            "link": tip.get("link"),
            "linkText": tip.get("linkText"),
            "priority": tip.get("priority", 5),
            "active": tip.get("active", True),
            "showInTicker": tip.get("showInTicker", True),
            "showInHelp": tip.get("showInHelp", True),
            "createdBy": tip.get("createdBy"),
            "createdAt": tip.get("createdAt"),
            "updatedAt": tip.get("updatedAt"),
        })

    return {"tips": result, "count": len(result), "categories": HELP_CATEGORIES}


@router.post("/admin/create")
async def create_tip(
    tip_data: TipCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a new tip (admin only)"""
    role = current_user.get("role") or current_user.get("role_name")
    if role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Admin access required")

    doc = tip_data.dict()
    doc["createdBy"] = current_user["username"]
    doc["createdAt"] = datetime.utcnow()
    doc["updatedAt"] = datetime.utcnow()

    result = await db.tips.insert_one(doc)
    logger.info(f"✅ Tip created by {current_user['username']}: {tip_data.tipText[:50]}")

    return {"success": True, "id": str(result.inserted_id), "message": "Tip created"}


@router.put("/admin/{tip_id}")
async def update_tip(
    tip_id: str,
    tip_data: TipUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update a tip (admin only)"""
    role = current_user.get("role") or current_user.get("role_name")
    if role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Admin access required")

    update_fields = {k: v for k, v in tip_data.dict().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updatedAt"] = datetime.utcnow()

    result = await db.tips.update_one(
        {"_id": ObjectId(tip_id)},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tip not found")

    logger.info(f"✅ Tip {tip_id} updated by {current_user['username']}")
    return {"success": True, "message": "Tip updated"}


@router.delete("/admin/{tip_id}")
async def delete_tip(
    tip_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a tip (admin only)"""
    role = current_user.get("role") or current_user.get("role_name")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.tips.delete_one({"_id": ObjectId(tip_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tip not found")

    logger.info(f"🗑️ Tip {tip_id} deleted by {current_user['username']}")
    return {"success": True, "message": "Tip deleted"}


@router.post("/admin/clone/{tip_id}")
async def clone_tip(
    tip_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Clone an existing tip (admin only)"""
    role = current_user.get("role") or current_user.get("role_name")
    if role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Admin access required")

    original = await db.tips.find_one({"_id": ObjectId(tip_id)})
    if not original:
        raise HTTPException(status_code=404, detail="Tip not found")

    clone = {k: v for k, v in original.items() if k != "_id"}
    clone["tipText"] = f"Copy of {clone.get('tipText', '')}"
    clone["createdBy"] = current_user["username"]
    clone["createdAt"] = datetime.utcnow()
    clone["updatedAt"] = datetime.utcnow()

    result = await db.tips.insert_one(clone)
    logger.info(f"📋 Tip {tip_id} cloned by {current_user['username']}")

    return {"success": True, "id": str(result.inserted_id), "message": "Tip cloned"}
