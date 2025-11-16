#!/usr/bin/env python3
"""Manual test runner for SavedSearchMatchesNotifierTemplate.

Usage:
  cd fastapi_backend
  python3 test_saved_search_matches_notifier.py

This will:
- Connect to MongoDB using .env.local (MONGODB_URL)
- Build a JobExecutionContext with parameters similar to production
- Call run_saved_search_notifier(db, params)
- Print the JobResult summary and stats

Prerequisites:
- Users with saved searches in `saved_searches` collection
- Each saved search may optionally include `notifications` config as used in the template
"""

import asyncio
import os
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from job_templates.saved_search_matches_notifier import run_saved_search_notifier


async def main() -> None:
    load_dotenv(".env.local")

    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGODB_DB_NAME", "matrimonialDB")

    if not mongodb_url:
        raise RuntimeError("MONGODB_URL is not set in .env.local")

    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]

    # Parameters similar to what the Dynamic Scheduler would pass
    params = {
        "batchSize": 50,
        "lookbackHours": 0,  # 0 = no time filter, find all matching profiles for testing
        # Use frontend URL if available so profile links are correct
        "appUrl": os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "forceRun": True,  # Bypass schedule check for testing
    }

    print("🔍 Running Saved Search Matches Notifier test run...\n")
    print(f"📅 Start time: {datetime.utcnow().isoformat()}Z")
    print(f"📂 Database: {db_name}")
    print(f"🌐 App URL: {params['appUrl']}\n")

    result = await run_saved_search_notifier(db, params)

    print("\n✅ Job finished")
    print(f"Status: {result.status}")
    print(f"Message: {result.message}")
    print(f"Duration: {result.duration_seconds:.2f}s")
    print(f"Records processed: {result.records_processed}")
    print(f"Records affected: {result.records_affected}")
    print(f"Details: {result.details}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
