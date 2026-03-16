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


class CloverChargeRequest(BaseModel):
    source: str  # clv_ token from clover.createToken()
    amount: str  # Dollar amount as string, e.g. "5.00"
    description: Optional[str] = "Platform Contribution"
    recurring: Optional[bool] = False  # Monthly recurring flag


@router.get("/status")
async def get_clover_status():
    """Check if Clover is configured and available."""
    return {
        "configured": clover_service.is_configured(),
        "environment": clover_service.environment if clover_service.is_configured() else None
    }


@router.get("/sdk-config")
async def get_clover_sdk_config(
    current_user: dict = Depends(get_current_user),
):
    """Return Clover public key and SDK URL for frontend iframe integration."""
    if not clover_service.is_configured():
        raise HTTPException(status_code=503, detail="Clover payments not configured")
    return clover_service.get_public_config()


@router.post("/charge")
async def create_charge(
    request: CloverChargeRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Charge a card using a Clover token from the iframe SDK.
    Called after clover.createToken() on the frontend.
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
    
    # Get user email for receipt
    user_email = user.get("email") or user.get("contactEmail")
    if user_email and user_email.startswith("gAAAAA"):
        try:
            from crypto_utils import get_encryptor
            user_email = get_encryptor().decrypt(user_email)
        except Exception:
            user_email = None
    
    # Create charge via Clover API
    result = await clover_service.create_charge(
        source_token=request.source,
        amount_cents=amount_cents,
        description=request.description or f"Contribution - ${amount_float:.2f}",
        customer_email=user_email,
    )
    
    if result["success"]:
        now = datetime.utcnow()
        is_recurring = request.recurring or False
        payment_type = "contribution_recurring" if is_recurring else "contribution_one_time"
        
        # Log completed payment (match PayPal field names so Contribution Management finds it)
        payment_record = {
            "username": username,
            "amount": amount_float,
            "paymentType": payment_type,
            "paymentProvider": "clover",
            "status": "completed",
            "cloverChargeId": result["charge_id"],
            "description": request.description or f"Clover Card payment - ${amount_float:.2f}",
            "createdAt": now,
            "updatedAt": now,
        }
        await db.payments.insert_one(payment_record)
        
        # If recurring, create a Clover customer (card on file) for future charges
        if is_recurring:
            from dateutil.relativedelta import relativedelta
            next_payment = now + relativedelta(months=1)
            
            # Create Clover customer with stored card
            first_name = user.get("firstName", "")
            last_name = user.get("lastName", "")
            cust_result = await clover_service.create_customer(
                source_token=request.source,
                email=user_email,
                first_name=first_name,
                last_name=last_name,
            )
            
            clover_customer_id = None
            if cust_result.get("success"):
                clover_customer_id = cust_result["customer_id"]
                logger.info(f"Clover customer created for recurring: {clover_customer_id}")
            else:
                logger.warning(f"Failed to create Clover customer for {username}: {cust_result.get('error')}. Recurring will not auto-charge.")
            
            recurring_doc = {
                "username": username,
                "amount": amount_float,
                "currency": "USD",
                "recurring_days": 30,
                "interval": "monthly",
                "payment_method": "clover",
                "clover_customer_id": clover_customer_id,
                "status": "active" if clover_customer_id else "pending_card",
                "last_paid_date": now,
                "next_payment_date": next_payment,
                "total_contributed": amount_float,
                "payment_count": 1,
                "failure_count": 0,
                "created_at": now,
                "updated_at": now,
            }
            await db.recurring_contributions.insert_one(recurring_doc)
            logger.info(f"Clover recurring contribution created for {username}: ${amount_float:.2f}/month (customer: {clover_customer_id})")
        
        # Update user contribution records
        await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "contributions.lastContributionDate": now,
                },
                "$inc": {
                    "contributions.totalContributed": amount_float
                }
            }
        )
        
        # Send thank you email
        try:
            from routers.contribution_routes import send_contribution_thank_you_email
            ptype = "monthly" if is_recurring else "one-time"
            email_sent = await send_contribution_thank_you_email(db, username, amount_float, ptype, "Clover Card")
            if email_sent:
                await db.payments.update_one(
                    {"_id": payment_record["_id"]},
                    {"$set": {"thankYouEmailSentAt": datetime.utcnow()}}
                )
        except Exception as e:
            logger.warning(f"Failed to send Clover card thank-you email: {e}")
        
        recur_label = " (recurring monthly)" if is_recurring else ""
        logger.info(f"Clover card charge successful for {username}: ${request.amount}{recur_label} (charge: {result['charge_id']})")
        
        return {
            "success": True,
            "charge_id": result["charge_id"],
            "amount": request.amount,
            "recurring": is_recurring,
            "message": f"Payment successful! {'Monthly recurring set up.' if is_recurring else 'Thank you for your contribution.'}"
        }
    else:
        logger.error(f"Clover card charge failed for {username}: {result.get('error')}")
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Card charge failed")
        )


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
            "paymentProvider": "clover",
            "provider": "clover",
            "sessionId": result["session_id"],
            "cloverChargeId": result["session_id"],
            "amount": request.amount,
            "paymentType": "contribution_one_time",
            "status": "pending",
            "description": request.description or f"Clover Checkout - ${amount_float:.2f}",
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
        {"username": username, "paymentProvider": "clover", "status": "pending"},
        sort=[("createdAt", -1)]
    )
    
    # Fallback: check legacy field name
    if not pending_payment:
        pending_payment = await db.payments.find_one(
            {"username": username, "provider": "clover", "status": "pending"},
            sort=[("createdAt", -1)]
        )
    
    if not pending_payment:
        raise HTTPException(status_code=404, detail="No pending Clover payment found")
    
    amount = float(pending_payment.get("amount", 0))
    
    # Update payment status and ensure consistent fields
    await db.payments.update_one(
        {"_id": pending_payment["_id"]},
        {"$set": {
            "status": "completed",
            "paymentProvider": "clover",
            "paymentType": pending_payment.get("paymentType") or "contribution_one_time",
            "completedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
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
