"""
Payment History Service
Created: December 26, 2025
Purpose: Business logic for payment history tracking
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models.payment_models import PaymentCreate, PaymentResponse, PaymentSummary


class PaymentService:
    """Service for managing payment history"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.payment_history
        self.users_collection = db.users
        self.promo_collection = db.promo_codes
    
    async def create_payment(self, payment: PaymentCreate, created_by: str = None) -> PaymentResponse:
        """Create a new payment record"""
        payment_doc = {
            "username": payment.username,
            "amount": payment.amount,
            "paymentType": payment.paymentType.value,
            "paymentMethod": payment.paymentMethod.value,
            "promoCode": payment.promoCode,
            "description": payment.description,
            "transactionId": payment.transactionId,
            "notes": payment.notes,
            "status": "completed",
            "createdAt": datetime.utcnow(),
            "createdBy": created_by
        }
        
        result = await self.collection.insert_one(payment_doc)
        payment_doc["_id"] = str(result.inserted_id)
        
        # Update promo code revenue if applicable
        if payment.promoCode:
            await self.promo_collection.update_one(
                {"code": {"$regex": f"^{payment.promoCode}$", "$options": "i"}},
                {
                    "$inc": {"revenue": payment.amount, "conversions": 1},
                    "$set": {"updatedAt": datetime.utcnow()}
                }
            )
        
        # Update user's isPaid status
        await self.users_collection.update_one(
            {"username": payment.username},
            {
                "$set": {
                    "isPaid": True,
                    "membershipAmount": payment.amount,
                    "paymentMethod": payment.paymentMethod.value,
                    "lastPaymentAt": datetime.utcnow()
                }
            }
        )
        
        return PaymentResponse(**payment_doc)
    
    async def get_payments_by_username(self, username: str) -> List[Dict[str, Any]]:
        """Get all payments for a specific user"""
        cursor = self.collection.find(
            {"username": username}
        ).sort("createdAt", -1)
        
        payments = await cursor.to_list(length=100)
        
        result = []
        for payment in payments:
            result.append({
                "id": str(payment["_id"]),
                "amount": payment.get("amount", 0),
                "paymentType": payment.get("paymentType", "one_time"),
                "paymentMethod": payment.get("paymentMethod", "-"),
                "promoCode": payment.get("promoCode"),
                "description": payment.get("description"),
                "transactionId": payment.get("transactionId"),
                "status": payment.get("status", "completed"),
                "createdAt": payment.get("createdAt").isoformat() if payment.get("createdAt") else None,
                "notes": payment.get("notes")
            })
        
        return result
    
    async def get_payments_by_promo_code(self, code: str) -> List[Dict[str, Any]]:
        """Get all payments associated with a promo code"""
        cursor = self.collection.find(
            {"promoCode": {"$regex": f"^{code}$", "$options": "i"}}
        ).sort("createdAt", -1)
        
        payments = await cursor.to_list(length=500)
        
        result = []
        for payment in payments:
            result.append({
                "id": str(payment["_id"]),
                "username": payment.get("username"),
                "amount": payment.get("amount", 0),
                "paymentType": payment.get("paymentType", "one_time"),
                "paymentMethod": payment.get("paymentMethod", "-"),
                "status": payment.get("status", "completed"),
                "createdAt": payment.get("createdAt").isoformat() if payment.get("createdAt") else None
            })
        
        return result
    
    async def get_user_payment_summary(self, username: str) -> Dict[str, Any]:
        """Get payment summary for a user"""
        payments = await self.get_payments_by_username(username)
        
        total_amount = sum(p.get("amount", 0) for p in payments if p.get("status") == "completed")
        
        return {
            "username": username,
            "totalPayments": len(payments),
            "totalAmount": total_amount,
            "payments": payments
        }
    
    async def get_revenue_by_promo_code(self, code: str) -> Dict[str, Any]:
        """Get revenue summary for a promo code"""
        payments = await self.get_payments_by_promo_code(code)
        
        total_revenue = sum(p.get("amount", 0) for p in payments if p.get("status") == "completed")
        
        return {
            "code": code,
            "totalPayments": len(payments),
            "totalRevenue": total_revenue,
            "payments": payments
        }
    
    async def get_all_payments(self, skip: int = 0, limit: int = 50) -> tuple:
        """Get all payments with pagination"""
        total = await self.collection.count_documents({})
        
        cursor = self.collection.find().sort("createdAt", -1).skip(skip).limit(limit)
        payments = await cursor.to_list(length=limit)
        
        result = []
        for payment in payments:
            result.append({
                "id": str(payment["_id"]),
                "username": payment.get("username"),
                "amount": payment.get("amount", 0),
                "paymentType": payment.get("paymentType", "one_time"),
                "paymentMethod": payment.get("paymentMethod", "-"),
                "promoCode": payment.get("promoCode"),
                "status": payment.get("status", "completed"),
                "createdAt": payment.get("createdAt").isoformat() if payment.get("createdAt") else None
            })
        
        return result, total

    async def get_yearly_summary(self) -> Dict[str, Any]:
        """Get payment summary grouped by year"""
        from datetime import datetime
        
        # Aggregate payments by year
        pipeline = [
            {
                "$group": {
                    "_id": {"$year": "$createdAt"},
                    "totalPayments": {"$sum": 1},
                    "totalRevenue": {"$sum": "$amount"},
                    "uniqueUsers": {"$addToSet": "$username"}
                }
            },
            {"$sort": {"_id": -1}}  # Most recent year first
        ]
        
        cursor = self.collection.aggregate(pipeline)
        yearly_data = await cursor.to_list(length=20)
        
        years = []
        for item in yearly_data:
            if item["_id"]:  # Skip null years
                years.append({
                    "year": item["_id"],
                    "totalPayments": item["totalPayments"],
                    "totalRevenue": round(item["totalRevenue"], 2),
                    "uniqueUsers": len(item["uniqueUsers"]),
                    "canPurge": item["_id"] < datetime.now().year  # Can only purge past years
                })
        
        # Calculate grand totals
        grand_total_payments = sum(y["totalPayments"] for y in years)
        grand_total_revenue = sum(y["totalRevenue"] for y in years)
        
        return {
            "years": years,
            "grandTotalPayments": grand_total_payments,
            "grandTotalRevenue": round(grand_total_revenue, 2),
            "availableYears": [y["year"] for y in years]
        }

    async def purge_year_data(self, year: int, archive: bool = True, purged_by: str = None) -> Dict[str, Any]:
        """Purge (and optionally archive) payment data for a specific year"""
        from datetime import datetime, timezone
        
        # Define date range for the year
        start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        
        # Find all payments for this year
        query = {
            "createdAt": {"$gte": start_date, "$lt": end_date}
        }
        
        payments_to_purge = await self.collection.find(query).to_list(length=10000)
        
        if not payments_to_purge:
            return {
                "year": year,
                "archived": 0,
                "deleted": 0,
                "message": f"No payment records found for {year}"
            }
        
        archived_count = 0
        deleted_count = 0
        
        # Archive if requested
        if archive:
            archive_collection = self.db.payment_history_archive
            
            # Add archive metadata to each payment
            for payment in payments_to_purge:
                payment["archivedAt"] = datetime.now(timezone.utc)
                payment["archivedBy"] = purged_by
                payment["originalId"] = payment.pop("_id")
            
            # Insert into archive
            if payments_to_purge:
                await archive_collection.insert_many(payments_to_purge)
                archived_count = len(payments_to_purge)
        
        # Delete from main collection
        delete_result = await self.collection.delete_many(query)
        deleted_count = delete_result.deleted_count
        
        return {
            "year": year,
            "archived": archived_count,
            "deleted": deleted_count,
            "message": f"Successfully purged {deleted_count} payment records for {year}" + 
                      (f" (archived {archived_count})" if archive else "")
        }

    async def get_payments_by_year(self, year: int) -> List[Dict[str, Any]]:
        """Get all payments for a specific year"""
        from datetime import datetime, timezone
        
        start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        
        cursor = self.collection.find({
            "createdAt": {"$gte": start_date, "$lt": end_date}
        }).sort("createdAt", -1)
        
        payments = await cursor.to_list(length=1000)
        
        result = []
        for payment in payments:
            result.append({
                "id": str(payment["_id"]),
                "username": payment.get("username"),
                "amount": payment.get("amount", 0),
                "paymentType": payment.get("paymentType", "one_time"),
                "paymentMethod": payment.get("paymentMethod", "-"),
                "promoCode": payment.get("promoCode"),
                "status": payment.get("status", "completed"),
                "createdAt": payment.get("createdAt").isoformat() if payment.get("createdAt") else None
            })
        
        return result
