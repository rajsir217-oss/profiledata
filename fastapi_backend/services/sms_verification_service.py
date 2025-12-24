"""
SMS Verification Service
Handles phone number verification for account activation as an alternative to email verification
"""
import secrets
import random
import string
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from config import settings

logger = logging.getLogger(__name__)

# Import SMS service
try:
    from services.sms_service import OTPManager
    SMS_AVAILABLE = True
except ImportError:
    SMS_AVAILABLE = False
    logger.warning("SMS service not available for verification")


def _decrypt_contact_info(value: str) -> Optional[str]:
    """Decrypt PII field if encrypted, return as-is if not"""
    if not value:
        return None
    
    # Check if it looks encrypted (gAAAAA prefix from Fernet)
    if value.startswith('gAAAAA'):
        try:
            from crypto_utils import get_encryptor
            encryptor = get_encryptor()
            return encryptor.decrypt(value)
        except Exception as e:
            logger.error(f"Failed to decrypt contact info: {e}")
            return None
    return value


class SMSVerificationService:
    """Service for handling SMS-based phone verification for account activation"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users_collection = db.users
        self.otp_collection = db.sms_verification_codes
        
        # Initialize OTP Manager for SMS sending
        if SMS_AVAILABLE:
            self.otp_manager = OTPManager(db)
            self.enabled = self.otp_manager.sms_provider is not None
        else:
            self.otp_manager = None
            self.enabled = False
        
        if self.enabled:
            logger.info(f"✅ SMS Verification Service initialized (provider: {self.otp_manager.sms_provider})")
        else:
            logger.warning("⚠️ SMS Verification Service disabled - no SMS provider available")
    
    def generate_otp(self, length: int = 6) -> str:
        """Generate a numeric OTP code"""
        return ''.join(random.choices(string.digits, k=length))
    
    async def send_verification_sms(self, username: str, phone: str = None) -> Dict[str, Any]:
        """
        Send verification SMS with OTP code to user's phone
        
        Args:
            username: Username of the user
            phone: Phone number (optional - will look up from user if not provided)
            
        Returns:
            Dictionary with success status and message
        """
        if not self.enabled:
            return {
                "success": False,
                "message": "SMS verification is not available. Please use email verification."
            }
        
        try:
            # Find user
            user = await self.users_collection.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
            
            if not user:
                return {
                    "success": False,
                    "message": "User not found"
                }
            
            # Check if already verified
            if user.get("phoneVerified") or user.get("emailVerified"):
                return {
                    "success": False,
                    "message": "Account already verified"
                }
            
            # Get phone number
            if not phone:
                phone = user.get("contactNumber") or user.get("phone")
                if phone:
                    phone = _decrypt_contact_info(phone)
            
            if not phone:
                return {
                    "success": False,
                    "message": "No phone number found for this account. Please use email verification."
                }
            
            # Check rate limiting (max 5 attempts per day)
            attempts = user.get("smsVerificationAttempts", 0)
            last_sent = user.get("smsVerificationSentAt")
            
            # Reset attempts if last sent was more than 24 hours ago
            if last_sent:
                if isinstance(last_sent, str):
                    try:
                        last_sent = datetime.fromisoformat(last_sent.replace('Z', '+00:00'))
                    except:
                        last_sent = None
                
                if last_sent:
                    hours_since_last = (datetime.utcnow() - last_sent.replace(tzinfo=None)).total_seconds() / 3600
                    if hours_since_last >= 24:
                        attempts = 0
            
            if attempts >= 5:
                return {
                    "success": False,
                    "message": "Maximum SMS verification attempts reached. Please try again tomorrow or use email verification."
                }
            
            # Check cooldown (60 seconds between sends)
            if last_sent:
                if isinstance(last_sent, datetime):
                    seconds_since_last = (datetime.utcnow() - last_sent.replace(tzinfo=None)).total_seconds()
                    if seconds_since_last < 60:
                        wait_time = int(60 - seconds_since_last)
                        return {
                            "success": False,
                            "message": f"Please wait {wait_time} seconds before requesting another code."
                        }
            
            # Generate OTP
            otp_code = self.generate_otp(6)
            expires_at = datetime.utcnow() + timedelta(minutes=10)
            
            # Store OTP in database
            await self.otp_collection.delete_many({
                "username": username,
                "purpose": "account_verification",
                "verified": False
            })
            
            otp_doc = {
                "username": username,
                "phone": phone,
                "code": otp_code,
                "purpose": "account_verification",
                "attempts": 0,
                "max_attempts": 5,
                "expires_at": expires_at,
                "created_at": datetime.utcnow(),
                "verified": False
            }
            
            await self.otp_collection.insert_one(otp_doc)
            
            # Update user with attempt tracking
            await self.users_collection.update_one(
                {"username": user["username"]},
                {
                    "$set": {"smsVerificationSentAt": datetime.utcnow()},
                    "$inc": {"smsVerificationAttempts": 1}
                }
            )
            
            # Send SMS using the OTP code
            send_result = await self._send_sms(phone, otp_code, username)
            
            if send_result.get("success"):
                # Mask phone for response
                phone_masked = f"***{phone[-4:]}" if len(phone) >= 4 else "****"
                
                logger.info(f"📱 SMS verification code sent to {username} ({phone_masked})")
                return {
                    "success": True,
                    "message": f"Verification code sent to {phone_masked}",
                    "phone_masked": phone_masked,
                    "expires_in_minutes": 10
                }
            else:
                logger.error(f"❌ Failed to send SMS to {username}: {send_result.get('error')}")
                return {
                    "success": False,
                    "message": "Failed to send SMS. Please try email verification instead."
                }
            
        except Exception as e:
            logger.error(f"Error sending verification SMS: {e}")
            return {
                "success": False,
                "message": "An error occurred. Please try again."
            }
    
    async def _send_sms(self, phone: str, otp_code: str, username: str) -> Dict[str, Any]:
        """Internal method to send SMS via configured provider"""
        try:
            if self.otp_manager.sms_provider == "simpletexting":
                # Use send_otp method which is the correct API for SimpleTexting
                return await self.otp_manager.simpletexting_service.send_otp(
                    phone=phone,
                    otp=otp_code,
                    purpose="verification",
                    username=username
                )
            elif self.otp_manager.sms_provider == "twilio":
                message = f"[L3V3LMATCHES] Your verification code is {otp_code}. Valid for 10 minutes."
                return await self.otp_manager.sms_service.send_notification(phone, message)
            else:
                return {"success": False, "error": "No SMS provider configured"}
        except Exception as e:
            logger.error(f"SMS send error: {e}")
            return {"success": False, "error": str(e)}
    
    async def verify_sms_code(self, username: str, code: str) -> Dict[str, Any]:
        """
        Verify SMS OTP code and activate account
        
        Args:
            username: Username of the user
            code: OTP code entered by user
            
        Returns:
            Dictionary with success status and next step
        """
        try:
            # Find the OTP record
            otp_record = await self.otp_collection.find_one({
                "username": {"$regex": f"^{username}$", "$options": "i"},
                "purpose": "account_verification",
                "verified": False
            })
            
            if not otp_record:
                return {
                    "success": False,
                    "message": "No verification code found. Please request a new code."
                }
            
            # Check if expired
            if datetime.utcnow() > otp_record["expires_at"]:
                await self.otp_collection.delete_one({"_id": otp_record["_id"]})
                return {
                    "success": False,
                    "message": "Verification code has expired. Please request a new code."
                }
            
            # Check attempts
            if otp_record["attempts"] >= otp_record["max_attempts"]:
                await self.otp_collection.delete_one({"_id": otp_record["_id"]})
                return {
                    "success": False,
                    "message": "Too many incorrect attempts. Please request a new code."
                }
            
            # Verify code
            if otp_record["code"] != code:
                # Increment attempts
                await self.otp_collection.update_one(
                    {"_id": otp_record["_id"]},
                    {"$inc": {"attempts": 1}}
                )
                remaining = otp_record["max_attempts"] - otp_record["attempts"] - 1
                return {
                    "success": False,
                    "message": f"Invalid code. {remaining} attempts remaining."
                }
            
            # Code is valid - mark as verified
            await self.otp_collection.update_one(
                {"_id": otp_record["_id"]},
                {"$set": {"verified": True, "verified_at": datetime.utcnow()}}
            )
            
            # Update user - mark phone as verified and update account status
            user = await self.users_collection.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
            
            if user:
                update_fields = {
                    "phoneVerified": True,
                    "phoneVerifiedAt": datetime.utcnow(),
                    "emailVerified": True,  # Also mark email as verified since phone is verified
                    "emailVerifiedAt": datetime.utcnow()
                }
                
                # Update account status to pending admin approval
                current_status = user.get("accountStatus", "")
                if current_status in ["pending_email_verification", "pending_verification", ""]:
                    update_fields["accountStatus"] = "pending_admin_approval"
                    update_fields["adminApprovalStatus"] = "pending"
                
                await self.users_collection.update_one(
                    {"_id": user["_id"]},
                    {"$set": update_fields}
                )
                
                logger.info(f"✅ Phone verified for {username} - account status updated to pending_admin_approval")
                
                return {
                    "success": True,
                    "message": "Phone number verified successfully! Your account is now pending admin approval.",
                    "nextStep": "pending_admin_approval"
                }
            
            return {
                "success": False,
                "message": "User not found"
            }
            
        except Exception as e:
            logger.error(f"Error verifying SMS code: {e}")
            return {
                "success": False,
                "message": "An error occurred during verification. Please try again."
            }
    
    async def check_sms_availability(self, username: str) -> Dict[str, Any]:
        """
        Check if SMS verification is available for a user
        
        Args:
            username: Username to check
            
        Returns:
            Dictionary with availability status
        """
        if not self.enabled:
            return {
                "available": False,
                "reason": "SMS service not configured"
            }
        
        try:
            user = await self.users_collection.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
            
            if not user:
                return {
                    "available": False,
                    "reason": "User not found"
                }
            
            # Check if user has a phone number
            phone = user.get("contactNumber") or user.get("phone")
            if phone:
                phone = _decrypt_contact_info(phone)
            
            if not phone:
                return {
                    "available": False,
                    "reason": "No phone number on file"
                }
            
            # Check if already verified
            if user.get("phoneVerified") or user.get("emailVerified"):
                return {
                    "available": False,
                    "reason": "Account already verified"
                }
            
            # Mask phone for display
            phone_masked = f"***{phone[-4:]}" if len(phone) >= 4 else "****"
            
            return {
                "available": True,
                "phone_masked": phone_masked
            }
            
        except Exception as e:
            logger.error(f"Error checking SMS availability: {e}")
            return {
                "available": False,
                "reason": "Error checking availability"
            }
