#!/usr/bin/env python3
"""
Migration: Update Default Notification Channels for All Users

This one-time migration updates existing notification preference documents to match
the new minimal default settings.

New defaults (EMAIL only enabled):
- monthly_digest
- saved_search_matches
- poll_reminder
- pending_pii_request
- missing_photo_warning
- missing_photo_suspended

All other triggers are disabled (empty array).

Run:
  python -m migrations.update_default_notification_channels
  python -m migrations.update_default_notification_channels --env production
  python -m migrations.update_default_notification_channels --dry-run
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
    description="Update default notification channels for all users"
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


# Triggers to enable with EMAIL
ENABLED_TRIGGERS = (
    "monthly_digest",
    "saved_search_matches",
    "poll_reminder",
    "pending_pii_request",
    "missing_photo_warning",
    "missing_photo_suspended",
)

# All triggers to disable (empty array)
DISABLED_TRIGGERS = (
    "new_match",
    "mutual_favorite",
    "shortlist_added",
    "favorited",
    "new_message",
    "message_read",
    "unread_messages",
    "conversation_cold",
    "profile_view",
    "profile_visibility_spike",
    "search_appearance",
    "pii_request",
    "pii_granted",
    "pii_denied",
    "pii_revoked",
    "suspicious_login",
    "pii_expiring",
    "new_users_matching",
    "profile_incomplete",
    "upload_photos",
    "daily_digest",
    "weekly_digest",
)


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

    # Build update document
    update_fields = {}

    # Set enabled triggers to EMAIL
    for trigger in ENABLED_TRIGGERS:
        update_fields[f"channels.{trigger}"] = ["email"]

    # Set disabled triggers to empty array
    for trigger in DISABLED_TRIGGERS:
        update_fields[f"channels.{trigger}"] = []

    update_fields["updatedAt"] = datetime.now(timezone.utc)

    if args.dry_run:
        logger.info("🔍 Dry run - would update all documents with:")
        for field, value in update_fields.items():
            if field != "updatedAt":
                logger.info(f"  {field}: {value}")
        changed = total_docs
        updated = 0
    else:
        result = await collection.update_many(
            {},  # Update all documents
            {"$set": update_fields}
        )
        changed = result.modified_count
        updated = result.modified_count

    logger.info("=" * 60)
    logger.info("✅ Migration summary")
    logger.info(f"Scanned: {total_docs}")
    logger.info(f"Would change: {changed}" if args.dry_run else f"Changed: {changed}")
    if not args.dry_run:
        logger.info(f"Updated: {updated}")
    logger.info(f"Enabled triggers ({len(ENABLED_TRIGGERS)}): {', '.join(ENABLED_TRIGGERS)}")
    logger.info(f"Disabled triggers ({len(DISABLED_TRIGGERS)}): {', '.join(DISABLED_TRIGGERS)}")

    client.close()
    logger.info("🔌 MongoDB connection closed")


if __name__ == "__main__":
    asyncio.run(migrate())
