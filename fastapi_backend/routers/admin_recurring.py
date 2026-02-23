"""
Admin Recurring Contributions API Routes

Admin-only endpoints for managing all recurring contributions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from services.paypal_service import paypal_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/recurring-contributions", tags=["Admin Recurring"])


class AdminRecurringUpdate(BaseModel):
    """Admin request model for updating recurring contribution."""
    status: Optional[str] = Field(None, description="Status: active, paused, cancelled")
    notes: Optional[str] = Field(None, description="Admin notes")


class ChargeNowRequest(BaseModel):
    """Request model for immediate charging."""
    amount: Optional[float] = Field(None, gt=0, description="Custom amount (optional)")
    notes: Optional[str] = Field(None, description="Charge notes")


def verify_admin(current_user: dict = Depends(get_current_user)):
    """Verify user is admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("")
async def get_all_recurring_contributions(
    status: Optional[str] = Query(None, description="Filter by status"),
    username: Optional[str] = Query(None, description="Filter by username"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(verify_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get all recurring contributions (admin only).
    """
    # Build filter
    filter_query = {}
    if status:
        filter_query["status"] = status
    if username:
        filter_query["username"] = {"$regex": username, "$options": "i"}
    
    # Get contributions
    cursor = db.recurring_contributions.find(filter_query).sort("created_at", -1).skip(offset).limit(limit)
    contributions = []
    
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        contributions.append(doc)
    
    # Get total count
    total = await db.recurring_contributions.count_documents(filter_query)
    
    return {
        "contributions": contributions,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/stats")
async def get_recurring_stats(
    current_user: dict = Depends(verify_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get statistics about recurring contributions.
    """
    pipeline = [
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_amount": {"$sum": "$amount"},
                "avg_amount": {"$avg": "$amount"}
            }
        }
    ]
    
    status_stats = []
    async for doc in db.recurring_contributions.aggregate(pipeline):
        status_stats.append({
            "status": doc["_id"],
            "count": doc["count"],
            "total_amount": doc["total_amount"],
            "avg_amount": doc["avg_amount"]
        })
    
    # Overall stats
    total_active = await db.recurring_contributions.count_documents({"status": "active"})
    total_monthly = await db.recurring_contributions.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {"_id": None, "monthly_total": {"$sum": "$amount"}}}
    ]).to_list(length=1)
    
    monthly_revenue = total_monthly[0]["monthly_total"] if total_monthly else 0
    
    # Due soon (next 7 days)
    soon_date = datetime.utcnow() + timedelta(days=7)
    due_soon = await db.recurring_contributions.count_documents({
        "status": "active",
        "next_payment_date": {"$lte": soon_date}
    })
    
    # Overdue
    overdue = await db.recurring_contributions.count_documents({
        "status": "active",
        "next_payment_date": {"$lt": datetime.utcnow()}
    })
    
    return {
        "by_status": status_stats,
        "total_active": total_active,
        "monthly_revenue": monthly_revenue,
        "due_soon_count": due_soon,
        "overdue_count": overdue
    }


