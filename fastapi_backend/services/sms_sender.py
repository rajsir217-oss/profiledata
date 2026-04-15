"""
SMS Sender Service
Simple wrapper for sending SMS messages via the configured SMS provider.
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Import SMS service
try:
    from services.sms_service import SMSManager
    SMS_AVAILABLE = True
except ImportError:
    SMS_AVAILABLE = False
    logger.warning("SMS service not available")


async def send_sms(
    to_phone: str,
    message: str = "We would like to request additional information regarding your registration interest. Please provide your referred details so that we can process your request as soon as possible. If you have any questions, please contact admins. Thanks."
) -> Dict[str, Any]:
    """
    Send an SMS message to a phone number.
    
    Args:
        to_phone: Phone number to send to
        message: Message content to send (default provided)
    
    Returns:
        Dictionary with success status and any error details
    """
    if not SMS_AVAILABLE:
        return {
            "success": False,
            "error": "SMS service not available"
        }
    
    try:
        # Initialize SMS manager
        sms_manager = SMSManager()
        
        if not sms_manager.enabled:
            return {
                "success": False,
                "error": "SMS provider not configured"
            }
        
        # Send the message using the notification method
        result = await sms_manager.send_notification(
            phone=to_phone,
            message=message
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")
        return {
            "success": False,
            "error": str(e)
        }
