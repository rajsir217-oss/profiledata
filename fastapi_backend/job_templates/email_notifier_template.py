"""
Email Notifier Job Template
Processes email notification queue and sends emails
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

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
        
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_user = settings.smtp_user
        self.smtp_password = settings.smtp_password
        self.from_email = settings.from_email or "noreply@datingapp.com"
        
        # Load brand name from whitelabel.json
        self.from_name = settings.from_name or get_app_name()
    
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
            
            # Get pending email notifications
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
                    await self._send_email(recipient_email, subject, body, notification)
                    
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
                # Flat structure
                {"channel": NotificationChannel.EMAIL, "enabled": True},
                {"channel": NotificationChannel.EMAIL, "active": True},
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
                    if first and last:
                        requester_name = f"{first} {last}"
                    elif first:
                        requester_name = first
            
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
                    "subject": "📧 Someone requested your contact information",
                    "body": f"<p><strong>Username:</strong> {notification.username}</p><p>{requester_name} has requested access to your contact information. Login to L3V3LMATCHES.com to review and respond to this request.</p>"
                },
                "pii_request": {
                    "subject": "📧 New contact information request",
                    "body": f"{requester_name} has requested access to your contact information. Login to L3V3LMATCHES.com to review and respond to this request."
                },
                "pii_granted": {
                    "subject": "✅ Your contact request was approved!",
                    "body": f"Great news! {requester_name} has approved your request to view their contact information. Login to L3V3LMATCHES.com to see their details."
                },
                "pii_denied": {
                    "subject": "Contact request update",
                    "body": f"{requester_name} has declined your contact information request. Don't worry - there are many other great matches waiting for you on L3V3LMATCHES.com!"
                },
                "new_message": {
                    "subject": "💬 You have a new message!",
                    "body": f"{requester_name} sent you a message. Login to L3V3LMATCHES.com to read and reply."
                },
                "unread_messages": {
                    "subject": "📬 You have unread messages waiting",
                    "body": "You have messages waiting for you! Login to L3V3LMATCHES.com to catch up on your conversations."
                },
                "profile_view": {
                    "subject": "👁️ Someone viewed your profile!",
                    "body": f"{requester_name} checked out your profile. Login to L3V3LMATCHES.com to see who's interested in you."
                },
                "new_match": {
                    "subject": "💕 You have a new match!",
                    "body": f"Exciting news! You matched with {requester_name}. Login to L3V3LMATCHES.com to start a conversation."
                },
                "mutual_favorite": {
                    "subject": "💖 It's a match! You both favorited each other",
                    "body": f"Great news! You and {requester_name} have both favorited each other. This could be the start of something special! Login to L3V3LMATCHES.com to connect."
                },
                "shortlist_added": {
                    "subject": "⭐ Someone added you to their shortlist!",
                    "body": f"{requester_name} added you to their shortlist. They're seriously interested! Login to L3V3LMATCHES.com to check them out."
                },
                "favorited": {
                    "subject": "❤️ Someone favorited your profile!",
                    "body": f"{requester_name} favorited your profile. Login to L3V3LMATCHES.com to see if you're interested too!"
                },
                "saved_search_matches": {
                    "subject": "🔍 New matches for your saved search!",
                    "body": self._build_saved_search_fallback_body(template_data)
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
    
    async def _send_email(self, to_email: str, subject: str, body: str, notification) -> None:
        """Send email via SMTP"""
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📧 SMTP Configuration: Host={self.smtp_host}, Port={self.smtp_port}, User={self.smtp_user}, Password={'SET' if self.smtp_password else 'NOT SET'}, From={self.from_email}")
        
        if not self.smtp_user or not self.smtp_password:
            raise Exception(f"SMTP credentials not configured (user={self.smtp_user}, pass={'SET' if self.smtp_password else 'NOT SET'})")
        
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{self.from_name} (Do Not Reply) <{self.from_email}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Add Reply-To header to discourage replies (or use configured no-reply address)
        reply_to = settings.reply_to_email or self.from_email
        msg['Reply-To'] = f"No Reply <{reply_to}>"
        
        # Add header to indicate this is an automated message
        msg['X-Auto-Response-Suppress'] = 'All'
        msg['Auto-Submitted'] = 'auto-generated'
        
        html_body = self._create_html_email(body, notification)
        msg.attach(MIMEText(html_body, 'html'))
        
        logger.info(f"📧 Sending email to {to_email}...")
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
        logger.info(f"📧 Email sent successfully to {to_email}!")
    
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
