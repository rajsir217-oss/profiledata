"""
Recurring Contributions API Routes

Manages recurring contribution payments with PayPal vault tokens.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contributions/recurring", tags=["Recurring Contributions"])


class RecurringContributionCreate(BaseModel):
    """Request model for creating a recurring contribution."""
    amount: float = Field(..., gt=0, description="Contribution amount")
    recurring_days: int = Field(..., gt=0, le=365, description="Days between payments")
    paypal_vault_id: str = Field(..., description="PayPal vault token ID")
    notes: Optional[str] = Field(None, description="Optional notes")


class RecurringContributionUpdate(BaseModel):
    """Request model for updating a recurring contribution."""
    amount: Optional[float] = Field(None, gt=0, description="New contribution amount")
    recurring_days: Optional[int] = Field(None, gt=0, le=365, description="Days between payments")
    status: Optional[str] = Field(None, description="Status: active, paused, cancelled")
    notes: Optional[str] = Field(None, description="Optional notes")


class RecurringContributionResponse(BaseModel):
    """Response model for recurring contribution."""
    id: str
    username: str
    amount: float
    currency: str
    recurring_days: int
    paypal_vault_id: str
    status: str
    last_paid_date: Optional[datetime]
    next_payment_date: datetime
    created_at: datetime
    updated_at: datetime
    total_contributed: float
    payment_count: int
    failure_count: int
    notes: Optional[str]


@router.post("/setup", response_model=RecurringContributionResponse)
async def setup_recurring_contribution(
    contribution: RecurringContributionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Set up a new recurring contribution.
    
    This creates a recurring contribution record that will be charged
    automatically based on the specified interval.
    """
    username = current_user.get("username")
    
    # Check if user already has an active recurring contribution
    existing = await db.recurring_contributions.find_one({
        "username": username,
        "status": "active"
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="User already has an active recurring contribution"
        )
    
    # Create new recurring contribution
    now = datetime.utcnow()
    next_payment = now + timedelta(days=contribution.recurring_days)
    
    doc = {
        "username": username,
        "amount": contribution.amount,
        "currency": "USD",
        "recurring_days": contribution.recurring_days,
        "paypal_vault_id": contribution.paypal_vault_id,
        "status": "active",
        "last_paid_date": None,
        "next_payment_date": next_payment,
        "created_at": now,
        "updated_at": now,
        "total_contributed": 0.0,
        "payment_count": 0,
        "failure_count": 0,
        "notes": contribution.notes
    }
    
    result = await db.recurring_contributions.insert_one(doc)
    
    # Return the created contribution
    doc["id"] = str(result.inserted_id)
    return RecurringContributionResponse(**doc)


@router.get("/", response_model=List[RecurringContributionResponse])
async def get_user_recurring_contributions(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get all recurring contributions for the current user.
    """
    username = current_user.get("username")
    
    cursor = db.recurring_contributions.find({"username": username}).sort("created_at", -1)
    contributions = []
    
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        contributions.append(RecurringContributionResponse(**doc))
    
    return contributions


@router.put("/{contribution_id}", response_model=RecurringContributionResponse)
async def update_recurring_contribution(
    contribution_id: str,
    update: RecurringContributionUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update a recurring contribution (amount, frequency, status, etc.).
    """
    username = current_user.get("username")
    
    # Find the contribution
    contribution = await db.recurring_contributions.find_one({
        "_id": contribution_id,
        "username": username
    })
    
    if not contribution:
        raise HTTPException(
            status_code=404,
            detail="Recurring contribution not found"
        )
    
    # Prepare update fields
    update_fields = {"updated_at": datetime.utcnow()}
    
    if update.amount is not None:
        update_fields["amount"] = update.amount
    
    if update.recurring_days is not None:
        update_fields["recurring_days"] = update.recurring_days
        # Recalculate next payment date
        if contribution.get("last_paid_date"):
            update_fields["next_payment_date"] = contribution["last_paid_date"] + timedelta(days=update.recurring_days)
    
    if update.status is not None:
        if update.status not in ["active", "paused", "cancelled"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid status. Must be: active, paused, or cancelled"
            )
        update_fields["status"] = update.status
    
    if update.notes is not None:
        update_fields["notes"] = update.notes
    
    # Update the contribution
    await db.recurring_contributions.update_one(
        {"_id": contribution_id},
        {"$set": update_fields}
    )
    
    # Return updated contribution
    updated = await db.recurring_contributions.find_one({"_id": contribution_id})
    updated["id"] = str(updated["_id"])
    return RecurringContributionResponse(**updated)


@router.delete("/{contribution_id}")
async def cancel_recurring_contribution(
    contribution_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Cancel a recurring contribution.
    """
    username = current_user.get("username")
    
    # Find and update the contribution
    result = await db.recurring_contributions.update_one(
        {"_id": contribution_id, "username": username},
        {"$set": {
            "status": "cancelled",
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Recurring contribution not found"
        )
    
    return {"message": "Recurring contribution cancelled successfully"}


@router.get("/{contribution_id}/history")
async def get_contribution_history(
    contribution_id: str,
    limit: int = Query(10, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get payment history for a specific recurring contribution.
    """
    username = current_user.get("username")
    
    # Verify ownership
    contribution = await db.recurring_contributions.find_one({
        "_id": contribution_id,
        "username": username
    })
    
    if not contribution:
        raise HTTPException(
            status_code=404,
            detail="Recurring contribution not found"
        )
    
    # Get payment history (would need a separate collection for transactions)
    # For now, return basic info
    return {
        "contribution_id": contribution_id,
        "total_contributed": contribution.get("total_contributed", 0),
        "payment_count": contribution.get("payment_count", 0),
        "last_paid_date": contribution.get("last_paid_date"),
        "next_payment_date": contribution.get("next_payment_date")
    }
