"""
SMS Sender Service
Simple wrapper for sending SMS messages via the configured SMS provider
(SimpleTexting preferred, Twilio fallback).
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Try to import SimpleTexting (preferred provider)
try:
    from services.simpletexting_service import SimpleTextingService
    SIMPLETEXTING_AVAILABLE = True
except ImportError:
    SIMPLETEXTING_AVAILABLE = False
    logger.warning("SimpleTexting service not available")

# Try to import Twilio SMSService (fallback)
try:
    from services.sms_service import SMSService
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    logger.warning("Twilio SMS service not available")


async def send_sms(
    to_phone: str,
    message: str = "We would like to request additional information regarding your registration interest. Please provide your referred details so that we can process your request as soon as possible. If you have any questions, please contact admins. Thanks."
) -> Dict[str, Any]:
    """
    Send an SMS message to a phone number.

    Tries SimpleTexting first, then falls back to Twilio.

    Args:
        to_phone: Phone number to send to
        message: Message content to send

    Returns:
        Dictionary with success status and any error details
    """
    if not to_phone:
        return {"success": False, "error": "No phone number provided"}

    # Try SimpleTexting first (preferred provider in production)
    if SIMPLETEXTING_AVAILABLE:
        try:
            service = SimpleTextingService()
            if service.enabled:
                result = await service.send_notification(phone=to_phone, message=message)
                # send_notification returns dict with success key
                if isinstance(result, dict):
                    return result
                # Defensive: handle bool return
                return {"success": bool(result), "provider": "simpletexting"}
            else:
                logger.warning("SimpleTexting not enabled, trying Twilio fallback")
        except Exception as e:
            logger.error(f"SimpleTexting failed, trying Twilio: {e}")

    # Fallback to Twilio
    if TWILIO_AVAILABLE:
        try:
            service = SMSService()
            if service.enabled:
                result = await service.send_notification(phone=to_phone, message=message)
                if isinstance(result, dict):
                    return result
                return {"success": bool(result), "provider": "twilio"}
            else:
                return {"success": False, "error": "Twilio SMS service not configured"}
        except Exception as e:
            logger.error(f"Twilio SMS failed: {e}")
            return {"success": False, "error": f"Twilio error: {str(e)}"}

    return {
        "success": False,
        "error": "No SMS provider configured (SimpleTexting and Twilio both unavailable)"
    }
