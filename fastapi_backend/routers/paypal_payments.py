"""
PayPal Direct Checkout API Routes

Handles PayPal order creation, capture, and management.
"""

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.paypal_service import paypal_service
from database import get_database
from config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/paypal", tags=["PayPal Payments"])


class CreateOrderRequest(BaseModel):
    """Request model for creating a PayPal order."""
    amount: str  # e.g., "29.99"
    currency: str = "USD"
    plan_id: Optional[str] = None  # Internal plan ID for reference
    description: Optional[str] = None


class CaptureOrderRequest(BaseModel):
    """Request model for capturing a PayPal order."""
    order_id: str


class RefundRequest(BaseModel):
    """Request model for refunding a capture."""
    capture_id: str
    amount: Optional[str] = None  # Partial refund amount (full if not specified)
    note: Optional[str] = None


class CreateSetupTokenRequest(BaseModel):
    """Request model for creating a PayPal setup token."""
    description: Optional[str] = None


class CreatePaymentTokenRequest(BaseModel):
    """Request model for creating a PayPal payment token from setup token."""
    setup_token_id: str


@router.get("/client-id")
async def get_paypal_client_id():
    """
    Get the PayPal client ID for frontend SDK initialization.
    This endpoint is public (no auth required) as it only returns the public client ID.
    """
    client_id = paypal_service.get_client_id()
    if not client_id:
        raise HTTPException(status_code=503, detail="PayPal is not configured")
    
    return {
        "client_id": client_id,
        "mode": settings.paypal_mode or "sandbox"
    }


@router.get("/test-config")
async def test_paypal_config():
    """
    Test PayPal configuration and return status.
    """
    is_configured = paypal_service.is_configured()
    mode = getattr(paypal_service, 'mode', 'unknown')
    client_id = getattr(paypal_service, 'client_id', None)
    
    return {
        "configured": is_configured,
        "mode": mode,
        "has_client_id": bool(client_id),
        "client_id_prefix": client_id[:10] + "..." if client_id else None
    }


@router.get("/config")
async def get_paypal_config():
    """
    Get PayPal configuration for frontend.
    Returns client ID and mode (sandbox/live).
    """
    if not paypal_service.is_configured():
        return {
            "configured": False,
            "client_id": None,
            "mode": None
        }
    
    return {
        "configured": True,
        "client_id": paypal_service.get_client_id(),
        "mode": settings.paypal_mode or "sandbox"
    }


