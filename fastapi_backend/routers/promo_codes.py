"""
Promo Code API Routes
Created: December 26, 2025
Purpose: API endpoints for promo code management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from models.promo_code_models import (
    PromoCodeCreate,
    PromoCodeUpdate,
    PromoCodeResponse,
    PromoCodeListResponse,
    PromoCodeType,
    PromoCodeStats
)
from services.promo_code_service import PromoCodeService


router = APIRouter(prefix="/api/promo-codes", tags=["promo-codes"])


def check_admin(current_user: dict):
    """Check if user is admin"""
    # Check both 'role' (from JWT) and 'role_name' (from DB) for compatibility
    role = current_user.get("role") or current_user.get("role_name", "free_user")
    username = current_user.get("username", "")
    if role != "admin" and username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


# ============== Admin Endpoints ==============

@router.post("", response_model=PromoCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_promo_code(
    promo_data: PromoCodeCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Create a new promo code (Admin only)
    
    - **code**: Unique promo code (will be stored uppercase)
    - **name**: Display name
    - **type**: community, event, referral, or campaign
    - **discountType**: percentage, fixed, or none
    - **discountValue**: Discount amount
    """
    check_admin(current_user)
    
    service = PromoCodeService(db)
    
    try:
        promo = await service.create_promo_code(
            promo_data=promo_data,
            created_by=current_user["username"]
        )
        # Service now returns dict directly
        return service._to_response(promo)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import logging
        logging.error(f"Error creating promo code: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {str(e)}"
        )


