"""
Email Notification Job Template
Sends scheduled email notifications to users
"""

from typing import Dict, Any, Optional, Tuple, List
from .base import JobTemplate, JobResult, JobExecutionContext
import logging
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings

logger = logging.getLogger(__name__)


class EmailNotificationTemplate(JobTemplate):
    """Template for sending bulk email notifications"""
    
    template_type = "email_notification"
    template_name = "Bulk Email Notification"
    template_description = "Send bulk emails to specified recipients. Choose simulation mode for testing or live mode for real SMTP delivery."
    category = "notifications"
    icon = "📧"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "medium"
    
    def __init__(self):
        from utils.branding import get_app_name
        
        # Email configuration from settings (reads from .env)
        self.smtp_host = settings.smtp_host or "smtp.gmail.com"
        self.smtp_port = settings.smtp_port or 587
        self.smtp_user = settings.smtp_user
        self.smtp_password = settings.smtp_password
        self.from_email = settings.from_email or "noreply@datingapp.com"
        self.from_name = settings.from_name or get_app_name()
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "recipients": {
                    "type": "array",
                    "description": "List of email addresses to send to",
                    "items": {
                        "type": "string",
                        "format": "email"
                    },
                    "minItems": 1,
                    "maxItems": 100
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line",
                    "minLength": 1,
                    "maxLength": 200
                },
                "body": {
                    "type": "string",
                    "description": "Email body content (plain text or HTML)",
                    "minLength": 1,
                    "maxLength": 10000
                },
                "body_type": {
                    "type": "string",
                    "description": "Body content type",
                    "enum": ["plain", "html"],
                    "default": "plain"
                },
                "template": {
                    "type": "string",
                    "description": "Optional email template to use",
                    "enum": ["default", "notification", "report", "alert", "digest"]
                },
                "reply_to": {
                    "type": "string",
                    "description": "Reply-to email address",
                    "format": "email"
                },
                "priority": {
                    "type": "string",
                    "description": "Email priority level",
                    "enum": ["low", "normal", "high"],
                    "default": "normal"
                },
                "include_unsubscribe": {
                    "type": "boolean",
                    "description": "Include unsubscribe link",
                    "default": True
                },
                "simulate_only": {
                    "type": "boolean",
                    "description": "Simulate",
                    "default": False
                }
            },
            "required": ["recipients", "subject", "body"]
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # Check recipients
        recipients = params.get("recipients", [])
        if not recipients:
            return False, "At least one recipient email is required"
        
        if not isinstance(recipients, list):
            return False, "Recipients must be a list of email addresses"
        
        if len(recipients) > 100:
            return False, "Maximum 100 recipients allowed per job"
        
        # Validate email format
        email_pattern = re.compile(r'^[\w\.-]+@[\w\.-]+\.\w+$')
        for email in recipients:
            if not email_pattern.match(email):
                return False, f"Invalid email format: {email}"
        
        # Check subject
        subject = params.get("subject", "").strip()
        if not subject:
            return False, "Email subject is required"
        
        if len(subject) > 200:
            return False, "Email subject must be 200 characters or less"
        
        # Check body
        body = params.get("body", "").strip()
        if not body:
            return False, "Email body is required"
        
        if len(body) > 10000:
            return False, "Email body must be 10000 characters or less"
        
        # Validate reply_to if provided
        reply_to = params.get("reply_to")
        if reply_to and not email_pattern.match(reply_to):
            return False, f"Invalid reply-to email format: {reply_to}"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute email notification job"""
        params = context.parameters
        recipients = params["recipients"]
        subject = params["subject"]
        body = params["body"]
        body_type = params.get("body_type", "plain")
        template = params.get("template")
        reply_to = params.get("reply_to")
        priority = params.get("priority", "normal")
        include_unsubscribe = params.get("include_unsubscribe", True)
        simulate_only = params.get("simulate_only", False)
        
        mode = "SIMULATION MODE" if simulate_only else "LIVE MODE (real emails)"
        context.log("INFO", f"📧 {mode}: Preparing to send email to {len(recipients)} recipient(s)")
        context.log("INFO", f"Subject: {subject}")
        if simulate_only:
            context.log("WARNING", "⚠️ SIMULATION MODE - Emails will NOT be actually sent!")
        
        try:
            sent_count = 0
            failed_count = 0
            failed_emails = []
            
            for email in recipients:
                try:
                    # Send email (real or simulated based on simulate_only flag)
                    success = await self._send_email(
                        to=email,
                        subject=subject,
                        body=body,
                        body_type=body_type,
                        template=template,
                        reply_to=reply_to,
                        priority=priority,
                        include_unsubscribe=include_unsubscribe,
                        simulate_only=simulate_only,
                        context=context
                    )
                    
                    if success:
                        sent_count += 1
                        context.log("DEBUG", f"Email sent successfully to: {email}")
                    else:
                        failed_count += 1
                        failed_emails.append(email)
                        context.log("WARNING", f"Failed to send email to: {email}")
                
                except Exception as e:
                    failed_count += 1
                    failed_emails.append(email)
                    context.log("ERROR", f"Error sending to {email}: {str(e)}")
            
            # Determine result status
            if sent_count == len(recipients):
                status = "success"
                message = f"Successfully sent {sent_count} email(s)"
            elif sent_count > 0:
                status = "partial"
                message = f"Sent {sent_count} emails, {failed_count} failed"
            else:
                status = "failed"
                message = f"Failed to send all {failed_count} email(s)"
            
            context.log("INFO", f"Email job completed: {message}")
            
            return JobResult(
                status=status,
                message=message,
                details={
                    "sent": sent_count,
                    "failed": failed_count,
                    "failed_emails": failed_emails,
                    "recipients": recipients,
                    "subject": subject
                },
                records_processed=len(recipients),
                records_affected=sent_count,
                errors=[f"Failed to send to: {email}" for email in failed_emails] if failed_emails else []
            )
            
        except Exception as e:
            context.log("ERROR", f"Email job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Email notification job failed: {str(e)}",
                errors=[str(e)]
            )
    
    async def _send_email(
        self,
        to: str,
        subject: str,
        body: str,
        body_type: str,
        template: Optional[str],
        reply_to: Optional[str],
        priority: str,
        include_unsubscribe: bool,
        simulate_only: bool,
        context: JobExecutionContext
    ) -> bool:
        """
        Send an individual email via SMTP (or simulate if simulate_only=True)
        """
        try:
            # SIMULATION MODE - just log, don't actually send
            if simulate_only:
                context.log("DEBUG", f"🎭 SIMULATING email send to {to}")
                context.log("DEBUG", f"   Subject: {subject}")
                context.log("DEBUG", f"   Body: {body[:100]}..." if len(body) > 100 else f"   Body: {body}")
                # Simulate success
                return True
            
            # LIVE MODE - actually send via SMTP
            context.log("INFO", f"📤 Sending REAL email to {to}")
            
            if not self.smtp_user or not self.smtp_password:
                raise Exception(f"SMTP credentials not configured")
            
            # Create email message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to
            msg['Subject'] = subject
            
            if reply_to:
                msg['Reply-To'] = reply_to
            
            # Add body (HTML or plain text)
            if body_type == 'html':
                msg.attach(MIMEText(body, 'html'))
            else:
                msg.attach(MIMEText(body, 'plain'))
            
            # Send via SMTP
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            context.log("INFO", f"✅ Email sent successfully to {to}")
            return True
            
        except Exception as e:
            context.log("ERROR", f"Failed to send email to {to}: {str(e)}")
            return False
