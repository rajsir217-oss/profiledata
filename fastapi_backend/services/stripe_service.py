"""
Stripe Payment Service
Created: January 12, 2026
Purpose: Handle Stripe payment processing for membership subscriptions
"""

import stripe
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import logging

from config import settings
from crypto_utils import get_encryptor

logger = logging.getLogger(__name__)

# Initialize Stripe with secret key
stripe.api_key = settings.stripe_secret_key


class StripeService:
    """Service for managing Stripe payments and subscriptions"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users_collection = db.users
        self.payments_collection = db.payment_history
        self.subscriptions_collection = db.subscriptions
    
    async def create_checkout_session(
        self,
        username: str,
        plan_id: str,
        promo_code: Optional[str] = None,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout Session for a membership plan.
        Returns the session ID and URL for redirecting the user.
        """
        try:
            # Get user info
            user = await self.users_collection.find_one({"username": username})
            if not user:
                raise ValueError(f"User '{username}' not found")
            
            # Get plan details from site settings
            site_settings = await self.db.site_settings.find_one({"_id": "site_settings"})
            if not site_settings:
                raise ValueError("Site settings not configured")
            
            plans = site_settings.get("membership", {}).get("plans", [])
            plan = next((p for p in plans if p["id"] == plan_id), None)
            
            if not plan:
                raise ValueError(f"Plan '{plan_id}' not found")
            
            if not plan.get("isActive", True):
                raise ValueError(f"Plan '{plan_id}' is not available")
            
            # Calculate price (in cents for Stripe)
            price_cents = int(plan["price"] * 100)
            
            # Apply promo code discount if provided
            discount_amount = 0
            promo_code_data = None
            if promo_code:
                promo_code_data = await self.db.promo_codes.find_one({
                    "code": {"$regex": f"^{promo_code}$", "$options": "i"},
                    "isActive": True,
                    "isArchived": {"$ne": True}
                })
                
                if promo_code_data:
                    discount_type = promo_code_data.get("discountType", "none")
                    discount_value = promo_code_data.get("discountValue", 0)
                    
                    if discount_type == "percentage":
                        discount_amount = int(price_cents * (discount_value / 100))
                    elif discount_type == "fixed":
                        discount_amount = int(min(discount_value * 100, price_cents))
                    
                    price_cents = max(0, price_cents - discount_amount)
            
            # Build URLs
            frontend_url = settings.frontend_url
            success_url = success_url or f"{frontend_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = cancel_url or f"{frontend_url}/payment/cancel"
            
            # Build description based on duration
            duration = plan.get("duration")
            if duration:
                description = f"{duration} month membership plan"
            else:
                description = "Lifetime membership access"
            
            # Create Stripe Checkout Session - using one-time payment mode
            # (Subscriptions require pre-created Products/Prices in Stripe dashboard)
            session_params = {
                "payment_method_types": ["card"],
                "mode": "payment",  # One-time payment for all plans
                "success_url": success_url,
                "cancel_url": cancel_url,
                "customer_email": get_encryptor().decrypt(user.get("contactEmail")) or get_encryptor().decrypt(user.get("email")) or None,
                "client_reference_id": username,
                "metadata": {
                    "username": username,
                    "plan_id": plan_id,
                    "plan_name": plan["name"],
                    "duration_months": str(duration) if duration else "lifetime",
                    "promo_code": promo_code or "",
                    "original_price": str(plan["price"]),
                    "discount_amount": str(discount_amount / 100) if discount_amount else "0"
                },
                "line_items": [{
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"{plan['name']} Membership",
                            "description": description,
                        },
                        "unit_amount": price_cents,
                    },
                    "quantity": 1
                }]
            }
            
            # Create the session
            session = stripe.checkout.Session.create(**session_params)
            
            logger.info(f"💳 Created Stripe checkout session {session.id} for {username}, plan: {plan_id}")
            
            return {
                "sessionId": session.id,
                "url": session.url,
                "planId": plan_id,
                "planName": plan["name"],
                "originalPrice": plan["price"],
                "finalPrice": price_cents / 100,
                "discountApplied": discount_amount / 100 if discount_amount else 0,
                "promoCode": promo_code if promo_code_data else None
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout session: {e}")
            raise ValueError(f"Payment service error: {str(e)}")
        except Exception as e:
            logger.error(f"Error creating checkout session: {e}", exc_info=True)
            raise
    
    async def handle_checkout_completed(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle successful checkout completion from webhook.
        Activates user's premium membership.
        """
        try:
            username = session.get("client_reference_id") or session.get("metadata", {}).get("username")
            if not username:
                logger.error("No username found in checkout session")
                return {"success": False, "error": "No username in session"}
            
            metadata = session.get("metadata", {})
            plan_id = metadata.get("plan_id", "premium")
            plan_name = metadata.get("plan_name", "Premium")
            amount_total = session.get("amount_total", 0) / 100  # Convert from cents
            promo_code = metadata.get("promo_code", "")
            
            # Get plan duration
            site_settings = await self.db.site_settings.find_one({"_id": "site_settings"})
            plans = site_settings.get("membership", {}).get("plans", []) if site_settings else []
            plan = next((p for p in plans if p["id"] == plan_id), None)
            duration_months = plan.get("duration") if plan else 12
            
            # Calculate expiry date
            now = datetime.utcnow()
            if duration_months:
                expiry_date = now + timedelta(days=duration_months * 30)
            else:
                expiry_date = None  # Lifetime
            
            # Update user's premium status
            update_data = {
                "isPaid": True,
                "isPremium": True,
                "premiumStatus": "premium",
                "premiumActivatedAt": now,
                "membershipPlanId": plan_id,
                "membershipAmount": amount_total,
                "lastPaymentAt": now
            }
            
            if expiry_date:
                update_data["premiumExpiresAt"] = expiry_date
            
            await self.users_collection.update_one(
                {"username": username},
                {"$set": update_data}
            )
            
            # Record payment in history
            payment_record = {
                "username": username,
                "amount": amount_total,
                "paymentType": "subscription" if duration_months else "one_time",
                "paymentMethod": "stripe",
                "planId": plan_id,
                "planName": plan_name,
                "promoCode": promo_code if promo_code else None,
                "stripeSessionId": session.get("id"),
                "stripePaymentIntentId": session.get("payment_intent"),
                "stripeSubscriptionId": session.get("subscription"),
                "status": "completed",
                "createdAt": now,
                "description": f"{plan_name} membership purchase"
            }
            
            await self.payments_collection.insert_one(payment_record)
            
            # Update promo code stats if used
            if promo_code:
                await self.db.promo_codes.update_one(
                    {"code": {"$regex": f"^{promo_code}$", "$options": "i"}},
                    {
                        "$inc": {"revenue": amount_total, "conversions": 1},
                        "$set": {"updatedAt": now}
                    }
                )
            
            logger.info(f"✅ Activated premium for {username}, plan: {plan_id}, amount: ${amount_total}")
            
            return {
                "success": True,
                "username": username,
                "planId": plan_id,
                "amount": amount_total,
                "expiresAt": expiry_date.isoformat() if expiry_date else None
            }
            
        except Exception as e:
            logger.error(f"Error handling checkout completed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def handle_subscription_updated(self, subscription: Dict[str, Any]) -> Dict[str, Any]:
        """Handle subscription update events (renewal, cancellation, etc.)"""
        try:
            customer_id = subscription.get("customer")
            status = subscription.get("status")
            
            # Find user by Stripe customer ID or subscription ID
            user = await self.users_collection.find_one({
                "$or": [
                    {"stripeCustomerId": customer_id},
                    {"stripeSubscriptionId": subscription.get("id")}
                ]
            })
            
            if not user:
                logger.warning(f"No user found for Stripe customer {customer_id}")
                return {"success": False, "error": "User not found"}
            
            username = user["username"]
            
            if status == "active":
                # Subscription renewed or reactivated
                current_period_end = subscription.get("current_period_end")
                if current_period_end:
                    expiry_date = datetime.fromtimestamp(current_period_end)
                    await self.users_collection.update_one(
                        {"username": username},
                        {"$set": {
                            "isPremium": True,
                            "premiumExpiresAt": expiry_date
                        }}
                    )
                    logger.info(f"🔄 Subscription renewed for {username} until {expiry_date}")
                    
            elif status in ["canceled", "unpaid", "past_due"]:
                # Subscription ended or payment failed
                await self.users_collection.update_one(
                    {"username": username},
                    {"$set": {
                        "isPremium": False,
                        "premiumStatus": "free"
                    }}
                )
                logger.info(f"⚠️ Subscription {status} for {username}")
            
            return {"success": True, "username": username, "status": status}
            
        except Exception as e:
            logger.error(f"Error handling subscription update: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def get_payment_history(self, username: str) -> List[Dict[str, Any]]:
        """Get payment history for a user"""
        cursor = self.payments_collection.find(
            {"username": username}
        ).sort("createdAt", -1)
        
        payments = await cursor.to_list(length=100)
        
        result = []
        for payment in payments:
            result.append({
                "id": str(payment["_id"]),
                "amount": payment.get("amount", 0),
                "planId": payment.get("planId"),
                "planName": payment.get("planName"),
                "paymentMethod": payment.get("paymentMethod", "stripe"),
                "status": payment.get("status", "completed"),
                "promoCode": payment.get("promoCode"),
                "createdAt": payment.get("createdAt").isoformat() if payment.get("createdAt") else None,
                "description": payment.get("description")
            })
        
        return result
    
    async def verify_session(self, session_id: str) -> Dict[str, Any]:
        """Verify a checkout session and return its status"""
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            
            return {
                "success": True,
                "status": session.payment_status,
                "customerEmail": session.customer_email,
                "amountTotal": session.amount_total / 100 if session.amount_total else 0,
                "metadata": session.metadata
            }
        except stripe.error.StripeError as e:
            logger.error(f"Error verifying session: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_customer_portal_session(self, username: str) -> Dict[str, Any]:
        """Create a Stripe Customer Portal session for managing subscriptions"""
        try:
            user = await self.users_collection.find_one({"username": username})
            if not user:
                raise ValueError("User not found")
            
            customer_id = user.get("stripeCustomerId")
            if not customer_id:
                raise ValueError("No Stripe customer found for this user")
            
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=f"{settings.frontend_url}/dashboard"
            )
            
            return {
                "success": True,
                "url": session.url
            }
        except Exception as e:
            logger.error(f"Error creating portal session: {e}")
            return {"success": False, "error": str(e)}


    async def create_contribution_session(
        self,
        username: str,
        amount: float,
        payment_type: str = "monthly"
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout Session for a contribution.
        Supports one-time and monthly recurring contributions.
        """
        try:
            # Get user info
            user = await self.users_collection.find_one({"username": username})
            if not user:
                raise ValueError(f"User '{username}' not found")
            
            # Decrypt email for Stripe
            customer_email = get_encryptor().decrypt(user.get("contactEmail")) or get_encryptor().decrypt(user.get("email")) or None
            
            # Convert to cents
            amount_cents = int(amount * 100)
            
            # Build success/cancel URLs
            success_url = f"{settings.frontend_url}/contribution/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{settings.frontend_url}/contribution/cancel"
            
            # Create session params
            if payment_type == "monthly":
                # Recurring monthly contribution
                session_params = {
                    "payment_method_types": ["card"],
                    "mode": "subscription",
                    "success_url": success_url,
                    "cancel_url": cancel_url,
                    "customer_email": customer_email,
                    "client_reference_id": username,
                    "metadata": {
                        "username": username,
                        "contribution_type": "recurring",
                        "amount": str(amount)
                    },
                    "line_items": [{
                        "price_data": {
                            "currency": "usd",
                            "product_data": {
                                "name": "L3V3L Matches Monthly Contribution",
                                "description": f"Monthly contribution of ${amount} to support the platform",
                            },
                            "unit_amount": amount_cents,
                            "recurring": {
                                "interval": "month",
                                "interval_count": 1
                            }
                        },
                        "quantity": 1
                    }]
                }
            else:
                # One-time contribution
                session_params = {
                    "payment_method_types": ["card"],
                    "mode": "payment",
                    "success_url": success_url,
                    "cancel_url": cancel_url,
                    "customer_email": customer_email,
                    "client_reference_id": username,
                    "metadata": {
                        "username": username,
                        "contribution_type": "one_time",
                        "amount": str(amount)
                    },
                    "line_items": [{
                        "price_data": {
                            "currency": "usd",
                            "product_data": {
                                "name": "L3V3L Matches Contribution",
                                "description": f"One-time contribution of ${amount} to support the platform",
                            },
                            "unit_amount": amount_cents,
                        },
                        "quantity": 1
                    }]
                }
            
            # Create the session
            session = stripe.checkout.Session.create(**session_params)
            
            logger.info(f"💝 Created contribution session {session.id} for {username}: ${amount} ({payment_type})")
            
            return {
                "sessionId": session.id,
                "url": session.url,
                "amount": amount,
                "paymentType": payment_type
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating contribution session: {e}")
            raise ValueError(f"Payment service error: {str(e)}")
        except Exception as e:
            logger.error(f"Error creating contribution session: {e}", exc_info=True)
            raise
    
    async def verify_contribution_session(self, session_id: str, username: str) -> Dict[str, Any]:
        """Verify a contribution checkout session and update user's contribution record"""
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            
            if session.payment_status != "paid":
                return {"success": False, "error": "Payment not completed"}
            
            metadata = session.metadata or {}
            amount = float(metadata.get("amount", 0))
            contribution_type = metadata.get("contribution_type", "one_time")
            is_recurring = contribution_type == "recurring"
            
            now = datetime.utcnow()
            
            # Update user's contribution record
            update_data = {
                "contributions.lastContributionDate": now,
                "contributions.lastContributionAmount": amount,
            }
            
            if is_recurring:
                update_data["contributions.hasActiveRecurring"] = True
                update_data["contributions.recurringSubscriptionId"] = session.subscription
            
            await self.users_collection.update_one(
                {"username": username},
                {
                    "$set": update_data,
                    "$inc": {"contributions.totalContributed": amount}
                }
            )
            
            # Record contribution in payments collection
            contribution_record = {
                "username": username,
                "amount": amount,
                "paymentType": "contribution_recurring" if is_recurring else "contribution_one_time",
                "paymentMethod": "stripe",
                "stripeSessionId": session_id,
                "stripeSubscriptionId": session.subscription if is_recurring else None,
                "status": "completed",
                "createdAt": now,
                "description": f"{'Monthly' if is_recurring else 'One-time'} contribution"
            }
            
            await self.db.payments.insert_one(contribution_record)
            
            logger.info(f"✅ Contribution verified for {username}: ${amount} ({contribution_type})")
            
            return {
                "success": True,
                "amount": amount,
                "isRecurring": is_recurring,
                "email": session.customer_details.email if session.customer_details else None
            }
            
        except Exception as e:
            logger.error(f"Error verifying contribution: {e}")
            raise
    
    async def handle_contribution_webhook(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """Handle contribution checkout completion from webhook"""
        try:
            metadata = session.get("metadata", {})
            
            # Check if this is a contribution
            if metadata.get("contribution_type"):
                username = session.get("client_reference_id") or metadata.get("username")
                if username:
                    return await self.verify_contribution_session(session.get("id"), username)
            
            return {"success": False, "error": "Not a contribution session"}
        except Exception as e:
            logger.error(f"Error handling contribution webhook: {e}")
            return {"success": False, "error": str(e)}


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    """Construct and verify a Stripe webhook event"""
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
        return event
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise ValueError("Invalid webhook signature")
    except Exception as e:
        logger.error(f"Error constructing webhook event: {e}")
        raise
