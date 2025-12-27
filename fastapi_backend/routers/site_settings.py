"""
Site Settings Router
Created: December 26, 2025
Purpose: API endpoints for managing site settings (membership fees, plans, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, Dict, Any
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.site_settings_service import SiteSettingsService
from models.site_settings_models import MembershipPlan, MembershipConfigUpdate
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/site-settings", tags=["Site Settings"])


def check_admin(current_user: dict):
    """Check if user is admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/membership")
async def get_membership_config(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get membership configuration (public for pricing display)"""
    service = SiteSettingsService(db)
    config = await service.get_membership_config()
    
    return {"success": True, "membership": config}


@router.put("/membership")
async def update_membership_config(
    updates: MembershipConfigUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update membership configuration (Admin only)"""
    check_admin(current_user)
    
    service = SiteSettingsService(db)
    
    # Filter out None values
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    config = await service.update_membership_config(
        update_data, 
        current_user.get("username")
    )
    
    return {"success": True, "membership": config}


@router.post("/membership/plans")
async def add_membership_plan(
    plan: MembershipPlan,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Add a new membership plan (Admin only)"""
    check_admin(current_user)
    
    service = SiteSettingsService(db)
    
    try:
        new_plan = await service.add_plan(
            plan.dict(), 
            current_user.get("username")
        )
        return {"success": True, "plan": new_plan}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/membership/plans/{plan_id}")
async def update_membership_plan(
    plan_id: str,
    updates: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update a membership plan (Admin only)"""
    check_admin(current_user)
    
    service = SiteSettingsService(db)
    
    updated_plan = await service.update_plan(
        plan_id, 
        updates, 
        current_user.get("username")
    )
    
    if not updated_plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found")
    
    return {"success": True, "plan": updated_plan}


@router.delete("/membership/plans/{plan_id}")
async def delete_membership_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a membership plan (Admin only)"""
    check_admin(current_user)
    
    service = SiteSettingsService(db)
    
    deleted = await service.delete_plan(plan_id, current_user.get("username"))
    
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found")
    
    return {"success": True, "message": f"Plan '{plan_id}' deleted"}


@router.get("/membership/calculate-price")
async def calculate_discounted_price(
    plan_id: str = Query(..., description="Plan ID to calculate price for"),
    promo_code: Optional[str] = Query(None, description="Promo code to apply"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Calculate final price after applying promo code discount"""
    service = SiteSettingsService(db)
    
    # Get promo code details if provided
    promo_code_data = None
    if promo_code:
        promo_codes_collection = db.promo_codes
        promo_code_data = await promo_codes_collection.find_one({
            "code": {"$regex": f"^{promo_code}$", "$options": "i"},
            "isActive": True,
            "isArchived": {"$ne": True}
        })
        
        if not promo_code_data:
            raise HTTPException(status_code=404, detail="Promo code not found or inactive")
    
    try:
        result = await service.calculate_discounted_price(plan_id, promo_code_data)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("")
async def get_all_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all site settings (Admin only)"""
    check_admin(current_user)
    
    service = SiteSettingsService(db)
    settings = await service.get_settings()
    
    return {"success": True, "settings": settings}
