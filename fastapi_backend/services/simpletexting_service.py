"""
SimpleTexting SMS Service
Clean, business-focused SMS API for US & Canada
"""

import logging
import os
from typing import Dict
import httpx

logger = logging.getLogger(__name__)


class SimpleTextingService:
    """Service for sending SMS via SimpleTexting API v2"""
    
    def __init__(self):
        """Initialize SimpleTexting service"""
        self.api_token = os.getenv("SIMPLETEXTING_API_TOKEN")
        self.account_phone = os.getenv("SIMPLETEXTING_ACCOUNT_PHONE")  # Your SimpleTexting number
        self.base_url = "https://api-app2.simpletexting.com/v2"
        self.enabled = bool(self.api_token and self.account_phone)
        
        if self.enabled:
            logger.info(f"✅ SimpleTexting SMS Service initialized (Phone: {self.account_phone[:5]}***)")
        else:
            logger.warning("⚠️  SimpleTexting SMS Service disabled - missing API token or account phone")
    
    async def send_otp(
        self,
        phone: str,
        otp: str,
        purpose: str = "verification"
    ) -> Dict[str, any]:
        """
        Send OTP code via SimpleTexting SMS
        
        Args:
            phone: Phone number in any format
            otp: OTP code to send
            purpose: Purpose of OTP (verification, mfa, password_reset)
        
        Returns:
            Dict with success status and message details
        """
        if not self.enabled:
            logger.warning(f"SimpleTexting SMS not sent - service disabled (phone: {phone})")
            return {
                "success": False,
                "error": "SimpleTexting SMS service not configured",
                "mock_code": otp  # For development
            }
        
        try:
            # Format phone number (remove +1 if present, SimpleTexting wants just digits for US)
            formatted_phone = phone.replace("+", "").replace("-", "").replace(" ", "")
            if formatted_phone.startswith("1") and len(formatted_phone) == 11:
                formatted_phone = formatted_phone[1:]  # Remove leading 1 for US numbers
            
            # Create message based on purpose
            if purpose == "verification":
                message_text = (
                    f"Your verification code is: {otp}\n\n"
                    f"This code will expire in 10 minutes.\n"
                    f"Do not share this code with anyone."
                )
            elif purpose == "mfa":
                message_text = (
                    f"Your login code is: {otp}\n\n"
                    f"This code will expire in 5 minutes.\n"
                    f"If you didn't request this, ignore this message."
                )
            elif purpose == "password_reset":
                message_text = (
                    f"Your password reset code is: {otp}\n\n"
                    f"This code will expire in 15 minutes.\n"
                    f"If you didn't request this, please secure your account."
                )
            else:
                message_text = f"Your code is: {otp}"
            
            # Prepare API request
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "contactPhone": formatted_phone,
                "accountPhone": self.account_phone,
                "text": message_text,
                "mode": "AUTO"  # Let SimpleTexting choose SMS/MMS automatically
            }
            
            # Send SMS via SimpleTexting API
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/messages",
                    headers=headers,
                    json=payload
                )
                
                # Check response
                if response.status_code == 200 or response.status_code == 201:
                    result = response.json()
                    message_id = result.get("data", {}).get("id", "unknown")
                    
                    logger.info(f"✅ SimpleTexting SMS sent to {formatted_phone[:3]}***{formatted_phone[-2:]}")
                    
                    return {
                        "success": True,
                        "message_id": message_id,
                        "provider": "simpletexting"
                    }
                else:
                    error_msg = response.text
                    logger.error(f"❌ SimpleTexting API error: {response.status_code} - {error_msg}")
                    return {
                        "success": False,
                        "error": f"SimpleTexting API error: {response.status_code}",
                        "details": error_msg
                    }
        
        except httpx.TimeoutException:
            logger.error("❌ SimpleTexting API timeout")
            return {
                "success": False,
                "error": "SimpleTexting API timeout"
            }
        
        except httpx.HTTPError as e:
            logger.error(f"❌ SimpleTexting HTTP error: {str(e)}")
            return {
                "success": False,
                "error": f"HTTP error: {str(e)}"
            }
        
        except Exception as e:
            logger.error(f"❌ Unexpected SimpleTexting error: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }
    
    async def send_notification(
        self,
        phone: str,
        message: str
    ) -> Dict[str, any]:
        """
        Send a general notification SMS via SimpleTexting
        
        Args:
            phone: Phone number
            message: Message to send
        
        Returns:
            Dict with success status
        """
        if not self.enabled:
            logger.warning(f"SimpleTexting SMS notification not sent - service disabled")
            return {
                "success": False,
                "error": "SimpleTexting SMS service not configured"
            }
        
        try:
            # Format phone number
            formatted_phone = phone.replace("+", "").replace("-", "").replace(" ", "")
            if formatted_phone.startswith("1") and len(formatted_phone) == 11:
                formatted_phone = formatted_phone[1:]
            
            # Prepare API request
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "contactPhone": formatted_phone,
                "accountPhone": self.account_phone,
                "text": message,
                "mode": "AUTO"
            }
            
            # Send SMS
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/messages",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200 or response.status_code == 201:
                    logger.info(f"✅ SimpleTexting notification sent to {formatted_phone[:3]}***")
                    return {
                        "success": True,
                        "message_id": response.json().get("data", {}).get("id", "unknown"),
                        "provider": "simpletexting"
                    }
                else:
                    logger.error(f"❌ SimpleTexting API error: {response.status_code}")
                    return {
                        "success": False,
                        "error": f"SimpleTexting API error: {response.status_code}"
                    }
        
        except Exception as e:
            logger.error(f"❌ SimpleTexting notification error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def format_phone_number(self, phone: str) -> str:
        """
        Format phone number for SimpleTexting (10 digits for US)
        
        Args:
            phone: Phone number in any format
        
        Returns:
            Formatted 10-digit phone number
        """
        # Remove all non-digit characters
        digits = ''.join(filter(str.isdigit, phone))
        
        # Remove leading 1 for US numbers
        if digits.startswith('1') and len(digits) == 11:
            digits = digits[1:]
        
        return digits
