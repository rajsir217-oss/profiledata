"""
Migration: Sync Promo Code Usage Counts
Created: December 26, 2025
Purpose: Count users with each promoCode and update the promo_codes collection

Run with: python migrations/sync_promo_code_counts.py
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()


async def sync_promo_code_counts():
    """Sync promo code usage counts with actual user data"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("🔄 Syncing promo code usage counts...")
    
    # Get all promo codes
    promo_codes = await db.promo_codes.find({}).to_list(length=None)
    print(f"📊 Found {len(promo_codes)} promo codes")
    
    for promo in promo_codes:
        code = promo.get("code")
        if not code:
            continue
        
        # Count users with this promo code (case-insensitive)
        user_count = await db.users.count_documents({
            "promoCode": {"$regex": f"^{code}$", "$options": "i"}
        })
        
        # Update the promo code with actual counts
        result = await db.promo_codes.update_one(
            {"code": code},
            {
                "$set": {
                    "registrations": user_count,
                    "currentUses": user_count
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"✅ {code}: Updated to {user_count} registrations")
        else:
            print(f"ℹ️  {code}: Already at {user_count} registrations (no change)")
    
    # Close connection
    client.close()
    print("\n✅ Sync complete!")


if __name__ == "__main__":
    asyncio.run(sync_promo_code_counts())
