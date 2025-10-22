"""
Email Notification Job Template
Sends scheduled email notifications to users
"""

from typing import Dict, Any, Optional, Tuple, List
from .base import JobTemplate, JobResult, JobExecutionContext
import logging
import re

logger = logging.getLogger(__name__)


class EmailNotificationTemplate(JobTemplate):
    """Template for sending bulk email notifications"""
    
    template_type = "email_notification"
    template_name = "Bulk Email Notification"
    template_description = "Send bulk emails to specified recipients (not for notification queue)"
    category = "notifications"
    icon = "📧"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "low"
    
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
        
        context.log("INFO", f"Preparing to send email to {len(recipients)} recipient(s)")
        context.log("INFO", f"Subject: {subject}")
        
        try:
            sent_count = 0
            failed_count = 0
            failed_emails = []
            
            # In a real implementation, this would use an email service like SendGrid or AWS SES
            # For now, we'll simulate the email sending
            
            for email in recipients:
                try:
                    # Simulate sending email
                    success = await self._send_email(
                        to=email,
                        subject=subject,
                        body=body,
                        body_type=body_type,
                        template=template,
                        reply_to=reply_to,
                        priority=priority,
                        include_unsubscribe=include_unsubscribe,
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
        context: JobExecutionContext
    ) -> bool:
        """
        Send an individual email
        
        In a real implementation, this would integrate with:
        - SendGrid API
        - AWS SES
        - SMTP server
        - Other email service providers
        
        For now, we simulate the operation and log it
        """
        # Simulate email sending
        context.log("DEBUG", f"Simulating email send to {to}")
        
        # In production, replace with actual email sending logic:
        # import sendgrid
        # from sendgrid.helpers.mail import Mail
        # 
        # sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
        # message = Mail(
        #     from_email='noreply@yourdomain.com',
        #     to_emails=to,
        #     subject=subject,
        #     html_content=body if body_type == 'html' else None,
        #     plain_text_content=body if body_type == 'plain' else None
        # )
        # response = sg.send(message)
        # return response.status_code in [200, 201, 202]
        
        # For now, simulate success
        return True
