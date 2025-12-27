"""
Migration: Add Promo Codes to Existing Users
Created: December 26, 2025
Purpose: 
  1. Add promoCode field to all existing users with value "usvedika"
  2. Create the default "USVEDIKA" promo code in promo_codes collection
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Settings


async def run_migration():
    """Run the promo code migration"""
    
    settings = Settings()
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("=" * 60)
    print("PROMO CODE MIGRATION")
    print("=" * 60)
    
    # ============================================
    # Step 1: Update all existing users with promoCode
    # ============================================
    print("\n📝 Step 1: Adding promoCode to existing users...")
    
    # Count users without promoCode
    users_without_code = await db.users.count_documents({
        "$or": [
            {"promoCode": {"$exists": False}},
            {"promoCode": None},
            {"promoCode": ""}
        ]
    })
    
    print(f"   Found {users_without_code} users without promoCode")
    
    if users_without_code > 0:
        result = await db.users.update_many(
            {
                "$or": [
                    {"promoCode": {"$exists": False}},
                    {"promoCode": None},
                    {"promoCode": ""}
                ]
            },
            {
                "$set": {
                    "promoCode": "USVEDIKA",
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        print(f"   ✅ Updated {result.modified_count} users with promoCode: USVEDIKA")
    else:
        print("   ✅ All users already have promoCode")
    
    # ============================================
    # Step 2: Create default USVEDIKA promo code
    # ============================================
    print("\n📝 Step 2: Creating default USVEDIKA promo code...")
    
    existing_code = await db.promo_codes.find_one({"code": "USVEDIKA"})
    
    if existing_code:
        print("   ✅ USVEDIKA promo code already exists")
    else:
        default_promo = {
            "code": "USVEDIKA",
            "name": "USVedika Default",
            "type": "referral",
            "description": "Default referral code for all USVedika members",
            "discountType": "none",
            "discountValue": 0,
            "applicablePlans": [],
            "validFrom": None,
            "validUntil": None,
            "maxUses": None,  # Unlimited
            "tags": ["default", "referral"],
            
            # Usage tracking
            "currentUses": 0,
            "isActive": True,
            
            # Creator info
            "createdBy": "system",
            "linkedToUser": None,
            
            # QR Code
            "qrCodeUrl": None,
            "invitationLink": f"{getattr(settings, 'frontend_url', 'https://usvedika.com')}/register?promo=USVEDIKA",
            
            # Analytics
            "registrations": 0,
            "conversions": 0,
            "revenue": 0,
            
            # Timestamps
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.promo_codes.insert_one(default_promo)
        print("   ✅ Created USVEDIKA promo code")
    
    # ============================================
    # Step 3: Create index on promo_codes collection
    # ============================================
    print("\n📝 Step 3: Creating indexes...")
    
    await db.promo_codes.create_index("code", unique=True)
    await db.promo_codes.create_index("type")
    await db.promo_codes.create_index("isActive")
    await db.promo_codes.create_index("linkedToUser")
    
    print("   ✅ Created indexes on promo_codes collection")
    
    # ============================================
    # Step 4: Create index on users.promoCode
    # ============================================
    await db.users.create_index("promoCode")
    print("   ✅ Created index on users.promoCode")
    
    # ============================================
    # Summary
    # ============================================
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    
    total_users = await db.users.count_documents({})
    users_with_code = await db.users.count_documents({"promoCode": {"$exists": True, "$ne": None, "$ne": ""}})
    total_promo_codes = await db.promo_codes.count_documents({})
    
    print(f"\n📊 Summary:")
    print(f"   Total users: {total_users}")
    print(f"   Users with promoCode: {users_with_code}")
    print(f"   Total promo codes: {total_promo_codes}")
    
    # Close connection
    client.close()
    print("\n✅ Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())
