"""
Email Notifier Job Template
Processes email notification queue and sends emails
Uses centralized email_sender.py for Resend + SMTP fallback
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from models.notification_models import NotificationChannel
from config import settings


class EmailNotifierTemplate(JobTemplate):
    """Job template for sending email notifications"""
    
    # Template metadata
    template_type = "email_notifier"
    template_name = "Email Notifier"
    template_description = "Process email notification queue and send emails"
    category = "notifications"
    icon = "📧"
    estimated_duration = "1-5 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def __init__(self):
        from config import settings
        from utils.branding import get_app_name
        from utils.gcp_secrets import get_email_config
        
        # Get email config with Courier -> Gmail SMTP failover
        email_config = get_email_config()
        
        self.email_provider = email_config['provider']
        self.courier_api_key = email_config['courier_api_key']
        self.smtp_host = email_config['smtp_host'] or settings.smtp_host
        self.smtp_port = email_config['smtp_port'] or settings.smtp_port
        self.smtp_user = email_config['smtp_user'] or settings.smtp_user
        self.smtp_password = email_config['smtp_password'] or settings.smtp_password
        self.from_email = (email_config['from_email'] or settings.from_email or "noreply@l3v3lmatches.com").strip()
        
        # Load brand name from whitelabel.json
        self.from_name = (email_config['from_name'] or settings.from_name or get_app_name()).strip()
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        batch_size = params.get("batchSize", 100)
        if not isinstance(batch_size, int) or batch_size < 1 or batch_size > 500:
            return False, "batchSize must be an integer between 1 and 500"
        
        if params.get("testMode") and not params.get("testEmail"):
            return False, "testEmail is required when testMode is enabled"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batchSize": 100,
            "priority": ["critical", "high", "medium", "low"],
            "respectQuietHours": True,
            "testMode": False,
            "testEmail": None
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of emails to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            },
            "respectQuietHours": {
                "type": "boolean",
                "label": "Respect Quiet Hours",
                "description": "Honor user quiet hours settings",
                "default": True
            },
            "testMode": {
                "type": "boolean",
                "label": "Test Mode",
                "description": "Send all emails to test address",
                "default": False
            },
            "testEmail": {
                "type": "string",
                "label": "Test Email",
                "description": "Email address for test mode",
                "required_if": {"testMode": True}
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the email notifier job"""
        start_time = datetime.utcnow()
        sent_count = 0
        failed_count = 0
        errors = []
        
        try:
            service = NotificationService(context.db)
            params = context.parameters
            
            # Log email provider info
            provider_info = f"📧 Email Provider: {self.email_provider.upper()}"
            if self.email_provider == 'smtp':
                provider_info += f" ({self.smtp_host}:{self.smtp_port})"
            context.log("info", provider_info)
            
            # Reset any stuck PROCESSING notifications (from crashed jobs)
            stuck_count = await service.reset_stuck_processing(timeout_minutes=10)
            if stuck_count > 0:
                context.log("warning", f"🔄 Reset {stuck_count} stuck notifications from previous failed runs")
            
            # Get pending email notifications (atomically claimed)
            context.log("info", f"Fetching pending email notifications (limit: {params.get('batchSize', 100)})")
            notifications = await service.get_pending_notifications(
                channel=NotificationChannel.EMAIL,
                limit=params.get("batchSize", 100)
            )
            
            if not notifications:
                return JobResult(
                    status="success",
                    message="No pending email notifications",
                    duration_seconds=(datetime.utcnow() - start_time).total_seconds()
                )
            
            context.log("info", f"Processing {len(notifications)} email notifications")
            
            # Send emails
            for notification in notifications:
                try:
                    # Get recipient email
                    if params.get("testMode") and params.get("testEmail"):
                        recipient_email = params["testEmail"]
                        context.log("info", f"🧪 Test mode - using email: {recipient_email}")
                    else:
                        context.log("info", f"Looking up email for user: {notification.username}")
                        user = await context.db.users.find_one({"username": notification.username})
                        context.log("info", f"Found user: {user is not None}")
                        
                        if not user:
                            raise Exception(f"User '{notification.username}' not found in database")
                        
                        # Check both 'email' and 'contactEmail' fields
                        email_field = user.get("email")
                        contactEmail_field = user.get("contactEmail")
                        context.log("info", f"DB Fields - email: {email_field or 'NOT SET'}, contactEmail: {contactEmail_field or 'NOT SET'}")
                        
                        recipient_email = email_field or contactEmail_field
                        
                        if not recipient_email:
                            raise Exception(f"User '{notification.username}' has no email address (checked 'email' and 'contactEmail' fields)")
                        
                        # 🔓 Decrypt email if encrypted
                        from crypto_utils import get_encryptor
                        if recipient_email and recipient_email.startswith('gAAAAA'):
                            try:
                                encryptor = get_encryptor()
                                decrypted_email = encryptor.decrypt(recipient_email)
                                context.log("info", f"🔓 Decrypted email: {decrypted_email[:3]}***@{decrypted_email.split('@')[1] if '@' in decrypted_email else '***'}")
                                recipient_email = decrypted_email
                            except Exception as decrypt_err:
                                raise Exception(f"Failed to decrypt email address: {decrypt_err}")
                        
                        context.log("info", f"✅ Using email: {recipient_email[:3]}***@{recipient_email.split('@')[1] if '@' in recipient_email else '***'}")
                    
                    # Render email
                    subject, body = await self._render_email(service, notification, context.db)
                    
                    # Send email
                    await self._send_email(recipient_email, subject, body, notification, context)
                    
                    # Mark as sent (use notification.id directly)
                    await service.mark_as_sent(
                        notification.id,  # Use .id field directly, not dict()
                        NotificationChannel.EMAIL,
                        success=True
                    )
                    
                    # Log notification with lineage tracking
                    await service.log_notification(
                        username=notification.username,
                        trigger=notification.trigger,
                        channel=NotificationChannel.EMAIL,
                        priority=notification.priority,
                        subject=subject,
                        preview=body[:100],
                        cost=0.0,
                        template_data=notification.templateData  # Include lineage_token
                    )
                    
                    sent_count += 1
                    
                except Exception as e:
                    await service.mark_as_sent(
                        notification.id,  # Use .id field directly
                        NotificationChannel.EMAIL,
                        success=False,
                        error=str(e)
                    )
                    failed_count += 1
                    errors.append(f"{notification.username}: {str(e)}")
                    context.log("error", f"Failed to send email to {notification.username}: {str(e)}")
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            return JobResult(
                status="success" if failed_count == 0 else "partial",
                message=f"Processed {len(notifications)} email notifications",
                details={
                    "sent": sent_count,
                    "failed": failed_count,
                    "total": len(notifications)
                },
                records_processed=len(notifications),
                records_affected=sent_count,
                errors=errors[:10],
                duration_seconds=duration
            )
            
        except Exception as e:
            context.log("error", f"Email notifier job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Email notifier job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
    
    async def _render_email(self, service, notification, db) -> Tuple[str, str]:
        """Render email subject and body from template"""
        from config import settings
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔍 Looking for template with trigger: '{notification.trigger}'")
        
        # Try to find template (check both 'enabled' and 'active' for backwards compatibility)
        # Templates can have either flat structure (channel, enabled) or nested (channels.email.enabled)
        template = await db.notification_templates.find_one({
            "trigger": notification.trigger,
            "$or": [
                # Flat structure - check both enum and string values
                {"channel": NotificationChannel.EMAIL, "enabled": True},
                {"channel": NotificationChannel.EMAIL, "active": True},
                {"channel": "email", "enabled": True},
                {"channel": "email", "active": True},
                # Nested structure (channels.email)
                {"channels.email.enabled": True, "isActive": True},
                {"channels.email.enabled": True}
            ]
        })
        
        logger.info(f"📋 Template found: {template is not None}")
        
        # Inject app URLs and tracking into template data
        template_data = notification.templateData.copy() if notification.templateData else {}
        tracking_id = str(notification.id)
        backend_url = settings.backend_url
        frontend_url = settings.frontend_url
        
        # Build profile URL for the relevant user on the frontend.
        # NOTE: event templates frequently provide `match.username` (not `actor.username`).
        actor_username = None
        if isinstance(template_data, dict):
            actor_data = template_data.get("actor")
            if isinstance(actor_data, dict):
                actor_username = actor_data.get("username")

            if not actor_username:
                match_data = template_data.get("match")
                if isinstance(match_data, dict):
                    actor_username = match_data.get("username")

            if not actor_username:
                actor_username = template_data.get("match_username")

        from urllib.parse import quote
        profile_path = f"/profile/{actor_username}" if actor_username else ""

        # For pii_granted, the CTA should open the Contact Information section.
        if notification.trigger == "pii_granted" and actor_username:
            profile_url = f"{frontend_url}{profile_path}?open=contact"
        elif actor_username:
            profile_url = f"{frontend_url}{profile_path}"
        else:
            # Fallback to app home if username is missing
            profile_url = frontend_url

        encoded_profile_url = quote(profile_url, safe="")
        
        # Add app URLs with tracking
        from urllib.parse import quote
        
        # Encode frontend URLs for tracking
        search_url_encoded = quote(f"{frontend_url}/search", safe="")
        dashboard_url_encoded = quote(f"{frontend_url}/dashboard", safe="")
        preferences_url_encoded = quote(f"{frontend_url}/preferences", safe="")
        unsubscribe_url_encoded = quote(f"{frontend_url}/preferences", safe="")
        
        template_data["app"] = {
            "logoUrl": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0IHg9IjEwIiB5PSI0MCIgZm9udC1zaXplPSIzMiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiM2NjdlZWEiPvCfposkIEwzVjNMPC90ZXh0Pjwvc3ZnPg==",
            "trackingPixelUrl": f"{backend_url}/api/email-tracking/pixel/{tracking_id}",
            "profileUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={encoded_profile_url}&link_type=profile",
            "chatUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={quote(f'{frontend_url}/messages', safe='')}&link_type=chat",
            "unsubscribeUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={unsubscribe_url_encoded}&link_type=unsubscribe",
            "preferencesUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={preferences_url_encoded}&link_type=preferences",
            "approveUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={quote(f'{frontend_url}/pii-management?tab=incoming', safe='')}&link_type=approve",
            "denyUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={quote(f'{frontend_url}/pii-management?tab=incoming', safe='')}&link_type=deny",
            "dashboardUrl": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={dashboard_url_encoded}&link_type=dashboard",
            "contactUrl": f"{frontend_url}/contact",
            "searchUrl": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={search_url_encoded}&link_type=search",
            "securityUrl": f"{frontend_url}/preferences"
        }
        
        # Also add flattened URL variables for templates using {dashboard_url} format
        template_data["dashboard_url"] = f"{backend_url}/api/email-tracking/click/{tracking_id}?url={dashboard_url_encoded}&link_type=dashboard"
        template_data["preferences_url"] = f"{backend_url}/api/email-tracking/click/{tracking_id}?url={preferences_url_encoded}&link_type=preferences"
        template_data["unsubscribe_url"] = f"{backend_url}/api/email-tracking/click/{tracking_id}?url={unsubscribe_url_encoded}&link_type=unsubscribe"
        template_data["tracking_pixel_url"] = f"{backend_url}/api/email-tracking/pixel/{tracking_id}"
        template_data["profile_url"] = f"{backend_url}/api/email-tracking/click/{tracking_id}?url={encoded_profile_url}&link_type=profile"
        
        # PII Management URL - for contact request emails
        pii_management_url_encoded = quote(f"{frontend_url}/pii-management?tab=incoming", safe="")
        template_data["pii_management_url"] = f"{backend_url}/api/email-tracking/click/{tracking_id}?url={pii_management_url_encoded}&link_type=pii_management"
        
        if not template:
            # Get requester name from template_data
            requester_name = "Someone"
            if isinstance(template_data, dict):
                match_data = template_data.get("match", {})
                if isinstance(match_data, dict):
                    first = match_data.get("firstName", "")
                    last = match_data.get("lastName", "")
                    username = match_data.get("username", "")
                    if first and last:
                        requester_name = f"{first} {last}"
                    elif first:
                        requester_name = first
                    elif username:
                        # Fallback to username if firstName is empty
                        requester_name = username
            
            # User-friendly fallback messages for each trigger type
            trigger_messages = {
                # Status change notifications (with username)
                "status_approved": {
                    "subject": "🎉 Your Profile is Now Active!",
                    "body": f"<p><strong>Username:</strong> {notification.username}</p><p>Great news! Your profile has been approved and is now active. You can now browse matches, send messages, and use all features.</p>"
                },
                "status_reactivated": {
                    "subject": "✅ Your Account Has Been Reactivated!",
                    "body": f"<p><strong>Username:</strong> {notification.username}</p><p>Good news! Your account has been reactivated. You can now access all features again.</p>"
                },
                "status_suspended": {
                    "subject": "⚠️ Your Account Has Been Suspended",
                    "body": f"<p><strong>Username:</strong> {notification.username}</p><p>Your account has been temporarily suspended. Please contact support if you have questions.</p>"
                },
                "status_banned": {
                    "subject": "⛔ Your Account Has Been Banned",
                    "body": f"<p><strong>Username:</strong> {notification.username}</p><p>Your account has been permanently banned. Please contact support if you believe this is an error.</p>"
                },
                "status_paused": {
                    "subject": "⏸️ Your Account Has Been Paused",
                    "body": f"<p><strong>Username:</strong> {notification.username}</p><p>Your account has been paused by an administrator. Your profile is hidden from searches. Please contact support for more information.</p>"
                },
                "pending_pii_request": {
                    "subject": f"🔒 {requester_name} requested your contact information",
                    "body": self._build_pii_request_fallback_body(template_data, notification, requester_name)
                },
                "pii_request": {
                    "subject": f"🔒 {requester_name} requested your contact information",
                    "body": self._build_pii_request_fallback_body(template_data, notification, requester_name)
                },
                "pii_granted": {
                    "subject": f"✅ {requester_name} approved your contact request!",
                    "body": self._build_pii_granted_fallback_body(template_data, notification, requester_name)
                },
                "pii_denied": {
                    "subject": f"📋 Contact request update from {requester_name}",
                    "body": f"{requester_name} has declined your contact information request. Don't worry - there are many other great matches waiting for you on L3V3LMATCHES.com!"
                },
                "new_message": {
                    "subject": f"💬 New message from {requester_name}",
                    "body": f"{requester_name} sent you a message. Login to L3V3LMATCHES.com to read and reply."
                },
                "unread_messages": {
                    "subject": "📬 You have unread messages waiting",
                    "body": "You have messages waiting for you! Login to L3V3LMATCHES.com to catch up on your conversations."
                },
                "profile_view": {
                    "subject": f"👁️ {requester_name} viewed your profile!",
                    "body": f"{requester_name} checked out your profile. Login to L3V3LMATCHES.com to see who's interested in you."
                },
                "new_match": {
                    "subject": f"💕 You matched with {requester_name}!",
                    "body": f"Exciting news! You matched with {requester_name}. Login to L3V3LMATCHES.com to start a conversation."
                },
                "mutual_favorite": {
                    "subject": f"💖 It's a match! You and {requester_name} favorited each other",
                    "body": f"Great news! You and {requester_name} have both favorited each other. This could be the start of something special! Login to L3V3LMATCHES.com to connect."
                },
                "shortlist_added": {
                    "subject": f"⭐ {requester_name} added you to their shortlist!",
                    "body": f"{requester_name} added you to their shortlist. They're seriously interested! Login to L3V3LMATCHES.com to check them out."
                },
                "favorited": {
                    "subject": f"❤️ {requester_name} favorited your profile!",
                    "body": f"{requester_name} favorited your profile. Login to L3V3LMATCHES.com to see if you're interested too!"
                },
                "saved_search_matches": {
                    "subject": "🔍 New matches for your saved search!",
                    "body": self._build_saved_search_fallback_body(template_data)
                },
                "monthly_digest": {
                    "subject": f"📊 Your Monthly Activity Report - {template_data.get('month', 'This Month')}",
                    "body": template_data.get("emailHtml", self._build_monthly_digest_fallback(template_data))
                },
                "daily_digest": {
                    "subject": self._build_daily_digest_subject(template_data),
                    "body": self._build_daily_digest_body(template_data)
                },
            }
            
            trigger_name = notification.trigger.replace("_", " ").title()
            default_message = {
                "subject": f"New {trigger_name} Notification",
                "body": f"<p><strong>Username:</strong> {notification.username}</p><p>You have a new notification on L3V3LMATCHES.com. Login to view the details.</p>"
            }
            
            message = trigger_messages.get(notification.trigger, default_message)
            subject = message["subject"]
            body = message["body"]
        else:
            # Support both flat and nested template structures
            if "channels" in template and "email" in template["channels"]:
                # Nested structure: channels.email.subject, channels.email.htmlBody
                email_config = template["channels"]["email"]
                subject_template = email_config.get("subject", "")
                body_template = email_config.get("htmlBody", email_config.get("body", ""))
            else:
                # Flat structure: subject, body
                subject_template = template.get("subject", "")
                body_template = template.get("body", template.get("bodyTemplate", ""))
            
            subject = service.render_template(subject_template, template_data)
            body = service.render_template(body_template, template_data)
        
        return subject, body
    
    def _build_saved_search_fallback_body(self, template_data: dict) -> str:
        """Build a rich HTML body for saved search matches when no template exists"""
        from config import settings
        
        user_first_name = "there"
        if isinstance(template_data, dict):
            user_data = template_data.get("user", {})
            if isinstance(user_data, dict):
                user_first_name = user_data.get("firstName", "there")
        
        match_count = template_data.get("matchCount", 0) if isinstance(template_data, dict) else 0
        plural = template_data.get("plural", "es") if isinstance(template_data, dict) else "es"
        search_name = template_data.get("searchName", "Your Saved Search") if isinstance(template_data, dict) else "Your Saved Search"
        search_description = template_data.get("searchDescription", "") if isinstance(template_data, dict) else ""
        matches_html = template_data.get("matchesHtml", "") if isinstance(template_data, dict) else ""
        app_url = template_data.get("appUrl", settings.frontend_url) if isinstance(template_data, dict) else settings.frontend_url
        
        # Build the email HTML
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">💜 L3V3L MATCHES</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">🦋 L3V3L</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="margin: 0 0 15px 0; color: #2d3748;">Hi {user_first_name}! 👋</h2>
            <p style="color: #4a5568; font-size: 16px; margin: 0 0 20px 0;">
                Great news! We found <strong style="color: #667eea;">{match_count} new profile{plural}</strong> matching your saved search:
            </p>
            
            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <strong style="color: #667eea; font-size: 18px;">🔍 {search_name}</strong>
                {f"<p style='margin: 8px 0 0 0; color: #666; font-size: 14px;'>{search_description}</p>" if search_description else ""}
            </div>
            
            {matches_html if matches_html else ""}
            
            <div style="text-align: center; margin: 30px 0 20px 0;">
                <a href="{app_url}/search" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                    View All Matches →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;">You're receiving this because you have saved searches on L3V3L MATCHES.</p>
            <p style="margin: 0;">
                <a href="{app_url}/preferences" style="color: #667eea; text-decoration: none;">Manage Notifications</a> | 
                <a href="{app_url}/preferences" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
            </p>
            <p style="margin: 10px 0 0 0; color: #999;">© 2025 L3V3L MATCHES. All rights reserved.</p>
        </div>
        
    </div>
</body>
</html>"""
        return html
    
    def _build_pii_request_fallback_body(self, template_data: dict, notification, requester_name: str) -> str:
        """Build a simple HTML body for PII request notifications"""
        from config import settings
        
        # Extract requester details from template_data
        match_data = {}
        if isinstance(template_data, dict):
            match_data = template_data.get("match", {}) or template_data.get("actor", {}) or {}
        
        requester_username = match_data.get("username", "") if isinstance(match_data, dict) else ""
        
        # Build requester full name
        first_name = match_data.get("firstName", "") if isinstance(match_data, dict) else ""
        last_name = match_data.get("lastName", "") if isinstance(match_data, dict) else ""
        username = match_data.get("username", "") if isinstance(match_data, dict) else ""
        if first_name and last_name:
            requester_fullname = f"{first_name} {last_name}"
        elif first_name:
            requester_fullname = first_name
        elif username:
            # Fallback to username if firstName is empty
            requester_fullname = username
        else:
            requester_fullname = requester_name
        
        # Get recipient/profile owner name
        recipient_name = "there"
        if isinstance(template_data, dict):
            recipient_data = template_data.get("recipient", {})
            if isinstance(recipient_data, dict):
                recipient_name = recipient_data.get("firstName", "there")
        
        app_url = settings.frontend_url
        profile_url = f"{app_url}/profile/{requester_username}" if requester_username else app_url
        
        # Simple, clean message as requested
        html = f"""<p>Hi {recipient_name},</p>
<p><a href="{profile_url}" style="color: #667eea; font-weight: bold; text-decoration: none;">{requester_fullname}</a> has requested access to your contact information. Login to <a href="{app_url}" style="color: #667eea; text-decoration: none;">L3V3LMATCHES.com</a> to review and respond to this request.</p>"""
        return html
    
    def _build_pii_granted_fallback_body(self, template_data: dict, notification, requester_name: str) -> str:
        """Build a rich HTML body for PII granted notifications"""
        from config import settings
        
        # Extract granter details from template_data
        match_data = {}
        if isinstance(template_data, dict):
            match_data = template_data.get("match", {}) or template_data.get("actor", {}) or {}
        
        granter_username = match_data.get("username", "") if isinstance(match_data, dict) else ""
        granter_photo = match_data.get("profilePhoto", match_data.get("photoUrl", "")) if isinstance(match_data, dict) else ""
        
        # Build granter display name with username fallback
        first_name = match_data.get("firstName", "") if isinstance(match_data, dict) else ""
        last_name = match_data.get("lastName", "") if isinstance(match_data, dict) else ""
        if first_name and last_name:
            granter_display_name = f"{first_name} {last_name}"
        elif first_name:
            granter_display_name = first_name
        elif granter_username:
            granter_display_name = granter_username
        else:
            granter_display_name = requester_name
        
        # Get recipient name
        recipient_name = "there"
        if isinstance(template_data, dict):
            recipient_data = template_data.get("recipient", {})
            if isinstance(recipient_data, dict):
                recipient_name = recipient_data.get("firstName", "there")
        
        app_url = settings.frontend_url
        
        # Build profile photo HTML
        photo_html = ""
        if granter_photo:
            photo_html = f'<img src="{granter_photo}" alt="{granter_display_name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 4px solid #10b981; margin-bottom: 15px;" />'
        else:
            initials = granter_display_name[0].upper() if granter_display_name else "?"
            photo_html = f'<div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto; font-size: 32px; color: white; font-weight: bold;">{initials}</div>'
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">✅ Request Approved!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Great news!</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="margin: 0 0 15px 0; color: #2d3748;">Hi {recipient_name}! 🎉</h2>
            <p style="color: #4a5568; font-size: 16px; margin: 0 0 25px 0;">
                <strong style="color: #10b981;">{granter_display_name}</strong> has approved your request to view their contact information!
            </p>
            
            <!-- Granter Card -->
            <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 25px; border: 1px solid #6ee7b7;">
                {photo_html}
                <h3 style="margin: 0 0 8px 0; color: #065f46; font-size: 20px;">{granter_display_name}</h3>
                <p style="margin: 0; color: #047857; font-size: 14px;">Contact information is now available!</p>
            </div>
            
            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0 20px 0;">
                <a href="{app_url}/profile/{granter_username}?open=contact" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 18px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
                    📞 View Contact Info
                </a>
            </div>
            
            <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px;">
                Don't wait - reach out and start a conversation!
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;">This is an automated message from L3V3L MATCHES.</p>
            <p style="margin: 0;">
                <a href="{app_url}/preferences" style="color: #667eea; text-decoration: none;">Manage Notifications</a> | 
                <a href="{app_url}/preferences" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af;">© {__import__('datetime').datetime.now().year} L3V3L MATCHES. All rights reserved.</p>
        </div>
        
    </div>
</body>
</html>"""
        return html
    
    def _build_monthly_digest_fallback(self, template_data: dict) -> str:
        """Build a fallback HTML body for monthly digest when emailHtml is not provided"""
        from config import settings
        
        user_first_name = "there"
        if isinstance(template_data, dict):
            user_data = template_data.get("user", {})
            if isinstance(user_data, dict):
                user_first_name = user_data.get("firstName", "there")
        
        month = template_data.get("month", "This Month") if isinstance(template_data, dict) else "This Month"
        app_url = settings.frontend_url
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Logo -->
        <div style="text-align: center; padding: 25px 20px 15px 20px; background: white;">
            <img src="https://l3v3lmatches.com/logo192.png" alt="L3V3L MATCHES" style="height: 60px; width: auto;" />
        </div>
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">📊 Your Monthly Activity</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">{month}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="margin: 0 0 15px 0; color: #2d3748;">Hi {user_first_name}! 👋</h2>
            <p style="color: #4a5568; font-size: 16px; margin: 0 0 20px 0;">
                Your monthly activity report is ready! Login to see your detailed stats including profile views, interests received, messages, and more.
            </p>
            
            <div style="text-align: center; margin: 30px 0 20px 0;">
                <a href="{app_url}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                    View Your Dashboard →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong>L3V3L MATCHES</strong> - Premium Matrimonial Platform</p>
            <p style="margin: 0;">
                <a href="{app_url}/preferences" style="color: #667eea; text-decoration: none;">Manage Notifications</a> | 
                <a href="{app_url}/preferences" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
            </p>
        </div>
        
    </div>
</body>
</html>"""
        return html
    
    async def _send_email(self, to_email: str, subject: str, body: str, notification, context=None) -> None:
        """Send email via centralized email sender (Resend + SMTP fallback)"""
        from services.email_sender import send_email
        import os
        
        # Log email provider info
        email_provider = os.environ.get("EMAIL_PROVIDER", "resend").lower()
        if context:
            context.log("info", f"📧 Using centralized email_sender (EMAIL_PROVIDER={email_provider})")
        
        # Create HTML email with styling
        html_body = self._create_html_email(body, notification)
        
        # Use centralized email sender with Resend + SMTP fallback
        try:
            result = await send_email(to_email, subject, html_body)
            
            # Log detailed result
            if context and isinstance(result, dict):
                if result.get("resend_attempted"):
                    if result.get("resend_error"):
                        context.log("warning", f"⚠️ Resend FAILED: {result['resend_error']}")
                    elif result.get("provider") == "resend":
                        context.log("info", f"✅ Email sent via Resend")
                
                if result.get("smtp_attempted"):
                    if result.get("smtp_error"):
                        context.log("error", f"❌ SMTP FAILED: {result['smtp_error']}")
                    elif result.get("provider") == "smtp":
                        context.log("info", f"✅ Email sent via SMTP fallback")
                
                if result.get("success"):
                    context.log("info", f"✅ Email delivered via {result.get('provider', 'unknown')}")
            elif context:
                context.log("info", f"✅ Email sent via centralized sender")
        except Exception as e:
            if context:
                context.log("error", f"❌ Email send failed: {e}")
            raise
    
    def _create_html_email(self, body: str, notification) -> str:
        """Create HTML email with inline CSS styling (email client compatible)"""
        frontend_url = settings.frontend_url or "http://localhost:3000"
        
        # Check if body already contains full HTML structure (from database template)
        # Look for common HTML wrapper indicators
        body_lower = body.lower()
        has_full_html = (
            '<!doctype' in body_lower or 
            '<html' in body_lower or
            'l3v3l match' in body_lower or  # Our branded template header (L3V3L MATCHES or L3V3LMATCH)
            '<head>' in body_lower or
            'linear-gradient' in body_lower or  # Our header gradient (any format)
            ('background:' in body_lower and '#667eea' in body_lower)  # Our brand colors
        )
        
        if has_full_html:
            # Template already has full HTML - append no-reply notice at the end
            no_reply_notice = f"""
            <div style="max-width: 600px; margin: 20px auto; padding: 0 15px;">
                <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 14px 18px; margin-top: 20px;">
                    <p style="margin: 0; font-size: 13px; color: #856404; line-height: 1.5;">
                        ⚠️ <strong style="color: #664d03;">Do not reply to this email.</strong> This is an automated notification 
                        and replies are not monitored. To communicate with other members, please use the 
                        messaging feature on our platform.
                    </p>
                </div>
                <p style="text-align: center; font-size: 11px; color: #999; margin: 15px 0;">
                    This is an automated message. Please do not reply directly to this email.
                </p>
            </div>
            """
            # Insert before </body> tag if exists, otherwise append at end
            if '</body>' in body.lower():
                body = body.replace('</body>', f'{no_reply_notice}</body>')
                body = body.replace('</BODY>', f'{no_reply_notice}</BODY>')
            else:
                # Just append at the end
                body = body + no_reply_notice
            return body
        
        # Use inline styles for maximum email client compatibility
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if mso]>
    <style type="text/css">
        body, table, td {{font-family: Arial, sans-serif !important;}}
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f4f4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 10px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">💜 L3V3L MATCHES</h1>
                            <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">🦋 L3V3L</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px 25px; background-color: #ffffff;">
                            <div style="font-size: 15px; line-height: 1.7; color: #333333;">
                                {body}
                            </div>
                            
                            <!-- Action Hint Box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0 15px 0;">
                                <tr>
                                    <td style="background-color: #e7f3ff; border: 1px solid #b6d4fe; border-radius: 8px; padding: 14px 18px;">
                                        <p style="margin: 0; font-size: 13px; color: #084298; line-height: 1.5;">
                                            💡 <strong style="color: #052c65;">To take action:</strong> Please click the button above or 
                                            <a href="{frontend_url}/dashboard" style="color: #667eea; text-decoration: underline;">log in to your account</a> 
                                            to respond to this notification.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- No-Reply Warning Box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 15px 0 0 0;">
                                <tr>
                                    <td style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 14px 18px;">
                                        <p style="margin: 0; font-size: 13px; color: #856404; line-height: 1.5;">
                                            ⚠️ <strong style="color: #664d03;">Do not reply to this email.</strong> This is an automated notification 
                                            and replies are not monitored. To communicate with other members, please use the 
                                            messaging feature on our platform.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px 20px; text-align: center; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6c757d;">
                                This is an automated message from {self.from_name}. Please do not reply directly to this email.
                            </p>
                            <p style="margin: 0 0 10px 0; font-size: 12px;">
                                <a href="{frontend_url}/preferences" style="color: #667eea; text-decoration: none;">Manage Notifications</a>
                                <span style="color: #adb5bd; margin: 0 8px;">|</span>
                                <a href="{frontend_url}/preferences" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #adb5bd;">
                                © 2025 {self.from_name}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        return html
    
    def _build_daily_digest_subject(self, template_data: dict) -> str:
        """Build subject line for daily digest email"""
        stats = template_data.get("stats", {}) if isinstance(template_data, dict) else {}
        total_favorites = stats.get("total_favorites", 0)
        total_views = stats.get("total_views", 0)
        total_messages = stats.get("total_messages", 0)
        
        # Build a dynamic subject based on activity
        parts = []
        if total_favorites > 0:
            parts.append(f"{total_favorites} ❤️")
        if total_views > 0:
            parts.append(f"{total_views} 👁️")
        if total_messages > 0:
            parts.append(f"{total_messages} 💬")
        
        if parts:
            return f"📬 Your Daily Digest - {', '.join(parts)}"
        return "📬 Your Daily Digest from L3V3L MATCHES"
    
    def _build_daily_digest_body(self, template_data: dict) -> str:
        """Build HTML body for daily digest email"""
        from config import settings
        
        recipient = template_data.get("recipient", {}) if isinstance(template_data, dict) else {}
        activity = template_data.get("activity", {}) if isinstance(template_data, dict) else {}
        stats = template_data.get("stats", {}) if isinstance(template_data, dict) else {}
        
        first_name = recipient.get("firstName", "there")
        frontend_url = settings.frontend_url
        
        # Extract activity lists
        favorited_by = activity.get("favorited_by", [])
        shortlisted_by = activity.get("shortlisted_by", [])
        profile_views = activity.get("profile_views", [])
        new_messages = activity.get("new_messages", [])
        pii_requests = activity.get("pii_requests", [])
        expiring_access = activity.get("expiring_access", [])
        
        # Build sections HTML
        sections_html = ""
        
        # Favorites section
        if favorited_by:
            sections_html += self._build_digest_section(
                "❤️ New Favorites",
                f"{len(favorited_by)} people favorited your profile",
                favorited_by,
                frontend_url,
                "#e74c3c"
            )
        
        # Shortlists section
        if shortlisted_by:
            sections_html += self._build_digest_section(
                "⭐ Added to Shortlists",
                f"{len(shortlisted_by)} people added you to their shortlist",
                shortlisted_by,
                frontend_url,
                "#f39c12"
            )
        
        # Profile views section
        if profile_views:
            sections_html += self._build_digest_section(
                "👁️ Profile Views",
                f"{stats.get('total_views', len(profile_views))} people viewed your profile",
                profile_views[:10],
                frontend_url,
                "#3498db"
            )
        
        # Messages section
        if new_messages:
            sections_html += self._build_messages_section(new_messages, frontend_url)
        
        # PII requests section
        if pii_requests:
            sections_html += self._build_digest_section(
                "🔒 Contact Requests",
                f"{len(pii_requests)} people requested your contact info",
                pii_requests,
                frontend_url,
                "#9b59b6",
                show_action=True
            )
        
        # Expiring access section
        if expiring_access:
            sections_html += self._build_expiring_section(expiring_access, frontend_url)
        
        # If no activity, show a friendly message
        if not sections_html:
            sections_html = """
            <div style="text-align: center; padding: 30px; color: #666;">
                <p style="font-size: 48px; margin: 0;">🌟</p>
                <p style="font-size: 16px; margin: 15px 0 0 0;">No new activity today, but keep your profile updated to attract more matches!</p>
            </div>
            """
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">📬 Your Daily Digest</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">L3V3L MATCHES</p>
        </div>
        
        <!-- Greeting -->
        <div style="padding: 25px 30px 15px 30px;">
            <h2 style="margin: 0; color: #2d3748; font-size: 22px;">Hi {first_name}! 👋</h2>
            <p style="color: #666; margin: 10px 0 0 0;">Here's what happened on your profile in the last 24 hours:</p>
        </div>
        
        <!-- Stats Summary -->
        <div style="display: flex; justify-content: space-around; padding: 15px 30px; background: #f8f9fa; margin: 0 20px; border-radius: 10px;">
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">{stats.get('total_favorites', 0)}</div>
                <div style="font-size: 12px; color: #666;">Favorites</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #3498db;">{stats.get('total_views', 0)}</div>
                <div style="font-size: 12px; color: #666;">Views</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #2ecc71;">{stats.get('total_messages', 0)}</div>
                <div style="font-size: 12px; color: #666;">Messages</div>
            </div>
        </div>
        
        <!-- Activity Sections -->
        <div style="padding: 20px 30px;">
            {sections_html}
        </div>
        
        <!-- CTA -->
        <div style="text-align: center; padding: 20px 30px 30px 30px;">
            <a href="{frontend_url}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                View Your Dashboard →
            </a>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;">You're receiving this because you enabled Daily Digest in your preferences.</p>
            <p style="margin: 0;">
                <a href="{frontend_url}/preferences" style="color: #667eea; text-decoration: none;">Manage Digest Settings</a> | 
                <a href="{frontend_url}/preferences" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
            </p>
            <p style="margin: 10px 0 0 0; color: #999;">© 2025 L3V3L MATCHES. All rights reserved.</p>
        </div>
        
    </div>
</body>
</html>"""
        return html
    
    def _build_digest_section(self, title: str, subtitle: str, items: list, frontend_url: str, color: str, show_action: bool = False) -> str:
        """Build a section for the daily digest"""
        items_html = ""
        for item in items[:5]:
            name = f"{item.get('firstName', '')} {item.get('lastName', '')}".strip() or item.get('username', 'Someone')
            location = item.get('location', '')
            occupation = item.get('occupation', '')
            details = f"{occupation}" if occupation else ""
            if location:
                details = f"{details} • {location}" if details else location
            
            items_html += f"""
            <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: {color}20; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <span style="font-size: 18px;">{title[0]}</span>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333;">{name}</div>
                    <div style="font-size: 12px; color: #666;">{details}</div>
                </div>
                <a href="{frontend_url}/profile/{item.get('username', '')}" style="color: {color}; text-decoration: none; font-size: 12px;">View →</a>
            </div>
            """
        
        more_count = len(items) - 5
        if more_count > 0:
            items_html += f'<div style="text-align: center; padding: 10px; color: #666; font-size: 12px;">+{more_count} more</div>'
        
        return f"""
        <div style="margin-bottom: 25px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: {color}; font-size: 16px;">{title}</h3>
            </div>
            <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">{subtitle}</p>
            <div style="background: #fafafa; border-radius: 8px; padding: 5px 15px;">
                {items_html}
            </div>
        </div>
        """
    
    def _build_messages_section(self, messages: list, frontend_url: str) -> str:
        """Build messages section for daily digest"""
        items_html = ""
        for msg in messages[:5]:
            name = f"{msg.get('firstName', '')} {msg.get('lastName', '')}".strip() or msg.get('username', 'Someone')
            count = msg.get('count', 1)
            preview = msg.get('lastMessage', '')[:50]
            if len(msg.get('lastMessage', '')) > 50:
                preview += "..."
            
            items_html += f"""
            <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #2ecc7120; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <span style="font-size: 18px;">💬</span>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333;">{name} <span style="font-weight: normal; color: #666;">({count} message{'s' if count > 1 else ''})</span></div>
                    <div style="font-size: 12px; color: #666; font-style: italic;">"{preview}"</div>
                </div>
                <a href="{frontend_url}/messages" style="color: #2ecc71; text-decoration: none; font-size: 12px;">Reply →</a>
            </div>
            """
        
        return f"""
        <div style="margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px 0; color: #2ecc71; font-size: 16px;">💬 Unread Messages</h3>
            <div style="background: #fafafa; border-radius: 8px; padding: 5px 15px;">
                {items_html}
            </div>
        </div>
        """
    
    def _build_expiring_section(self, expiring: list, frontend_url: str) -> str:
        """Build expiring access section for daily digest"""
        items_html = ""
        for item in expiring[:3]:
            name = f"{item.get('firstName', '')} {item.get('lastName', '')}".strip() or item.get('username', 'Someone')
            expires_at = item.get('expiresAt')
            if expires_at:
                from datetime import datetime
                if isinstance(expires_at, datetime):
                    expires_str = expires_at.strftime("%b %d")
                else:
                    expires_str = "soon"
            else:
                expires_str = "soon"
            
            items_html += f"""
            <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #e67e2220; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <span style="font-size: 18px;">⏰</span>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333;">{name}</div>
                    <div style="font-size: 12px; color: #e67e22;">Access expires {expires_str}</div>
                </div>
                <a href="{frontend_url}/profile/{item.get('username', '')}" style="color: #e67e22; text-decoration: none; font-size: 12px;">View →</a>
            </div>
            """
        
        return f"""
        <div style="margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px 0; color: #e67e22; font-size: 16px;">⏰ Expiring Access</h3>
            <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">Contact access expiring soon - view their info before it expires!</p>
            <div style="background: #fafafa; border-radius: 8px; padding: 5px 15px;">
                {items_html}
            </div>
        </div>
        """
