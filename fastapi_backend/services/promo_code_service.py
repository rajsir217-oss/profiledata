"""
Promo Code Service
Created: December 26, 2025
Purpose: Business logic for promo code management
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models.promo_code_models import (
    PromoCodeCreate,
    PromoCodeUpdate,
    PromoCodeDB,
    PromoCodeResponse,
    PromoCodeType,
    PromoCodeStats
)


class PromoCodeService:
    """Service for managing promo codes"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.promo_codes
        self.users_collection = db.users
    
    async def create_promo_code(
        self,
        promo_data: PromoCodeCreate,
        created_by: str,
        linked_to_user: Optional[str] = None
    ) -> PromoCodeDB:
        """Create a new promo code"""
        
        # Check if code already exists (case-insensitive)
        existing = await self.collection.find_one({
            "code": {"$regex": f"^{promo_data.code}$", "$options": "i"}
        })
        
        if existing:
            raise ValueError(f"Promo code '{promo_data.code}' already exists")
        
        # Build invitation link (for future QR code generation)
        from config import Settings
        settings = Settings()
        base_url = getattr(settings, 'frontend_url', 'https://usvedika.com')
        invitation_link = f"{base_url}/register?promo={promo_data.code}"
        
        # Create promo code document
        # Convert enum values to strings for MongoDB storage
        promo_type = promo_data.type.value if hasattr(promo_data.type, 'value') else promo_data.type
        discount_type = promo_data.discountType.value if hasattr(promo_data.discountType, 'value') else promo_data.discountType
        
        promo_doc = {
            "code": promo_data.code.upper(),  # Store uppercase
            "name": promo_data.name,
            "type": promo_type,
            "description": promo_data.description or "",
            "discountType": discount_type,
            "discountValue": promo_data.discountValue or 0,
            "applicablePlans": promo_data.applicablePlans or [],
            "validFrom": promo_data.validFrom,
            "validUntil": promo_data.validUntil,
            "maxUses": promo_data.maxUses,
            "tags": promo_data.tags or [],
            
            # Usage tracking
            "currentUses": 0,
            "isActive": True,
            
            # Creator info
            "createdBy": created_by,
            "linkedToUser": linked_to_user,
            
            # QR Code (placeholder for future)
            "qrCodeUrl": None,
            "invitationLink": invitation_link,
            
            # Analytics
            "registrations": 0,
            "conversions": 0,
            "revenue": 0,
            
            # Timestamps
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await self.collection.insert_one(promo_doc)
        promo_doc["_id"] = str(result.inserted_id)
        
        # Return the dict directly instead of Pydantic model to avoid enum serialization issues
        return promo_doc
    
    async def get_promo_code(self, code: str) -> Optional[PromoCodeResponse]:
        """Get a promo code by code string"""
        promo = await self.collection.find_one({
            "code": {"$regex": f"^{code}$", "$options": "i"}
        })
        
        if not promo:
            return None
        
        promo["_id"] = str(promo["_id"])
        return self._to_response(promo)
    
    async def get_promo_code_by_id(self, promo_id: str) -> Optional[PromoCodeResponse]:
        """Get a promo code by ID"""
        try:
            promo = await self.collection.find_one({"_id": ObjectId(promo_id)})
        except Exception:
            return None
        
        if not promo:
            return None
        
        promo["_id"] = str(promo["_id"])
        return self._to_response(promo)
    
    async def list_promo_codes(
        self,
        skip: int = 0,
        limit: int = 50,
        code_type: Optional[PromoCodeType] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None
    ) -> tuple[List[PromoCodeResponse], int]:
        """List promo codes with filtering (excludes archived by default)"""
        
        query: Dict[str, Any] = {
            "$or": [{"isArchived": False}, {"isArchived": {"$exists": False}}]
        }
        
        if code_type:
            query["type"] = code_type
        
        if is_active is not None:
            query["isActive"] = is_active
        
        if search:
            query["$and"] = [
                {"$or": [{"isArchived": False}, {"isArchived": {"$exists": False}}]},
                {"$or": [
                    {"code": {"$regex": search, "$options": "i"}},
                    {"name": {"$regex": search, "$options": "i"}},
                    {"description": {"$regex": search, "$options": "i"}}
                ]}
            ]
            del query["$or"]  # Remove the top-level $or since we're using $and
        
        total = await self.collection.count_documents(query)
        
        cursor = self.collection.find(query).sort("createdAt", -1).skip(skip).limit(limit)
        promos = await cursor.to_list(length=limit)
        
        results = []
        for promo in promos:
            promo["_id"] = str(promo["_id"])
            results.append(self._to_response(promo))
        
        return results, total
    
    async def update_promo_code(
        self,
        code: str,
        update_data: PromoCodeUpdate
    ) -> Optional[PromoCodeResponse]:
        """Update a promo code"""
        
        update_dict = {}
        for k, v in update_data.dict().items():
            if v is not None:
                # Convert enum values to strings
                if hasattr(v, 'value'):
                    update_dict[k] = v.value
                else:
                    update_dict[k] = v
        
        if not update_dict:
            return await self.get_promo_code(code)
        
        update_dict["updatedAt"] = datetime.utcnow()
        
        result = await self.collection.find_one_and_update(
            {"code": {"$regex": f"^{code}$", "$options": "i"}},
            {"$set": update_dict},
            return_document=True
        )
        
        if not result:
            return None
        
        result["_id"] = str(result["_id"])
        return self._to_response(result)
    
    async def delete_promo_code(self, code: str) -> bool:
        """Delete a promo code (hard delete - only for codes with no usage)"""
        result = await self.collection.delete_one({
            "code": {"$regex": f"^{code}$", "$options": "i"}
        })
        return result.deleted_count > 0
    
    async def archive_promo_code(self, code: str) -> bool:
        """Archive a promo code (soft delete)"""
        result = await self.collection.update_one(
            {"code": {"$regex": f"^{code}$", "$options": "i"}},
            {
                "$set": {
                    "isArchived": True,
                    "isActive": False,
                    "archivedAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    
    async def restore_promo_code(self, code: str) -> bool:
        """Restore an archived promo code (unarchive + reactivate)"""
        result = await self.collection.update_one(
            {"code": {"$regex": f"^{code}$", "$options": "i"}, "isArchived": True},
            {
                "$set": {
                    "isArchived": False,
                    "isActive": True,  # Automatically reactivate
                    "archivedAt": None,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    
    async def list_archived_promo_codes(
        self,
        skip: int = 0,
        limit: int = 50
    ) -> tuple:
        """List archived promo codes"""
        query = {"isArchived": True}
        
        total = await self.collection.count_documents(query)
        
        cursor = self.collection.find(query).sort("archivedAt", -1).skip(skip).limit(limit)
        
        results = []
        async for promo in cursor:
            promo["_id"] = str(promo["_id"])
            results.append(self._to_response(promo))
        
        return results, total
    
    async def validate_promo_code(self, code: str) -> Dict[str, Any]:
        """Validate if a promo code can be used for registration"""
        promo = await self.collection.find_one({
            "code": {"$regex": f"^{code}$", "$options": "i"}
        })
        
        if not promo:
            return {"valid": False, "reason": "Promo code not found", "defaultToNormal": True}
        
        # Check if archived
        if promo.get("isArchived", False):
            return {"valid": False, "reason": "This promo code is no longer available", "defaultToNormal": True}
        
        if not promo.get("isActive", True):
            return {"valid": False, "reason": "This promo code is inactive", "defaultToNormal": True}
        
        now = datetime.utcnow()
        
        if promo.get("validFrom") and now < promo["validFrom"]:
            valid_from = promo["validFrom"].strftime("%B %d, %Y")
            return {"valid": False, "reason": f"This promo code is not yet valid. It will be active from {valid_from}", "defaultToNormal": True}
        
        if promo.get("validUntil") and now > promo["validUntil"]:
            return {"valid": False, "reason": "This promo code has expired. You can continue with normal registration.", "defaultToNormal": True}
        
        if promo.get("maxUses") and promo.get("currentUses", 0) >= promo["maxUses"]:
            return {"valid": False, "reason": "This promo code has reached its usage limit", "defaultToNormal": True}
        
        return {
            "valid": True,
            "code": promo["code"],
            "name": promo["name"],
            "type": promo.get("type", "community"),
            "discountType": promo.get("discountType", "none"),
            "discountValue": promo.get("discountValue", 0),
            "applicablePlans": promo.get("applicablePlans", []),
            "defaultToNormal": False
        }
    
    async def increment_usage(self, code: str) -> bool:
        """Increment usage count for a promo code"""
        result = await self.collection.update_one(
            {"code": {"$regex": f"^{code}$", "$options": "i"}},
            {
                "$inc": {"currentUses": 1, "registrations": 1},
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        return result.modified_count > 0
    
    async def record_conversion(self, code: str, revenue: float = 0) -> bool:
        """Record a conversion (paid membership) for a promo code"""
        result = await self.collection.update_one(
            {"code": {"$regex": f"^{code}$", "$options": "i"}},
            {
                "$inc": {"conversions": 1, "revenue": revenue},
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        return result.modified_count > 0
    
    async def get_user_promo_code(self, username: str) -> Optional[str]:
        """Get a user's personal promo code"""
        user = await self.users_collection.find_one(
            {"username": username},
            {"promoCode": 1}
        )
        
        if user:
            return user.get("promoCode")
        return None
    
    async def set_user_promo_code(self, username: str, promo_code: str) -> bool:
        """Set a user's personal promo code"""
        result = await self.users_collection.update_one(
            {"username": username},
            {"$set": {"promoCode": promo_code, "updatedAt": datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    async def get_stats(self) -> PromoCodeStats:
        """Get overall promo code statistics"""
        
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "totalCodes": {"$sum": 1},
                    "activeCodes": {
                        "$sum": {"$cond": [{"$eq": ["$isActive", True]}, 1, 0]}
                    },
                    "totalRegistrations": {"$sum": "$registrations"},
                    "totalConversions": {"$sum": "$conversions"},
                    "totalRevenue": {"$sum": "$revenue"}
                }
            }
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(1)
        
        if not result:
            return PromoCodeStats()
        
        stats_data = result[0]
        
        # Get top performing codes
        top_codes_cursor = self.collection.find(
            {"isActive": True}
        ).sort("registrations", -1).limit(5)
        
        top_codes = await top_codes_cursor.to_list(5)
        top_codes_list = [
            {
                "code": c["code"],
                "name": c["name"],
                "registrations": c.get("registrations", 0),
                "conversions": c.get("conversions", 0)
            }
            for c in top_codes
        ]
        
        return PromoCodeStats(
            totalCodes=stats_data.get("totalCodes", 0),
            activeCodes=stats_data.get("activeCodes", 0),
            totalRegistrations=stats_data.get("totalRegistrations", 0),
            totalConversions=stats_data.get("totalConversions", 0),
            totalRevenue=stats_data.get("totalRevenue", 0),
            topCodes=top_codes_list
        )
    
    async def get_all_active_codes_for_dropdown(self) -> List[Dict[str, str]]:
        """Get all active promo codes for dropdown selection"""
        cursor = self.collection.find(
            {"isActive": True},
            {"code": 1, "name": 1, "type": 1}
        ).sort("name", 1)
        
        codes = await cursor.to_list(length=500)
        
        return [
            {
                "code": c["code"],
                "name": c["name"],
                "type": c.get("type", "referral")
            }
            for c in codes
        ]
    
    async def get_users_by_promo_code(self, code: str) -> List[Dict[str, Any]]:
        """Get all users who registered with a specific promo code"""
        cursor = self.users_collection.find(
            {"promoCode": {"$regex": f"^{code}$", "$options": "i"}},
            {
                "username": 1,
                "firstName": 1,
                "lastName": 1,
                "gender": 1,
                "location": 1,
                "city": 1,
                "state": 1,
                "country": 1,
                "created_at": 1,
                "promoCodeAppliedAt": 1,
                "membershipType": 1,
                "membershipAmount": 1,
                "paymentMethod": 1,
                "membershipStartDate": 1,
                "membershipEndDate": 1,
                "isPaid": 1
            }
        ).sort("created_at", -1)
        
        users = await cursor.to_list(length=500)
        
        result = []
        for user in users:
            result.append({
                "username": user.get("username"),
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "gender": user.get("gender", "-"),
                "location": user.get("location", "-"),
                "city": user.get("city", "-"),
                "state": user.get("state", "-"),
                "country": user.get("country", "USA"),
                "registeredAt": user.get("created_at").isoformat() if user.get("created_at") else None,
                "activatedAt": user.get("promoCodeAppliedAt").isoformat() if user.get("promoCodeAppliedAt") else (user.get("created_at").isoformat() if user.get("created_at") else None),
                "membershipType": user.get("membershipType", "free"),
                "amount": user.get("membershipAmount", 0),
                "paymentMethod": user.get("paymentMethod", "-"),
                "isPaid": user.get("isPaid", False)
            })
        
        return result
    
    async def get_analytics(self) -> Dict[str, Any]:
        """Get comprehensive analytics for promo codes"""
        
        # Get all promo codes with their stats
        all_codes = await self.collection.find(
            {"isArchived": {"$ne": True}}
        ).to_list(length=500)
        
        # Calculate per-code metrics
        code_analytics = []
        for code in all_codes:
            registrations = code.get("registrations", 0)
            conversions = code.get("conversions", 0)
            revenue = code.get("revenue", 0)
            
            # Conversion rate = conversions / registrations
            conversion_rate = (conversions / registrations * 100) if registrations > 0 else 0
            
            code_analytics.append({
                "code": code["code"],
                "name": code.get("name", code["code"]),
                "type": code.get("type", "referral"),
                "registrations": registrations,
                "conversions": conversions,
                "conversionRate": round(conversion_rate, 1),
                "revenue": revenue,
                "isActive": code.get("isActive", True),
                "createdAt": code.get("createdAt").isoformat() if code.get("createdAt") else None
            })
        
        # Sort by registrations descending
        code_analytics.sort(key=lambda x: x["registrations"], reverse=True)
        
        # Get registration trends (by month) from users collection
        trends_pipeline = [
            {
                "$match": {
                    "promoCode": {"$exists": True, "$ne": None}
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": {"$year": "$created_at"},
                        "month": {"$month": "$created_at"},
                        "promoCode": "$promoCode"
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id.year": 1, "_id.month": 1}
            }
        ]
        
        trends_result = await self.users_collection.aggregate(trends_pipeline).to_list(length=500)
        
        # Process trends into monthly data
        monthly_data = {}
        for item in trends_result:
            year = item["_id"].get("year")
            month = item["_id"].get("month")
            if year and month:
                key = f"{year}-{str(month).zfill(2)}"
                promo_code = item["_id"].get("promoCode", "UNKNOWN")
                
                if key not in monthly_data:
                    monthly_data[key] = {"month": key, "total": 0, "byCode": {}}
                
                monthly_data[key]["total"] += item["count"]
                monthly_data[key]["byCode"][promo_code] = item["count"]
        
        # Convert to sorted list
        trends = sorted(monthly_data.values(), key=lambda x: x["month"])
        
        # Calculate totals
        total_registrations = sum(c["registrations"] for c in code_analytics)
        total_conversions = sum(c["conversions"] for c in code_analytics)
        total_revenue = sum(c["revenue"] for c in code_analytics)
        overall_conversion_rate = (total_conversions / total_registrations * 100) if total_registrations > 0 else 0
        
        return {
            "summary": {
                "totalCodes": len(code_analytics),
                "activeCodes": len([c for c in code_analytics if c["isActive"]]),
                "totalRegistrations": total_registrations,
                "totalConversions": total_conversions,
                "overallConversionRate": round(overall_conversion_rate, 1),
                "totalRevenue": total_revenue
            },
            "codeAnalytics": code_analytics,
            "trends": trends
        }
    
    def _to_response(self, promo: dict) -> PromoCodeResponse:
        """Convert database document to response model"""
        now = datetime.utcnow()
        
        # Check if expired
        is_expired = False
        if promo.get("validUntil") and now > promo["validUntil"]:
            is_expired = True
        
        # Calculate remaining uses
        uses_remaining = None
        if promo.get("maxUses"):
            uses_remaining = max(0, promo["maxUses"] - promo.get("currentUses", 0))
        
        return PromoCodeResponse(
            **promo,
            isExpired=is_expired,
            usesRemaining=uses_remaining
        )
