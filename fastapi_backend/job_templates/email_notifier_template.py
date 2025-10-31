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
        # Email configuration from settings (reads from .env)
        self.smtp_host = settings.smtp_host or "smtp.gmail.com"
        self.smtp_port = settings.smtp_port or 587
        self.smtp_user = settings.smtp_user
        self.smtp_password = settings.smtp_password
        self.from_email = settings.from_email or "noreply@datingapp.com"
        self.from_name = settings.from_name or "L3V3L Dating"
    
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
                        context.log("info", f"✅ Using email: {recipient_email}")
                        
                        if not recipient_email:
                            raise Exception(f"User '{notification.username}' has no email address (checked 'email' and 'contactEmail' fields)")
                    
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
                    
                    # Log notification
                    await service.log_notification(
                        username=notification.username,
                        trigger=notification.trigger,
                        channel=NotificationChannel.EMAIL,
                        priority=notification.priority,
                        subject=subject,
                        preview=body[:100],
                        cost=0.0
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
        
        template = await db.notification_templates.find_one({
            "trigger": notification.trigger,
            "channel": NotificationChannel.EMAIL,
            "active": True
        })
        
        # Inject app URLs and tracking into template data
        template_data = notification.templateData.copy() if notification.templateData else {}
        tracking_id = str(notification.id)
        backend_url = settings.backend_url or "http://localhost:8000"
        
        # Add app URLs with tracking
        template_data["app"] = {
            "logoUrl": f"{backend_url}/uploads/logo.png",
            "trackingPixelUrl": f"{backend_url}/api/email-tracking/pixel/{tracking_id}",
            "profileUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={backend_url}/profile&link_type=profile",
            "chatUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={backend_url}/messages&link_type=chat",
            "unsubscribeUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={backend_url}/unsubscribe&link_type=unsubscribe",
            "preferencesUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={backend_url}/preferences&link_type=preferences",
            "approveUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={backend_url}/pii/approve&link_type=approve",
            "denyUrl_tracked": f"{backend_url}/api/email-tracking/click/{tracking_id}?url={backend_url}/pii/deny&link_type=deny",
            "dashboardUrl": f"{backend_url}/dashboard",
            "contactUrl": f"{backend_url}/contact",
            "searchUrl": f"{backend_url}/search",
            "securityUrl": f"{backend_url}/security"
        }
        
        if not template:
            subject = f"New {notification.trigger} notification"
            body = f"You have a new {notification.trigger} event."
        else:
            subject = service.render_template(
                template.get("subject", ""),
                template_data
            )
            # Use 'body' field for HTML templates
            body = service.render_template(
                template.get("body", template.get("bodyTemplate", "")),
                template_data
            )
        
        return subject, body
    
    async def _send_email(self, to_email: str, subject: str, body: str, notification) -> None:
        """Send email via SMTP"""
        # Debug logging
        print(f"DEBUG: SMTP Configuration:")
        print(f"  Host: {self.smtp_host}")
        print(f"  Port: {self.smtp_port}")
        print(f"  User: {self.smtp_user}")
        print(f"  Password: {'SET' if self.smtp_password else 'NOT SET'}")
        print(f"  From: {self.from_email}")
        
        if not self.smtp_user or not self.smtp_password:
            raise Exception(f"SMTP credentials not configured (user={self.smtp_user}, pass={'SET' if self.smtp_password else 'NOT SET'})")
        
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        html_body = self._create_html_email(body, notification)
        msg.attach(MIMEText(html_body, 'html'))
        
        print(f"DEBUG: Sending email to {to_email}...")
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
        print(f"DEBUG: Email sent successfully!")
    
    def _create_html_email(self, body: str, notification) -> str:
        """Create HTML email with styling"""
        app_url = os.getenv("APP_URL", "https://app.datingsite.com")
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                           color: white; padding: 30px; text-align: center; }}
                .content {{ background: #ffffff; padding: 30px; }}
                .footer {{ background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="header"><h1>💜 {self.from_name}</h1></div>
            <div class="content">{body}</div>
            <div class="footer">
                <p>© 2025 {self.from_name}. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        return html
