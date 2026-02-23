"""
PayPal Direct Checkout Service

Handles PayPal payment processing using PayPal's REST API.
Supports sandbox testing and live production payments.
"""

import httpx
import base64
from typing import Optional, Dict, Any
from config import settings
import logging

logger = logging.getLogger(__name__)


class PayPalService:
    """Service for handling direct PayPal payments."""
    
    SANDBOX_API_URL = "https://api-m.sandbox.paypal.com"
    LIVE_API_URL = "https://api-m.paypal.com"
    
    def __init__(self):
        self.client_id = settings.paypal_client_id
        self.client_secret = settings.paypal_client_secret
        self.mode = settings.paypal_mode or "sandbox"
        self.api_url = self.LIVE_API_URL if self.mode == "live" else self.SANDBOX_API_URL
        self._access_token = None
        self._token_expires_at = 0
        
        if self.is_configured():
            logger.info(f"PayPal service initialized in {self.mode} mode")
        else:
            logger.warning("PayPal credentials not configured. PayPal payments disabled.")
    
    def is_configured(self) -> bool:
        """Check if PayPal is properly configured."""
        return bool(self.client_id and self.client_secret)
    
    async def _get_access_token(self) -> Optional[str]:
        """Get OAuth 2.0 access token from PayPal."""
        if not self.is_configured():
            return None
        
        try:
            # Create Basic Auth header
            credentials = f"{self.client_id}:{self.client_secret}"
            encoded_credentials = base64.b64encode(credentials.encode()).decode()
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/v1/oauth2/token",
                    headers={
                        "Authorization": f"Basic {encoded_credentials}",
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    data={"grant_type": "client_credentials"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self._access_token = data.get("access_token")
                    return self._access_token
                else:
                    logger.error(f"Failed to get PayPal access token: {response.text}")
                    return None
        except Exception as e:
            logger.error(f"Error getting PayPal access token: {e}")
            return None
    
    async def create_setup_token(self, description: str) -> Dict[str, Any]:
        """
        Create a PayPal setup token for storing payment methods.
        
        Args:
            description: Description of the setup token
            
        Returns:
            Dict with setup token details
        """
        if not self.is_configured():
            return {"success": False, "error": "PayPal not configured"}
        
        access_token = await self._get_access_token()
        if not access_token:
            return {"success": False, "error": "Failed to authenticate with PayPal"}
        
        try:
            setup_data = {
                "payment_source": {
                    "paypal": {
                        "experience_context": {
                            "brand_name": "L3V3L MATCHES",
                            "locale": "en-US",
                            "shipping_preference": "NO_SHIPPING",
                            "user_action": "CONTINUE",
                            "return_url": f"{settings.frontend_url}/paypal-recurring-return",
                            "cancel_url": f"{settings.frontend_url}/contribution/cancel"
                        }
                    }
                }
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/v1/vault/setup-tokens",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "Accept-Language": "en_US"
                    },
                    json=setup_data
                )
                
                if response.status_code in [200, 201]:
                    try:
                        data = response.json()
                        setup_token_id = data.get("id")
                        
                        logger.info(f"PayPal setup token created: {setup_token_id}")
                        return {
                            "success": True,
                            "setup_token_id": setup_token_id,
                            "status": "CREATED",
                            "raw_response": data
                        }
                    except Exception as json_error:
                        logger.error(f"Failed to parse PayPal response: {response.text}")
                        return {"success": False, "error": "Invalid response from PayPal"}
                else:
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("message", response.text)
                        
                        # Check for specific error details
                        details = error_data.get("details", [])
                        if details:
                            error_msg = details[0].get("description", error_msg)
                    except:
                        error_msg = response.text
                    
                    logger.error(f"Failed to create PayPal setup token: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
        except Exception as e:
            logger.error(f"Error creating PayPal setup token: {e}")
            return {"success": False, "error": str(e)}

    async def create_payment_token(self, setup_token_id: str) -> Dict[str, Any]:
        """
        Create a PayPal payment token from a setup token.
        
        Args:
            setup_token_id: The setup token ID from PayPal approval
            
        Returns:
            Dict with payment token details
        """
        if not self.is_configured():
            return {"success": False, "error": "PayPal not configured"}
        
        access_token = await self._get_access_token()
        if not access_token:
            return {"success": False, "error": "Failed to authenticate with PayPal"}
        
        try:
            payment_data = {
                "setup_token": setup_token_id
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/v1/vault/payment-tokens",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "Accept-Language": "en_US"
                    },
                    json=payment_data
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    payment_token_id = data.get("id")
                    payment_source = data.get("payment_source")
                    
                    logger.info(f"PayPal payment token created: {payment_token_id}")
                    return {
                        "success": True,
                        "payment_token_id": payment_token_id,
                        "payment_source": payment_source,
                        "status": "CREATED",
                        "raw_response": data
                    }
                else:
                    error_data = response.json()
                    error_msg = error_data.get("message", response.text)
                    
                    # Check for specific error details
                    details = error_data.get("details", [])
                    if details:
                        error_msg = details[0].get("description", error_msg)
                    
                    logger.error(f"Failed to create PayPal payment token: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
        except Exception as e:
            logger.error(f"Error creating PayPal payment token: {e}")
            return {"success": False, "error": str(e)}

    async def create_order(
        self,
        amount: str,
        currency: str = "USD",
        description: str = "",
        custom_id: Optional[str] = None,
        return_url: Optional[str] = None,
        cancel_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a PayPal order for checkout.
        
        Args:
            amount: Amount in dollars (e.g., "29.99")
            currency: Currency code (default: USD)
            description: Order description
            custom_id: Your internal order/reference ID
            return_url: URL to redirect after approval
            cancel_url: URL to redirect if cancelled
            
        Returns:
            Dict with order_id, approval_url, and status
        """
        if not self.is_configured():
            return {"success": False, "error": "PayPal not configured"}
        
        access_token = await self._get_access_token()
        if not access_token:
            return {"success": False, "error": "Failed to authenticate with PayPal"}
        
        try:
            order_data = {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "amount": {
                        "currency_code": currency,
                        "value": amount
                    },
                    "description": description
                }]
            }
            
            if custom_id:
                order_data["purchase_units"][0]["custom_id"] = custom_id
            
            # Add application context for redirects (used in redirect flow)
            if return_url and cancel_url:
                order_data["application_context"] = {
                    "return_url": return_url,
                    "cancel_url": cancel_url,
                    "brand_name": "L3V3L MATCHES",
                    "landing_page": "LOGIN",
                    "user_action": "PAY_NOW"
                }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/v2/checkout/orders",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json=order_data
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    order_id = data.get("id")
                    
                    # Find approval URL
                    approval_url = None
                    for link in data.get("links", []):
                        if link.get("rel") == "approve":
                            approval_url = link.get("href")
                            break
                    
                    logger.info(f"PayPal order created: {order_id}")
                    return {
                        "success": True,
                        "order_id": order_id,
                        "approval_url": approval_url,
                        "status": data.get("status")
                    }
                else:
                    error_data = response.json()
                    error_msg = error_data.get("message", response.text)
                    logger.error(f"Failed to create PayPal order: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
        except Exception as e:
            logger.error(f"Error creating PayPal order: {e}")
            return {"success": False, "error": str(e)}
    
    async def capture_order(self, order_id: str) -> Dict[str, Any]:
        """
        Capture payment for an approved order.
        
        Args:
            order_id: The PayPal order ID to capture
            
        Returns:
            Dict with capture details
        """
        if not self.is_configured():
            return {"success": False, "error": "PayPal not configured"}
        
        access_token = await self._get_access_token()
        if not access_token:
            return {"success": False, "error": "Failed to authenticate with PayPal"}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/v2/checkout/orders/{order_id}/capture",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    status = data.get("status")
                    
                    # Extract capture details
                    capture_id = None
                    amount = None
                    payer_email = data.get("payer", {}).get("email_address")
                    
                    purchase_units = data.get("purchase_units", [])
                    if purchase_units:
                        captures = purchase_units[0].get("payments", {}).get("captures", [])
                        if captures:
                            capture_id = captures[0].get("id")
                            amount = captures[0].get("amount", {}).get("value")
                    
                    logger.info(f"PayPal order captured: {order_id}, capture_id: {capture_id}")
                    return {
                        "success": True,
                        "order_id": order_id,
                        "capture_id": capture_id,
                        "status": status,
                        "amount": amount,
                        "payer_email": payer_email,
                        "raw_response": data
                    }
                else:
                    error_data = response.json()
                    error_msg = error_data.get("message", response.text)
                    
                    # Check for specific error details
                    details = error_data.get("details", [])
                    if details:
                        error_msg = details[0].get("description", error_msg)
                    
                    logger.error(f"Failed to capture PayPal order: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
        except Exception as e:
            logger.error(f"Error capturing PayPal order: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_order_details(self, order_id: str) -> Dict[str, Any]:
        """Get details of a PayPal order."""
        if not self.is_configured():
            return {"success": False, "error": "PayPal not configured"}
        
        access_token = await self._get_access_token()
        if not access_token:
            return {"success": False, "error": "Failed to authenticate with PayPal"}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.api_url}/v2/checkout/orders/{order_id}",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {"success": True, "order": data}
                else:
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.error(f"Error getting PayPal order details: {e}")
            return {"success": False, "error": str(e)}
    
    async def refund_capture(
        self,
        capture_id: str,
        amount: Optional[str] = None,
        currency: str = "USD",
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Refund a captured payment (full or partial).
        
        Args:
            capture_id: The capture ID to refund
            amount: Optional partial refund amount (full refund if not specified)
            currency: Currency code
            note: Optional note to payer
            
        Returns:
            Dict with refund details
        """
        if not self.is_configured():
            return {"success": False, "error": "PayPal not configured"}
        
        access_token = await self._get_access_token()
        if not access_token:
            return {"success": False, "error": "Failed to authenticate with PayPal"}
        
        try:
            refund_data = {}
            
            if amount:
                refund_data["amount"] = {
                    "value": amount,
                    "currency_code": currency
                }
            
            if note:
                refund_data["note_to_payer"] = note
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/v2/payments/captures/{capture_id}/refund",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json=refund_data if refund_data else None
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    logger.info(f"PayPal refund successful: {data.get('id')}")
                    return {
                        "success": True,
                        "refund_id": data.get("id"),
                        "status": data.get("status"),
                        "amount": data.get("amount", {}).get("value")
                    }
                else:
                    error_data = response.json()
                    error_msg = error_data.get("message", response.text)
                    logger.error(f"PayPal refund failed: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
        except Exception as e:
            logger.error(f"Error processing PayPal refund: {e}")
            return {"success": False, "error": str(e)}
    
    def get_client_id(self) -> Optional[str]:
        """Get the PayPal client ID for frontend SDK."""
        return self.client_id if self.is_configured() else None


# Singleton instance
paypal_service = PayPalService()
