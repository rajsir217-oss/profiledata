"""
Seed the PUBLIC promo code for Registration Interest invitations.
Run: python scripts/seed_public_promo.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

# Load production MongoDB URL from .env.production
from dotenv import dotenv_values
env_prod_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.production")
prod_config = dotenv_values(env_prod_path)

MONGODB_URL = prod_config.get("MONGODB_URL", "")
DATABASE_NAME = prod_config.get("DATABASE_NAME", "matrimonialDB")

if not MONGODB_URL:
    print("❌ MONGODB_URL not found in .env.production")
    sys.exit(1)

print(f"🔗 Connecting to production DB: {DATABASE_NAME}")


async def seed_public_promo():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    existing = await db.promo_codes.find_one({"code": "PUBLIC"})
    if existing:
        print("✅ PUBLIC promo code already exists")
        return

    promo = {
        "code": "PUBLIC",
        "name": "Public Registration",
        "type": "campaign",
        "description": "Auto-applied to users who register via the public Registration Interest form",
        "discountType": "none",
        "discountValue": 0,
        "applicablePlans": [],
        "defaultPlan": "premium",
        "planPricing": None,
        "validFrom": None,
        "validUntil": None,
        "maxUses": None,  # Unlimited
        "tags": ["public", "interest-form", "auto"],
        "currentUses": 0,
        "isActive": True,
        "isArchived": False,
        "archivedAt": None,
        "createdBy": "system",
        "linkedToUser": None,
        "qrCodeUrl": None,
        "invitationLink": None,
        "registrations": 0,
        "conversions": 0,
        "revenue": 0,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }

    result = await db.promo_codes.insert_one(promo)
    print(f"✅ Created PUBLIC promo code (id: {result.inserted_id})")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed_public_promo())
