"""
Seed Payment History Test Data
Run: python scripts/seed_payment_data.py
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone
import random

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


async def seed_payment_data():
    """Add test payment records to the database - Multiple years of data"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔌 Connected to MongoDB")
    
    # Clear existing test payment data
    delete_result = await db.payment_history.delete_many({"createdBy": "seed_script"})
    print(f"🗑️  Cleared {delete_result.deleted_count} existing test payments")
    
    # Get some users who have promo codes
    users_with_promo = await db.users.find(
        {"promoCode": {"$exists": True, "$ne": None, "$ne": ""}},
        {"username": 1, "promoCode": 1, "firstName": 1, "lastName": 1}
    ).limit(30).to_list(length=30)
    
    if not users_with_promo:
        print("❌ No users with promo codes found. Please ensure some users have promoCode set.")
        return
    
    print(f"📋 Found {len(users_with_promo)} users with promo codes")
    
    # Payment types and methods
    payment_types = ["monthly", "quarterly", "yearly", "one_time"]
    payment_methods = ["stripe", "paypal", "credit_card", "bank_transfer"]
    
    # Amounts by type
    amounts_by_type = {
        "monthly": [9.99, 14.99, 19.99, 24.99],
        "quarterly": [29.99, 39.99, 49.99, 59.99],
        "yearly": [99.99, 149.99, 199.99, 249.99],
        "one_time": [29.99, 49.99, 79.99, 99.99]
    }
    
    payments_to_insert = []
    now = datetime.now(timezone.utc)
    
    for user in users_with_promo:
        username = user["username"]
        promo_code = user.get("promoCode")
        
        # Generate 3 years of payment history (2022, 2023, 2024, 2025)
        # Random number of payments per year (2-6 per year for recurring users)
        num_years = random.randint(2, 4)  # 2-4 years of history
        
        for year_offset in range(num_years):
            # Payments per year varies
            payments_this_year = random.randint(1, 6)
            
            for i in range(payments_this_year):
                payment_type = random.choice(payment_types)
                amount = random.choice(amounts_by_type[payment_type])
                method = random.choice(payment_methods)
                
                # Random date within that year
                # year_offset=0 is current year, 1 is last year, etc.
                base_days_ago = year_offset * 365
                days_in_year = random.randint(0, 364)
                total_days_ago = base_days_ago + days_in_year
                
                # Don't go into the future
                if total_days_ago < 0:
                    total_days_ago = random.randint(1, 30)
                
                payment_date = now - timedelta(days=total_days_ago)
                
                payment = {
                    "username": username,
                    "amount": amount,
                    "paymentType": payment_type,
                    "paymentMethod": method,
                    "promoCode": promo_code,
                    "description": f"{payment_type.replace('_', ' ').title()} membership - {payment_date.year}",
                    "transactionId": f"TXN_{username[:4].upper()}_{random.randint(100000, 999999)}",
                    "status": "completed",
                    "createdAt": payment_date,
                    "createdBy": "seed_script",
                    "notes": f"Test data - Year {payment_date.year}"
                }
                
                payments_to_insert.append(payment)
    
    # Insert all payments
    if payments_to_insert:
        result = await db.payment_history.insert_many(payments_to_insert)
        print(f"✅ Inserted {len(result.inserted_ids)} payment records")
        
        # Update promo code revenue
        promo_revenue = {}
        for payment in payments_to_insert:
            code = payment.get("promoCode")
            if code:
                promo_revenue[code] = promo_revenue.get(code, 0) + payment["amount"]
        
        for code, revenue in promo_revenue.items():
            await db.promo_codes.update_one(
                {"code": {"$regex": f"^{code}$", "$options": "i"}},
                {
                    "$inc": {"revenue": revenue},
                    "$set": {"updatedAt": datetime.now(timezone.utc)}
                }
            )
            print(f"   📊 Updated {code} revenue: +${revenue:.2f}")
        
        # Update user isPaid status
        usernames = list(set(p["username"] for p in payments_to_insert))
        await db.users.update_many(
            {"username": {"$in": usernames}},
            {"$set": {"isPaid": True}}
        )
        print(f"   👥 Updated {len(usernames)} users as paid")
    
    # Show summary
    total_payments = await db.payment_history.count_documents({})
    total_revenue = 0
    async for doc in db.payment_history.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]):
        total_revenue = doc.get("total", 0)
    
    print(f"\n📊 Database Summary:")
    print(f"   Total payment records: {total_payments}")
    print(f"   Total revenue: ${total_revenue:.2f}")
    
    client.close()
    print("\n✅ Done!")


if __name__ == "__main__":
    asyncio.run(seed_payment_data())