@router.post("/{contribution_id}/charge")
async def charge_contribution_now(
    contribution_id: str,
    request: ChargeNowRequest = ChargeNowRequest(),
    current_user: dict = Depends(verify_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Immediately charge a recurring contribution.
    """
    # Find the contribution
    contribution = await db.recurring_contributions.find_one({"_id": contribution_id})
    
    if not contribution:
        raise HTTPException(
            status_code=404,
            detail="Recurring contribution not found"
        )
    
    if contribution["status"] != "active":
        raise HTTPException(
            status_code=400,
            detail="Can only charge active contributions"
        )
    
    # Use custom amount or default
    charge_amount = request.amount or contribution["amount"]
    
    if not paypal_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="PayPal is not configured"
        )
    
    try:
        # Charge using PayPal vault token
        result = await paypal_service.create_order(
            amount=str(charge_amount),
            currency="USD",
            description=f"Recurring contribution - {request.notes or 'Manual charge'}",
            custom_id=f"recurring_{contribution_id}"
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"PayPal charge failed: {result.get('error', 'Unknown error')}"
            )
        
        # Capture the payment
        capture_result = await paypal_service.capture_order(result["order_id"])
        
        if not capture_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"PayPal capture failed: {capture_result.get('error', 'Unknown error')}"
            )
        
        # Update contribution record
        now = datetime.utcnow()
        next_payment = now + timedelta(days=contribution["recurring_days"])
        
        await db.recurring_contributions.update_one(
            {"_id": contribution_id},
            {
                "$set": {
                    "last_paid_date": now,
                    "next_payment_date": next_payment,
                    "updated_at": now,
                    "failure_count": 0
                },
                "$inc": {
                    "total_contributed": charge_amount,
                    "payment_count": 1
                }
            }
        )
        
        # Log the transaction (would ideally go to a separate transactions collection)
        await db.recurring_transactions.insert_one({
            "contribution_id": contribution_id,
            "username": contribution["username"],
            "amount": charge_amount,
            "currency": "USD",
            "status": "completed",
            "paypal_order_id": result["order_id"],
            "paypal_capture_id": capture_result.get("capture_id"),
            "notes": request.notes,
            "created_at": now,
            "admin_charged": True,
            "admin_username": current_user["username"]
        })
        
        return {
            "message": "Charge successful",
            "amount": charge_amount,
            "order_id": result["order_id"],
            "next_payment_date": next_payment
        }
        
    except Exception as e:
        logger.error(f"Failed to charge recurring contribution {contribution_id}: {e}")
        
        # Update failure count
        await db.recurring_contributions.update_one(
            {"_id": contribution_id},
            {"$inc": {"failure_count": 1}}
        )
        
        raise HTTPException(
            status_code=500,
            detail=f"Charge failed: {str(e)}"
        )


@router.post("/{contribution_id}/pause")
async def pause_contribution(
    contribution_id: str,
    current_user: dict = Depends(verify_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Pause a recurring contribution.
    """
    result = await db.recurring_contributions.update_one(
        {"_id": contribution_id},
        {
            "$set": {
                "status": "paused",
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Recurring contribution not found"
        )
    
    return {"message": "Contribution paused successfully"}


@router.post("/{contribution_id}/resume")
async def resume_contribution(
    contribution_id: str,
    current_user: dict = Depends(verify_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Resume a paused recurring contribution.
    """
    # Get current contribution
    contribution = await db.recurring_contributions.find_one({"_id": contribution_id})
    
    if not contribution:
        raise HTTPException(
            status_code=404,
            detail="Recurring contribution not found"
        )
    
    if contribution["status"] != "paused":
        raise HTTPException(
            status_code=400,
            detail="Can only resume paused contributions"
        )
    
    # Calculate next payment date
    now = datetime.utcnow()
    last_paid = contribution.get("last_paid_date")
    
    if last_paid:
        next_payment = last_paid + timedelta(days=contribution["recurring_days"])
        # If next payment is in the past, set it to tomorrow
        if next_payment < now:
            next_payment = now + timedelta(days=1)
    else:
        next_payment = now + timedelta(days=contribution["recurring_days"])
    
    await db.recurring_contributions.update_one(
        {"_id": contribution_id},
        {
            "$set": {
                "status": "active",
                "next_payment_date": next_payment,
                "updated_at": now,
                "failure_count": 0
            }
        }
    )
    
    return {"message": "Contribution resumed successfully", "next_payment_date": next_payment}


@router.post("/{contribution_id}/cancel")
async def admin_cancel_contribution(
    contribution_id: str,
    current_user: dict = Depends(verify_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Cancel a recurring contribution (admin action).
    """
    result = await db.recurring_contributions.update_one(
        {"_id": contribution_id},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Recurring contribution not found"
        )
    
    return {"message": "Contribution cancelled successfully"}


@router.get("/overdue/list")
async def get_overdue_contributions(
    current_user: dict = Depends(verify_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get all overdue recurring contributions.
    """
    now = datetime.utcnow()
    
    cursor = db.recurring_contributions.find({
        "status": "active",
        "next_payment_date": {"$lt": now}
    }).sort("next_payment_date", 1)
    
    overdue = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        doc["days_overdue"] = (now - doc["next_payment_date"]).days
        overdue.append(doc)
    
    return {
        "overdue": overdue,
        "count": len(overdue)
    }
