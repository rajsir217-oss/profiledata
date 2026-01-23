"""
Braintree Payment Service

Handles PayPal/Braintree payment processing alongside Stripe.
Supports sandbox testing and production payments.
"""

import braintree
from typing import Optional, Dict, Any
from config import settings
import logging

logger = logging.getLogger(__name__)


class BraintreeService:
    """Service for handling Braintree/PayPal payments."""
    
    def __init__(self):
        self.gateway = None
        self._initialize_gateway()
    
    def _initialize_gateway(self):
        """Initialize the Braintree gateway with credentials from config."""
        if not all([
            settings.braintree_merchant_id,
            settings.braintree_public_key,
            settings.braintree_private_key
        ]):
            logger.warning("Braintree credentials not configured. Payment processing disabled.")
            return
        
        # Determine environment
        environment = braintree.Environment.Sandbox
        if settings.braintree_environment == "production":
            environment = braintree.Environment.Production
        
        self.gateway = braintree.BraintreeGateway(
            braintree.Configuration(
                environment=environment,
                merchant_id=settings.braintree_merchant_id,
                public_key=settings.braintree_public_key,
                private_key=settings.braintree_private_key
            )
        )
        logger.info(f"Braintree gateway initialized in {settings.braintree_environment} mode")
    
    def is_configured(self) -> bool:
        """Check if Braintree is properly configured."""
        return self.gateway is not None
    
    def generate_client_token(self, customer_id: Optional[str] = None) -> Optional[str]:
        """
        Generate a client token for the frontend Drop-in UI.
        
        Args:
            customer_id: Optional Braintree customer ID for returning customers
            
        Returns:
            Client token string or None if error
        """
        if not self.gateway:
            logger.error("Braintree gateway not initialized")
            return None
        
        try:
            options = {}
            if customer_id:
                options["customer_id"] = customer_id
            
            client_token = self.gateway.client_token.generate(options)
            return client_token
        except Exception as e:
            logger.error(f"Failed to generate Braintree client token: {e}")
            return None
    
    def create_customer(self, user_data: Dict[str, Any]) -> Optional[str]:
        """
        Create a Braintree customer for storing payment methods.
        
        Args:
            user_data: Dict with username, email, firstName, lastName
            
        Returns:
            Braintree customer ID or None if error
        """
        if not self.gateway:
            return None
        
        try:
            result = self.gateway.customer.create({
                "id": user_data.get("username"),  # Use username as customer ID
                "email": user_data.get("email"),
                "first_name": user_data.get("firstName", ""),
                "last_name": user_data.get("lastName", ""),
            })
            
            if result.is_success:
                logger.info(f"Created Braintree customer: {result.customer.id}")
                return result.customer.id
            else:
                logger.error(f"Failed to create Braintree customer: {result.message}")
                return None
        except Exception as e:
            logger.error(f"Error creating Braintree customer: {e}")
            return None
    
    def find_or_create_customer(self, user_data: Dict[str, Any]) -> Optional[str]:
        """Find existing customer or create new one."""
        if not self.gateway:
            return None
        
        username = user_data.get("username")
        try:
            # Try to find existing customer
            customer = self.gateway.customer.find(username)
            return customer.id
        except braintree.exceptions.NotFoundError:
            # Create new customer
            return self.create_customer(user_data)
        except Exception as e:
            logger.error(f"Error finding/creating customer: {e}")
            return None
    
    def process_payment(
        self,
        payment_method_nonce: str,
        amount: str,
        order_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        store_in_vault: bool = False
    ) -> Dict[str, Any]:
        """
        Process a one-time payment.
        
        Args:
            payment_method_nonce: Token from frontend Drop-in UI
            amount: Amount in dollars (e.g., "29.99")
            order_id: Optional order reference
            customer_id: Optional Braintree customer ID
            store_in_vault: Whether to save payment method for future use
            
        Returns:
            Dict with success status, transaction_id, and any errors
        """
        if not self.gateway:
            return {"success": False, "error": "Braintree not configured"}
        
        try:
            transaction_data = {
                "amount": amount,
                "payment_method_nonce": payment_method_nonce,
                "options": {
                    "submit_for_settlement": True
                }
            }
            
            if order_id:
                transaction_data["order_id"] = order_id
            
            if customer_id:
                transaction_data["customer_id"] = customer_id
                if store_in_vault:
                    transaction_data["options"]["store_in_vault_on_success"] = True
            
            result = self.gateway.transaction.sale(transaction_data)
            
            if result.is_success:
                transaction = result.transaction
                logger.info(f"Braintree payment successful: {transaction.id} for ${amount}")
                return {
                    "success": True,
                    "transaction_id": transaction.id,
                    "status": transaction.status,
                    "amount": str(transaction.amount),
                    "payment_type": transaction.payment_instrument_type
                }
            else:
                error_msg = result.message
                if result.transaction:
                    error_msg = f"{result.transaction.processor_response_text} ({result.transaction.processor_response_code})"
                
                logger.error(f"Braintree payment failed: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }
        except Exception as e:
            logger.error(f"Braintree payment error: {e}")
            return {"success": False, "error": str(e)}
    
    def create_subscription(
        self,
        payment_method_token: str,
        plan_id: str,
        price: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a recurring subscription.
        
        Args:
            payment_method_token: Stored payment method token
            plan_id: Braintree plan ID (must be created in Braintree dashboard)
            price: Optional override price
            
        Returns:
            Dict with success status and subscription details
        """
        if not self.gateway:
            return {"success": False, "error": "Braintree not configured"}
        
        try:
            subscription_data = {
                "payment_method_token": payment_method_token,
                "plan_id": plan_id
            }
            
            if price:
                subscription_data["price"] = price
            
            result = self.gateway.subscription.create(subscription_data)
            
            if result.is_success:
                subscription = result.subscription
                logger.info(f"Braintree subscription created: {subscription.id}")
                return {
                    "success": True,
                    "subscription_id": subscription.id,
                    "status": subscription.status,
                    "next_billing_date": str(subscription.next_billing_date),
                    "price": str(subscription.price)
                }
            else:
                logger.error(f"Braintree subscription failed: {result.message}")
                return {"success": False, "error": result.message}
        except Exception as e:
            logger.error(f"Braintree subscription error: {e}")
            return {"success": False, "error": str(e)}
    
    def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Cancel an active subscription."""
        if not self.gateway:
            return {"success": False, "error": "Braintree not configured"}
        
        try:
            result = self.gateway.subscription.cancel(subscription_id)
            
            if result.is_success:
                logger.info(f"Braintree subscription cancelled: {subscription_id}")
                return {"success": True, "subscription_id": subscription_id}
            else:
                logger.error(f"Failed to cancel subscription: {result.message}")
                return {"success": False, "error": result.message}
        except Exception as e:
            logger.error(f"Error cancelling subscription: {e}")
            return {"success": False, "error": str(e)}
    
    def get_transaction(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """Get transaction details."""
        if not self.gateway:
            return None
        
        try:
            transaction = self.gateway.transaction.find(transaction_id)
            return {
                "id": transaction.id,
                "status": transaction.status,
                "amount": str(transaction.amount),
                "created_at": str(transaction.created_at),
                "payment_type": transaction.payment_instrument_type
            }
        except Exception as e:
            logger.error(f"Error fetching transaction: {e}")
            return None
    
    def refund_transaction(
        self,
        transaction_id: str,
        amount: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Refund a transaction (full or partial).
        
        Args:
            transaction_id: The transaction to refund
            amount: Optional partial refund amount
            
        Returns:
            Dict with success status
        """
        if not self.gateway:
            return {"success": False, "error": "Braintree not configured"}
        
        try:
            if amount:
                result = self.gateway.transaction.refund(transaction_id, amount)
            else:
                result = self.gateway.transaction.refund(transaction_id)
            
            if result.is_success:
                logger.info(f"Braintree refund successful: {result.transaction.id}")
                return {
                    "success": True,
                    "refund_id": result.transaction.id,
                    "amount": str(result.transaction.amount)
                }
            else:
                logger.error(f"Braintree refund failed: {result.message}")
                return {"success": False, "error": result.message}
        except Exception as e:
            logger.error(f"Braintree refund error: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
braintree_service = BraintreeService()
