"""
Membership Transactions Router
Purpose: Save and list membership payment transactions
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["membership-transactions"])


class MembershipActivateRequest(BaseModel):
    plan_id: str
    plan_name: str
    amount: float
    payment_method: str  # 'paypal' or 'clover'
    transaction_id: str
    promo_code: Optional[str] = None
    discount_amount: Optional[float] = 0


def check_admin(current_user: dict):
    role = current_user.get("role") or current_user.get("role_name")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.post("/api/membership/activate")
async def activate_membership(
    body: MembershipActivateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Save membership transaction and update user's membership status"""
    username = current_user.get("username")
    if not username:
        raise HTTPException(status_code=400, detail="Username not found in token")

    now = datetime.now(timezone.utc)

    # Determine expiry based on plan
    expires_at = None
    if body.plan_id == 'premium':
        from datetime import timedelta
        expires_at = now + timedelta(days=365)
    # lifetime: expires_at stays None

    # Build transaction document
    transaction = {
        "username": username,
        "fullName": current_user.get("fullName") or f"{current_user.get('firstName', '')} {current_user.get('lastName', '')}".strip(),
        "planId": body.plan_id,
        "planName": body.plan_name,
        "amount": body.amount,
        "paymentMethod": body.payment_method,
        "transactionId": body.transaction_id,
        "promoCode": body.promo_code,
        "discountAmount": body.discount_amount or 0,
        "activatedAt": now,
        "expiresAt": expires_at,
        "createdAt": now,
    }

    # Save transaction
    result = await db.membership_transactions.insert_one(transaction)
    transaction["_id"] = str(result.inserted_id)

    # Update user's membership status
    update_fields = {
        "isPremium": True,
        "premiumStatus": body.plan_id,
        "membershipPlanId": body.plan_id,
        # NOTE: role_name intentionally NOT updated yet — membership limits not enforced in production
        "premiumActivatedAt": now,
        "membershipAmount": body.amount,
        "membershipPaymentMethod": body.payment_method,
        "membershipTransactionId": body.transaction_id,
    }
    if expires_at:
        update_fields["premiumExpiresAt"] = expires_at

    await db.users.update_one(
        {"username": username},
        {"$set": update_fields}
    )

    logger.info(f"Membership activated: {username} -> {body.plan_id} (${body.amount}) via {body.payment_method}")

    return {
        "success": True,
        "message": f"{body.plan_name} membership activated",
        "transaction_id": str(result.inserted_id),
    }


@router.get("/api/admin/membership-transactions")
async def list_membership_transactions(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    search: Optional[str] = Query(None, description="Search by username or full name"),
    plan_filter: Optional[str] = Query(None, alias="plan", description="Filter by plan (premium, lifetime)"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method (paypal, clover)"),
    sort_by: Optional[str] = Query("createdAt", description="Sort field"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Admin-only: List all membership transactions with search, filter, sort"""
    check_admin(current_user)

    # Build query
    query = {}
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"username": search_regex},
            {"fullName": search_regex},
        ]
    if plan_filter:
        query["planId"] = plan_filter
    if payment_method:
        query["paymentMethod"] = payment_method

    # Build sort
    sort_dir = -1 if sort_order == "desc" else 1
    sort_field = sort_by if sort_by in ["createdAt", "activatedAt", "amount", "username", "planId", "paymentMethod"] else "createdAt"

    total = await db.membership_transactions.count_documents(query)
    total_pages = max(1, (total + limit - 1) // limit)

    cursor = db.membership_transactions.find(query) \
        .sort(sort_field, sort_dir) \
        .skip((page - 1) * limit) \
        .limit(limit)

    transactions = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if doc.get("activatedAt"):
            doc["activatedAt"] = doc["activatedAt"].isoformat()
        if doc.get("createdAt"):
            doc["createdAt"] = doc["createdAt"].isoformat()
        if doc.get("expiresAt"):
            doc["expiresAt"] = doc["expiresAt"].isoformat()
        transactions.append(doc)

    return {
        "success": True,
        "transactions": transactions,
        "total": total,
        "page": page,
        "totalPages": total_pages,
        "limit": limit,
    }
