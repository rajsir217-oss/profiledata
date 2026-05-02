"""
Contribution Reminders Service
Single source of truth for sending contribution reminders to unpaid members.

Used by:
- routers/contribution_routes.py (UI: single + bulk reminders)
- job_templates/unpaid_reminder_email_template.py (Scheduler: bulk email)
- job_templates/unpaid_reminder_sms_template.py (Scheduler: bulk SMS)
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase

from config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PII Decryption Helper
# ---------------------------------------------------------------------------
def decrypt_if_needed(value: Any) -> Optional[str]:
    """Decrypt a Fernet-encrypted PII value if needed. Returns None on failure."""
    if not value or not isinstance(value, str):
        return value if value else None
    if value.startswith("gAAAAA"):
        try:
            from crypto_utils import get_encryptor
            return get_encryptor().decrypt(value)
        except Exception as e:
            logger.error(f"Failed to decrypt PII: {e}")
            return None
    return value


# ---------------------------------------------------------------------------
# Contact Info Extraction (single source of truth)
# ---------------------------------------------------------------------------
def extract_email(user: Dict[str, Any]) -> Optional[str]:
    """Extract and decrypt email from user document."""
    return decrypt_if_needed(user.get("email") or user.get("contactEmail"))


def extract_phone(user: Dict[str, Any]) -> Optional[str]:
    """Extract and decrypt phone from user document, checking all known fields."""
    # Try direct fields first
    phone = user.get("phone") or user.get("contactPhone") or user.get("contactNumber")

    # Fall back to contactNumbers (dict or list formats)
    if not phone:
        cn = user.get("contactNumbers")
        if isinstance(cn, dict):
            for key in ["primary", "home", "mobile", "work"]:
                val = cn.get(key)
                if val:
                    phone = val
                    break
            if not phone:
                for v in cn.values():
                    if v:
                        phone = v
                        break
        elif isinstance(cn, list) and len(cn) > 0:
            if isinstance(cn[0], dict):
                phone = cn[0].get("number") or cn[0].get("value") or cn[0].get("phone")
            else:
                phone = str(cn[0])

    return decrypt_if_needed(phone)


# ---------------------------------------------------------------------------
# Unpaid Users Query (single source of truth)
# ---------------------------------------------------------------------------
async def get_unpaid_users(db: AsyncIOMotorDatabase, channel: str) -> List[Dict[str, Any]]:
    """
    Get all users who have NOT made any contribution payment, filtered by channel.

    - "email": users with any email field present
    - "sms": users with any phone field present

    Excludes admins, moderators, and deleted accounts.
    """
    # Source of truth: db.payments collection with paymentType filter
    payment_usernames = await db.payments.distinct("username", {
        "paymentType": {"$in": ["contribution_one_time", "contribution_recurring"]}
    })
    payment_usernames = list(set(payment_usernames))

    base_query = {
        "accountStatus": "active",
        "role": {"$nin": ["admin", "moderator"]},
        "username": {"$nin": payment_usernames},
    }

    if channel == "email":
        base_query["$or"] = [
            {"email": {"$exists": True, "$ne": ""}},
            {"contactEmail": {"$exists": True, "$ne": ""}},
        ]
        projection = {"username": 1, "firstName": 1, "email": 1, "contactEmail": 1}
    elif channel == "sms":
        base_query["$or"] = [
            {"phone": {"$exists": True, "$ne": ""}},
            {"contactPhone": {"$exists": True, "$ne": ""}},
            {"contactNumber": {"$exists": True, "$ne": ""}},
            {"contactNumbers": {"$exists": True, "$ne": []}},
        ]
        projection = {
            "username": 1, "firstName": 1,
            "phone": 1, "contactPhone": 1, "contactNumber": 1, "contactNumbers": 1,
        }
    else:
        raise ValueError(f"Invalid channel: {channel} (must be 'email' or 'sms')")

    cursor = db.users.find(base_query, projection)
    return await cursor.to_list(length=None)


# ---------------------------------------------------------------------------
# Message Templates (single source of truth)
# ---------------------------------------------------------------------------
EMAIL_SUBJECT = "We miss you at L3V3L MATCHES 💝"


def build_reminder_email(first_name: str, custom_message: Optional[str] = None) -> Tuple[str, str]:
    """
    Build the reminder email content.
    Returns: (subject, html_body)
    """
    body_inner = (
        f'<p>{custom_message}</p>' if custom_message else
        '<p>L3V3L MATCHES thrives because of members like you.</p>'
        '<p>We truly appreciate your presence in our community. '
        'Your contribution directly helps us maintain, secure, and enhance the platform for all families.</p>'
        '<p>Your support goes toward:</p>'
        '<ul>'
        '<li>Reliable servers and infrastructure</li>'
        '<li>Stronger security and privacy protections</li>'
        '<li>New and improved matching features</li>'
        '</ul>'
    )

    html_body = f"""<html>
