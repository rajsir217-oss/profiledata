"""
Site Settings Service
Created: December 26, 2025
Purpose: Manage site-wide settings like membership fees and plans
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class SiteSettingsService:
    """Service for managing site settings"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.site_settings
    
    async def get_settings(self) -> Dict[str, Any]:
        """Get all site settings, creating defaults if not exists"""
        settings = await self.collection.find_one({"_id": "site_settings"})
        
        if not settings:
            # Create default settings
            settings = await self._create_default_settings()
        
        return self._format_settings(settings)
    
    async def _create_default_settings(self) -> Dict[str, Any]:
        """Create default site settings"""
        default_settings = {
            "_id": "site_settings",
            "membership": {
                "baseFee": 99.00,
                "currency": "USD",
                "plans": [
                    {
                        "id": "basic",
                        "name": "Basic",
                        "price": 49.00,
                        "duration": 6,
                        "features": [
                            "View profiles",
                            "Send messages",
                            "Basic search"
                        ],
                        "isActive": True,
                        "sortOrder": 1
                    },
                    {
                        "id": "premium",
                        "name": "Premium",
                        "price": 99.00,
                        "duration": 12,
                        "features": [
                            "All Basic features",
                            "Advanced search",
                            "Priority support",
                            "Profile boost"
                        ],
                        "isActive": True,
                        "sortOrder": 2
                    },
                    {
                        "id": "lifetime",
                        "name": "Lifetime",
                        "price": 199.00,
                        "duration": None,
                        "features": [
                            "All Premium features",
                            "Lifetime access",
                            "VIP badge",
                            "Exclusive events"
                        ],
                        "isActive": True,
                        "sortOrder": 3
                    }
                ],
                "defaultPlanId": "premium",
                "trialDays": 0,
                "gracePeriodDays": 7
            },
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "updatedBy": "system"
        }
        
        await self.collection.insert_one(default_settings)
        logger.info("Created default site settings")
        return default_settings
    
    async def get_membership_config(self) -> Dict[str, Any]:
        """Get membership configuration only"""
        settings = await self.get_settings()
        return settings.get("membership", {})
    
    async def update_membership_config(
        self, 
        updates: Dict[str, Any], 
        updated_by: str
    ) -> Dict[str, Any]:
        """Update membership configuration"""
        # Get current settings
        current = await self.get_settings()
        current_membership = current.get("membership", {})
        
        # Merge updates
        updated_membership = {**current_membership, **updates}
        
        # Update in database
        result = await self.collection.update_one(
            {"_id": "site_settings"},
            {
                "$set": {
                    "membership": updated_membership,
                    "updatedAt": datetime.now(timezone.utc),
                    "updatedBy": updated_by
                }
            },
            upsert=True
        )
        
        logger.info(f"Membership config updated by {updated_by}")
        return await self.get_membership_config()
    
    async def add_plan(self, plan: Dict[str, Any], updated_by: str) -> Dict[str, Any]:
        """Add a new membership plan"""
        settings = await self.get_settings()
        plans = settings.get("membership", {}).get("plans", [])
        
        # Check if plan ID already exists
        if any(p["id"] == plan["id"] for p in plans):
            raise ValueError(f"Plan with ID '{plan['id']}' already exists")
        
        # Add sort order if not provided
        if "sortOrder" not in plan:
            plan["sortOrder"] = len(plans) + 1
        
        plans.append(plan)
        
        await self.collection.update_one(
            {"_id": "site_settings"},
            {
                "$set": {
                    "membership.plans": plans,
                    "updatedAt": datetime.now(timezone.utc),
                    "updatedBy": updated_by
                }
            }
        )
        
        logger.info(f"Plan '{plan['id']}' added by {updated_by}")
        return plan
    
    async def update_plan(
        self, 
        plan_id: str, 
        updates: Dict[str, Any], 
        updated_by: str
    ) -> Optional[Dict[str, Any]]:
        """Update an existing membership plan"""
        settings = await self.get_settings()
        plans = settings.get("membership", {}).get("plans", [])
        
        # Find and update the plan
        updated_plan = None
        for i, plan in enumerate(plans):
            if plan["id"] == plan_id:
                plans[i] = {**plan, **updates, "id": plan_id}  # Keep original ID
                updated_plan = plans[i]
                break
        
        if not updated_plan:
            return None
        
        await self.collection.update_one(
            {"_id": "site_settings"},
            {
                "$set": {
                    "membership.plans": plans,
                    "updatedAt": datetime.now(timezone.utc),
                    "updatedBy": updated_by
                }
            }
        )
        
        logger.info(f"Plan '{plan_id}' updated by {updated_by}")
        return updated_plan
    
    async def delete_plan(self, plan_id: str, updated_by: str) -> bool:
        """Delete a membership plan"""
        settings = await self.get_settings()
        plans = settings.get("membership", {}).get("plans", [])
        
        # Filter out the plan
        new_plans = [p for p in plans if p["id"] != plan_id]
        
        if len(new_plans) == len(plans):
            return False  # Plan not found
        
        await self.collection.update_one(
            {"_id": "site_settings"},
            {
                "$set": {
                    "membership.plans": new_plans,
                    "updatedAt": datetime.now(timezone.utc),
                    "updatedBy": updated_by
                }
            }
        )
        
        logger.info(f"Plan '{plan_id}' deleted by {updated_by}")
        return True
    
    async def calculate_discounted_price(
        self, 
        plan_id: str, 
        promo_code: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Calculate price after applying promo code discount"""
        settings = await self.get_settings()
        plans = settings.get("membership", {}).get("plans", [])
        
        # Find the plan
        plan = next((p for p in plans if p["id"] == plan_id), None)
        if not plan:
            raise ValueError(f"Plan '{plan_id}' not found")
        
        original_price = plan["price"]
        discount_amount = 0
        final_price = original_price
        
        if promo_code:
            discount_type = promo_code.get("discountType", "none")
            discount_value = promo_code.get("discountValue", 0)
            
            if discount_type == "percentage":
                discount_amount = original_price * (discount_value / 100)
            elif discount_type == "fixed":
                discount_amount = min(discount_value, original_price)
            
            final_price = max(0, original_price - discount_amount)
        
        return {
            "planId": plan_id,
            "planName": plan["name"],
            "originalPrice": round(original_price, 2),
            "discountAmount": round(discount_amount, 2),
            "finalPrice": round(final_price, 2),
            "promoCodeApplied": promo_code.get("code") if promo_code else None
        }
    
    def _format_settings(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Format settings for response"""
        if not settings:
            return {}
        
        result = dict(settings)
        result["id"] = str(result.pop("_id", "site_settings"))
        
        # Format dates
        if "createdAt" in result and result["createdAt"]:
            result["createdAt"] = result["createdAt"].isoformat()
        if "updatedAt" in result and result["updatedAt"]:
            result["updatedAt"] = result["updatedAt"].isoformat()
        
        return result
