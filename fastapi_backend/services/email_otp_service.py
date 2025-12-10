"""
Email OTP Service
Handles sending OTP codes via email
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime, timedelta
from config import settings

logger = logging.getLogger(__name__)


class EmailOTPService:
    """Service for sending OTP codes via email"""
    
    def __init__(self):
        """Initialize email OTP service"""
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_user = settings.smtp_user
        self.smtp_password = settings.smtp_password
        self.from_email = settings.from_email
        self.from_name = settings.from_name
        
        # Use from_name for email branding (L3V3L MATCHES)
        self.app_name = self.from_name or "L3V3L MATCHES"
        
        # Check if SMTP is configured
        self.enabled = all([
            self.smtp_host,
            self.smtp_port,
            self.smtp_user,
            self.smtp_password,
            self.from_email
        ])
        
        if not self.enabled:
            logger.warning("⚠️  Email OTP service not configured - SMTP settings missing")
        else:
            logger.info(f"✅ Email OTP service initialized (SMTP: {self.smtp_host})")
    
    def _load_template(self, template_name: str) -> str:
        """Load email template from file"""
        template_path = Path(__file__).parent.parent / "templates" / template_name
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to load template {template_name}: {e}")
            return ""
    
    def _render_template(self, template: str, context: Dict) -> str:
        """Simple template rendering (replace {{variable}} with values)"""
        for key, value in context.items():
            placeholder = f"{{{{{key}}}}}"
            template = template.replace(placeholder, str(value))
        return template
    
    async def send_otp(
        self,
        email: str,
        otp_code: str,
        username: str,
        purpose: str = "verification",
        expiry_minutes: int = 10
    ) -> Dict:
        """
        Send OTP code via email
        
        Args:
            email: Recipient email address
            otp_code: The OTP code to send
            username: Username for personalization
            purpose: Purpose of OTP (verification, mfa, password_reset)
            expiry_minutes: How long the code is valid
            
        Returns:
            Dict with success status and details
        """
        if not self.enabled:
            logger.warning("Email OTP service not enabled")
            return {
                "success": False,
                "error": "Email service not configured",
                "channel": "email"
            }
        
        try:
            # Determine message based on purpose
            purpose_messages = {
                "verification": f"You requested to verify your email address for profile '{username}'. Please use the code below to complete verification.",
                "mfa": f"Someone is trying to log in to profile '{username}'. Please use the code below to complete authentication.",
                "password_reset": f"You requested to reset your password for profile '{username}'. Please use the code below to proceed.",
            }
            
            message_text = purpose_messages.get(
                purpose,
                f"Please use the verification code below to proceed for profile '{username}'."
            )
            
            # Subject based on purpose (include username for clarity)
            subject_map = {
                "verification": f"🔐 Verification Code for {username} - {self.app_name}",
                "mfa": f"🔒 Login Code for {username} - {self.app_name}",
                "password_reset": f"🔑 Password Reset for {username} - {self.app_name}",
            }
            
            subject = subject_map.get(
                purpose,
                f"Verification Code for {username} - {self.app_name}"
            )
            
            # Template context
            context = {
                "username": username,
                "otp_code": otp_code,
                "message": message_text,
                "expiry_minutes": expiry_minutes,
                "app_name": self.app_name,
                "purpose": purpose
            }
            
            # Load and render templates
            html_template = self._load_template("otp_verification_email.html")
            text_template = self._load_template("otp_verification_email.txt")
            
            html_body = self._render_template(html_template, context)
            text_body = self._render_template(text_template, context)
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} (Do Not Reply) <{self.from_email}>"
            msg['To'] = email
            
            # Add Reply-To header to discourage replies
            reply_to = getattr(settings, 'reply_to_email', None) or self.from_email
            msg['Reply-To'] = f"No Reply <{reply_to}>"
            
            # Add headers to indicate this is an automated message
            msg['X-Auto-Response-Suppress'] = 'All'
            msg['Auto-Submitted'] = 'auto-generated'
            
            # Attach both plain text and HTML versions
            msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ OTP email sent to {email} (purpose: {purpose})")
            
            return {
                "success": True,
                "channel": "email",
                "email": email,
                "email_masked": self._mask_email(email),
                "expires_in": expiry_minutes * 60,  # seconds
                "message": f"Verification code sent to {self._mask_email(email)}"
            }
            
        except smtplib.SMTPAuthenticationError:
            logger.error("❌ SMTP authentication failed - check credentials")
            return {
                "success": False,
                "error": "Email service authentication failed",
                "channel": "email"
            }
            
        except smtplib.SMTPException as e:
            logger.error(f"❌ SMTP error sending OTP: {e}")
            return {
                "success": False,
                "error": f"Failed to send email: {str(e)}",
                "channel": "email"
            }
            
        except Exception as e:
            logger.error(f"❌ Unexpected error sending OTP email: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "channel": "email"
            }
    
    def _mask_email(self, email: str) -> str:
        """Mask email for privacy (show first char and domain)"""
        try:
            local, domain = email.split('@')
            if len(local) <= 2:
                masked_local = local[0] + '*'
            else:
                masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
            return f"{masked_local}@{domain}"
        except:
            return email[:3] + "***@***"
    
    async def send_notification(
        self,
        email: str,
        subject: str,
        message: str,
        username: Optional[str] = None
    ) -> Dict:
        """
        Send a general notification email
        
        Args:
            email: Recipient email
            subject: Email subject
            message: Email message
            username: Optional username for personalization
            
        Returns:
            Dict with success status
        """
        if not self.enabled:
            return {
                "success": False,
                "error": "Email service not configured",
                "channel": "email"
            }
        
        try:
            # Create simple text message
            text_body = f"Hello{' ' + username if username else ''},\n\n{message}\n\n---\n{self.app_name}"
            
            msg = MIMEText(text_body, 'plain', 'utf-8')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = email
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Notification email sent to {email}")
            
            return {
                "success": True,
                "channel": "email",
                "message": "Email sent successfully"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to send notification email: {e}")
            return {
                "success": False,
                "error": str(e),
                "channel": "email"
            }