@router.get("", response_model=PromoCodeListResponse)
async def list_promo_codes(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    code_type: Optional[PromoCodeType] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List all promo codes (Admin only)
    
    - **page**: Page number
    - **limit**: Items per page
    - **code_type**: Filter by type
    - **is_active**: Filter by active status
    - **search**: Search in code, name, description
    """
    check_admin(current_user)
    
    service = PromoCodeService(db)
    skip = (page - 1) * limit
    
    promos, total = await service.list_promo_codes(
        skip=skip,
        limit=limit,
        code_type=code_type,
        is_active=is_active,
        search=search
    )
    
    pages = (total + limit - 1) // limit
    
    return PromoCodeListResponse(
        promoCodes=promos,
        total=total,
        page=page,
        pages=pages
    )


@router.get("/analytics")
async def get_promo_code_analytics(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get comprehensive promo code analytics (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    analytics = await service.get_analytics()
    
    return {"success": True, **analytics}


@router.get("/archived/list", response_model=PromoCodeListResponse)
async def list_archived_promo_codes(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """List all archived promo codes (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    skip = (page - 1) * limit
    
    promos, total = await service.list_archived_promo_codes(skip=skip, limit=limit)
    
    pages = (total + limit - 1) // limit
    
    return PromoCodeListResponse(
        promoCodes=promos,
        total=total,
        page=page,
        pages=pages
    )


@router.get("/users/{code}")
async def get_users_by_promo_code(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all users who registered with a specific promo code (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    users = await service.get_users_by_promo_code(code)
    
    # Calculate total revenue from this promo code
    total_revenue = sum(u.get("amount", 0) for u in users if u.get("isPaid"))
    
    return {
        "success": True,
        "code": code,
        "totalUsers": len(users),
        "totalRevenue": total_revenue,
        "users": users
    }


@router.get("/dropdown", response_model=List[dict])
async def get_promo_codes_for_dropdown(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get all active promo codes for dropdown selection
    Returns simplified list with code, name, type
    """
    service = PromoCodeService(db)
    return await service.get_all_active_codes_for_dropdown()


@router.get("/stats", response_model=PromoCodeStats)
async def get_promo_code_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get overall promo code statistics (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    return await service.get_stats()


@router.get("/validate/{code}")
async def validate_promo_code(
    code: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Validate a promo code (Public endpoint for registration)
    
    Returns validity status and discount info if valid
    """
    service = PromoCodeService(db)
    return await service.validate_promo_code(code)


@router.get("/my-code")
async def get_my_promo_code(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get current user's personal promo code"""
    service = PromoCodeService(db)
    code = await service.get_user_promo_code(current_user["username"])
    
    return {
        "username": current_user["username"],
        "promoCode": code
    }


@router.get("/{code}", response_model=PromoCodeResponse)
async def get_promo_code(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get a specific promo code by code string (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    promo = await service.get_promo_code(code)
    
    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{code}' not found"
        )
    
    return promo


@router.put("/{code}", response_model=PromoCodeResponse)
async def update_promo_code(
    code: str,
    update_data: PromoCodeUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update a promo code (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    promo = await service.update_promo_code(code, update_data)
    
    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{code}' not found"
        )
    
    return promo


@router.delete("/{code}")
async def delete_promo_code(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a promo code - only if no usage (Admin only)"""
    check_admin(current_user)
    
    # System codes cannot be deleted
    if code.upper() == 'NOPROMOCODE':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System code 'NOPROMOCODE' cannot be deleted"
        )
    
    service = PromoCodeService(db)
    
    # Check if code has usage - if so, must use archive instead
    promo = await service.get_promo_code(code)
    if promo and promo.createdBy == 'system':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System codes cannot be deleted"
        )
    if promo and (promo.currentUses > 0 or promo.registrations > 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete promo code with usage. Use archive instead."
        )
    
    deleted = await service.delete_promo_code(code)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{code}' not found"
        )
    
    return {"success": True, "message": f"Promo code '{code}' deleted"}


@router.post("/{code}/archive")
async def archive_promo_code(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Archive a promo code (soft delete) - Admin only"""
    check_admin(current_user)
    
    # System codes cannot be archived
    if code.upper() == 'NOPROMOCODE':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System code 'NOPROMOCODE' cannot be archived"
        )
    
    service = PromoCodeService(db)
    
    # Check if it's a system code
    promo = await service.get_promo_code(code)
    if promo and promo.createdBy == 'system':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System codes cannot be archived"
        )
    
    archived = await service.archive_promo_code(code)
    
    if not archived:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{code}' not found"
        )
    
    return {"success": True, "message": f"Promo code '{code}' archived"}


@router.post("/{code}/restore")
async def restore_promo_code(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Restore an archived promo code - Admin only"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    restored = await service.restore_promo_code(code)
    
    if not restored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{code}' not found"
        )
    
    return {"success": True, "message": f"Promo code '{code}' restored"}


@router.delete("/{code}/permanent")
async def permanently_delete_promo_code(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Permanently delete an archived promo code (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    
    # Only allow permanent deletion of archived codes
    promo = await service.get_promo_code(code)
    if promo and not promo.isArchived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code must be archived before permanent deletion. Archive it first."
        )
    
    deleted = await service.delete_promo_code(code)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{code}' not found"
        )
    
    return {"success": True, "message": f"Promo code '{code}' permanently deleted"}


@router.post("/{code}/increment-usage")
async def increment_promo_code_usage(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Increment usage count for a promo code (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    success = await service.increment_usage(code)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{code}' not found"
        )
    
    return {"success": True, "message": "Usage incremented"}


@router.post("/{code}/record-conversion")
async def record_promo_code_conversion(
    code: str,
    revenue: float = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Record a conversion (paid membership) for a promo code (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    success = await service.record_conversion(code, revenue)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{code}' not found"
        )
    
    return {"success": True, "message": "Conversion recorded"}


# ============== User Promo Code Management ==============

@router.put("/user/{username}/promo-code")
async def set_user_promo_code(
    username: str,
    promo_code: str = Query(..., min_length=3, max_length=50),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Set a user's personal promo code (Admin only)"""
    check_admin(current_user)
    
    service = PromoCodeService(db)
    success = await service.set_user_promo_code(username, promo_code.upper())
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{username}' not found"
        )
    
    return {"success": True, "message": f"Promo code set for {username}"}


@router.get("/user/{username}/promo-code")
async def get_user_promo_code(
    username: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get a user's personal promo code"""
    # Users can only see their own code, admins can see any
    role = current_user.get("role_name", "free_user")
    if role != "admin" and current_user["username"] != username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own promo code"
        )
    
    service = PromoCodeService(db)
    code = await service.get_user_promo_code(username)
    
    return {
        "username": username,
        "promoCode": code
    }
