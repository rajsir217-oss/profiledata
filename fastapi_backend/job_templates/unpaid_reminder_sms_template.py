"""
Unpaid Members SMS Reminder Job Template
Sends bulk SMS reminders to unpaid members
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Tuple

from .base import JobTemplate, JobExecutionContext, JobResult
from config import settings

logger = logging.getLogger(__name__)


class UnpaidReminderSMSTemplate(JobTemplate):
    """Job template for sending SMS reminders to unpaid members"""
    
    # Template metadata
    template_type = "unpaid_reminder_sms"
    template_name = "Unpaid Members SMS Reminder"
    template_description = "Send bulk SMS reminders to unpaid contribution members"
    category = "contributions"
    icon = "📱"
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
                "description": "Test without sending actual SMS",
                "default": False
            },
            "test_mode": {
                "type": "boolean",
                "label": "Test Mode",
                "description": "Send all SMS to test phone instead of actual recipients",
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
        """Execute the unpaid members SMS reminder job"""
        params = context.parameters
        db = context.db
        
        dry_run = params.get("dry_run", False)
        test_mode = params.get("test_mode", False)
        batch_size = params.get("batch_size", 100)
        
        context.log("info", f"📱 Starting unpaid members SMS reminder job")
        context.log("info", f"   Dry run: {dry_run}")
        context.log("info", f"   Test mode: {test_mode}")
        context.log("info", f"   Batch size: {batch_size}")
        
        try:
            # Get unpaid members with phone numbers
            unpaid_query = {
                "accountStatus": {"$ne": "deleted"},
                "role": {"$nin": ["admin", "moderator"]},
                "username": {"$nin": list(await db.contributions.distinct("username", {"status": "paid"}))},
                "$or": [
                    {"phone": {"$exists": True, "$ne": None}},
                    {"contactPhone": {"$exists": True, "$ne": None}},
                    {"contactNumber": {"$exists": True, "$ne": None}},
                    {"contactNumbers": {"$exists": True, "$ne": []}}
                ]
            }
            
            projection = {
                "username": 1,
                "firstName": 1,
                "phone": 1,
                "contactPhone": 1,
                "contactNumber": 1,
                "contactNumbers": 1
            }
            
            unpaid_users = await db.users.find(unpaid_query, projection).to_list(length=None)
            
            total_users = len(unpaid_users)
            context.log("info", f"📊 Found {total_users} unpaid members with phone numbers")
            
            if total_users == 0:
                return JobResult(
                    status="success",
                    message="No unpaid members with phone numbers found",
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
                        first_name = user.get("firstName", "")
                        
                        # Extract phone number
                        phone = self._extract_phone(user)
                        
                        if not phone:
                            context.log("warning", f"   ⚠️ No phone for {username}, skipping")
                            continue
                        
                        if dry_run:
                            context.log("info", f"   📝 Dry run: Would send SMS to {username} ({phone[:3]}***)")
                            sent_count += 1
                        else:
                            # Send SMS
                            await self._send_sms_reminder(
                                db, username, phone, first_name, test_mode
                            )
                            sent_count += 1
                            context.log("info", f"   ✅ Sent SMS to {username}")
                            
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
            context.log("error", f"❌ Unpaid members SMS reminder job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                errors=[str(e)]
            )
    
    def _extract_phone(self, user: Dict[str, Any]) -> str:
        """Extract phone number from user data"""
        # Try various phone fields
        phone = user.get("phone") or user.get("contactPhone") or user.get("contactNumber")
        
        if phone:
            return phone
        
        # Check contactNumbers array or object
        contact_numbers = user.get("contactNumbers")
        if isinstance(contact_numbers, list) and contact_numbers:
            # Array format: [{"number": "...", "label": "..."}]
            for cn in contact_numbers:
                if isinstance(cn, dict):
                    num = cn.get("number")
                    if num:
                        return num
        elif isinstance(contact_numbers, dict):
            # Object format: {"primary": "...", "secondary": "..."}
            for key in ["primary", "home", "mobile", "work"]:
                num = contact_numbers.get(key)
                if num:
                    return num
        
        return ""
    
    async def _send_sms_reminder(self, db, username: str, phone: str, first_name: str, test_mode: bool):
        """Send SMS reminder to a user"""
        from services.sms_sender import send_sms
        from crypto_utils import get_encryptor
        
        # Decrypt phone if encrypted
        if phone and phone.startswith('gAAAAA'):
            try:
                encryptor = get_encryptor()
                phone = encryptor.decrypt(phone)
            except Exception:
                pass
        
        # Build SMS message
        message = f"Hi {first_name}! 💝 Your contribution helps keep L3V3L MATCHES running. Please consider making a contribution: https://l3v3lmatches.com/contribution"
        
        if test_mode:
            # Send to test phone instead
            test_phone = settings.test_phone or "+1234567890"
            await send_sms(test_phone, message)
        else:
            await send_sms(phone, message)
