"""
Unpaid Members Email Reminder Job Template
Sends bulk email reminders to unpaid members
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Tuple

from .base import JobTemplate, JobExecutionContext, JobResult
from config import settings

logger = logging.getLogger(__name__)


class UnpaidReminderEmailTemplate(JobTemplate):
    """Job template for sending email reminders to unpaid members"""
    
    # Template metadata
    template_type = "unpaid_reminder_email"
    template_name = "Unpaid Members Email Reminder"
    template_description = "Send bulk email reminders to unpaid contribution members"
    category = "contributions"
    icon = "💰"
    estimated_duration = "5-10 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def __init__(self):
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate job parameters"""
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "dry_run": False,
            "test_mode": False,
            "batch_size": 100
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "dry_run": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "Test without sending actual emails",
                "default": False
            },
            "test_mode": {
                "type": "boolean",
                "label": "Test Mode",
                "description": "Send all emails to test address instead of actual recipients",
                "default": False
            },
            "batch_size": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per batch",
                "default": 100,
                "min": 1,
                "max": 500
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the unpaid members email reminder job"""
        params = context.parameters
        db = context.db
        
        dry_run = params.get("dry_run", False)
        test_mode = params.get("test_mode", False)
        batch_size = params.get("batch_size", 100)
        
        context.log("info", f"💰 Starting unpaid members email reminder job")
        context.log("info", f"   Dry run: {dry_run}")
        context.log("info", f"   Test mode: {test_mode}")
        context.log("info", f"   Batch size: {batch_size}")
        
        try:
            # Get unpaid members
            payment_usernames = await db.contributions.distinct("username", {"status": "paid"})
            unpaid_query = {
                "accountStatus": {"$ne": "deleted"},
                "role": {"$nin": ["admin", "moderator"]},
                "username": {"$nin": payment_usernames},
                "$or": [
                    {"contactEmail": {"$exists": True, "$ne": None}}
                ]
            }
            
            projection = {
                "username": 1,
                "firstName": 1,
                "email": 1,
                "contactEmail": 1
            }
            
            unpaid_users = await db.users.find(unpaid_query, projection).to_list(length=None)
            
            total_users = len(unpaid_users)
            context.log("info", f"📊 Found {total_users} unpaid members")
            
            if total_users == 0:
                return JobResult(
                    status="success",
                    message="No unpaid members found",
                    records_processed=0,
                    records_affected=0
                )
            
            # Process in batches
            sent_count = 0
            failed_count = 0
            errors = []
            
            for i in range(0, total_users, batch_size):
                batch = unpaid_users[i:i + batch_size]
                context.log("info", f"📦 Processing batch {i//batch_size + 1}/{(total_users + batch_size - 1)//batch_size}")
                
                for user in batch:
                    try:
                        username = user.get("username")
                        email = user.get("email") or user.get("contactEmail")
                        
                        if not email:
                            context.log("warning", f"   ⚠️ No email for {username}, skipping")
                            continue
                        
                        if dry_run:
                            context.log("info", f"   📝 Dry run: Would send email to {username} ({email[:3]}***)")
                            sent_count += 1
                        else:
                            # Send email
                            await self._send_email_reminder(
                                db, username, email, user.get("firstName", ""), test_mode
                            )
                            sent_count += 1
                            context.log("info", f"   ✅ Sent email to {username}")
                            
                    except Exception as e:
                        failed_count += 1
                        error_msg = f"Failed to send to {user.get('username')}: {str(e)}"
                        errors.append(error_msg)
                        context.log("error", f"   ❌ {error_msg}")
                
                # Small delay between batches
                if i + batch_size < total_users:
                    await asyncio.sleep(1)
            
            return JobResult(
                status="success" if failed_count == 0 else "partial",
                message=f"Processed {total_users} unpaid members",
                records_processed=total_users,
                records_affected=sent_count,
                details={
                    "sent": sent_count,
                    "failed": failed_count,
                    "dry_run": dry_run,
                    "test_mode": test_mode
                },
                errors=errors[:10]
            )
            
        except Exception as e:
            context.log("error", f"❌ Unpaid members email reminder job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                errors=[str(e)]
            )
    
    async def _send_email_reminder(self, db, username: str, email: str, first_name: str, test_mode: bool):
        """Send email reminder to a user"""
        from services.email_sender import send_email
        from crypto_utils import get_encryptor
        
        # Decrypt email if encrypted
        if email and email.startswith('gAAAAA'):
            try:
                encryptor = get_encryptor()
                email = encryptor.decrypt(email)
            except Exception:
                pass
        
        # Build email content
        subject = "We miss you at L3V3L MATCHES 💝"
        html_body = f"""<html>
<body style="font-family:Arial,sans-serif;padding:0;margin:0;background:#f8f9fa;">
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:1px;">💜 L3V3L MATCHES</h1>
    <p style="margin:8px 0 0 0;font-size:14px;opacity:0.9;">Level Up Your Connections</p>
  </div>
  <div style="background:white;padding:28px 24px;border-radius:0 0 12px 12px;max-width:600px;margin:0 auto;">
    <h2 style="color:#667eea;margin-top:0;">Hi {first_name},</h2>
    <p>Your support keeps L3V3L MATCHES strong.</p>
    <p>If you haven't contributed yet, even a small amount helps us cover:</p>
    <ul>
      <li>Server & infrastructure</li>
      <li>Security & privacy</li>
      <li>New matching features</li>
    </ul>
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
        
        if test_mode:
            # Send to test email instead
            test_email = settings.test_email or "admin@l3v3lmatches.com"
            await send_email(test_email, subject, html_body)
        else:
            await send_email(email, subject, html_body)
