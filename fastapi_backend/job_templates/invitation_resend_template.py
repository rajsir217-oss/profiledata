"""
Invitation Resend Job Template
Automatically resends invitation emails to recipients who haven't registered yet.
Targets invitations where emailStatus is "sent" but no registration has occurred.
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from .base import JobTemplate, JobExecutionContext, JobResult


class InvitationResendTemplate(JobTemplate):
    """Job template for automatically resending invitation emails"""
    
    # Template metadata
    template_type = "invitation_resend"
    template_name = "Invitation Resend"
    template_description = "Automatically resend invitation emails to recipients who haven't registered yet"
    category = "invitations"
    icon = "📨"
    estimated_duration = "1-10 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        batch_size = params.get("batchSize", 50)
        if not isinstance(batch_size, int) or batch_size < 1 or batch_size > 200:
            return False, "batchSize must be an integer between 1 and 200"
        
        min_days_since_last_send = params.get("minDaysSinceLastSend", 3)
        if not isinstance(min_days_since_last_send, int) or min_days_since_last_send < 1:
            return False, "minDaysSinceLastSend must be at least 1 day"
        
        max_resend_count = params.get("maxResendCount", 3)
        if not isinstance(max_resend_count, int) or max_resend_count < 1 or max_resend_count > 10:
            return False, "maxResendCount must be between 1 and 10"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batchSize": 50,
            "minDaysSinceLastSend": 3,
            "maxResendCount": 3,
            "testMode": False,
            "testEmail": None
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Maximum number of invitations to resend per run",
                "default": 50,
                "min": 1,
                "max": 200
            },
            "minDaysSinceLastSend": {
                "type": "integer",
                "label": "Minimum Days Since Last Send",
                "description": "Wait at least this many days before resending",
                "default": 3,
                "min": 1,
                "max": 30
            },
            "maxResendCount": {
                "type": "integer",
                "label": "Maximum Resend Count",
                "description": "Maximum number of times to resend an invitation",
                "default": 3,
                "min": 1,
                "max": 10
            },
            "testMode": {
                "type": "boolean",
                "label": "Test Mode",
                "description": "Don't actually send emails, just log what would be sent",
                "default": False
            },
            "testEmail": {
                "type": "string",
                "label": "Test Email",
                "description": "Send all emails to this address instead (for testing)",
                "required_if": {"testMode": True}
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the invitation resend job"""
        start_time = datetime.utcnow()
        resent_count = 0
        skipped_count = 0
        failed_count = 0
        errors = []
        
        try:
            params = context.parameters
            batch_size = params.get("batchSize", 50)
            min_days = params.get("minDaysSinceLastSend", 3)
            max_resend = params.get("maxResendCount", 3)
            test_mode = params.get("testMode", False)
            test_email = params.get("testEmail")
            
            context.log("info", f"🔍 Finding invitations to resend (minDays={min_days}, maxResend={max_resend})")
            
            # Calculate cutoff date - only resend if last email was sent at least minDays ago
            cutoff_date = datetime.utcnow() - timedelta(days=min_days)
            
            # Query for invitations that:
            # 1. Have emailStatus = "sent" (already sent at least once)
            # 2. Have NOT been registered (registeredAt is null)
            # 3. Are NOT archived
            # 4. Have emailResendCount < maxResendCount (or field doesn't exist)
            # 5. Last email was sent at least minDays ago
            query = {
                "emailStatus": "sent",
                "registeredAt": None,
                "archived": {"$ne": True},
                "$or": [
                    {"emailResendCount": {"$exists": False}},
                    {"emailResendCount": {"$lt": max_resend}}
                ],
                "$and": [
                    {
                        "$or": [
                            {"lastEmailSentAt": {"$lte": cutoff_date}},
                            {"lastEmailSentAt": {"$exists": False}, "emailSentAt": {"$lte": cutoff_date}}
                        ]
                    }
                ]
            }
            
            # Find eligible invitations
            cursor = context.db.invitations.find(query).limit(batch_size)
            invitations = await cursor.to_list(length=batch_size)
            
            if not invitations:
                return JobResult(
                    status="success",
                    message="No invitations eligible for resend",
                    details={"checked": 0, "resent": 0},
                    duration_seconds=(datetime.utcnow() - start_time).total_seconds()
                )
            
            context.log("info", f"📧 Found {len(invitations)} invitations eligible for resend")
            
            # Import required modules
            from config import Settings
            from services.email_sender import send_invitation_email
            from urllib.parse import quote
            settings = Settings()
            
            for invitation in invitations:
                try:
                    inv_id = str(invitation["_id"])
                    inv_email = invitation.get("email")
                    inv_name = invitation.get("name", "Friend")
                    inv_token = invitation.get("invitationToken")
                    current_resend_count = invitation.get("emailResendCount", 0)
                    
                    # Generate token if missing (for bulk-imported invitations)
                    if not inv_token:
                        import secrets
                        import string
                        
                        context.log("info", f"🔑 Generating token for invitation {inv_id} (missing token)")
                        
                        # Generate secure token
                        alphabet = string.ascii_letters + string.digits
                        inv_token = ''.join(secrets.choice(alphabet) for _ in range(32))
                        token_expiry = datetime.utcnow() + timedelta(days=30)
                        
                        # Update invitation with new token
                        await context.db.invitations.update_one(
                            {"_id": ObjectId(inv_id)},
                            {
                                "$set": {
                                    "invitationToken": inv_token,
                                    "tokenExpiresAt": token_expiry,
                                    "updatedAt": datetime.utcnow()
                                }
                            }
                        )
                        context.log("info", f"✅ Token generated for invitation {inv_id}")
                    
                    # Skip if no email
                    if not inv_email:
                        context.log("warning", f"⚠️ Skipping invitation {inv_id} - no email")
                        skipped_count += 1
                        continue
                    
                    # Build invitation link
                    invitation_link = f"{settings.app_url}/register2?invitation={inv_token}&email={quote(inv_email)}"
                    
                    # Determine target email
                    target_email = test_email if test_mode and test_email else inv_email
                    
                    if test_mode:
                        context.log("info", f"🧪 [TEST MODE] Would resend to {inv_email} (count: {current_resend_count + 1})")
                    else:
                        # Send the email
                        context.log("info", f"📨 Resending invitation to {inv_email} (attempt #{current_resend_count + 1})")
                        
                        # Create a follow-up subject line
                        email_subject = invitation.get("emailSubject") or "Reminder: You're Invited to Join USVedika"
                        if current_resend_count > 0:
                            email_subject = f"Reminder #{current_resend_count + 1}: {email_subject}"
                        
                        await send_invitation_email(
                            to_email=target_email,
                            to_name=inv_name,
                            invitation_link=invitation_link,
                            custom_message=invitation.get("customMessage"),
                            email_subject=email_subject
                        )
                    
                    # Update the invitation with resend count and timestamp
                    await context.db.invitations.update_one(
                        {"_id": ObjectId(inv_id)},
                        {
                            "$set": {
                                "lastEmailSentAt": datetime.utcnow(),
                                "updatedAt": datetime.utcnow()
                            },
                            "$inc": {
                                "emailResendCount": 1
                            }
                        }
                    )
                    
                    resent_count += 1
                    
                except Exception as e:
                    failed_count += 1
                    error_msg = f"Failed to resend to {invitation.get('email', 'unknown')}: {str(e)}"
                    errors.append(error_msg)
                    context.log("error", f"❌ {error_msg}")
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            status = "success"
            if failed_count > 0 and resent_count == 0:
                status = "failed"
            elif failed_count > 0:
                status = "partial"
            
            return JobResult(
                status=status,
                message=f"Processed {len(invitations)} invitations: {resent_count} resent, {skipped_count} skipped, {failed_count} failed",
                details={
                    "total": len(invitations),
                    "resent": resent_count,
                    "skipped": skipped_count,
                    "failed": failed_count,
                    "testMode": test_mode
                },
                records_processed=len(invitations),
                records_affected=resent_count,
                errors=errors[:10],
                duration_seconds=duration
            )
            
        except Exception as e:
            context.log("error", f"Invitation resend job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Invitation resend job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
