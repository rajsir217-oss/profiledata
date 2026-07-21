"""
Migration: Backfill lifetime engagement stats for existing users
Created: Jul 21, 2026
Purpose: Populate user.lifetimeStats and conversation_partners from existing data
"""

from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase


async def up(db: AsyncIOMotorDatabase):
    """Backfill lifetime favorites, shortlists, and conversations for all users"""

    # Ensure conversation_partners collection exists for immutable unique-pair tracking
    try:
        await db.create_collection("conversation_partners")
        print("✅ Created conversation_partners collection")
    except Exception as e:
        if "already exists" in str(e):
            print("ℹ️ conversation_partners already exists, skipping creation")
        else:
            raise

    users_cursor = db.users.find({}, {"username": 1})
    users = await users_cursor.to_list(length=None)
    total = len(users)
    processed = 0

    for user in users:
        username = user.get("username")
        if not username:
            continue

        # Lifetime distinct users who ever favorited/shortlisted this user
        # (Current collections only hold active records; this is the best available historical proxy.)
        lifetime_fav = len(await db.favorites.distinct("userUsername", {"favoriteUsername": username}))
        lifetime_short = len(await db.shortlists.distinct("userUsername", {"shortlistedUsername": username}))

        # Lifetime unique conversation partners from the messages collection
        sent_to = await db.messages.distinct("to_username", {"from_username": username})
        received_from = await db.messages.distinct("from_username", {"to_username": username})
        partners = set(sent_to) | set(received_from)
        lifetime_conv = len(partners)

        # Populate immutable conversation_partners records so future messages don't double-count
        for partner in partners:
            sorted_pair = sorted([username, partner])
            pair_id = "|".join(sorted_pair)
            await db.conversation_partners.update_one(
                {"_id": pair_id},
                {"$setOnInsert": {"participants": sorted_pair, "createdAt": datetime.utcnow()}},
                upsert=True
            )

        # Update user's lifetime stats
        await db.users.update_one(
            {"username": username},
            {"$set": {
                "lifetimeStats": {
                    "favoritesReceived": lifetime_fav,
                    "shortlistsReceived": lifetime_short,
                    "conversations": lifetime_conv
                }
            }}
        )

        processed += 1
        if processed % 10 == 0:
            print(f"⏳ Processed {processed}/{total} users")

    print(f"✅ Backfilled lifetime stats for {processed} users")


async def down(db: AsyncIOMotorDatabase):
    """Remove lifetime stats and drop conversation_partners"""

    await db.users.update_many({}, {"$unset": {"lifetimeStats": ""}})

    try:
        await db.conversation_partners.drop()
        print("✅ Dropped conversation_partners collection")
    except Exception as e:
        print(f"⚠️ Failed to drop conversation_partners: {e}")

    print("✅ Removed lifetimeStats from all users")
