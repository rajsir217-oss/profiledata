#!/usr/bin/env python3
"""Generate test notification queue items for all active templates.

This script:
- Connects to MongoDB using .env.local (MONGODB_URL)
- Reads all active notification_templates (email/sms/push)
- Prints a summary of templates
- Inserts a pending notification_queue item for each template for a test user

Use this to populate the Event Queue Manager for end-to-end testing.
"""

import asyncio
from datetime import datetime
import os

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv


load_dotenv(".env.local")

MONGODB_URL = os.getenv("MONGODB_URL")
DB_NAME = os.getenv("MONGODB_DB_NAME", "matrimonialDB")
TEST_USERNAME = os.getenv("TEST_NOTIFICATION_USER", "admin")


async def generate_test_queue():
    if not MONGODB_URL:
        raise RuntimeError("MONGODB_URL is not set in .env.local")

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]

    print("🔍 Loading active notification templates...\n")

    cursor = db.notification_templates.find({"active": True})
    templates = await cursor.to_list(length=None)

    if not templates:
        print("❌ No active notification templates found.")
        await client.close()
        return

    print(f"✅ Found {len(templates)} active templates")

    now = datetime.utcnow()
    created = 0

    for tpl in templates:
        trigger = tpl.get("trigger")
        channel = tpl.get("channel", "email")
        subject = tpl.get("subject", "(no subject)")
        tpl_id = str(tpl.get("_id"))

        # Only handle primary channels for queue testing
        if channel not in ("email", "sms", "push"):
            print(f"   ⚠️ Skipping template {tpl_id} (unsupported channel: {channel})")
            continue

        print(f"   • Template {tpl_id} | trigger={trigger} | channel={channel} | subject={subject}")

        # Build a minimal test notification queue document
        queue_doc = {
            "username": TEST_USERNAME,
            "trigger": trigger,
            "channels": [channel],
            "priority": "medium",
            "templateData": {
                "_test": True,
                "templateId": tpl_id,
                "note": "Auto-generated for queue testing"
            },
            "status": "pending",
            "scheduledFor": None,
            "attempts": 0,
            "lastAttempt": None,
            "error": None,
            "createdAt": now,
            "updatedAt": now,
        }

        result = await db.notification_queue.insert_one(queue_doc)
        created += 1
        print(f"     → Queued test notification with _id={result.inserted_id}")

    print("\n📊 Summary:")
    print(f"   Test user: {TEST_USERNAME}")
    print(f"   New queue items created: {created}")

    await client.close()


if __name__ == "__main__":
    asyncio.run(generate_test_queue())
