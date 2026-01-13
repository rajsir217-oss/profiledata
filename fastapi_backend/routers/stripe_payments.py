"""
Stripe Payments Router
Created: January 12, 2026
Purpose: API endpoints for Stripe payment processing
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Header, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from typing import Optional
import logging

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.stripe_service import StripeService, construct_webhook_event
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stripe", tags=["Stripe Payments"])


class CreateCheckoutRequest(BaseModel):
    """Request model for creating a checkout session"""
    planId: str = Field(..., description="Membership plan ID")
    promoCode: Optional[str] = Field(None, description="Optional promo code")


class VerifySessionRequest(BaseModel):
    """Request model for verifying a session"""
    sessionId: str = Field(..., description="Stripe checkout session ID")


class CreateDonationRequest(BaseModel):
    """Request model for creating a donation checkout session"""
    amount: float = Field(..., ge=1, description="Donation amount in dollars (minimum $1)")
    paymentType: str = Field("monthly", description="Payment type: 'one-time' or 'monthly'")


@router.get("/config")
async def get_payment_config():
    """Get Stripe publishable key and available plans for frontend"""
    try:
        # Return publishable key (safe to expose to frontend)
        return {
            "success": True,
            "publishableKey": settings.stripe_publishable_key,
            "isConfigured": bool(settings.stripe_secret_key and settings.stripe_publishable_key)
        }
    except Exception as e:
        logger.error(f"Error getting payment config: {e}")
        raise HTTPException(status_code=500, detail="Failed to get payment configuration")


@router.get("/plans")
async def get_available_plans(
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get available membership plans for purchase"""
    try:
        site_settings = await db.site_settings.find_one({"_id": "site_settings"})
        if not site_settings:
            return {"success": True, "plans": []}
        
        plans = site_settings.get("membership", {}).get("plans", [])
        
        # Filter to only active plans and format for frontend
        active_plans = []
        for plan in plans:
            if plan.get("isActive", True):
                active_plans.append({
                    "id": plan["id"],
                    "name": plan["name"],
                    "price": plan["price"],
                    "duration": plan.get("duration"),  # None = lifetime
                    "features": plan.get("features", []),
                    "isPopular": plan["id"] == site_settings.get("membership", {}).get("defaultPlanId")
                })
        
        # Sort by price
        active_plans.sort(key=lambda x: x["price"])
        
        return {
            "success": True,
            "plans": active_plans,
            "currency": site_settings.get("membership", {}).get("currency", "USD")
        }
    except Exception as e:
        logger.error(f"Error getting plans: {e}")
        raise HTTPException(status_code=500, detail="Failed to get plans")


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a Stripe Checkout Session for purchasing a membership"""
    logger.info(f"💳 Checkout request from {current_user.get('username')} for plan: {request.planId}")
    try:
        if not settings.stripe_secret_key:
            logger.error("Stripe secret key not configured")
            raise HTTPException(
                status_code=503, 
                detail="Payment service not configured. Please contact support."
            )
        
        username = current_user["username"]
        logger.info(f"💳 Creating checkout session for user: {username}")
        service = StripeService(db)
        
        result = await service.create_checkout_session(
            username=username,
            plan_id=request.planId,
            promo_code=request.promoCode
        )
        
        logger.info(f"✅ Checkout session created: {result.get('sessionId')}")
        return {"success": True, **result}
        
    except ValueError as e:
        logger.error(f"ValueError in checkout: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Error creating checkout session: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-session")
async def verify_payment_session(
    request: VerifySessionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Verify a checkout session after payment completion"""
    try:
        service = StripeService(db)
        result = await service.verify_session(request.sessionId)
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Verification failed"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying session: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify payment")


