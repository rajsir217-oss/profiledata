"""
Braintree Payment Routes

API endpoints for Braintree/PayPal payment processing.
Works alongside Stripe for payment provider choice.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.braintree_service import braintree_service
from database import get_database
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/braintree", tags=["braintree-payments"])


class PaymentRequest(BaseModel):
    payment_method_nonce: str
    amount: str
    plan_type: Optional[str] = None  # "monthly", "yearly", etc.
    order_id: Optional[str] = None


class SubscriptionRequest(BaseModel):
    payment_method_token: str
    plan_id: str
    price: Optional[str] = None


@router.get("/status")
async def get_braintree_status():
    """Check if Braintree is configured and available."""
    return {
        "configured": braintree_service.is_configured(),
        "environment": "sandbox" if braintree_service.is_configured() else None
    }


@router.get("/client-token")
async def get_client_token(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Generate a client token for the Braintree Drop-in UI.
    
    This token is required to initialize the payment form on the frontend.
    """
    if not braintree_service.is_configured():
        raise HTTPException(status_code=503, detail="Braintree payments not configured")
    
    username = current_user["username"]
    
    # Try to find or create Braintree customer
    user = await db.users.find_one({"username": username})
    customer_id = None
    
    if user:
        # Check if user has a Braintree customer ID
        braintree_customer_id = user.get("braintreeCustomerId")
        
        if not braintree_customer_id:
            # Create new Braintree customer
            customer_id = braintree_service.find_or_create_customer({
                "username": username,
                "email": user.get("email") or user.get("contactEmail"),
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", "")
            })
            
            if customer_id:
                # Save customer ID to user record
                await db.users.update_one(
                    {"username": username},
                    {"$set": {"braintreeCustomerId": customer_id}}
                )
        else:
            customer_id = braintree_customer_id
    
    # Generate client token
    client_token = braintree_service.generate_client_token(customer_id)
    
    if not client_token:
        raise HTTPException(status_code=500, detail="Failed to generate client token")
    
    return {"clientToken": client_token}


@router.post("/process-payment")
async def process_payment(
    request: PaymentRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Process a one-time payment via Braintree.
    
    This handles credit card, PayPal, and other payment methods
    supported by Braintree Drop-in UI.
    """
    if not braintree_service.is_configured():
        raise HTTPException(status_code=503, detail="Braintree payments not configured")
    
    username = current_user["username"]
    user = await db.users.find_one({"username": username})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    customer_id = user.get("braintreeCustomerId")
    
    # Process the payment
    result = braintree_service.process_payment(
        payment_method_nonce=request.payment_method_nonce,
        amount=request.amount,
        order_id=request.order_id,
        customer_id=customer_id,
        store_in_vault=True  # Save payment method for future use
    )
    
    if result["success"]:
        # Record the payment in database
        payment_record = {
            "username": username,
            "provider": "braintree",
            "transactionId": result["transaction_id"],
            "amount": request.amount,
            "planType": request.plan_type,
            "status": "completed",
            "paymentType": result.get("payment_type"),
            "createdAt": datetime.utcnow()
        }
        await db.payments.insert_one(payment_record)
        
        # Update user subscription if plan_type provided
        if request.plan_type:
            await _update_user_subscription(db, username, request.plan_type, result["transaction_id"])
        
        logger.info(f"Braintree payment successful for {username}: ${request.amount}")
        return {
            "success": True,
            "transactionId": result["transaction_id"],
            "message": "Payment processed successfully"
        }
    else:
        logger.error(f"Braintree payment failed for {username}: {result.get('error')}")
        raise HTTPException(status_code=400, detail=result.get("error", "Payment failed"))


@router.get("/transaction/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get details of a specific transaction."""
    if not braintree_service.is_configured():
        raise HTTPException(status_code=503, detail="Braintree payments not configured")
    
    # Verify user owns this transaction
    payment = await db.payments.find_one({
        "transactionId": transaction_id,
        "username": current_user["username"]
    })
    
    if not payment:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction = braintree_service.get_transaction(transaction_id)
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found in Braintree")
    
    return transaction


@router.post("/refund/{transaction_id}")
async def refund_transaction(
    transaction_id: str,
    amount: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Refund a transaction (admin only).
    
    Args:
        transaction_id: The transaction to refund
        amount: Optional partial refund amount
    """
    # Check if user is admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not braintree_service.is_configured():
        raise HTTPException(status_code=503, detail="Braintree payments not configured")
    
    result = braintree_service.refund_transaction(transaction_id, amount)
    
    if result["success"]:
        # Update payment record
        await db.payments.update_one(
            {"transactionId": transaction_id},
            {
                "$set": {
                    "status": "refunded",
                    "refundId": result["refund_id"],
                    "refundAmount": result["amount"],
                    "refundedAt": datetime.utcnow()
                }
            }
        )
        return result
    else:
        raise HTTPException(status_code=400, detail=result.get("error", "Refund failed"))


@router.get("/payment-history")
async def get_payment_history(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get user's payment history (both Stripe and Braintree)."""
    username = current_user["username"]
    
    payments = await db.payments.find(
        {"username": username}
    ).sort("createdAt", -1).to_list(100)
    
    # Convert ObjectId to string
    for payment in payments:
        payment["_id"] = str(payment["_id"])
        if "createdAt" in payment:
            payment["createdAt"] = payment["createdAt"].isoformat()
        if "refundedAt" in payment:
            payment["refundedAt"] = payment["refundedAt"].isoformat()
    
    return {"payments": payments}


async def _update_user_subscription(db, username: str, plan_type: str, transaction_id: str):
    """Update user's subscription status after successful payment."""
    from datetime import timedelta
    
    # Calculate subscription end date based on plan
    now = datetime.utcnow()
    if plan_type == "yearly":
        end_date = now + timedelta(days=365)
    elif plan_type == "6month":
        end_date = now + timedelta(days=180)
    elif plan_type == "3month":
        end_date = now + timedelta(days=90)
    else:  # monthly
        end_date = now + timedelta(days=30)
    
    await db.users.update_one(
        {"username": username},
        {
            "$set": {
                "subscriptionStatus": "active",
                "subscriptionPlan": plan_type,
                "subscriptionStartDate": now,
                "subscriptionEndDate": end_date,
                "lastPaymentId": transaction_id,
                "lastPaymentProvider": "braintree"
            }
        }
    )
    
    logger.info(f"Updated subscription for {username}: {plan_type} until {end_date}")
