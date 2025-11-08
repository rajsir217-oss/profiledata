"""
Email Templates Router
API endpoints for managing and previewing email templates
"""

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from auth.jwt_auth import get_current_user_dependency as get_current_user
from typing import List, Dict, Any
from config import Settings

router = APIRouter()
settings = Settings()

# MongoDB connection
client = AsyncIOMotorClient(settings.mongodb_url)
db = client[settings.database_name]


@router.get("/templates")
async def get_all_templates(
    current_user: dict = Depends(get_current_user),
    category: str = None
):
    """
    Get all email templates
    Admin only
    """
    # Security: Only admin can view templates
    if current_user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build query
    query = {"channel": "email"}
    if category:
        query["category"] = category
    
    # Fetch templates
    templates = await db.notification_templates.find(query).sort("category", 1).to_list(length=100)
    
    # Convert ObjectId to string
    for template in templates:
        template["_id"] = str(template["_id"])
    
    return {
        "templates": templates,
        "total": len(templates)
    }


@router.get("/templates/{trigger}")
async def get_template_by_trigger(
    trigger: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific template by trigger name
    Admin only
    """
    # Security: Only admin can view templates
    if current_user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    template = await db.notification_templates.find_one({"trigger": trigger})
    
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{trigger}' not found")
    
    # Convert ObjectId to string
    template["_id"] = str(template["_id"])
    
    return template


@router.get("/templates/categories")
async def get_template_categories(
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of unique template categories
    Admin only
    """
    # Security: Only admin can view templates
    if current_user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get distinct categories
    categories = await db.notification_templates.distinct("category", {"channel": "email"})
    
    # Get count per category
    category_counts = {}
    for category in categories:
        count = await db.notification_templates.count_documents({
            "channel": "email",
            "category": category
        })
        category_counts[category] = count
    
    return {
        "categories": categories,
        "counts": category_counts
    }