@router.get("/history")
async def get_payment_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get payment history for the current user"""
    try:
        service = StripeService(db)
        payments = await service.get_payment_history(current_user["username"])
        
        return {
            "success": True,
            "payments": payments,
            "count": len(payments)
        }
    except Exception as e:
        logger.error(f"Error getting payment history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get payment history")


@router.get("/subscription-status")
async def get_subscription_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get current subscription status for the user"""
    try:
        user = await db.users.find_one({"username": current_user["username"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "isPremium": user.get("isPremium", False),
            "premiumStatus": user.get("premiumStatus", "free"),
            "planId": user.get("membershipPlanId"),
            "activatedAt": user.get("premiumActivatedAt").isoformat() if user.get("premiumActivatedAt") else None,
            "expiresAt": user.get("premiumExpiresAt").isoformat() if user.get("premiumExpiresAt") else None,
            "isLifetime": user.get("membershipPlanId") == "lifetime"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subscription status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get subscription status")


@router.post("/customer-portal")
async def create_customer_portal(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a Stripe Customer Portal session for managing subscriptions"""
    try:
        service = StripeService(db)
        result = await service.create_customer_portal_session(current_user["username"])
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create portal"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating customer portal: {e}")
        raise HTTPException(status_code=500, detail="Failed to create customer portal")


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Handle Stripe webhook events.
    This endpoint receives events from Stripe about payment status changes.
    """
    try:
        if not settings.stripe_webhook_secret:
            logger.warning("Stripe webhook secret not configured")
            raise HTTPException(status_code=503, detail="Webhook not configured")
        
        # Get raw body for signature verification
        payload = await request.body()
        
        if not stripe_signature:
            raise HTTPException(status_code=400, detail="Missing Stripe signature")
        
        # Verify and construct the event
        try:
            event = construct_webhook_event(payload, stripe_signature)
        except ValueError as e:
            logger.error(f"Webhook signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        service = StripeService(db)
        event_type = event["type"]
        event_data = event["data"]["object"]
        
        logger.info(f"📥 Received Stripe webhook: {event_type}")
        
        # Handle different event types
        if event_type == "checkout.session.completed":
            result = await service.handle_checkout_completed(event_data)
            if result.get("success"):
                logger.info(f"✅ Checkout completed for {result.get('username')}")
            else:
                logger.error(f"❌ Failed to process checkout: {result.get('error')}")
                
        elif event_type == "customer.subscription.updated":
            result = await service.handle_subscription_updated(event_data)
            
        elif event_type == "customer.subscription.deleted":
            result = await service.handle_subscription_updated(event_data)
            
        elif event_type == "invoice.payment_succeeded":
            # Subscription renewal
            logger.info(f"💰 Invoice payment succeeded: {event_data.get('id')}")
            
        elif event_type == "invoice.payment_failed":
            # Payment failed - may need to notify user
            logger.warning(f"⚠️ Invoice payment failed: {event_data.get('id')}")
            
        else:
            logger.debug(f"Unhandled webhook event type: {event_type}")
        
        return {"success": True, "received": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Webhook processing failed")


@router.post("/create-donation-session")
async def create_donation_session(
    request: CreateDonationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a Stripe Checkout Session for a donation"""
    logger.info(f"💝 Donation request from {current_user.get('username')}: ${request.amount} ({request.paymentType})")
    try:
        if not settings.stripe_secret_key:
            raise HTTPException(
                status_code=503, 
                detail="Payment service not configured"
            )
        
        service = StripeService(db)
        result = await service.create_donation_session(
            username=current_user["username"],
            amount=request.amount,
            payment_type=request.paymentType
        )
        
        logger.info(f"✅ Donation session created: {result.get('sessionId')}")
        return {"success": True, **result}
        
    except ValueError as e:
        logger.error(f"ValueError in donation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Error creating donation session: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-donation")
async def verify_donation_session(
    request: VerifySessionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Verify a donation checkout session after payment"""
    try:
        service = StripeService(db)
        result = await service.verify_donation_session(request.sessionId, current_user["username"])
        return result
    except Exception as e:
        logger.error(f"Error verifying donation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/donation-status")
async def get_donation_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get user's donation status for popup logic"""
    try:
        user = await db.users.find_one({"username": current_user["username"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        donations = user.get("donations", {})
        
        # Check site-level setting
        site_settings = await db.site_settings.find_one({"_id": "site_settings"})
        donation_config = site_settings.get("donation", {}) if site_settings else {}
        
        return {
            "success": True,
            "siteEnabled": donation_config.get("enabled", False),  # Default: disabled
            "userDisabledByAdmin": user.get("donationPopupDisabledByAdmin", False),
            "hasActiveRecurringDonation": donations.get("hasActiveRecurring", False),
            "lastDonationDate": donations.get("lastDonationDate"),
            "totalDonated": donations.get("totalDonated", 0),
            "popupConfig": {
                "amounts": donation_config.get("amounts", [5, 10, 15]),
                "message": donation_config.get("message", "Please support the platform by generous donation"),
                "frequencyDays": donation_config.get("frequencyDays", 14),
                "minLogins": donation_config.get("minLogins", 3)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting donation status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get donation status")


@router.get("/admin/donation-settings")
async def get_donation_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get donation popup settings (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    site_settings = await db.site_settings.find_one({"_id": "site_settings"})
    donation_config = site_settings.get("donation", {}) if site_settings else {}
    
    return {
        "success": True,
        "donation": {
            "enabled": donation_config.get("enabled", False),  # Default: disabled
            "amounts": donation_config.get("amounts", [5, 10, 15]),
            "message": donation_config.get("message", "Please support the platform by generous donation"),
            "frequencyDays": donation_config.get("frequencyDays", 14),
            "minLogins": donation_config.get("minLogins", 3)
        }
    }


@router.put("/admin/donation-settings")
async def update_donation_settings(
    settings_data: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update donation popup settings (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Update site settings
    await db.site_settings.update_one(
        {"_id": "site_settings"},
        {"$set": {"donation": settings_data}},
        upsert=True
    )
    
    logger.info(f"💝 Donation settings updated by {current_user['username']}: enabled={settings_data.get('enabled')}")
    
    return {"success": True, "message": "Donation settings updated"}


@router.put("/admin/user/{username}/donation-popup")
async def toggle_user_donation_popup(
    username: str,
    disabled: bool = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Enable/disable donation popup for a specific user (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.update_one(
        {"username": username},
        {"$set": {"donationPopupDisabledByAdmin": disabled}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    status_text = "disabled" if disabled else "enabled"
    logger.info(f"💝 Donation popup {status_text} for {username} by {current_user['username']}")
    
    return {"success": True, "message": f"Donation popup {status_text} for {username}"}


@router.get("/admin/donations")
async def get_all_donations(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    page: int = 1,
    limit: int = 50,
    payment_type: Optional[str] = None
):
    """Get all donations (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Build query for donations only
        query = {"paymentType": {"$in": ["donation_one_time", "donation_recurring"]}}
        
        if payment_type == "one_time":
            query["paymentType"] = "donation_one_time"
        elif payment_type == "recurring":
            query["paymentType"] = "donation_recurring"
        
        # Get total count
        total = await db.payments.count_documents(query)
        
        # Get donations with pagination
        skip = (page - 1) * limit
        donations = await db.payments.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(length=limit)
        
        # Format for frontend
        formatted_donations = []
        for d in donations:
            formatted_donations.append({
                "id": str(d.get("_id")),
                "username": d.get("username"),
                "amount": d.get("amount"),
                "paymentType": "recurring" if d.get("paymentType") == "donation_recurring" else "one_time",
                "status": d.get("status", "completed"),
                "stripeSessionId": d.get("stripeSessionId"),
                "stripeSubscriptionId": d.get("stripeSubscriptionId"),
                "createdAt": d.get("createdAt").isoformat() if d.get("createdAt") else None,
                "description": d.get("description")
            })
        
        # Get summary stats
        pipeline = [
            {"$match": {"paymentType": {"$in": ["donation_one_time", "donation_recurring"]}}},
            {"$group": {
                "_id": None,
                "totalAmount": {"$sum": "$amount"},
                "totalCount": {"$sum": 1},
                "oneTimeCount": {"$sum": {"$cond": [{"$eq": ["$paymentType", "donation_one_time"]}, 1, 0]}},
                "recurringCount": {"$sum": {"$cond": [{"$eq": ["$paymentType", "donation_recurring"]}, 1, 0]}}
            }}
        ]
        stats_result = await db.payments.aggregate(pipeline).to_list(length=1)
        stats = stats_result[0] if stats_result else {"totalAmount": 0, "totalCount": 0, "oneTimeCount": 0, "recurringCount": 0}
        
        return {
            "success": True,
            "donations": formatted_donations,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": (total + limit - 1) // limit
            },
            "stats": {
                "totalAmount": stats.get("totalAmount", 0),
                "totalCount": stats.get("totalCount", 0),
                "oneTimeCount": stats.get("oneTimeCount", 0),
                "recurringCount": stats.get("recurringCount", 0)
            }
        }
    except Exception as e:
        logger.error(f"Error getting donations: {e}")
        raise HTTPException(status_code=500, detail="Failed to get donations")


@router.post("/apply-promo")
async def apply_promo_code(
    plan_id: str,
    promo_code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Calculate price after applying a promo code"""
    try:
        # Get plan
        site_settings = await db.site_settings.find_one({"_id": "site_settings"})
        if not site_settings:
            raise HTTPException(status_code=404, detail="Plans not configured")
        
        plans = site_settings.get("membership", {}).get("plans", [])
        plan = next((p for p in plans if p["id"] == plan_id), None)
        
        if not plan:
            raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found")
        
        original_price = plan["price"]
        
        # Get promo code
        promo = await db.promo_codes.find_one({
            "code": {"$regex": f"^{promo_code}$", "$options": "i"},
            "isActive": True,
            "isArchived": {"$ne": True}
        })
        
        if not promo:
            raise HTTPException(status_code=404, detail="Invalid or expired promo code")
        
        # Calculate discount
        discount_type = promo.get("discountType", "none")
        discount_value = promo.get("discountValue", 0)
        discount_amount = 0
        
        if discount_type == "percentage":
            discount_amount = original_price * (discount_value / 100)
        elif discount_type == "fixed":
            discount_amount = min(discount_value, original_price)
        
        final_price = max(0, original_price - discount_amount)
        
        return {
            "success": True,
            "promoCode": promo["code"],
            "discountType": discount_type,
            "discountValue": discount_value,
            "originalPrice": original_price,
            "discountAmount": round(discount_amount, 2),
            "finalPrice": round(final_price, 2)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying promo code: {e}")
        raise HTTPException(status_code=500, detail="Failed to apply promo code")
