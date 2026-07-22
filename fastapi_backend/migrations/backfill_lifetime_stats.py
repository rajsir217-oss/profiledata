"""
Migration: Backfill lifetime engagement stats for existing users
Created: Jul 21, 2026
Purpose: Populate user.lifetimeStats and conversation_partners from existing data
"""

from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase


async def up(db: AsyncIOMotorDatabase):
    """Backfill lifetime totals for favorites, shortlists, messages, and views for all users"""

    users_cursor = db.users.find({}, {"username": 1})
    users = await users_cursor.to_list(length=None)
    total = len(users)
    processed = 0

    for user in users:
        username = user.get("username")
        if not username:
            continue

        # Favorites: received + sent
        fav_received = await db.favorites.count_documents({"favoriteUsername": username})
        fav_sent = await db.favorites.count_documents({"userUsername": username})
        lifetime_fav = fav_received + fav_sent

        # Shortlists: received + sent
        short_received = await db.shortlists.count_documents({"shortlistedUsername": username})
        short_sent = await db.shortlists.count_documents({"userUsername": username})
        lifetime_short = short_received + short_sent

        # Messages: sent + received, supporting mixed camelCase and snake_case field names
        msg_sent_snake = await db.messages.count_documents({"from_username": username})
        msg_received_snake = await db.messages.count_documents({"to_username": username})
        msg_sent_camel = await db.messages.count_documents({"fromUsername": username})
        msg_received_camel = await db.messages.count_documents({"toUsername": username})
        lifetime_messages = msg_sent_snake + msg_received_snake + msg_sent_camel + msg_received_camel

        # Views: sum viewCount for both received and given
        views_received_result = await db.profile_views.aggregate([
            {"$match": {"profileUsername": username}},
            {"$group": {"_id": None, "total": {"$sum": "$viewCount"}}}
        ]).to_list(1)
        views_given_result = await db.profile_views.aggregate([
            {"$match": {"viewedByUsername": username}},
            {"$group": {"_id": None, "total": {"$sum": "$viewCount"}}}
        ]).to_list(1)
        lifetime_views = (views_received_result[0]["total"] if views_received_result else 0) + (views_given_result[0]["total"] if views_given_result else 0)

        # Update user's lifetime stats
        await db.users.update_one(
            {"username": username},
            {"$set": {
                "lifetimeStats": {
                    "favorites": lifetime_fav,
                    "shortlists": lifetime_short,
                    "messages": lifetime_messages,
                    "views": lifetime_views
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
