#!/usr/bin/env python3
"""
Migration: Disable Email/SMS Channels for Activity Notification Triggers

This one-time migration updates existing notification preference documents so
activity triggers never contain email/sms channels.

Affected triggers:
- profile_view
- favorited
- profile_visibility_spike
- search_appearance

Run:
  python -m migrations.disable_activity_email_sms_channels
  python -m migrations.disable_activity_email_sms_channels --env production
  python -m migrations.disable_activity_email_sms_channels --dry-run
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient


# Add parent dir to path so config is importable
sys.path.insert(0, str(Path(__file__).parent.parent))


parser = argparse.ArgumentParser(
    description="Disable email/sms channels for activity notification triggers"
)
parser.add_argument(
    "--env",
    default=None,
    help="Environment: local, staging, production, docker, test",
)
parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Preview changes without updating database",
)
args = parser.parse_args()

if args.env:
    os.environ["APP_ENVIRONMENT"] = args.env
    print(f"🔧 Using environment: {args.env}")


from config import Settings


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


ACTIVITY_TRIGGERS = (
    "profile_view",
    "favorited",
    "profile_visibility_spike",
    "search_appearance",
)


def _build_needs_update_query():
    """Find docs where activity channels are missing or include blocked channels."""
    conditions = [{"channels": {"$exists": False}}]
    for trigger in ACTIVITY_TRIGGERS:
        field = f"channels.{trigger}"
        conditions.append({field: {"$exists": False}})
        conditions.append({field: {"$in": ["email", "sms"]}})
    return {"$or": conditions}


def _build_activity_channel_expr(trigger):
    """Mongo expression to coerce trigger channels to array without email/sms."""
    source_path = f"$channels.{trigger}"
    return {
        "$let": {
            "vars": {
                "current": {"$ifNull": [source_path, []]}
            },
            "in": {
                "$cond": [
                    {"$isArray": "$$current"},
                    {
                        "$filter": {
                            "input": "$$current",
                            "as": "channel",
                            "cond": {
                                "$and": [
                                    {"$ne": ["$$channel", "email"]},
                                    {"$ne": ["$$channel", "sms"]},
                                ]
                            },
                        }
                    },
                    [],
                ]
            },
        }
    }


async def migrate():
    settings = Settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    collection = db.notification_preferences

    logger.info("🔌 Connecting to MongoDB")
    logger.info(f"📦 Database: {settings.database_name}")
    logger.info(f"🧪 Dry run: {args.dry_run}")

    total_docs = await collection.count_documents({})
    logger.info(f"📊 notification_preferences documents: {total_docs}")

    query = _build_needs_update_query()
    needing_update = await collection.count_documents(query)

    scanned = total_docs
    errors = 0

    if args.dry_run:
        changed = needing_update
        updated = 0
    else:
        set_fields = {
            f"channels.{trigger}": _build_activity_channel_expr(trigger)
            for trigger in ACTIVITY_TRIGGERS
        }
        set_fields["updatedAt"] = datetime.now(timezone.utc)

        result = await collection.update_many(
            query,
            [{"$set": set_fields}],
        )
        changed = result.modified_count
        updated = result.modified_count

    logger.info("=" * 60)
    logger.info("✅ Migration summary")
    logger.info(f"Scanned: {scanned}")
    logger.info(f"Would change: {changed}" if args.dry_run else f"Changed: {changed}")
    if not args.dry_run:
        logger.info(f"Updated: {updated}")
        remaining = await collection.count_documents(query)
        logger.info(f"Remaining needing update: {remaining}")
    logger.info(f"Errors: {errors}")

    client.close()
    logger.info("🔌 MongoDB connection closed")


if __name__ == "__main__":
    asyncio.run(migrate())