@router.post("/create-setup-token")
async def create_paypal_setup_token(
    request: CreateSetupTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a PayPal setup token for recurring payments.
    
    This creates a setup token that can be used to store a payment method
    for future recurring charges.
    """
    try:
        if not paypal_service.is_configured():
            raise HTTPException(status_code=503, detail="PayPal is not configured")
        
        username = current_user.get("username")
        
        # Create description
        description = request.description or f"Setup for recurring contributions - {username}"
        
        logger.info(f"Creating PayPal setup token for user: {username}")
        result = await paypal_service.create_setup_token(description)
        
        if not result.get("success"):
            logger.error(f"PayPal setup token creation failed for {username}: {result.get('error')}")
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create PayPal setup token"))
        
        logger.info(f"PayPal setup token created for {username}: {result.get('setup_token_id')}")
        
        return {
            "setup_token_id": result.get("setup_token_id"),
            "status": result.get("status")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_setup_token: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/create-payment-token")
async def create_paypal_payment_token(
    request: CreatePaymentTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a PayPal payment token from a setup token.
    
    This creates a payment token that can be stored for recurring charges.
    """
    if not paypal_service.is_configured():
        raise HTTPException(status_code=503, detail="PayPal is not configured")
    
    username = current_user.get("username")
    
    result = await paypal_service.create_payment_token(request.setup_token_id)
    
    if not result.get("success"):
        logger.error(f"PayPal payment token creation failed for {username}: {result.get('error')}")
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create PayPal payment token"))
    
    logger.info(f"PayPal payment token created for {username}: {result.get('payment_token_id')}")
    
    return {
        "payment_token_id": result.get("payment_token_id"),
        "payment_source": result.get("payment_source"),
        "status": result.get("status")
    }


@router.post("/create-order")
async def create_paypal_order(
    request: CreateOrderRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a PayPal order for checkout.
    
    The frontend will use the returned order_id with the PayPal JS SDK
    to render the PayPal buttons and handle the checkout flow.
    """
    if not paypal_service.is_configured():
        raise HTTPException(status_code=503, detail="PayPal is not configured")
    
    username = current_user.get("username")
    
    # Create description
    description = request.description or f"L3V3L MATCHES Premium Membership"
    if request.plan_id:
        description = f"{description} - Plan: {request.plan_id}"
    
    # Create custom_id for tracking (username + plan)
    custom_id = f"{username}|{request.plan_id or 'premium'}"
    
    result = await paypal_service.create_order(
        amount=request.amount,
        currency=request.currency,
        description=description,
        custom_id=custom_id
    )
    
    if not result.get("success"):
        logger.error(f"PayPal order creation failed for {username}: {result.get('error')}")
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create PayPal order"))
    
    logger.info(f"PayPal order created for {username}: {result.get('order_id')}")
    
    return {
        "order_id": result.get("order_id"),
        "status": result.get("status")
    }


@router.post("/capture-order")
async def capture_paypal_order(
    request: CaptureOrderRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Capture payment for an approved PayPal order.
    
    This is called after the user approves the payment in the PayPal popup.
    The frontend calls this with the order_id to complete the transaction.
    """
    if not paypal_service.is_configured():
        raise HTTPException(status_code=503, detail="PayPal is not configured")
    
    username = current_user.get("username")
    
    result = await paypal_service.capture_order(request.order_id)
    
    if not result.get("success"):
        logger.error(f"PayPal capture failed for {username}, order {request.order_id}: {result.get('error')}")
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to capture PayPal payment"))
    
    logger.info(f"PayPal payment captured for {username}: order={request.order_id}, capture={result.get('capture_id')}")
    
    # Log payment to contributions/payments collection
    try:
        amount = float(result.get("amount", 0))
        payment_record = {
            "username": username,
            "amount": amount,
            "paymentType": "contribution_one_time",
            "paymentProvider": "paypal",
            "status": "completed",
            "paypalOrderId": result.get("order_id"),
            "paypalCaptureId": result.get("capture_id"),
            "payerEmail": result.get("payer_email"),
            "description": f"PayPal payment - ${amount:.2f}",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        await db.payments.insert_one(payment_record)
        logger.info(f"💝 PayPal payment logged for {username}: ${amount}")
        
        # Update user's contribution stats
        await db.users.update_one(
            {"username": username},
            {
                "$inc": {"contributions.totalContributed": amount},
                "$set": {
                    "contributions.lastContributionDate": datetime.utcnow(),
                    "contributions.lastContributionAmount": amount,
                }
            }
        )

        # Send thank you email (lazy import to avoid circular)
        try:
            from routers.contribution_routes import send_contribution_thank_you_email
            email_sent = await send_contribution_thank_you_email(db=db, username=username, amount=amount, payment_type="one-time", payment_method="PayPal")
            if email_sent:
                await db.payments.update_one(
                    {"_id": payment_record["_id"]},
                    {"$set": {"thankYouEmailSentAt": datetime.utcnow()}}
                )
                logger.info(f"✅ Thank you email sent and marked for {username}")
        except Exception as email_err:
            logger.error(f"Error sending thank you email: {email_err}")
    except Exception as e:
        logger.error(f"Error logging PayPal payment: {e}")
        # Don't fail the request if logging fails
    
    return {
        "success": True,
        "order_id": result.get("order_id"),
        "capture_id": result.get("capture_id"),
        "status": result.get("status"),
        "amount": result.get("amount"),
        "payer_email": result.get("payer_email")
    }


@router.get("/order/{order_id}")
async def get_order_details(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get details of a PayPal order."""
    if not paypal_service.is_configured():
        raise HTTPException(status_code=503, detail="PayPal is not configured")
    
    result = await paypal_service.get_order_details(order_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to get order details"))
    
    return result.get("order")


@router.post("/refund")
async def refund_payment(
    request: RefundRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Refund a captured PayPal payment.
    Admin only endpoint.
    """
    if not paypal_service.is_configured():
        raise HTTPException(status_code=503, detail="PayPal is not configured")
    
    # Check admin access
    user_role = current_user.get("role", "")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await paypal_service.refund_capture(
        capture_id=request.capture_id,
        amount=request.amount,
        note=request.note
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to process refund"))
    
    logger.info(f"PayPal refund processed by {current_user.get('username')}: {result.get('refund_id')}")
    
    return result
