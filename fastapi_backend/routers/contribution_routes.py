"""
Contribution Routes
Purpose: API endpoints for contribution management, activity logging, and admin tools.
Migrated from stripe_payments.py after removing Stripe integration.
"""

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from typing import Optional
import logging
from datetime import datetime
import pytz

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.email_sender import send_email
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contributions", tags=["Contributions"])


async def send_contribution_thank_you_email(
    db: AsyncIOMotorDatabase,
    username: str,
    amount: float,
    payment_type: str,
    payment_method: str = "PayPal",
    contribution_id: Optional[str] = None
):
    """Send thank you email after successful contribution"""
    try:
        # Get user details
        user = await db.users.find_one({"username": username})
        if not user:
            logger.warning(f"Cannot send thank you email - user {username} not found")
            return
        
        user_email = user.get("email") or user.get("contactEmail")
        if not user_email:
            logger.warning(f"Cannot send thank you email - user {username} has no email")
            return
        
        # Decrypt if encrypted (production PII encryption)
        if user_email.startswith("gAAAAA"):
            from crypto_utils import get_encryptor
            try:
                user_email = get_encryptor().decrypt(user_email)
            except Exception as e:
                logger.error(f"Failed to decrypt email for {username}: {e}")
                return
        first_name = user.get("firstName", "Supporter")

        # Resolve timezone-aware date
        try:
            tz = pytz.timezone("America/Los_Angeles")
            now = datetime.now(tz)
            date_str = now.strftime('%B %d, %Y %I:%M %p %Z')
        except Exception:
            date_str = datetime.utcnow().strftime('%B %d, %Y UTC')

        # Resolve transaction ID and actual payment type from contribution record
        transaction_id = "N/A"
        actual_payment_type = payment_type
        if contribution_id:
            from bson import ObjectId
            try:
                payment = await db.payments.find_one({"_id": ObjectId(contribution_id)})
                if payment:
                    transaction_id = (
                        payment.get("stripeSessionId")
                        or payment.get("paypalOrderId")
                        or payment.get("paypalCaptureId")
                        or payment.get("cloverChargeId")
                        or payment.get("sessionId")
                        or "N/A"
                    )
                    stored_type = payment.get("paymentType")
                    if stored_type == "contribution_recurring":
                        actual_payment_type = "Recurring"
                    elif stored_type == "contribution_one_time":
                        actual_payment_type = "One-time"
            except Exception:
                pass

        app_url = settings.frontend_url or "https://l3v3lmatches.com"

        # Create email content
        subject = f"Thank You for Your ${amount:.2f} Contribution! 💝"

        # HTML email template
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Thank You for Your Contribution</title>
            <style>
                body {{ font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .brand-banner {{ background: linear-gradient(135deg, #6366f1, #a78bfa); color: white; padding: 16px 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.2); }}
                .brand-banner span {{ font-size: 22px; vertical-align: middle; margin-right: 6px; }}
                .brand-banner .brand-text {{ font-size: 18px; font-weight: 700; letter-spacing: 1px; vertical-align: middle; }}
                .header {{ background: linear-gradient(135deg, #6366f1, #a78bfa); color: white; padding: 40px 30px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; font-weight: 700; }}
                .header p {{ margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }}
                .content {{ padding: 40px 30px; }}
                .thank-you {{ text-align: center; margin-bottom: 30px; }}
                .thank-you h2 {{ color: #1f2937; font-size: 24px; margin-bottom: 10px; }}
                .amount {{ font-size: 36px; font-weight: 700; color: #6366f1; margin: 20px 0; }}
                .details {{ background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .details p {{ margin: 8px 0; color: #6b7280; }}
                .impact {{ margin: 30px 0; }}
                .impact h3 {{ color: #1f2937; margin-bottom: 15px; }}
                .impact ul {{ color: #6b7280; line-height: 1.6; }}
                .cta {{ text-align: center; margin: 24px 0; }}
                .cta a {{ display: inline-block; background: linear-gradient(135deg, #6366f1, #a78bfa); color: white; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 15px; }}
                .notice {{ background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin: 20px 0; text-align: center; }}
                .notice p {{ margin: 0; color: #92400e; font-size: 14px; }}
                .footer {{ text-align: center; padding: 30px; background: #f8fafc; color: #6b7280; font-size: 14px; }}
                .heart {{ color: #ef4444; font-size: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="brand-banner">
                    <span>🦋</span>
                    <span class="brand-text">L3V3L Matches</span>
                </div>
                <div class="header">
                    <h1>Thank You! 💝</h1>
                    <p>Your generosity makes a difference</p>
                </div>

                <div class="content">
                    <div class="thank-you">
                        <h2>Dear {first_name},</h2>
                        <p>We're incredibly grateful for your support! Your contribution helps us continue providing valuable services to our community.</p>

                        <div class="amount">
                            ${amount:.2f}
                        </div>

                        <p><strong>{actual_payment_type} Contribution</strong> via {payment_method}</p>
                    </div>

                    <div class="details">
                        <p><strong>Contribution Details:</strong></p>
                        <p>Amount: ${amount:.2f}</p>
                        <p>Type: {actual_payment_type}</p>
                        <p>Date: {date_str}</p>
                        <p>Transaction ID: {transaction_id}</p>
                    </div>

                    <div class="impact">
                        <h3>Your Impact 🌟</h3>
                        <ul>
                            <li>Connecting more Indian-origin professionals with their ideal match</li>
                            <li>Keeping the platform safe, respectful, and community-verified</li>
                            <li>Providing free access to families seeking genuine relationships</li>
                            <li>Maintaining secure profiles and responsive support for our members</li>
                        </ul>
                    </div>

                    <div class="cta">
                        <a href="{app_url}/contribution-management">View Contribution History</a>
                    </div>

                    <div class="notice">
                        <p><strong>Important:</strong> On your credit card statement, charges may appear as <strong>nimbledata.us</strong>.</p>
                    </div>

                    <p style="text-align: center; margin-top: 30px;">
                        <strong>With heartfelt thanks,</strong><br>
                        The L3V3L Matches Team <span class="heart">❤️</span>
                    </p>
                </div>

                <div class="footer">
                    <p>This is an automated receipt for your contribution. Please keep it for your records.</p>
                    <p>If you have any questions, please don't hesitate to contact our support team.</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Plain text version
        text_content = f"""
Thank You for Your Contribution! 💝

Dear {first_name},

We're incredibly grateful for your support! Your contribution helps us continue providing valuable services to our community.

Contribution Details:
- Amount: ${amount:.2f}
- Type: {actual_payment_type}
- Payment Method: {payment_method}
- Date: {date_str}
- Transaction ID: {transaction_id}

Your Impact:
- Connecting more Indian-origin professionals with their ideal match
- Keeping the platform safe, respectful, and community-verified
- Providing free access to families seeking genuine relationships
- Maintaining secure profiles and responsive support for our members

Important Notice:
On your credit card statement, charges may appear as "nimbledata.us".

View your contribution history: {app_url}/contribution-management

With heartfelt thanks,
The L3V3L Matches Team ❤️

This is an automated receipt for your contribution. Please keep it for your records.
"""
        
        # Send the email
        result = await send_email(
            to_email=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        
        if result.get("success"):
            logger.info(f"✅ Thank you email sent to {user_email} for ${amount:.2f} contribution")
            return True
        else:
            logger.warning(f"Failed to send thank you email to {user_email}: {result}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending contribution thank you email: {e}")
        return False


@router.get("/contribution-status")
async def get_contribution_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get user's contribution status for popup logic"""
    try:
        user = await db.users.find_one({"username": current_user["username"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        contributions = user.get("contributions", {})
        
        # Check site-level setting
        site_settings = await db.site_settings.find_one({"_id": "site_settings"})
        contribution_config = site_settings.get("contributions", {}) if site_settings else {}
        
        # Get site-level enabled setting - MUST be explicitly True to show popup
        site_enabled = contribution_config.get("enabled") is True  # Strict check: only True, not truthy
        
        # Debug logging
        logger.info(f"💝 Contribution status for {current_user['username']}: site_settings exists={site_settings is not None}, contributions={contribution_config}, siteEnabled={site_enabled}")
        
        # Resolve last contribution amount.
        # Preferred: the `contributions.lastContributionAmount` field stamped by
        # payment handlers. Fallback: look up the most recent contribution in
        # db.payments (handles users who paid before the stamping change).
        last_amount = contributions.get("lastContributionAmount")
        if last_amount is None:
            latest_payment = await db.payments.find_one(
                {
                    "username": current_user["username"],
                    "paymentType": {"$in": ["contribution_one_time", "contribution_recurring"]},
                    "status": {"$in": ["completed", "succeeded", "paid", None]},
                },
                sort=[("createdAt", -1)],
            )
            if latest_payment:
                last_amount = latest_payment.get("amount", 0) or 0
        
        return {
            "success": True,
            "siteEnabled": site_enabled,  # Only True if explicitly enabled
            "userDisabledByAdmin": user.get("contributionPopupDisabledByAdmin", False),
            "hasActiveRecurringContribution": contributions.get("hasActiveRecurring", False),
            "lastContributionDate": contributions.get("lastContributionDate"),
            "lastRecurringPaymentDate": contributions.get("lastRecurringPaymentDate"),
            "lastContributionAmount": last_amount,
            "totalContributed": contributions.get("totalContributed", 0),
            "popupConfig": {
                "amounts": contribution_config.get("amounts", [25, 50, 75, 100]),
                "message": contribution_config.get("message", "Support the platform"),
                "frequencyDays": contribution_config.get("frequencyDays", 14),
                "minLogins": contribution_config.get("minLogins", 10),
                "loginDelaySeconds": contribution_config.get("loginDelaySeconds", 30),
                "monthlySilenceDays": contribution_config.get("monthlySilenceDays", 35)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contribution status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get contribution status")


@router.get("/admin/contribution-settings")
async def get_contribution_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get contribution popup settings (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    site_settings = await db.site_settings.find_one({"_id": "site_settings"})
    contribution_config = site_settings.get("contributions", {}) if site_settings else {}
    
    return {
        "success": True,
        "contributions": {
            "enabled": contribution_config.get("enabled", False),  # Default: disabled
            "amounts": contribution_config.get("amounts", [25, 50, 75, 100]),
            "message": contribution_config.get("message", "Support the platform"),
            "frequencyDays": contribution_config.get("frequencyDays", 14),
            "minLogins": contribution_config.get("minLogins", 10),
            "loginDelaySeconds": contribution_config.get("loginDelaySeconds", 30),
            "monthlySilenceDays": contribution_config.get("monthlySilenceDays", 35)
        }
    }


@router.put("/admin/contribution-settings")
async def update_contribution_settings(
    settings_data: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update contribution popup settings (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Update site settings
    await db.site_settings.update_one(
        {"_id": "site_settings"},
        {"$set": {"contributions": settings_data}},
        upsert=True
    )
    
    logger.info(f"💝 Contribution settings updated by {current_user['username']}: enabled={settings_data.get('enabled')}")
    
    return {"success": True, "message": "Contribution settings updated"}


@router.put("/admin/user/{username}/contribution-popup")
async def toggle_user_contribution_popup(
    username: str,
    disabled: bool = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Enable/disable contribution popup for a specific user (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.update_one(
        {"username": username},
        {"$set": {"contributionPopupDisabledByAdmin": disabled}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    status_text = "disabled" if disabled else "enabled"
    logger.info(f"💝 Contribution popup {status_text} for {username} by {current_user['username']}")
    
    return {"success": True, "message": f"Contribution popup {status_text} for {username}"}


@router.get("/admin/contributions")
async def get_all_contributions(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    page: int = 1,
    limit: int = 50,
    payment_type: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all contributions (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Build query for contributions only
        query = {"paymentType": {"$in": ["contribution_one_time", "contribution_recurring"]}}
        
        if payment_type == "one_time":
            query["paymentType"] = "contribution_one_time"
        elif payment_type == "recurring":
            query["paymentType"] = "contribution_recurring"
        
        # Resolve search to a set of usernames BEFORE pagination
        target_usernames = None
        if username and username.strip():
            target_usernames = {username.strip()}
        
        if search and search.strip():
            regex = {"$regex": search.strip(), "$options": "i"}
            matching_users = await db.users.find(
                {"$or": [{"username": regex}, {"firstName": regex}, {"lastName": regex}]},
                {"username": 1, "_id": 0}
            ).to_list(length=None)
            search_usernames = {u["username"] for u in matching_users if u.get("username")}
            
            if not search_usernames:
                return {
                    "success": True,
                    "contributions": [],
                    "pagination": {"page": page, "limit": limit, "total": 0, "totalPages": 0},
                    "stats": {"totalAmount": 0, "totalCount": 0, "oneTimeCount": 0, "recurringCount": 0}
                }
            
            if target_usernames:
                target_usernames = target_usernames & search_usernames
                if not target_usernames:
                    return {
                        "success": True,
                        "contributions": [],
                        "pagination": {"page": page, "limit": limit, "total": 0, "totalPages": 0},
                        "stats": {"totalAmount": 0, "totalCount": 0, "oneTimeCount": 0, "recurringCount": 0}
                    }
            else:
                target_usernames = search_usernames
        
        if target_usernames:
            query["username"] = {"$in": list(target_usernames)}
        
        # Get total count (reflects search + payment_type filters)
        total = await db.payments.count_documents(query)
        
        # Get contributions with pagination
        skip = (page - 1) * limit
        contributions = await db.payments.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(length=limit)
        
        # Fetch user details in batch
        usernames = list(set(c.get("username") for c in contributions if c.get("username")))
        user_details = {}
        if usernames:
            users = await db.users.find(
                {"username": {"$in": usernames}},
                {"username": 1, "firstName": 1, "lastName": 1, "_id": 0}
            ).to_list(length=len(usernames))
            user_details = {u["username"]: u for u in users}
        
        # Format for frontend
        formatted_contributions = []
        for c in contributions:
            uname = c.get("username")
            user = user_details.get(uname, {})
            formatted_contributions.append({
                "id": str(c.get("_id")),
                "username": uname,
                "firstName": user.get("firstName"),
                "lastName": user.get("lastName"),
                "amount": c.get("amount"),
                "paymentType": "recurring" if c.get("paymentType") == "contribution_recurring" else "one_time",
                "status": c.get("status", "completed"),
                "sessionId": c.get("stripeSessionId") or c.get("paypalOrderId") or c.get("cloverChargeId") or c.get("sessionId"),
                "createdAt": c.get("createdAt").isoformat() if c.get("createdAt") else None,
                "description": c.get("description"),
                "thankYouEmailSentAt": c.get("thankYouEmailSentAt").isoformat() if c.get("thankYouEmailSentAt") else None
            })
        
        # Get summary stats — use the SAME query so stats respect filters
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": None,
                "totalAmount": {"$sum": "$amount"},
                "totalCount": {"$sum": 1},
                "oneTimeCount": {"$sum": {"$cond": [{"$eq": ["$paymentType", "contribution_one_time"]}, 1, 0]}},
                "recurringCount": {"$sum": {"$cond": [{"$eq": ["$paymentType", "contribution_recurring"]}, 1, 0]}}
            }}
        ]
        stats_result = await db.payments.aggregate(pipeline).to_list(length=1)
        stats = stats_result[0] if stats_result else {"totalAmount": 0, "totalCount": 0, "oneTimeCount": 0, "recurringCount": 0}
        
        return {
            "success": True,
            "contributions": formatted_contributions,
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
        logger.error(f"Error getting contributions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get contributions")


@router.get("/admin/unpaid-members")
async def get_unpaid_members(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    page: int = 1,
    limit: int = 50,
    search: str = "",
    sort_by: str = "createdAt",
    sort_order: str = "desc",
):
    """List users who have never made a contribution payment (admin only).

    Sortable fields: username, fullName, age, gender, contactEmail, contactPhone,
                     joinedAt, lastLogin, lastEmailReminderAt, lastSmsReminderAt
    sort_order: "asc" or "desc"
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        # Get usernames who HAVE contributed
        payment_usernames = await db.payments.distinct("username", {
            "paymentType": {"$in": ["contribution_one_time", "contribution_recurring"]}
        })
        payment_usernames = set(payment_usernames)

        # Build query for users WITHOUT contributions
        unpaid_query = {
            "accountStatus": "active",
            "role": {"$nin": ["admin", "moderator"]},
            "username": {"$nin": list(payment_usernames)}
        }

        if search and search.strip():
            search_text = search.strip()
            unpaid_query["$or"] = [
                {"username": {"$regex": search_text, "$options": "i"}},
                {"firstName": {"$regex": search_text, "$options": "i"}},
                {"lastName": {"$regex": search_text, "$options": "i"}},
            ]

        # Map frontend sort fields to MongoDB fields
        sort_field_map = {
            "username": "username",
            "fullName": "firstName",
            "age": "age",
            "gender": "gender",
            "contactEmail": "email",
            "contactPhone": "phone",
            "joinedAt": "createdAt",
            "lastLogin": "lastLogin",
            "lastEmailReminderAt": "lastEmailReminderAt",
            "lastSmsReminderAt": "lastSmsReminderAt",
            "lastReminderAt": "lastEmailReminderAt",  # combined column proxy
        }
        mongo_sort_dir = -1 if sort_order == "desc" else 1

        # Count total
        total = await db.users.count_documents(unpaid_query)

        # Build sort list. Age is special: sort by birthYear then birthMonth
        # since the DB age field is often empty and we calculate it on the fly.
        if sort_by == "age":
            sort_list = [("birthYear", mongo_sort_dir), ("birthMonth", mongo_sort_dir)]
        elif sort_by == "lastLogin":
            # Also consider security.last_login_at as fallback for ordering
            sort_list = [("lastLogin", mongo_sort_dir), ("security.last_login_at", mongo_sort_dir)]
        else:
            mongo_sort_field = sort_field_map.get(sort_by, "createdAt")
            sort_list = [(mongo_sort_field, mongo_sort_dir)]

        # Get page
        cursor = db.users.find(
            unpaid_query,
            {
                "username": 1, "firstName": 1, "lastName": 1,
                "age": 1, "birthMonth": 1, "birthYear": 1,
                "gender": 1, "email": 1, "contactEmail": 1,
                "phone": 1, "contactPhone": 1, "contactNumber": 1, "contactNumbers": 1,
                "createdAt": 1, "lastLogin": 1, "lastActive": 1,
                "security.last_login_at": 1,
                "status.last_seen": 1,
                "lastEmailReminderAt": 1, "lastSmsReminderAt": 1, "_id": 0
            }
        ).sort(sort_list).skip((page - 1) * limit).limit(limit)

        users = await cursor.to_list(length=limit)

        # Decrypt PII if needed
        def decrypt_if_needed(value):
            if not value or not isinstance(value, str):
                return value
            if value.startswith("gAAAAA"):
                try:
                    from crypto_utils import get_encryptor
                    return get_encryptor().decrypt(value)
                except Exception:
                    return "[Encrypted]"
            return value

        def extract_phone(user_doc):
            """Extract best phone number from user doc, handling contactNumbers array/object or legacy fields."""
            # 1. Check contactNumbers (array of objects or dict with keys)
            contact_numbers = user_doc.get("contactNumbers")
            if contact_numbers:
                # Array of objects format: [{"number": "...", "label": "primary"}]
                if isinstance(contact_numbers, list) and contact_numbers:
                    for entry in contact_numbers:
                        if isinstance(entry, dict) and entry.get("number"):
                            return decrypt_if_needed(entry["number"])
                # Object format: {"primary": "...", "secondary": "..."}
                elif isinstance(contact_numbers, dict):
                    for key in ["primary", "home", "mobile", "work"]:
                        val = contact_numbers.get(key)
                        if val:
                            return decrypt_if_needed(val)
                    # Fallback: any non-empty value
                    for val in contact_numbers.values():
                        if val:
                            return decrypt_if_needed(val)
            # 2. Legacy contactNumber field
            contact_number = user_doc.get("contactNumber")
            if contact_number:
                return decrypt_if_needed(contact_number)
            # 3. Even older phone/contactPhone fields
            return decrypt_if_needed(user_doc.get("phone") or user_doc.get("contactPhone") or "")

        def fmt_dt(v):
            if not v:
                return None
            return v.isoformat() if hasattr(v, "isoformat") else str(v)

        def _best_last_login(u):
            """Compute best last login from multiple sources (same logic as profile view)."""
            from datetime import datetime, timezone as dt_tz
            candidates = []
            for raw in [
                u.get("security", {}).get("last_login_at"),
                u.get("lastLogin"),
                u.get("lastActive"),
                u.get("status", {}).get("last_seen"),
            ]:
                if raw is None:
                    continue
                if isinstance(raw, datetime):
                    dt = raw.replace(tzinfo=None) if raw.tzinfo else raw
                    candidates.append(dt)
                elif isinstance(raw, str):
                    try:
                        dt = datetime.fromisoformat(raw.replace('Z', '+00:00').replace('+00:00', ''))
                        dt = dt.replace(tzinfo=None) if dt.tzinfo else dt
                        candidates.append(dt)
                    except Exception:
                        pass
            return max(candidates) if candidates else None

        def _calculate_age(birth_month, birth_year):
            """Calculate age from birthMonth and birthYear."""
            if not birth_month or not birth_year:
                return None
            try:
                from datetime import datetime
                today = datetime.utcnow()
                bm = int(birth_month)
                by = int(birth_year)
                age = today.year - by
                if today.month < bm:
                    age -= 1
                return age if 0 < age <= 120 else None
            except Exception:
                return None

        formatted = []
        for u in users:
            contact_email = decrypt_if_needed(u.get("email") or u.get("contactEmail") or "")
            contact_phone = extract_phone(u)

            # Age: use stored value if valid, otherwise calculate from birthMonth/birthYear
            age = u.get("age")
            if not age:
                age = _calculate_age(u.get("birthMonth"), u.get("birthYear"))

            # Last login: pick the most recent from available sources (same as profile view)
            best_ll = _best_last_login(u)

            formatted.append({
                "username": u.get("username"),
                "fullName": f"{u.get('firstName','')} {u.get('lastName','')}".strip(),
                "age": age,
                "gender": u.get("gender"),
                "contactEmail": contact_email,
                "contactPhone": contact_phone,
                "joinedAt": fmt_dt(u.get("createdAt")),
                "lastLogin": fmt_dt(best_ll),
                "lastEmailReminderAt": fmt_dt(u.get("lastEmailReminderAt")),
                "lastSmsReminderAt": fmt_dt(u.get("lastSmsReminderAt")),
            })

        return {
            "success": True,
            "users": formatted,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        logger.error(f"Error getting unpaid members: {e}")
        raise HTTPException(status_code=500, detail="Failed to get unpaid members")


@router.post("/admin/send-reminder")
async def send_contribution_reminder(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send a contribution reminder to a single user (admin only).
    Request body: {"username": str, "channel": "email"|"sms", "message": "" (optional)}
    """
    role = current_user.get("role", "")
    if role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Admin access required")

    username = request.get("username")
    channel = request.get("channel", "email")
    custom_message = request.get("message", "") or ""

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if channel not in ("email", "sms"):
        raise HTTPException(status_code=400, detail="channel must be 'email' or 'sms'")

    try:
        user = await db.users.find_one(
            {"username": username},
            {"username": 1, "firstName": 1, "email": 1, "contactEmail": 1,
             "phone": 1, "contactPhone": 1, "contactNumber": 1, "contactNumbers": 1}
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        from services.contribution_reminders import send_reminder_to_user, log_reminder_activity

        result = await send_reminder_to_user(
            db, user, channel, custom_message=custom_message
        )

        await log_reminder_activity(
            db,
            action="reminder_sent",
            channel=channel,
            admin_username=current_user.get("username"),
            username=username,
            sent=bool(result.get("sent")),
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending reminder to {username}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send reminder: {str(e)}")


@router.post("/admin/send-bulk-reminder")
async def send_bulk_contribution_reminder(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send contribution reminder emails/SMS to all unpaid members (admin only).
    Request body: {"channel": "email"|"sms", "message": "" (optional)}
    Returns count of messages sent.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    channel = request.get("channel", "email")
    custom_message = request.get("message", "") or ""

    if channel not in ("email", "sms"):
        raise HTTPException(status_code=400, detail="channel must be 'email' or 'sms'")

    try:
        from services.contribution_reminders import send_bulk_reminders
        return await send_bulk_reminders(
            db,
            channel=channel,
            custom_message=custom_message,
            admin_username=current_user.get("username"),
        )
    except Exception as e:
        logger.error(f"Error sending bulk reminders: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send bulk reminders: {str(e)}")


@router.get("/admin/export-csv")
async def export_contributions_csv(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Export all users with contribution details for CSV (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get ALL users (not just contributors)
        users_cursor = db.users.find(
            {},
            {
                "username": 1, 
                "firstName": 1, 
                "lastName": 1,
                "age": 1,
                "gender": 1,
                "contactPhone": 1,
                "phone": 1,
                "contactEmail": 1,
                "email": 1,
                "birthYear": 1,
                "birthMonth": 1,
                "birthDay": 1,
                "lastLogin": 1,
                "_id": 0
            }
        )
        all_users = await users_cursor.to_list(length=None)
        
        # Get ALL contributions
        query = {"paymentType": {"$in": ["contribution_one_time", "contribution_recurring"]}}
        contributions = await db.payments.find(query).sort("createdAt", -1).to_list(length=None)
        
        # Build contribution map: username -> list of contributions
        contribution_map = {}
        for c in contributions:
            username = c.get("username")
            if username:
                if username not in contribution_map:
                    contribution_map[username] = []
                contribution_map[username].append(c)
        
        # Decrypt PII if encrypted
        from datetime import datetime as dt
        
        def decrypt_if_needed(value):
            """Decrypt value if it's encrypted"""
            if not value or not isinstance(value, str):
                return value
            if value.startswith("gAAAAA"):
                try:
                    from crypto_utils import get_encryptor
                    return get_encryptor().decrypt(value)
                except Exception as e:
                    logger.error(f"Failed to decrypt value: {e}")
                    return "[Encrypted]"
            return value
        
        def calculate_age(user):
            """Calculate age from birth date"""
            if user.get("age"):
                return user["age"]
            if user.get("birthYear") and user.get("birthMonth") and user.get("birthDay"):
                try:
                    birth_date = dt(user["birthYear"], user["birthMonth"], user["birthDay"])
                    today = dt.now()
                    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
                    return age
                except:
                    pass
            return ""
        
        # Format for CSV export - iterate through ALL users
        formatted_contributions = []
        for user in all_users:
            username = user.get("username")
            
            # Get contact info with decryption
            contact_email = decrypt_if_needed(user.get("contactEmail") or user.get("email") or "")
            contact_phone = decrypt_if_needed(user.get("contactPhone") or user.get("phone") or "")
            
            # Build full name
            first_name = user.get("firstName", "")
            last_name = user.get("lastName", "")
            full_name = f"{first_name} {last_name}".strip()
            
            # Get contribution data if user has contributed
            user_contributions = contribution_map.get(username, [])
            
            # Get last login date
            last_login = user.get("lastLogin")
            last_login_str = last_login.isoformat() if last_login else ""
            
            if user_contributions:
                # User has contributions - create a row for each contribution
                for c in user_contributions:
                    formatted_contributions.append({
                        "username": username,
                        "fullName": full_name,
                        "age": calculate_age(user),
                        "gender": user.get("gender", ""),
                        "contactPhone": contact_phone,
                        "contactEmail": contact_email,
                        "amount": c.get("amount", 0),
                        "createdAt": c.get("createdAt").isoformat() if c.get("createdAt") else "",
                        "lastLogin": last_login_str
                    })
            else:
                # User has NOT contributed - create a row with empty contribution fields
                formatted_contributions.append({
                    "username": username,
                    "fullName": full_name,
                    "age": calculate_age(user),
                    "gender": user.get("gender", ""),
                    "contactPhone": contact_phone,
                    "contactEmail": contact_email,
                    "amount": "",
                    "createdAt": "",
                    "lastLogin": last_login_str
                })
        
        return {
            "success": True,
            "contributions": formatted_contributions
        }
    except Exception as e:
        logger.error(f"Error exporting contributions CSV: {e}")
        raise HTTPException(status_code=500, detail="Failed to export contributions")


@router.post("/admin/contributions/{contribution_id}/thank-you")
async def send_thank_you_email(
    contribution_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Send a thank-you email to a contributor (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    from bson import ObjectId
    try:
        obj_id = ObjectId(contribution_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid contribution ID")

    contribution = await db.payments.find_one({"_id": obj_id})
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    username = contribution.get("username")
    if not username:
        raise HTTPException(status_code=400, detail="Contribution has no associated user")

    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")

    # Get email — decrypt if encrypted (production PII encryption)
    user_email = user.get("email") or user.get("contactEmail")
    if not user_email:
        raise HTTPException(status_code=400, detail=f"No email on file for {username}")

    if user_email.startswith("gAAAAA"):
        from crypto_utils import get_encryptor
        try:
            user_email = get_encryptor().decrypt(user_email)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to decrypt email: {str(e)}")

    if not user_email or not user_email.strip():
        raise HTTPException(status_code=400, detail=f"No valid email for {username}")

    amount = contribution.get("amount", 0)
    payment_type = "monthly" if contribution.get("paymentType") == "contribution_recurring" else "one-time"
    already_sent = contribution.get("thankYouEmailSentAt")

    # Send the thank you email (reuse existing function)
    await send_contribution_thank_you_email(
        db=db,
        username=username,
        amount=amount,
        payment_type=payment_type,
        payment_method=contribution.get("paymentProvider", "PayPal").title(),
        contribution_id=contribution_id
    )

    # Mark contribution as thanked
    now = datetime.utcnow()
    await db.payments.update_one(
        {"_id": obj_id},
        {"$set": {"thankYouEmailSentAt": now, "thankYouSentBy": current_user.get("username")}}
    )

    logger.info(f"🙏 Thank you email sent to {username} ({user_email}) for ${amount:.2f} by admin {current_user.get('username')}")

    return {
        "success": True,
        "message": f"Thank you email sent to {username}",
        "sentTo": user_email,
        "sentAt": now.isoformat(),
        "alreadySentBefore": already_sent.isoformat() if already_sent else None
    }


class ManualContributionRequest(BaseModel):
    """Request model for manually adding a contribution (admin)"""
    username: str = Field(..., description="Username of the contributor")
    amount: float = Field(..., gt=0, description="Contribution amount in USD")
    paymentMethod: str = Field(..., description="venmo, paypal, zelle, cash, other")
    paymentType: str = Field("one_time", description="one_time or recurring")
    notes: Optional[str] = Field(None, description="Admin notes")
    paymentDate: Optional[str] = Field(None, description="Custom date ISO format")
    sendThankYou: bool = Field(True, description="Send thank you email")


@router.get("/admin/search-users")
async def search_users_for_contribution(
    q: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Search users by username or name for manual contribution entry (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    regex = {"$regex": q, "$options": "i"}
    query = {"$or": [{"username": regex}, {"firstName": regex}, {"lastName": regex}]}
    users = await db.users.find(
        query, {"username": 1, "firstName": 1, "lastName": 1, "_id": 0}
    ).limit(10).to_list(length=10)
    return {"success": True, "users": users}


@router.post("/admin/add-manual")
async def add_manual_contribution(
    request: ManualContributionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Manually record a contribution made outside the app (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = await db.users.find_one({"username": request.username})
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{request.username}' not found")

    # Determine payment date (allow backdating)
    if request.paymentDate:
        try:
            payment_date = datetime.fromisoformat(request.paymentDate.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    else:
        payment_date = datetime.utcnow()

    pt = "contribution_recurring" if request.paymentType == "recurring" else "contribution_one_time"

    payment_doc = {
        "username": request.username,
        "amount": request.amount,
        "paymentType": pt,
        "paymentProvider": "manual",
        "paymentMethod": request.paymentMethod,
        "status": "completed",
        "description": f"Manual entry - {request.paymentMethod.title()} ${request.amount:.2f}",
        "notes": request.notes,
        "createdAt": payment_date,
        "updatedAt": datetime.utcnow(),
        "addedBy": current_user["username"],
        "manualEntry": True
    }

    result = await db.payments.insert_one(payment_doc)

    # Update user contribution stats
    await db.users.update_one(
        {"username": request.username},
        {
            "$inc": {"contributions.totalContributed": request.amount},
            "$set": {
                "contributions.lastContributionDate": payment_date,
                "contributions.lastContributionAmount": request.amount,
            }
        }
    )

    # Optionally send thank you email
    thank_you_sent = None
    if request.sendThankYou:
        try:
            ptype = "monthly" if request.paymentType == "recurring" else "one-time"
            email_sent = await send_contribution_thank_you_email(
                db=db, username=request.username, amount=request.amount,
                payment_type=ptype, payment_method=request.paymentMethod.title(),
                contribution_id=str(result.inserted_id)
            )
            if email_sent:
                thank_you_sent = datetime.utcnow()
                await db.payments.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {"thankYouEmailSentAt": thank_you_sent}}
                )
        except Exception as e:
            logger.error(f"Failed to send thank you email for manual contribution: {e}")

    logger.info(
        f"Manual contribution recorded: {request.username} "
        f"${request.amount:.2f} via {request.paymentMethod} by {current_user['username']}"
    )

    return {
        "success": True,
        "message": f"Contribution of ${request.amount:.2f} recorded for {request.username}",
        "contributionId": str(result.inserted_id),
        "thankYouSent": thank_you_sent is not None
    }


class ContributionActivityRequest(BaseModel):
    """Request model for logging contribution popup activity"""
    action: str = Field(..., description="Action: 'popup_shown', 'closed', 'remind_later', 'proceed_to_payment', 'contributed'")
    amount: Optional[float] = Field(None, description="Amount if applicable")
    paymentType: Optional[str] = Field(None, description="Payment type if applicable")


@router.post("/log-contribution-activity")
async def log_contribution_activity(
    request: ContributionActivityRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Log user interaction with the contribution popup"""
    from datetime import datetime
    
    try:
        activity = {
            "username": current_user["username"],
            "action": request.action,
            "amount": request.amount,
            "paymentType": request.paymentType,
            "timestamp": datetime.utcnow(),
            "userAgent": None  # Could be added from request headers if needed
        }
        
        await db.contribution_activity.insert_one(activity)
        
        logger.debug(f"💝 Contribution activity logged: {current_user['username']} - {request.action}")
        
        return {"success": True, "message": "Activity logged"}
    except Exception as e:
        logger.error(f"Error logging contribution activity: {e}")
        # Don't fail the request if logging fails
        return {"success": True, "message": "Activity logging skipped"}


@router.get("/contribution-history")
async def get_contribution_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get contribution history for the current user"""
    try:
        username = current_user["username"]
        
        # Get user's contribution payments
        contributions = await db.payments.find({
            "username": username,
            "paymentType": {"$in": ["contribution_one_time", "contribution_recurring"]}
        }).sort("createdAt", -1).to_list(length=None)
        
        # Format contributions for frontend
        formatted_contributions = []
        for c in contributions:
            formatted_contributions.append({
                "id": str(c.get("_id")),
                "amount": c.get("amount", 0),
                "type": "recurring" if c.get("paymentType") == "contribution_recurring" else "one-time",
                "date": c.get("createdAt").isoformat() if c.get("createdAt") else None,
                "paymentMethod": c.get("paymentProvider", c.get("paymentMethod", "PayPal")),
                "status": c.get("status", "completed"),
                "description": c.get("description", "Platform Contribution")
            })
        
        # Calculate stats
        total_contributed = sum(c["amount"] for c in formatted_contributions)
        contribution_count = len(formatted_contributions)
        average_amount = total_contributed / contribution_count if contribution_count > 0 else 0
        
        # Check if user has recurring contributions
        recurring_contributions = [c for c in formatted_contributions if c["type"] == "recurring"]
        last_contribution = formatted_contributions[0]["date"] if formatted_contributions else None
        
        stats = {
            "totalContributed": total_contributed,
            "contributionCount": contribution_count,
            "averageAmount": average_amount,
            "lastContribution": last_contribution,
            "monthlyContributions": len(recurring_contributions),
            "isRecurringContributor": len(recurring_contributions) > 0
        }
        
        return {
            "success": True,
            "contributions": formatted_contributions,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting contribution history: {e}")
        # Return empty data instead of error to avoid breaking UI
        return {
            "success": True,
            "contributions": [],
            "stats": {
                "totalContributed": 0,
                "contributionCount": 0,
                "averageAmount": 0,
                "lastContribution": None,
                "monthlyContributions": 0,
                "isRecurringContributor": False
            }
        }


@router.get("/payment-methods")
async def get_payment_methods(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get saved payment methods for the current user"""
    try:
        username = current_user["username"]
        
        # For now, return empty list since we don't have saved payment methods implementation
        # This can be extended later when we implement payment method storage
        payment_methods = []
        
        return {
            "success": True,
            "paymentMethods": payment_methods
        }
        
    except Exception as e:
        logger.error(f"Error getting payment methods: {e}")
        # Return empty data instead of error to avoid breaking UI
        return {
            "success": True,
            "paymentMethods": []
        }


@router.get("/admin/contribution-activity")
async def get_contribution_activity(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    page: int = 1,
    limit: int = 50,
    action_filter: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None
):
    """Get contribution popup activity log (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Build query
        query = {}
        if action_filter and action_filter != "all":
            query["action"] = action_filter
        
        # Resolve search to a set of usernames BEFORE pagination
        target_usernames = None
        if username and username.strip():
            target_usernames = {username.strip()}
        
        if search and search.strip():
            regex = {"$regex": search.strip(), "$options": "i"}
            matching_users = await db.users.find(
                {"$or": [{"username": regex}, {"firstName": regex}, {"lastName": regex}]},
                {"username": 1, "_id": 0}
            ).to_list(length=None)
            search_usernames = {u["username"] for u in matching_users if u.get("username")}
            
            if not search_usernames:
                return {
                    "success": True,
                    "activities": [],
                    "pagination": {"page": page, "limit": limit, "total": 0, "totalPages": 0},
                    "stats": {}
                }
            
            if target_usernames:
                target_usernames = target_usernames & search_usernames
                if not target_usernames:
                    return {
                        "success": True,
                        "activities": [],
                        "pagination": {"page": page, "limit": limit, "total": 0, "totalPages": 0},
                        "stats": {}
                    }
            else:
                target_usernames = search_usernames
        
        # Build query
        query = {}
        if action_filter and action_filter != "all":
            query["action"] = action_filter
        
        if target_usernames:
            query["username"] = {"$in": list(target_usernames)}
        
        # Get total count (reflects search + action_filter)
        total = await db.contribution_activity.count_documents(query)
        
        # Get activities with pagination
        skip = (page - 1) * limit
        activities = await db.contribution_activity.find(query).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
        
        # Fetch user details in batch
        usernames = list(set(a.get("username") for a in activities if a.get("username")))
        user_details = {}
        if usernames:
            users = await db.users.find(
                {"username": {"$in": usernames}},
                {"username": 1, "firstName": 1, "lastName": 1, "_id": 0}
            ).to_list(length=len(usernames))
            user_details = {u["username"]: u for u in users}
        
        # Format for frontend
        formatted_activities = []
        for a in activities:
            uname = a.get("username")
            user = user_details.get(uname, {})
            formatted_activities.append({
                "id": str(a.get("_id")),
                "username": uname,
                "firstName": user.get("firstName"),
                "lastName": user.get("lastName"),
                "action": a.get("action"),
                "amount": a.get("amount"),
                "paymentType": a.get("paymentType"),
                "timestamp": a.get("timestamp").isoformat() if a.get("timestamp") else None
            })
        
        # Get action summary stats — use the SAME query so stats respect filters
        match_stage = {"$match": query} if query else None
        pipeline = []
        if match_stage:
            pipeline.append(match_stage)
        pipeline.append({
            "$group": {
                "_id": "$action",
                "count": {"$sum": 1}
            }
        })
        action_stats = await db.contribution_activity.aggregate(pipeline).to_list(length=20)
        stats = {s["_id"]: s["count"] for s in action_stats}
        
        # Add total count to stats for accurate "All" filter
        stats["total"] = total
        
        return {
            "success": True,
            "activities": formatted_activities,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": (total + limit - 1) // limit if total > 0 else 1
            },
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Error getting contribution activity: {e}")
        raise HTTPException(status_code=500, detail="Failed to get contribution activity")


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