<body style="font-family:Arial,sans-serif;padding:0;margin:0;background:#f8f9fa;">
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:1px;">💜 L3V3L MATCHES</h1>
    <p style="margin:8px 0 0 0;font-size:14px;opacity:0.9;">Level Up Your Connections</p>
  </div>
  <div style="background:white;padding:28px 24px;border-radius:0 0 12px 12px;max-width:600px;margin:0 auto;">
    <h2 style="color:#667eea;margin-top:0;">Hi {first_name},</h2>
    {body_inner}
    <p style="margin-top:24px;text-align:center;">
      <a href="https://l3v3lmatches.com/contribution" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:14px 28px;border-radius:50px;text-decoration:none;display:inline-block;font-weight:600;font-size:16px;box-shadow:0 4px 15px rgba(102,126,234,0.4);">
        Make a Contribution
      </a>
    </p>
    <p style="color:#888;font-size:12px;margin-top:32px;text-align:center;border-top:1px solid #eee;padding-top:20px;">
      Thank you for being part of L3V3L MATCHES.<br>
      — The L3V3L Team
    </p>
  </div>
</body>
</html>"""
    return EMAIL_SUBJECT, html_body


def build_reminder_sms(first_name: str, custom_message: Optional[str] = None) -> str:
    """Build the SMS reminder text."""
    if custom_message:
        return custom_message
    return (
        f"Hi {first_name}! Hope your partner-search journey is going beautifully. 💝\n\n"
        f"Thank you for being part of our community. Your contribution plays a big role in keeping L3V3L MATCHES growing and improving for everyone.\n\n"
        f"Support here: https://l3v3lmatches.com/contribution\n"
        f"— L3V3L Team"
    )


# ---------------------------------------------------------------------------
# Activity Logging (single source of truth)
# ---------------------------------------------------------------------------
async def log_reminder_activity(
    db: AsyncIOMotorDatabase,
    action: str,
    channel: str,
    admin_username: Optional[str],
    username: Optional[str] = None,
    sent: Optional[bool] = None,
    sent_count: Optional[int] = None,
    failed_count: Optional[int] = None,
    total: Optional[int] = None,
):
    """Insert a single entry into contribution_activity for audit/UI."""
    entry: Dict[str, Any] = {
        "action": action,
        "channel": channel,
        "adminUsername": admin_username,
        "createdAt": datetime.utcnow(),
    }
    if username is not None:
        entry["username"] = username
    if sent is not None:
        entry["sent"] = sent
    if sent_count is not None:
        entry["sentCount"] = sent_count
    if failed_count is not None:
        entry["failedCount"] = failed_count
    if total is not None:
        entry["total"] = total
    try:
        await db.contribution_activity.insert_one(entry)
    except Exception as e:
        logger.error(f"Failed to log reminder activity: {e}")


# ---------------------------------------------------------------------------
# Send to a Single User
# ---------------------------------------------------------------------------
async def send_reminder_to_user(
    db: AsyncIOMotorDatabase,
    user: Dict[str, Any],
    channel: str,
    custom_message: str = "",
    test_mode: bool = False,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Send a reminder to a single user via the specified channel.

    Returns:
        {
            "success": bool,
            "sent": bool,
            "username": str,
            "channel": str,
            "error": Optional[str],
        }
    """
    username = user.get("username")
    first_name = user.get("firstName") or username or "there"
    result: Dict[str, Any] = {
        "success": False,
        "sent": False,
        "username": username,
        "channel": channel,
    }

    if channel == "email":
        recipient = extract_email(user)
        if not recipient:
            result["error"] = "No email address found"
            return result

        if test_mode:
            recipient = getattr(settings, "test_email", None) or "admin@l3v3lmatches.com"

        if dry_run:
            result["success"] = True
            result["sent"] = True
            result["dry_run"] = True
            return result

        subject, html_body = build_reminder_email(first_name, custom_message or None)
        try:
            from services.email_sender import send_email
            send_result = await send_email(recipient, subject, html_body)
        except Exception as e:
            result["error"] = f"Email send error: {e}"
            return result

        if isinstance(send_result, dict) and send_result.get("success"):
            result["sent"] = True
            result["success"] = True
            # Stamp last reminder timestamp on user doc (skip for test_mode/dry_run)
            if username and not test_mode:
                try:
                    await db.users.update_one(
                        {"username": username},
                        {"$set": {"lastEmailReminderAt": datetime.utcnow()}}
                    )
                except Exception as e:
                    logger.warning(f"Failed to stamp lastEmailReminderAt for {username}: {e}")
        else:
            err = (send_result or {}).get("error") if isinstance(send_result, dict) else None
            result["error"] = err or "Failed to send email"

    elif channel == "sms":
        recipient = extract_phone(user)
        if not recipient:
            result["error"] = "No phone number found"
            return result

        if test_mode:
            recipient = getattr(settings, "test_phone", None) or "+1234567890"

        if dry_run:
            result["success"] = True
            result["sent"] = True
            result["dry_run"] = True
            return result

        sms_text = build_reminder_sms(first_name, custom_message or None)
        try:
            from services.sms_sender import send_sms
            send_result = await send_sms(recipient, sms_text)
        except Exception as e:
            result["error"] = f"SMS send error: {e}"
            return result

        if isinstance(send_result, dict) and send_result.get("success"):
            result["sent"] = True
            result["success"] = True
            # Stamp last reminder timestamp on user doc (skip for test_mode/dry_run)
            if username and not test_mode:
                try:
                    await db.users.update_one(
                        {"username": username},
                        {"$set": {"lastSmsReminderAt": datetime.utcnow()}}
                    )
                except Exception as e:
                    logger.warning(f"Failed to stamp lastSmsReminderAt for {username}: {e}")
        else:
            err = (send_result or {}).get("error") if isinstance(send_result, dict) else None
            result["error"] = err or "Failed to send SMS"

    else:
        result["error"] = f"Invalid channel: {channel}"

    return result


