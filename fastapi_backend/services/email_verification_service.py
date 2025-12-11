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
        Runs in a thread pool to avoid blocking the async event loop
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content
            
        Returns:
            True if sent successfully, False otherwise
        """
        from starlette.concurrency import run_in_threadpool
        
        def send_sync():
            try:
                # Create message
                msg = MIMEMultipart('alternative')
                msg['From'] = f"{settings.from_name} (Do Not Reply) <{settings.from_email}>"
                msg['To'] = to_email
                msg['Subject'] = subject
                
                # Add Reply-To header to discourage replies
                reply_to = getattr(settings, 'reply_to_email', None) or settings.from_email
                msg['Reply-To'] = f"No Reply <{reply_to}>"
                
                # Add headers to indicate this is an automated message
                msg['X-Auto-Response-Suppress'] = 'All'
                msg['Auto-Submitted'] = 'auto-generated'
                
                # Attach both plain text and HTML
                part1 = MIMEText(text_content, 'plain')
                part2 = MIMEText(html_content, 'html')
                msg.attach(part1)
                msg.attach(part2)
                
                # Connect to SMTP server and send
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                    if settings.smtp_port == 587:  # TLS
                        server.starttls()
                    server.login(settings.smtp_user, settings.smtp_password)
                    server.send_message(msg)
                
                print(f"✅ Verification email sent to: {to_email}")
                return True
                
            except Exception as e:
                import traceback
                print(f"❌ Error sending email: {e}")
                print(f"❌ Full traceback: {traceback.format_exc()}")
                print(f"❌ SMTP Config: host={settings.smtp_host}, port={settings.smtp_port}, user={settings.smtp_user}")
                return False

        return await run_in_threadpool(send_sync)
    
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
            
            # Check if token exists in database
            if not stored_token:
                print(f"❌ No verification token found for user '{username}' - may have been used already")
                return {
                    "success": False,
                    "message": "Verification token not found. It may have already been used or expired. Please request a new verification email.",
                    "tokenNotFound": True
                }
            
            if stored_token != token:
                print(f"❌ Token mismatch! Stored: {stored_token}, Received: {token}")
                return {
                    "success": False,
                    "message": "Invalid verification token. Please use the most recent verification email sent to you."
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
    
    async def send_welcome_email(self, username: str, email: str, first_name: str = "") -> bool:
        """
        Send welcome email when admin activates user account
        
        Args:
            username: Username of the activated user
            email: Email address
            first_name: User's first name for personalization
            
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            # Create email content
            subject = "🎉 Your Profile is Now Activated!"
            
            # Construct URLs
            search_url = f"{settings.frontend_url}/search"
            l3v3l_url = f"{settings.frontend_url}/l3v3l-matches"
            profile_url = f"{settings.frontend_url}/profile/{username}"
            
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
                        padding: 40px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }}
                    .header h1 {{
                        margin: 0;
                        font-size: 32px;
                    }}
                    .celebration {{
                        font-size: 48px;
                        margin: 10px 0;
                    }}
                    .content {{
                        background: white;
                        padding: 30px;
                        border-radius: 0 0 10px 10px;
                    }}
                    .success-box {{
                        background: #d4edda;
                        border: 2px solid #28a745;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                        text-align: center;
                    }}
                    .success-box h3 {{
                        color: #155724;
                        margin: 0 0 10px 0;
                    }}
                    .button {{
                        display: inline-block;
                        padding: 15px 30px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white !important;
                        text-decoration: none;
                        border-radius: 5px;
                        margin: 10px 5px;
                        font-weight: bold;
                    }}
                    .button:hover {{
                        opacity: 0.9;
                    }}
                    .feature-list {{
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                    }}
                    .feature-item {{
                        margin: 12px 0;
                        padding-left: 30px;
                        position: relative;
                    }}
                    .feature-item:before {{
                        content: "✓";
                        position: absolute;
                        left: 0;
                        color: #28a745;
                        font-weight: bold;
                        font-size: 18px;
                    }}
                    .footer {{
                        text-align: center;
                        color: #666;
                        font-size: 12px;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                    }}
                    .cta-section {{
                        text-align: center;
                        margin: 30px 0;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="celebration">🎉</div>
                        <h1>You're All Set!</h1>
                        <p style="font-size: 18px; margin: 10px 0 0 0;">Your profile has been activated</p>
                    </div>
                    
                    <div class="content">
                        <h2>Congratulations, {first_name or username}!</h2>
                        
                        <div class="success-box">
                            <h3>✓ Profile Fully Activated</h3>
                            <p style="margin: 0;">Your account has been approved by our admin team and you now have full access to all features!</p>
                        </div>
                        
                        <h3>What You Can Do Now:</h3>
                        <div class="feature-list">
                            <div class="feature-item">Search for matching profiles</div>
                            <div class="feature-item">View L3V3L compatibility scores</div>
                            <div class="feature-item">Send messages to your matches</div>
                            <div class="feature-item">Add profiles to favorites & shortlist</div>
                            <div class="feature-item">View who's interested in you</div>
                            <div class="feature-item">Access full profile details</div>
                        </div>
                        
                        <div class="cta-section">
                            <h3 style="color: #667eea;">Ready to Find Your Match?</h3>
                            <p>Start your journey today!</p>
                            <a href="{search_url}" class="button">🔍 Search Profiles</a>
                            <a href="{l3v3l_url}" class="button">💜 View L3V3L Matches</a>
                        </div>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        
                        <h3>Pro Tips for Success:</h3>
                        <ul style="line-height: 1.8;">
                            <li>Complete your profile with photos and detailed information</li>
                            <li>Be genuine and authentic in your communications</li>
                            <li>Check your L3V3L matches for high compatibility scores</li>
                            <li>Respond promptly to messages from interested profiles</li>
                            <li>Use the favorites feature to keep track of interesting profiles</li>
                        </ul>
                        
                        <div class="success-box" style="background: #d1ecf1; border-color: #17a2b8;">
                            <h3 style="color: #0c5460;">Need Help?</h3>
                            <p style="margin: 0;">Visit your <a href="{profile_url}" style="color: #0c5460; font-weight: bold;">profile page</a> or contact our support team anytime.</p>
                        </div>
                        
                        <p style="margin-top: 30px;">
                            We're excited to have you join our community! Wishing you all the best in your search for a meaningful connection.
                        </p>
                        
                        <p style="margin-top: 20px;">
                            <strong>Best regards,</strong><br>
                            The Team
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>© 2025 Matrimonial Platform. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text version (fallback)
            text_content = f"""
            🎉 Congratulations, {first_name or username}!
            
            Your profile has been ACTIVATED!
            
            Your account has been approved by our admin team and you now have full access to all features.
            
            What You Can Do Now:
            ✓ Search for matching profiles
            ✓ View L3V3L compatibility scores
            ✓ Send messages to your matches
            ✓ Add profiles to favorites & shortlist
            ✓ View who's interested in you
            ✓ Access full profile details
            
            Get Started:
            🔍 Search Profiles: {search_url}
            💜 L3V3L Matches: {l3v3l_url}
            👤 Your Profile: {profile_url}
            
            Pro Tips for Success:
            • Complete your profile with photos and detailed information
            • Be genuine and authentic in your communications
            • Check your L3V3L matches for high compatibility scores
            • Respond promptly to messages from interested profiles
            • Use the favorites feature to keep track of interesting profiles
            
            We're excited to have you join our community!
            
            Best regards,
            The Team
            
            ---
            This is an automated message. Please do not reply to this email.
            """
            
            # Send email
            return await self._send_email(email, subject, html_content, text_content)
            
        except Exception as e:
            print(f"❌ Error sending welcome email: {e}")
            return False
    
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
