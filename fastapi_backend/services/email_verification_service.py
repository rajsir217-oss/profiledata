"""
Email Verification Service
Handles user email verification, token generation, and account activation
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Settings

settings = Settings()

class EmailVerificationService:
    """Service for handling email verification and account activation"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users_collection = db.users
        
    def generate_verification_token(self) -> str:
        """Generate a secure random token for email verification"""
        # Generate 32-byte random token
        token = secrets.token_urlsafe(32)
        return token
    
    async def create_verification_token(self, username: str) -> Optional[str]:
        """
        Create and store verification token for user
        
        Args:
            username: Username of the user
            
        Returns:
            Verification token if successful, None otherwise
        """
        try:
            # Generate token
            token = self.generate_verification_token()
            
            # Token expires in 24 hours
            expiry = datetime.utcnow() + timedelta(hours=24)
            
            # Update user with token
            result = await self.users_collection.update_one(
                {"username": username},
                {
                    "$set": {
                        "emailVerificationToken": token,
                        "emailVerificationTokenExpiry": expiry,
                        "emailVerificationSentAt": datetime.utcnow()
                    },
                    "$inc": {"emailVerificationAttempts": 1}
                }
            )
            
            if result.modified_count > 0:
                return token
            return None
            
        except Exception as e:
            print(f"Error creating verification token: {e}")
            return None
    
    async def send_verification_email(self, username: str, email: str, first_name: str = "") -> bool:
        """
        Send verification email to user
        
        Args:
            username: Username of the user
            email: Email address to send verification to
            first_name: User's first name for personalization
            
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            # Create verification token
            token = await self.create_verification_token(username)
            if not token:
                return False
            
            # Construct verification URL
            verification_url = f"{settings.frontend_url}/verify-email?token={token}&username={username}"
            
            # Create email content
            subject = "Verify Your Email - Activate Your Profile"
            
            # HTML email template
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f9f9f9;
                    }}
                    .header {{
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }}
                    .content {{
                        background: white;
                        padding: 30px;
                        border-radius: 0 0 10px 10px;
                    }}
                    .button {{
                        display: inline-block;
                        padding: 15px 30px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                        margin: 20px 0;
                        font-weight: bold;
                    }}
                    .button:hover {{
                        opacity: 0.9;
                    }}
                    .footer {{
                        text-align: center;
                        color: #666;
                        font-size: 12px;
                        margin-top: 20px;
                    }}
                    .warning {{
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        padding: 10px;
                        border-radius: 5px;
                        margin-top: 15px;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Our Platform!</h1>
                        <p>Just one more step to activate your account</p>
                    </div>
                    <div class="content">
                        <h2>Hello {first_name or username}!</h2>
                        <p>Thank you for registering! To activate your profile and start using all features, please verify your email address.</p>
                        
                        <div style="text-align: center;">
                            <a href="{verification_url}" class="button">Verify Email Address</a>
                        </div>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
                            {verification_url}
                        </p>
                        
                        <div class="warning">
                            <strong>⏰ This link expires in 24 hours</strong><br>
                            If you didn't register for an account, please ignore this email.
                        </div>
                        
                        <h3>What happens next?</h3>
                        <ol>
                            <li><strong>Click the verification link above</strong> - This confirms your email address</li>
                            <li><strong>Admin approval</strong> - Our team will review and approve your profile (usually within 24 hours)</li>
                            <li><strong>Start matching!</strong> - Once approved, you'll have full access to all features</li>
                        </ol>
                        
                        <p>If you have any questions, feel free to contact our support team.</p>
                        
                        <p>Best regards,<br>The Team</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated email. Please do not reply directly to this message.</p>
                        <p>&copy; 2025 Matrimonial Platform. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text fallback
            text_content = f"""
            Hello {first_name or username}!
            
            Thank you for registering! To activate your profile, please verify your email address.
            
            Click here to verify: {verification_url}
            
            This link expires in 24 hours.
            
            What happens next?
            1. Click the verification link - This confirms your email address
            2. Admin approval - Our team will review and approve your profile
            3. Start matching! - Once approved, you'll have full access
            
            If you didn't register for an account, please ignore this email.
            
            Best regards,
            The Team
            """
            
            # Send email
            success = await self._send_email(email, subject, html_content, text_content)
            return success
            
        except Exception as e:
            print(f"Error sending verification email: {e}")
            return False
    
    async def _send_email(self, to_email: str, subject: str, html_content: str, text_content: str) -> bool:
        """
        Internal method to send email via SMTP
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content
            
        Returns:
            True if sent successfully, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{settings.from_name} <{settings.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Attach both plain text and HTML
            part1 = MIMEText(text_content, 'plain')
            part2 = MIMEText(html_content, 'html')
            msg.attach(part1)
            msg.attach(part2)
            
            # Connect to SMTP server and send
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                if settings.smtp_port == 587:  # TLS
                    server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            
            print(f"✅ Verification email sent to: {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Error sending email: {e}")
            return False
    
    async def verify_token(self, username: str, token: str) -> Dict[str, Any]:
        """
        Verify email verification token
        
        Args:
            username: Username of the user
            token: Verification token from email link
            
        Returns:
            Dictionary with success status and message
        """
        try:
            print(f"🔍 Verifying email for username: {username}")
            print(f"🔑 Token received: {token[:20]}..." if token and len(token) > 20 else f"🔑 Token: {token}")
            
            # Find user
            user = await self.users_collection.find_one({"username": username})
            
            if not user:
                print(f"❌ User '{username}' not found in database")
                return {
                    "success": False,
                    "message": "User not found"
                }
            
            # Check if already verified
            if user.get("emailVerified"):
                print(f"✅ User '{username}' email already verified")
                return {
                    "success": True,
                    "message": "Email already verified",
                    "alreadyVerified": True
                }
            
            # Check if token matches
            stored_token = user.get("emailVerificationToken")
            print(f"🔑 Stored token: {stored_token[:20]}..." if stored_token and len(stored_token) > 20 else f"🔑 Stored token: {stored_token}")
            
            if stored_token != token:
                print(f"❌ Token mismatch! Stored: {stored_token}, Received: {token}")
                return {
                    "success": False,
                    "message": "Invalid verification token"
                }
            
            # Check if token expired
            expiry = user.get("emailVerificationTokenExpiry")
            if not expiry or datetime.utcnow() > expiry:
                return {
                    "success": False,
                    "message": "Verification token has expired. Please request a new one.",
                    "expired": True
                }
            
            # Mark email as verified
            await self.users_collection.update_one(
                {"username": username},
                {
                    "$set": {
                        "emailVerified": True,
                        "emailVerifiedAt": datetime.utcnow(),
                        "accountStatus": "pending_admin_approval",  # Move to next stage
                        "emailVerificationToken": None,  # Clear token
                        "emailVerificationTokenExpiry": None
                    }
                }
            )
            
            # Notify admin about new user pending approval
            await self._notify_admin_new_user(username)
            
            return {
                "success": True,
                "message": "Email verified successfully! Your profile is now pending admin approval.",
                "nextStep": "pending_admin_approval"
            }
            
        except Exception as e:
            print(f"Error verifying token: {e}")
            return {
                "success": False,
                "message": "An error occurred during verification"
            }
    
    async def resend_verification_email(self, username: str) -> Dict[str, Any]:
        """
        Resend verification email to user
        
        Args:
            username: Username of the user
            
        Returns:
            Dictionary with success status and message
        """
        try:
            # Find user
            user = await self.users_collection.find_one({"username": username})
            
            if not user:
                return {
                    "success": False,
                    "message": "User not found"
                }
            
            # Check if already verified
            if user.get("emailVerified"):
                return {
                    "success": False,
                    "message": "Email already verified"
                }
            
            # Check resend attempts (max 5 per day)
            attempts = user.get("emailVerificationAttempts", 0)
            if attempts >= 5:
                return {
                    "success": False,
                    "message": "Maximum resend attempts reached. Please try again tomorrow."
                }
            
            # Send verification email
            success = await self.send_verification_email(
                username,
                user.get("contactEmail"),
                user.get("firstName", "")
            )
            
            if success:
                return {
                    "success": True,
                    "message": "Verification email sent successfully"
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to send verification email"
                }
                
        except Exception as e:
            print(f"Error resending verification email: {e}")
            return {
                "success": False,
                "message": "An error occurred while sending email"
            }
    
    async def _notify_admin_new_user(self, username: str):
        """Notify admin when new user completes email verification"""
        try:
            # TODO: Implement admin notification
            # This could be:
            # - Email to admin
            # - In-app notification
            # - Slack/Discord webhook
            # - Dashboard alert
            print(f"📬 Admin notification: New user {username} pending approval")
            pass
        except Exception as e:
            print(f"Error notifying admin: {e}")
