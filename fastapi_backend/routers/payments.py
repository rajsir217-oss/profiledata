"""
Payment History API Routes
Created: December 26, 2025
Purpose: API endpoints for payment history tracking
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from models.payment_models import PaymentCreate
from services.payment_service import PaymentService


router = APIRouter(prefix="/api/payments", tags=["payments"])


def check_admin(current_user: dict):
    """Check if user is admin"""
    role = current_user.get("role_name", "free_user")
    username = current_user.get("username", "")
    if role != "admin" and username != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.post("")
async def create_payment(
    payment: PaymentCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a new payment record (Admin only)"""
    check_admin(current_user)
    
    service = PaymentService(db)
    result = await service.create_payment(payment, created_by=current_user.get("username"))
    
    return {"success": True, "payment": result}


@router.get("/user/{username}")
async def get_user_payments(
    username: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get payment history for a specific user (Admin only)"""
    check_admin(current_user)
    
    service = PaymentService(db)
    summary = await service.get_user_payment_summary(username)
    
    return {"success": True, **summary}


@router.get("/promo-code/{code}")
async def get_promo_code_payments(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all payments associated with a promo code (Admin only)"""
    check_admin(current_user)
    
    service = PaymentService(db)
    result = await service.get_revenue_by_promo_code(code)
    
    return {"success": True, **result}


@router.get("")
async def get_all_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all payments with pagination (Admin only)"""
    check_admin(current_user)
    
    service = PaymentService(db)
    skip = (page - 1) * limit
    payments, total = await service.get_all_payments(skip=skip, limit=limit)
    
    pages = (total + limit - 1) // limit
    
    return {
        "success": True,
        "payments": payments,
        "total": total,
        "page": page,
        "pages": pages
    }


@router.get("/yearly-summary")
async def get_yearly_summary(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get payment summary grouped by year (Admin only)"""
    check_admin(current_user)
    
    service = PaymentService(db)
    summary = await service.get_yearly_summary()
    
    return {"success": True, **summary}


@router.get("/year/{year}")
async def get_year_payments(
    year: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all payments for a specific year (Admin only)"""
    check_admin(current_user)
    
    service = PaymentService(db)
    payments = await service.get_payments_by_year(year)
    
    # Get year summary info
    year_data = None
    summary = await service.get_yearly_summary()
    for y in summary.get("years", []):
        if y["year"] == year:
            year_data = y
            break
    
    return {
        "success": True,
        "year": year,
        "payments": payments,
        "summary": year_data or {
            "totalPayments": len(payments),
            "totalRevenue": sum(p.get("amount", 0) for p in payments),
            "uniqueUsers": len(set(p.get("username") for p in payments))
        }
    }


@router.delete("/purge/{year}")
async def purge_year_data(
    year: int,
    archive: bool = Query(True, description="Archive before deleting"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Purge payment data for a specific year (Admin only)"""
    check_admin(current_user)
    
    # Validate year
    from datetime import datetime
    current_year = datetime.now().year
    if year >= current_year:
        raise HTTPException(status_code=400, detail="Cannot purge current or future year data")
    
    service = PaymentService(db)
    result = await service.purge_year_data(year, archive=archive, purged_by=current_user.get("username"))
    
    return {"success": True, **result}
