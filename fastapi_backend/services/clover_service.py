"""
Clover Payment Service

Handles payment processing via Clover's Ecommerce API.
Supports both Hosted Checkout sessions and iframe SDK card charges.
"""

import httpx
import uuid
from typing import Optional, Dict, Any
from config import settings
import logging

logger = logging.getLogger(__name__)


class CloverService:
    """Service for handling Clover payments (Hosted Checkout + iframe SDK charges)."""
    
    SANDBOX_API_URL = "https://apisandbox.dev.clover.com"
    PRODUCTION_API_URL = "https://api.clover.com"
    SANDBOX_CHARGE_URL = "https://scl-sandbox.dev.clover.com"
    PRODUCTION_CHARGE_URL = "https://scl.clover.com"
    SANDBOX_SDK_URL = "https://checkout.sandbox.dev.clover.com/sdk.js"
    PRODUCTION_SDK_URL = "https://checkout.clover.com/sdk.js"
    
    def __init__(self):
        self.private_token = settings.clover_private_token
        self.merchant_id = settings.clover_merchant_id
        self.public_key = settings.clover_public_key
        self.environment = settings.clover_environment or "production"
        self.api_url = self.PRODUCTION_API_URL if self.environment == "production" else self.SANDBOX_API_URL
        self.charge_url = self.PRODUCTION_CHARGE_URL if self.environment == "production" else self.SANDBOX_CHARGE_URL
        self.sdk_url = self.PRODUCTION_SDK_URL if self.environment == "production" else self.SANDBOX_SDK_URL
        
        if self.is_configured():
            logger.info(f"Clover service initialized in {self.environment} mode (MID: {self.merchant_id})")
        else:
            logger.warning("Clover credentials not configured. Clover payments disabled.")
    
    def is_configured(self) -> bool:
        """Check if Clover is properly configured."""
        return bool(self.private_token and self.merchant_id)
    
    def get_public_config(self) -> Dict[str, Any]:
        """Return safe-to-expose config for the frontend SDK."""
        return {
            "public_key": self.public_key,
            "merchant_id": self.merchant_id,
            "sdk_url": self.sdk_url,
            "environment": self.environment,
        }
    
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


    async def create_charge(
        self,
        source_token: str,
        amount_cents: int,
        currency: str = "usd",
        description: Optional[str] = None,
        customer_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a charge using a Clover card token from the iframe SDK.
        
        Args:
            source_token: The clv_ token from clover.createToken()
            amount_cents: Amount in cents (e.g., 500 for $5.00)
            currency: Currency code (default: usd)
            description: Optional charge description
            customer_email: Optional email for receipt
            
        Returns:
            Dict with charge result
        """
        if not self.is_configured():
            return {"success": False, "error": "Clover not configured"}
        
        try:
            charge_endpoint = f"{self.charge_url}/v1/charges"
            idempotency_key = str(uuid.uuid4())
            
            payload = {
                "amount": amount_cents,
                "currency": currency,
                "source": source_token,
            }
            if description:
                payload["description"] = description
            if customer_email:
                payload["receipt_email"] = customer_email
            
            logger.info(
                f"Clover charge request: amount={amount_cents}, "
                f"source={source_token[:20]}..., idempotency={idempotency_key}"
            )
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    charge_endpoint,
                    headers={
                        "Authorization": f"Bearer {self.private_token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "idempotency-key": idempotency_key,
                    },
                    json=payload,
                )
                
                logger.info(f"Clover charge response: status={response.status_code}, body={response.text}")
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    charge_id = data.get("id")
                    status = data.get("status")
                    
                    logger.info(
                        f"Clover charge successful: {charge_id} "
                        f"(amount: ${amount_cents / 100:.2f}, status: {status})"
                    )
                    
                    return {
                        "success": True,
                        "charge_id": charge_id,
                        "status": status,
                        "amount": data.get("amount"),
                        "currency": data.get("currency"),
                    }
                else:
                    error_text = response.text
                    try:
                        error_data = response.json()
                        error_text = error_data.get("message", error_text)
                    except Exception:
                        pass
                    
                    logger.error(
                        f"Clover charge failed "
                        f"(status {response.status_code}): {error_text}"
                    )
                    return {
                        "success": False,
                        "error": f"Clover charge error: {error_text}",
                        "status_code": response.status_code,
                    }
                    
        except httpx.TimeoutException:
            logger.error("Clover charge request timed out")
            return {"success": False, "error": "Clover charge request timed out"}
        except Exception as e:
            logger.error(f"Error creating Clover charge: {e}")
            return {"success": False, "error": str(e)}


    async def get_charge(self, charge_id: str) -> Dict[str, Any]:
        """
        Retrieve a Clover charge by ID. Used for server-side payment
        verification before granting access to paid resources.

        Returns dict with success, status, amount (cents), currency on success.
        """
        if not self.is_configured():
            return {"success": False, "error": "Clover not configured"}

        if not charge_id or not isinstance(charge_id, str):
            return {"success": False, "error": "Invalid charge id"}

        try:
            endpoint = f"{self.charge_url}/v1/charges/{charge_id}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {self.private_token}",
                        "Accept": "application/json",
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    # Clover's get-a-charge endpoint can return either a flat
                    # charge object or a list-wrapped response of the form
                    # {"object": "list", "data": [ {...} ]}. Normalize both.
                    charge = data
                    if isinstance(data, dict) and isinstance(data.get("data"), list):
                        charge = data["data"][0] if data["data"] else {}
                    return {
                        "success": True,
                        "charge_id": charge.get("id"),
                        "status": charge.get("status"),
                        "amount": charge.get("amount"),
                        "currency": charge.get("currency"),
                        "paid": charge.get("paid"),
                    }

                error_text = response.text
                try:
                    error_data = response.json()
                    error_text = error_data.get("message", error_text)
                except Exception:
                    pass

                logger.warning(
                    f"Clover get_charge failed (status {response.status_code}): {error_text}"
                )
                return {
                    "success": False,
                    "error": error_text,
                    "status_code": response.status_code,
                }

        except httpx.TimeoutException:
            logger.error("Clover get_charge request timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Error retrieving Clover charge: {e}")
            return {"success": False, "error": str(e)}

    async def create_customer(
        self,
        source_token: str,
        email: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a Clover customer with a card on file using a single-use token.
        This stores the card securely on Clover's side for future recurring charges.
        
        Args:
            source_token: The clv_ token from clover.createToken()
            email: Customer email
            first_name: Customer first name
            last_name: Customer last name
            
        Returns:
            Dict with customer_id and card details
        """
        if not self.is_configured():
            return {"success": False, "error": "Clover not configured"}
        
        try:
            customer_endpoint = f"{self.charge_url}/v1/customers"
            
            payload = {
                "source": source_token,
            }
            if email:
                payload["email"] = email
            if first_name:
                payload["firstName"] = first_name
            if last_name:
                payload["lastName"] = last_name
            
            logger.info(
                f"Clover create customer: email={email}, "
                f"source={source_token[:20]}..."
            )
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    customer_endpoint,
                    headers={
                        "Authorization": f"Bearer {self.private_token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json=payload,
                )
                
                logger.info(f"Clover create customer response: status={response.status_code}, body={response.text}")
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    customer_id = data.get("id")
                    
                    logger.info(f"Clover customer created: {customer_id}")
                    
                    return {
                        "success": True,
                        "customer_id": customer_id,
                        "sources": data.get("sources", {}),
                    }
                else:
                    error_text = response.text
                    try:
                        error_data = response.json()
                        error_text = error_data.get("message", error_text)
                    except Exception:
                        pass
                    
                    logger.error(f"Clover create customer failed (status {response.status_code}): {error_text}")
                    return {"success": False, "error": f"Failed to create customer: {error_text}"}
                    
        except httpx.TimeoutException:
            logger.error("Clover create customer request timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Error creating Clover customer: {e}")
            return {"success": False, "error": str(e)}

    async def charge_customer(
        self,
        customer_id: str,
        amount_cents: int,
        currency: str = "usd",
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Charge a Clover customer using their stored card on file.
        Used for recurring monthly charges.
        
        Args:
            customer_id: The Clover customer ID (from create_customer)
            amount_cents: Amount in cents
            currency: Currency code (default: usd)
            description: Optional charge description
            
        Returns:
            Dict with charge result
        """
        if not self.is_configured():
            return {"success": False, "error": "Clover not configured"}
        
        try:
            charge_endpoint = f"{self.charge_url}/v1/charges"
            idempotency_key = str(uuid.uuid4())
            
            payload = {
                "amount": amount_cents,
                "currency": currency,
                "customer": customer_id,
            }
            if description:
                payload["description"] = description
            
            logger.info(
                f"Clover recurring charge: customer={customer_id}, "
                f"amount={amount_cents}, idempotency={idempotency_key}"
            )
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    charge_endpoint,
                    headers={
                        "Authorization": f"Bearer {self.private_token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "idempotency-key": idempotency_key,
                    },
                    json=payload,
                )
                
                logger.info(f"Clover recurring charge response: status={response.status_code}, body={response.text}")
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    charge_id = data.get("id")
                    status = data.get("status")
                    
                    logger.info(
                        f"Clover recurring charge successful: {charge_id} "
                        f"(customer: {customer_id}, amount: ${amount_cents / 100:.2f})"
                    )
                    
                    return {
                        "success": True,
                        "charge_id": charge_id,
                        "status": status,
                        "amount": data.get("amount"),
                        "currency": data.get("currency"),
                    }
                else:
                    error_text = response.text
                    try:
                        error_data = response.json()
                        error_text = error_data.get("message", error_text)
                    except Exception:
                        pass
                    
                    logger.error(
                        f"Clover recurring charge failed "
                        f"(customer: {customer_id}, status {response.status_code}): {error_text}"
                    )
                    return {
                        "success": False,
                        "error": f"Charge failed: {error_text}",
                        "status_code": response.status_code,
                    }
                    
        except httpx.TimeoutException:
            logger.error("Clover recurring charge request timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Error charging Clover customer: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
clover_service = CloverService()
