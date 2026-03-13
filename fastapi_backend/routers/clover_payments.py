"""
Clover Hosted Checkout Payment Routes

API endpoints for Clover payment processing via Hosted Checkout.
Creates checkout sessions that redirect users to Clover's hosted payment page.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.clover_service import clover_service
from database import get_database
from datetime import datetime
from config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clover", tags=["clover-payments"])


class CloverCheckoutRequest(BaseModel):
    amount: str  # Dollar amount as string, e.g. "25.00"
    description: Optional[str] = "Platform Contribution"


@router.get("/status")
async def get_clover_status():
    """Check if Clover is configured and available."""
    return {
        "configured": clover_service.is_configured(),
        "environment": clover_service.environment if clover_service.is_configured() else None
    }


@router.post("/create-checkout")
async def create_checkout(
    request: CloverCheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Create a Clover Hosted Checkout session for a contribution.
    
    Returns a checkout URL that the frontend opens in a new tab.
    The user completes payment on Clover's hosted page, then gets
    redirected back to the app.
    """
    if not clover_service.is_configured():
        raise HTTPException(status_code=503, detail="Clover payments not configured")
    
    username = current_user["username"]
    user = await db.users.find_one({"username": username})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Parse amount
    try:
        amount_float = float(request.amount)
        if amount_float < 1:
            raise ValueError("Minimum amount is $1")
        amount_cents = int(round(amount_float * 100))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid amount: {e}")
    
    # Get user info for Clover customer fields
    user_email = user.get("email") or user.get("contactEmail")
    # Decrypt if encrypted
    if user_email and user_email.startswith("gAAAAA"):
        try:
            from crypto_utils import get_encryptor
            user_email = get_encryptor().decrypt(user_email)
        except Exception:
            user_email = None
    
    first_name = user.get("firstName", "")
    last_name = user.get("lastName", "")
    
    # Build redirect URLs — Clover requires HTTPS, so only include for production
    frontend_url = settings.frontend_url.rstrip("/")
    success_url = None
    failure_url = None
    if frontend_url.startswith("https://"):
        success_url = f"{frontend_url}/contribution/clover-success"
        failure_url = f"{frontend_url}/contribution/clover-failure"
    
    # Create checkout session
    result = await clover_service.create_checkout_session(
        amount_cents=amount_cents,
        description=request.description or f"Contribution - ${amount_float:.2f}",
        customer_email=user_email,
        customer_first_name=first_name,
        customer_last_name=last_name,
        success_url=success_url,
        failure_url=failure_url,
    )
    
    if result["success"]:
        # Log the pending checkout in payments collection
        payment_record = {
            "username": username,
            "provider": "clover",
            "sessionId": result["session_id"],
            "amount": request.amount,
            "status": "pending",
            "description": request.description,
            "createdAt": datetime.utcnow(),
            "expirationTime": result.get("expiration_time")
        }
        await db.payments.insert_one(payment_record)
        
        logger.info(f"Clover checkout created for {username}: ${request.amount} (session: {result['session_id']})")
        
        return {
            "success": True,
            "checkout_url": result["checkout_url"],
            "session_id": result["session_id"],
            "expires_in_minutes": 15
        }
    else:
        logger.error(f"Clover checkout failed for {username}: {result.get('error')}")
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to create Clover checkout session")
        )


@router.post("/confirm-payment")
async def confirm_clover_payment(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Called by frontend after user returns from Clover success URL.
    Marks the most recent pending Clover payment as completed and
    updates user contribution records.
    """
    username = current_user["username"]
    
    # Find the most recent pending Clover payment for this user
    pending_payment = await db.payments.find_one(
        {"username": username, "provider": "clover", "status": "pending"},
        sort=[("createdAt", -1)]
    )
    
    if not pending_payment:
        raise HTTPException(status_code=404, detail="No pending Clover payment found")
    
    amount = float(pending_payment.get("amount", 0))
    
    # Update payment status
    await db.payments.update_one(
        {"_id": pending_payment["_id"]},
        {"$set": {
            "status": "completed",
            "completedAt": datetime.utcnow()
        }}
    )
    
    # Update user contribution records
    await db.users.update_one(
        {"username": username},
        {
            "$set": {
                "contributions.lastContributionDate": datetime.utcnow(),
            },
            "$inc": {
                "contributions.totalContributed": amount
            }
        }
    )
    
    # Send thank you email (fire and forget)
    try:
        from routers.contribution_routes import send_contribution_thank_you_email
        await send_contribution_thank_you_email(db, username, amount, "one-time", "Clover")
    except Exception as e:
        logger.warning(f"Failed to send Clover thank-you email: {e}")
    
    logger.info(f"Clover payment confirmed for {username}: ${amount:.2f}")
    
    return {
        "success": True,
        "message": "Payment confirmed successfully",
        "amount": f"{amount:.2f}"
    }
