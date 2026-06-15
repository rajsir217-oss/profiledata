#!/usr/bin/env python3
"""
Backfill updatedAt from legacy updated_at
========================================

Purpose:
- For user docs missing `updatedAt`, populate it from:
  1) `updated_at` (legacy), else
  2) `createdAt` (fallback)

This improves "Newest Members" freshness sorting and updated-profile visibility.
"""

import asyncio
import os
from datetime import datetime

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "matrimonialDB")


def _to_datetime(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


async def run_backfill():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    print("🔧 Starting updatedAt backfill migration")
    print(f"   DB: {DATABASE_NAME}")

    missing_updated_at_query = {
        "$or": [
            {"updatedAt": {"$exists": False}},
            {"updatedAt": None},
            {"updatedAt": ""},
        ]
    }

    total_users = await db.users.count_documents({})
    missing_count = await db.users.count_documents(missing_updated_at_query)

    print(f"📊 Total users: {total_users}")
    print(f"📊 Missing updatedAt: {missing_count}")

    users = await db.users.find(
        missing_updated_at_query,
        {"_id": 1, "username": 1, "updated_at": 1, "createdAt": 1, "updatedAt": 1},
    ).to_list(length=None)

    from_updated_at = 0
    from_created_at = 0
    skipped = 0

    for user in users:
        legacy_updated = _to_datetime(user.get("updated_at"))
        created_at = _to_datetime(user.get("createdAt"))

        source = legacy_updated or created_at
        if source is None:
            skipped += 1
            continue

        # Store as ISO string for consistency with current app writes.
        source_iso = source.isoformat()

        result = await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"updatedAt": source_iso}},
        )

        if result.modified_count > 0:
            if legacy_updated is not None:
                from_updated_at += 1
            else:
                from_created_at += 1

    print("✅ Backfill complete")
    print(f"   Updated from updated_at: {from_updated_at}")
    print(f"   Updated from createdAt: {from_created_at}")
    print(f"   Skipped (no parseable source): {skipped}")

    remaining_missing = await db.users.count_documents(missing_updated_at_query)
    print(f"   Remaining missing updatedAt: {remaining_missing}")

    client.close()


if __name__ == "__main__":
    asyncio.run(run_backfill())
