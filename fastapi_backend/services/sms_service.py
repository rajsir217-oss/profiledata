"""
OTP Service (SMS + Email)
Handles sending OTP codes via SMS (Twilio/AWS SNS) and Email (SMTP)
Includes OTP management for verification codes with dual-channel support
"""
import os
import random
import string
from datetime import datetime, timedelta
from typing import Optional, Dict
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
import logging
from config import settings

logger = logging.getLogger(__name__)

# Import email OTP service
try:
    from services.email_otp_service import EmailOTPService
    EMAIL_OTP_AVAILABLE = True
except ImportError:
    EMAIL_OTP_AVAILABLE = False
    logger.warning("Email OTP service not available")

# Import SimpleTexting service
try:
    from services.simpletexting_service import SimpleTextingService
    SIMPLETEXTING_AVAILABLE = True
except ImportError:
    SIMPLETEXTING_AVAILABLE = False
    logger.warning("SimpleTexting service not available")


class SMSService:
    """Service for sending SMS messages via Twilio"""
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_phone = os.getenv("TWILIO_FROM_PHONE")
        self.enabled = bool(self.account_sid and self.auth_token and self.from_phone)
        
        if self.enabled:
            self.client = Client(self.account_sid, self.auth_token)
            logger.info("✅ SMS Service initialized with Twilio")
        else:
            logger.warning("⚠️ SMS Service disabled - missing Twilio credentials")
    
    def generate_otp(self, length: int = 6) -> str:
        """Generate a numeric OTP code"""
        return ''.join(random.choices(string.digits, k=length))
    
    def format_phone_number(self, phone: str) -> str:
        """Format phone number to E.164 format (+1234567890)"""
        # Remove all non-digit characters
        digits = ''.join(filter(str.isdigit, phone))
        
        # Add country code if not present
        if not digits.startswith('1') and len(digits) == 10:
            digits = '1' + digits
        
        # Add + prefix
        if not digits.startswith('+'):
            digits = '+' + digits
        
        return digits
    
    async def send_otp(
        self, 
        phone: str, 
        otp: str,
        purpose: str = "verification",
        username: str = None
    ) -> Dict[str, any]:
        """
        Send OTP code via SMS
        
        Args:
            phone: Phone number in any format
            otp: OTP code to send
            purpose: Purpose of OTP (verification, mfa, password_reset)
            username: Username/profile identifier (included in message for clarity)
        
        Returns:
            Dict with success status and message_sid or error
        """
        if not self.enabled:
            logger.warning(f"SMS not sent - service disabled (phone: {phone})")
            return {
                "success": False,
                "error": "SMS service not configured",
                "mock_code": otp  # For development
            }
        
        try:
            formatted_phone = self.format_phone_number(phone)
            
            # Include username in message for multi-profile clarity
            profile_prefix = f"[L3V3LMATCHES | {username}] " if username else "[L3V3LMATCHES] "
            
            # Create message based on purpose
            if purpose == "verification":
                message_body = (
                    f"{profile_prefix}Your verification code is: {otp}\n\n"
                    f"This code will expire in 10 minutes.\n"
                    f"Do not share this code with anyone."
                )
            elif purpose == "mfa":
                message_body = (
                    f"{profile_prefix}Login code: {otp}\n\n"
                    f"Expires in 5 minutes.\n"
                    f"Didn't request this? Ignore this message."
                )
            elif purpose == "password_reset":
                message_body = (
                    f"{profile_prefix}Password reset code: {otp}\n\n"
                    f"Expires in 15 minutes.\n"
                    f"Didn't request this? Secure your account."
                )
            else:
                message_body = f"{profile_prefix}Your code is: {otp}"
            
            # Send SMS
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_phone,
                to=formatted_phone
            )
            
            logger.info(f"✅ SMS sent successfully to {formatted_phone[:7]}*** (SID: {message.sid})")
            
            return {
                "success": True,
                "message_sid": message.sid,
                "phone": formatted_phone,
                "sent_at": datetime.utcnow()
            }
            
        except TwilioRestException as e:
            logger.error(f"❌ Twilio error sending SMS to {phone}: {e.msg}")
            return {
                "success": False,
                "error": f"Failed to send SMS: {e.msg}",
                "error_code": e.code
            }
        except Exception as e:
            logger.error(f"❌ Unexpected error sending SMS to {phone}: {str(e)}")
            return {
                "success": False,
                "error": "Failed to send SMS due to system error"
            }
    
    async def send_notification(
        self,
        phone: str,
        message: str
    ) -> Dict[str, any]:
        """
        Send a general notification SMS
        
        Args:
            phone: Phone number
            message: Message to send
        
        Returns:
            Dict with success status
        """
        if not self.enabled:
            logger.warning(f"SMS notification not sent - service disabled")
            return {"success": False, "error": "SMS service not configured"}
        
        try:
            formatted_phone = self.format_phone_number(phone)
            
            message = self.client.messages.create(
                body=message,
                from_=self.from_phone,
                to=formatted_phone
            )
            
            logger.info(f"✅ Notification SMS sent to {formatted_phone[:7]}***")
            
            return {
                "success": True,
                "message_sid": message.sid
            }
            
        except TwilioRestException as e:
            logger.error(f"❌ Failed to send notification SMS: {e.msg}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"❌ Unexpected error: {str(e)}")
            return {"success": False, "error": "System error"}


class OTPManager:
    """Manage OTP codes - generation, storage, validation (SMS + Email)"""
    
    def __init__(self, db):
        self.db = db
        self.collection = db.otp_codes
        
        # Initialize SMS providers (priority: SimpleTexting > Twilio > AWS SNS)
        self.sms_provider = None
        sms_provider_pref = (settings.sms_provider or "auto").lower()
        
        # SimpleTexting
        if SIMPLETEXTING_AVAILABLE:
            self.simpletexting_service = SimpleTextingService()
            if self.simpletexting_service.enabled and (sms_provider_pref == "simpletexting" or sms_provider_pref == "auto"):
                self.sms_provider = "simpletexting"
        
        # Twilio (fallback or explicit choice)
        self.sms_service = SMSService()
        if not self.sms_provider and self.sms_service.enabled:
            if sms_provider_pref in ["twilio", "auto"]:
                self.sms_provider = "twilio"
        
        # Email service
        self.email_service = EmailOTPService() if EMAIL_OTP_AVAILABLE else None
        
        # Log available channels
        channels = []
        if self.sms_provider:
            channels.append(f"SMS ({self.sms_provider.upper()})")
        if self.email_service and self.email_service.enabled:
            channels.append("Email")
        
        if channels:
            logger.info(f"✅ OTP Manager initialized with channels: {', '.join(channels)}")
        else:
            logger.warning("⚠️  OTP Manager has NO channels enabled!")
    
    async def create_otp(
        self,
        identifier: str,  # username or phone
        phone: str,
        purpose: str = "verification",
        expires_in_minutes: int = 10
    ) -> Dict[str, any]:
        """
        Create and send OTP code
        
        Args:
            identifier: User identifier (username/email)
            phone: Phone number to send to
            purpose: verification, mfa, password_reset
            expires_in_minutes: OTP expiry time
        
        Returns:
            Dict with success status and OTP details
        """
        # Generate OTP
        otp_code = self.sms_service.generate_otp(6)
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
        
        # Store OTP in database
        otp_doc = {
            "identifier": identifier,
            "phone": phone,
            "code": otp_code,
            "purpose": purpose,
            "attempts": 0,
            "max_attempts": 5,
            "expires_at": expires_at,
            "created_at": datetime.utcnow(),
            "verified": False,
            "used": False
        }
        
        # Remove any existing OTPs for this identifier and purpose
        await self.collection.delete_many({
            "identifier": identifier,
            "purpose": purpose,
            "verified": False
        })
        
        # Insert new OTP
        result = await self.collection.insert_one(otp_doc)
        
        # Send SMS
        sms_result = await self.sms_service.send_otp(phone, otp_code, purpose, username=identifier)
        
        if sms_result["success"]:
            logger.info(f"✅ OTP created and sent for {identifier} ({purpose})")
            return {
                "success": True,
                "otp_id": str(result.inserted_id),
                "expires_at": expires_at,
                "phone_masked": f"{phone[:3]}***{phone[-2:]}" if len(phone) > 5 else "***"
            }
        else:
            # SMS failed, but OTP is created - return mock code in development
            logger.warning(f"⚠️ OTP created but SMS failed for {identifier}")
            response = {
                "success": False,
                "error": sms_result.get("error"),
                "otp_id": str(result.inserted_id),
                "expires_at": expires_at
            }
            
            # In development, include the actual code
            if os.getenv("ENVIRONMENT") == "development":
                response["mock_code"] = otp_code
                logger.info(f"🔧 DEV MODE - OTP Code: {otp_code}")
            
            return response
    
    async def create_otp_with_channel(
        self,
        identifier: str,
        channel: str = "email",  # "email" or "sms"
        phone: Optional[str] = None,
        email: Optional[str] = None,
        username: Optional[str] = None,
        purpose: str = "verification",
        expires_in_minutes: int = 10
    ) -> Dict[str, any]:
        """
        Create and send OTP code via specified channel (Email or SMS)
        
        Args:
            identifier: User identifier (username/email)
            channel: "email" or "sms"
            phone: Phone number (required for SMS)
            email: Email address (required for email)
            username: Username for personalization
            purpose: verification, mfa, password_reset
            expires_in_minutes: OTP expiry time
        
        Returns:
            Dict with success status and OTP details
        """
        # Validate channel
        if channel not in ["email", "sms"]:
            return {
                "success": False,
                "error": f"Invalid channel: {channel}. Must be 'email' or 'sms'"
            }
        
        # Check if channel is available
        sms_available = False
        if self.sms_provider == "simpletexting":
            sms_available = self.simpletexting_service and self.simpletexting_service.enabled
        elif self.sms_provider == "twilio":
            sms_available = self.sms_service and self.sms_service.enabled
        
        if channel == "sms" and not sms_available:
            # Fallback to email if available
            if self.email_service and self.email_service.enabled:
                logger.warning(f"SMS not available, falling back to email for {identifier}")
                channel = "email"
            else:
                return {
                    "success": False,
                    "error": "SMS service not configured and no fallback available"
                }
        
        if channel == "email" and (not self.email_service or not self.email_service.enabled):
            # Fallback to SMS if available
            if sms_available:
                logger.warning(f"Email not available, falling back to SMS for {identifier}")
                channel = "sms"
            else:
                return {
                    "success": False,
                    "error": "Email service not configured and no fallback available"
                }
        
        # Validate required fields
        if channel == "sms" and not phone:
            return {"success": False, "error": "Phone number required for SMS channel"}
        if channel == "email" and not email:
            return {"success": False, "error": "Email address required for email channel"}
        
        # Generate OTP
        otp_code = self.sms_service.generate_otp(6)
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
        
        # Store OTP in database
        otp_doc = {
            "identifier": identifier,
            "phone": phone,
            "email": email,
            "code": otp_code,
            "purpose": purpose,
            "channel": channel,
            "attempts": 0,
            "max_attempts": 5,
            "expires_at": expires_at,
            "created_at": datetime.utcnow(),
            "verified": False,
            "used": False
        }
        
        # Remove any existing OTPs for this identifier and purpose
        await self.collection.delete_many({
            "identifier": identifier,
            "purpose": purpose,
            "verified": False
        })
        
        # Insert new OTP
        result = await self.collection.insert_one(otp_doc)
        
        # Send via selected channel
        send_result = None
        
        if channel == "sms":
            # Use the configured SMS provider
            if self.sms_provider == "simpletexting":
                send_result = await self.simpletexting_service.send_otp(phone, otp_code, purpose, username=username)
            elif self.sms_provider == "twilio":
                send_result = await self.sms_service.send_otp(phone, otp_code, purpose, username=username)
            else:
                return {
                    "success": False,
                    "error": "No SMS provider configured"
                }
            masked_contact = f"{phone[:3]}***{phone[-2:]}" if len(phone) > 5 else "***"
        else:  # email
            send_result = await self.email_service.send_otp(
                email=email,
                otp_code=otp_code,
                username=username or identifier,
                purpose=purpose,
                expiry_minutes=expires_in_minutes
            )
            # Extract masked email from send_result
            masked_contact = send_result.get("email_masked", email[:3] + "***@***")
        
        if send_result["success"]:
            logger.info(f"✅ OTP created and sent via {channel.upper()} for {identifier} ({purpose})")
            return {
                "success": True,
                "channel": channel,
                "otp_id": str(result.inserted_id),
                "expires_at": expires_at,
                "contact_masked": masked_contact,
                "message": f"Verification code sent via {channel.upper()}"
            }
        else:
            # Sending failed, but OTP is created
            logger.warning(f"⚠️  OTP created but {channel.upper()} send failed for {identifier}")
            
            # Handle opt-out: sync to database if user opted out at carrier level
            error_msg = send_result.get("error", "")
            if channel == "sms" and ("OPT_OUT" in error_msg or "OPT-OUT" in error_msg or "unsubscribe" in error_msg.lower()):
                await self._handle_sms_opt_out(phone, identifier)
            
            response = {
                "success": False,
                "channel": channel,
                "error": send_result.get("error"),
                "otp_id": str(result.inserted_id),
                "expires_at": expires_at
            }
            
            # In development, include the actual code
            if os.getenv("ENVIRONMENT") == "development":
                response["mock_code"] = otp_code
                logger.info(f"🔧 DEV MODE - OTP Code: {otp_code}")
            
            return response
    
    async def verify_otp(
        self,
        identifier: str,
        code: str,
        purpose: str = "verification",
        mark_as_used: bool = True
    ) -> Dict[str, any]:
        """
        Verify OTP code
        
        Args:
            identifier: User identifier
            code: OTP code to verify
            purpose: Purpose to match
            mark_as_used: Mark OTP as used after verification
        
        Returns:
            Dict with verification result
        """
        # Find OTP
        otp = await self.collection.find_one({
            "identifier": identifier,
            "purpose": purpose,
            "verified": False,
            "used": False
        })
        
        if not otp:
            return {
                "success": False,
                "error": "No OTP found or OTP already used"
            }
        
        # Check expiry
        if datetime.utcnow() > otp["expires_at"]:
            await self.collection.update_one(
                {"_id": otp["_id"]},
                {"$set": {"expired": True}}
            )
            return {
                "success": False,
                "error": "OTP code expired. Please request a new one."
            }
        
        # Check max attempts
        if otp["attempts"] >= otp["max_attempts"]:
            return {
                "success": False,
                "error": "Too many failed attempts. Please request a new code."
            }
        
        # Verify code
        if otp["code"] != code:
            # Increment attempts
            await self.collection.update_one(
                {"_id": otp["_id"]},
                {"$inc": {"attempts": 1}}
            )
            
            remaining_attempts = otp["max_attempts"] - otp["attempts"] - 1
            return {
                "success": False,
                "error": f"Invalid code. {remaining_attempts} attempts remaining."
            }
        
        # Code is valid
        update_data = {
            "verified": True,
            "verified_at": datetime.utcnow()
        }
        
        if mark_as_used:
            update_data["used"] = True
        
        await self.collection.update_one(
            {"_id": otp["_id"]},
            {"$set": update_data}
        )
        
        logger.info(f"✅ OTP verified successfully for {identifier} ({purpose})")
        
        return {
            "success": True,
            "message": "Code verified successfully",
            "phone": otp["phone"]
        }
    
    async def resend_otp(
        self,
        identifier: str,
        phone: str,
        purpose: str = "verification"
    ) -> Dict[str, any]:
        """Resend OTP (creates new one)"""
        # Check rate limiting - only allow resend after 1 minute
        recent_otp = await self.collection.find_one(
            {
                "identifier": identifier,
                "purpose": purpose,
                "created_at": {"$gte": datetime.utcnow() - timedelta(minutes=1)}
            },
            sort=[("created_at", -1)]
        )
        
        if recent_otp:
            wait_seconds = 60 - (datetime.utcnow() - recent_otp["created_at"]).seconds
            return {
                "success": False,
                "error": f"Please wait {wait_seconds} seconds before requesting a new code"
            }
        
        # Create new OTP
        return await self.create_otp(identifier, phone, purpose)
    
    async def _handle_sms_opt_out(self, phone: str, identifier: str):
        """
        Handle SMS opt-out by syncing to user database
        
        When a user opts out at the carrier level (via SimpleTexting/Twilio),
        we need to update our database to reflect this.
        
        Args:
            phone: Phone number that opted out
            identifier: User identifier (username)
        """
        try:
            # Update user's smsOptIn to False
            result = await self.db.users.update_one(
                {"contactNumber": phone},
                {"$set": {"smsOptIn": False}}
            )
            
            if result.modified_count > 0:
                logger.warning(f"⚠️  Synced opt-out status for {phone[:3]}***{phone[-4:]} - updated smsOptIn to False")
            else:
                # Try by username if phone number didn't match
                result = await self.db.users.update_one(
                    {"username": identifier},
                    {"$set": {"smsOptIn": False}}
                )
                if result.modified_count > 0:
                    logger.warning(f"⚠️  Synced opt-out status for {identifier} - updated smsOptIn to False")
        
        except Exception as e:
            logger.error(f"❌ Failed to sync opt-out status: {str(e)}")
    
    async def cleanup_expired_otps(self):
        """Cleanup expired OTPs (run periodically)"""
        result = await self.collection.delete_many({
            "expires_at": {"$lt": datetime.utcnow()}
        })
        
        if result.deleted_count > 0:
            logger.info(f"🧹 Cleaned up {result.deleted_count} expired OTPs")
        
        return result.deleted_count
