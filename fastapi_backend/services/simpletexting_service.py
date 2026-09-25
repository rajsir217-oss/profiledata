"""
SimpleTexting SMS Service
Clean, business-focused SMS API for US & Canada
"""

import logging
import re
from typing import Any, Dict
import httpx
from config import settings
from services.phone_utils import normalize_phone_for_sms

logger = logging.getLogger(__name__)

# SimpleTexting link-tracking markup: [url=<link>]. URLs wrapped this way get
# shortened (txt.so) and click-tracked by SimpleTexting.
_URL_MARKUP_RE = re.compile(r"(\[url=[^\]]*\])", re.IGNORECASE)
# Negative lookbehind on the bare-domain alternatives prevents matching inside
# an email address (e.g. "support@l3v3lmatches.com" must stay untouched).
# Comma is excluded from the continuation charset (not just trimmed off the
# end) so a URL glued to trailing text with no space (e.g. "...com/x,thanks")
# can't swallow that text into the markup - it stops at the comma instead.
_URL_RE = re.compile(
    r"https?://[^\s\],]+"
    r"|(?<![\w@.])www\.[^\s\],]+"
    r"|(?<![\w@.])l3v3lmatches\.com[^\s\],]*",
    re.IGNORECASE,
)
_TRAILING_PUNCT = ".,;:!?)'\""


def wrap_urls_for_tracking(text: str) -> str:
    """Wrap bare URLs in [url=...] markup; existing markup is left untouched."""
    def _wrap(match: re.Match) -> str:
        url = match.group(0)
        tail = ""
        while url and url[-1] in _TRAILING_PUNCT:
            tail = url[-1] + tail
            url = url[:-1]
        if not url:
            return match.group(0)
        href = url if url[:4].lower() == "http" else f"https://{url}"
        return f"[url={href}]{tail}"

    # Split keeps [url=...] spans at odd indices so we never double-wrap
    parts = _URL_MARKUP_RE.split(text)
    return "".join(
        part if i % 2 else _URL_RE.sub(_wrap, part)
        for i, part in enumerate(parts)
    )


class SimpleTextingService:
    """Service for sending SMS via SimpleTexting API v2"""
    
    def __init__(self):
        """Initialize SimpleTexting service"""
        self.api_token = settings.simpletexting_api_token
        self.account_phone = settings.simpletexting_account_phone
        self.base_url = "https://api-app2.simpletexting.com/v2"
        self.enabled = bool(self.api_token and self.account_phone)
        
        if self.enabled:
            logger.info(f"✅ SimpleTexting SMS Service initialized (Phone: {self.account_phone[:5]}***)")
        else:
            logger.warning("⚠️  SimpleTexting SMS Service disabled - missing API token or account phone")
    
    async def _send_text(self, formatted_phone: str, text: str) -> Dict[str, Any]:
        """POST a message to the SimpleTexting messages endpoint."""
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "contactPhone": formatted_phone,
            "accountPhone": self.account_phone,
            "text": wrap_urls_for_tracking(text),
            "mode": "AUTO"  # Let SimpleTexting choose SMS/MMS automatically
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/messages",
                    headers=headers,
                    json=payload
                )
            
            if response.status_code in (200, 201):
                result = response.json()
                logger.info(f"✅ SimpleTexting SMS sent to {formatted_phone[:3]}***{formatted_phone[-2:]}")
                logger.debug(f"SimpleTexting API Response: {result}")
                return {
                    "success": True,
                    "message_id": result.get("data", {}).get("id", "unknown"),
                    "provider": "simpletexting",
                    "api_response": result
                }
            
            error_msg = response.text
            error_code = None
            error_details = None
            try:
                error_json = response.json()
                if isinstance(error_json, dict):
                    error_code = error_json.get("errorCode")
                    error_details = (
                        error_json.get("message")
                        or error_json.get("error")
                        or error_json.get("detail")
                        or str(error_json)
                    )
            except ValueError:
                pass
            
            # TEST_SEND_LIMIT_EXCEEDED means the account is in trial/test mode and
            # has hit its daily cap - messages are NOT delivered. Surface clearly.
            if error_code == "TEST_SEND_LIMIT_EXCEEDED":
                logger.error(
                    "❌ SimpleTexting TEST MODE limit reached - SMS NOT delivered! "
                    "Account is in trial/test mode (daily limit: 100). "
                    "Upgrade the SimpleTexting account to a paid plan to send real messages. "
                    "Details: %s",
                    error_details,
                )
            else:
                logger.error(
                    "❌ SimpleTexting API error: %s (errorCode=%s) - %s",
                    response.status_code,
                    error_code,
                    error_details or error_msg,
                )
            return {
                "success": False,
                "error": f"SimpleTexting API error: {response.status_code}",
                "error_code": error_code,
                "details": error_details or error_msg,
                "status_code": response.status_code,
            }
        
        except httpx.TimeoutException:
            logger.error("❌ SimpleTexting API timeout")
            return {"success": False, "error": "SimpleTexting API timeout"}
        except httpx.HTTPError as e:
            logger.error(f"❌ SimpleTexting HTTP error: {str(e)}")
            return {"success": False, "error": f"HTTP error: {str(e)}"}
        except Exception as e:
            logger.error(f"❌ Unexpected SimpleTexting error: {str(e)}", exc_info=True)
            return {"success": False, "error": f"Unexpected error: {str(e)}"}
    
    async def send_otp(
        self,
        phone: str,
        otp: str,
        purpose: str = "verification",
        username: str = None
    ) -> Dict[str, Any]:
        """
        Send OTP code via SimpleTexting SMS
        
        Args:
            phone: Phone number in any format
            otp: OTP code to send
            purpose: Purpose of OTP (verification, mfa, password_reset)
            username: Username/profile identifier (included in message for clarity)
        
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
        
        formatted_phone = normalize_phone_for_sms(phone)
        if not formatted_phone:
            logger.warning("SimpleTexting SMS not sent - invalid or empty phone after normalization")
            return {
                "success": False,
                "error": "Invalid phone number"
            }
        
        # Include L3V3LMATCHES branding and username in message
        profile_prefix = f"[L3V3LMATCHES | {username}] " if username else "[L3V3LMATCHES] "
        
        # Create message based on purpose
        if purpose == "verification":
            message_text = (
                f"{profile_prefix}Your verification code is: {otp}\n\n"
                f"This code will expire in 10 minutes.\n"
                f"Do not share this code with anyone."
            )
        elif purpose == "mfa":
            message_text = (
                f"{profile_prefix}Login code: {otp}\n\n"
                f"Expires in 5 minutes.\n"
                f"Didn't request this? Ignore this message."
            )
        elif purpose == "password_reset":
            message_text = (
                f"{profile_prefix}Password reset code: {otp}\n\n"
                f"Expires in 15 minutes.\n"
                f"Didn't request this? Secure your account."
            )
        else:
            message_text = f"{profile_prefix}Your code is: {otp}"
        
        return await self._send_text(formatted_phone, message_text)
    
    async def send_notification(
        self,
        phone: str,
        message: str
    ) -> Dict[str, Any]:
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
        
        formatted_phone = normalize_phone_for_sms(phone)
        if not formatted_phone:
            logger.warning("SimpleTexting notification not sent - invalid or empty phone after normalization")
            return {
                "success": False,
                "error": "Invalid phone number"
            }
        
        return await self._send_text(formatted_phone, message)