# ---------------------------------------------------------------------------
# Send Bulk Reminders
# ---------------------------------------------------------------------------
async def send_bulk_reminders(
    db: AsyncIOMotorDatabase,
    channel: str,
    custom_message: str = "",
    admin_username: Optional[str] = None,
    dry_run: bool = False,
    test_mode: bool = False,
    batch_size: int = 100,
    inter_batch_delay_seconds: float = 1.0,
    progress_callback=None,
) -> Dict[str, Any]:
    """
    Send reminders to all unpaid users for the given channel.

    Args:
        db: MongoDB database
        channel: "email" or "sms"
        custom_message: Optional custom message text
        admin_username: Username of admin triggering this (or "scheduler")
        dry_run: If True, don't actually send messages
        test_mode: If True, send all messages to a test recipient
        batch_size: Process N users per batch
        inter_batch_delay_seconds: Delay between batches
        progress_callback: Optional async fn(level, message) for live logging

    Returns:
        Summary dict: {success, sentCount, failedCount, total, errors, message}
    """
    async def _log(level: str, msg: str):
        if progress_callback:
            try:
                if asyncio.iscoroutinefunction(progress_callback):
                    await progress_callback(level, msg)
                else:
                    progress_callback(level, msg)
            except Exception:
                pass
        getattr(logger, level.lower(), logger.info)(msg)

    if channel not in ("email", "sms"):
        return {
            "success": False,
            "sentCount": 0,
            "failedCount": 0,
            "total": 0,
            "errors": [f"Invalid channel: {channel}"],
            "message": f"Invalid channel: {channel}",
        }

    unpaid_users = await get_unpaid_users(db, channel)
    total = len(unpaid_users)
    await _log("info", f"📊 Found {total} unpaid members for {channel}")

    if total == 0:
        return {
            "success": True,
            "sentCount": 0,
            "failedCount": 0,
            "total": 0,
            "errors": [],
            "message": "No unpaid members found",
        }

    sent_count = 0
    failed_count = 0
    errors: List[str] = []

    for i in range(0, total, batch_size):
        batch = unpaid_users[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (total + batch_size - 1) // batch_size
        await _log("info", f"📦 Processing batch {batch_num}/{total_batches} ({len(batch)} users)")

        for user in batch:
            username = user.get("username")
            res = await send_reminder_to_user(
                db, user, channel,
                custom_message=custom_message,
                test_mode=test_mode,
                dry_run=dry_run,
            )
            if res.get("sent"):
                sent_count += 1
            else:
                failed_count += 1
                err = res.get("error") or "Unknown"
                errors.append(f"{username}: {err}")

        if i + batch_size < total:
            await asyncio.sleep(inter_batch_delay_seconds)

    # Audit log (single summary entry)
    await log_reminder_activity(
        db,
        action="bulk_reminder_sent",
        channel=channel,
        admin_username=admin_username,
        sent_count=sent_count,
        failed_count=failed_count,
        total=total,
    )

    return {
        "success": True,
        "sentCount": sent_count,
        "failedCount": failed_count,
        "total": total,
        "errors": errors[:10],
        "message": f"Sent {sent_count} {channel} reminder(s) ({failed_count} failed)",
        "dry_run": dry_run,
        "test_mode": test_mode,
    }
