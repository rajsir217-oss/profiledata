"""
Clover Hosted Checkout Service

Handles payment processing via Clover's Hosted Checkout API.
Creates checkout sessions that redirect users to a Clover-hosted payment page.
"""

import httpx
from typing import Optional, Dict, Any
from config import settings
import logging

logger = logging.getLogger(__name__)


class CloverService:
    """Service for handling Clover Hosted Checkout payments."""
    
    SANDBOX_API_URL = "https://apisandbox.dev.clover.com"
    PRODUCTION_API_URL = "https://api.clover.com"
    
    def __init__(self):
        self.private_token = settings.clover_private_token
        self.merchant_id = settings.clover_merchant_id
        self.environment = settings.clover_environment or "production"
        self.api_url = self.PRODUCTION_API_URL if self.environment == "production" else self.SANDBOX_API_URL
        
        if self.is_configured():
            logger.info(f"Clover service initialized in {self.environment} mode (MID: {self.merchant_id})")
        else:
            logger.warning("Clover credentials not configured. Clover payments disabled.")
    
    def is_configured(self) -> bool:
        """Check if Clover is properly configured."""
        return bool(self.private_token and self.merchant_id)
    
    async def create_checkout_session(
        self,
        amount_cents: int,
        description: str,
        customer_email: Optional[str] = None,
        customer_first_name: Optional[str] = None,
        customer_last_name: Optional[str] = None,
        success_url: Optional[str] = None,
        failure_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a Clover Hosted Checkout session.
        
        Args:
            amount_cents: Amount in cents (e.g., 2500 for $25.00)
            description: Line item description
            customer_email: Optional customer email
            customer_first_name: Optional customer first name
            customer_last_name: Optional customer last name
            success_url: URL to redirect on successful payment
            failure_url: URL to redirect on failed payment
            
        Returns:
            Dict with checkout URL, session ID, and expiration
        """
        if not self.is_configured():
            return {"success": False, "error": "Clover not configured"}
        
        try:
            # Build the checkout request payload
            payload = {
                "shoppingCart": {
                    "lineItems": [
                        {
                            "name": description,
                            "price": amount_cents,
                            "unitQty": 1
                        }
                    ]
                }
            }
            
            # Add customer info if available (only non-empty values)
            customer = {}
            if customer_email and customer_email.strip():
                customer["email"] = customer_email.strip()
            if customer_first_name and customer_first_name.strip():
                customer["firstName"] = customer_first_name.strip()
            if customer_last_name and customer_last_name.strip():
                customer["lastName"] = customer_last_name.strip()
            if customer:
                payload["customer"] = customer
            
            # Add redirect URLs if provided
            if success_url or failure_url:
                payload["redirectUrls"] = {}
                if success_url:
                    payload["redirectUrls"]["success"] = success_url
                if failure_url:
                    payload["redirectUrls"]["failure"] = failure_url
            
            checkout_url = f"{self.api_url}/invoicingcheckoutservice/v1/checkouts"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    checkout_url,
                    headers={
                        "Authorization": f"Bearer {self.private_token}",
                        "X-Clover-Merchant-Id": self.merchant_id,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    json=payload
                )
                
                logger.info(
                    f"Clover API request: URL={checkout_url}, "
                    f"MID={self.merchant_id}, payload={payload}"
                )
                logger.info(f"Clover API response: status={response.status_code}, body={response.text}")
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    checkout_href = data.get("href")
                    session_id = data.get("checkoutSessionId")
                    expiration = data.get("expirationTime")
                    
                    logger.info(
                        f"Clover checkout session created: {session_id} "
                        f"(amount: ${amount_cents / 100:.2f}, expires: {expiration})"
                    )
                    
                    return {
                        "success": True,
                        "checkout_url": checkout_href,
                        "session_id": session_id,
                        "expiration_time": expiration,
                        "created_time": data.get("createdTime")
                    }
                else:
                    error_text = response.text
                    try:
                        error_data = response.json()
                        error_text = error_data.get("message", error_text)
                    except Exception:
                        pass
                    
                    logger.error(
                        f"Clover checkout session creation failed "
                        f"(status {response.status_code}): {error_text}"
                    )
                    return {
                        "success": False,
                        "error": f"Clover API error: {error_text}",
                        "status_code": response.status_code
                    }
                    
        except httpx.TimeoutException:
            logger.error("Clover API request timed out")
            return {"success": False, "error": "Clover API request timed out"}
        except Exception as e:
            logger.error(f"Error creating Clover checkout session: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
clover_service = CloverService()
