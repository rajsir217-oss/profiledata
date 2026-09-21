"""Add cleanup targets for archive/analytics collections to the "Database Cleanup" dynamic job.

Run (production — default):
    python migrations/update_database_cleanup_targets.py

Run against local dev:
    ENV_FILE=.env python migrations/update_database_cleanup_targets.py

Idempotent: existing targets are preserved; only missing ones are appended.
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Default to production config; override with ENV_FILE=.env for local dev.
ENV_FILE = os.getenv("ENV_FILE", ".env.production")
load_dotenv(ENV_FILE)
URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB = os.getenv("DATABASE_NAME", os.getenv("DB_NAME", "matrimonialDB"))

# Targets to ensure exist on the "Database Cleanup" job.
NEW_TARGETS = [
    {"collection": "contribution_activity_archive", "days_old": 90, "date_field": "archived_at"},
    {"collection": "email_analytics", "days_old": 90, "date_field": "timestamp"},
    {"collection": "weekly_user_stats_archive", "days_old": 90, "date_field": "archivedAt"},
]


async def main():
    c = AsyncIOMotorClient(URL)
    db = c[DB]

    job = await db.dynamic_jobs.find_one({"name": "Database Cleanup"})
    if not job:
        print("❌ No 'Database Cleanup' job found")
        c.close()
        return

    targets = list(job.get("parameters", {}).get("cleanup_targets", []))
    existing = {t.get("collection") for t in targets}

    added = []
    for target in NEW_TARGETS:
        if target["collection"] not in existing:
            targets.append(target)
            added.append(target["collection"])

    if not added:
        print("✅ All cleanup targets already present. No changes needed.")
        c.close()
        return

    result = await db.dynamic_jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {"parameters.cleanup_targets": targets}}
    )

    print(f"✅ Updated job (modified={result.modified_count})")
    for name in added:
        print(f"   + {name}")

    # Verify
    job2 = await db.dynamic_jobs.find_one({"name": "Database Cleanup"})
    final = {t.get("collection") for t in job2.get("parameters", {}).get("cleanup_targets", [])}
    print("\nFinal cleanup targets:")
    for t in job2.get("parameters", {}).get("cleanup_targets", []):
        print(f"   - {t.get('collection')} (days_old={t.get('days_old')}, date_field={t.get('date_field')})")

    c.close()


if __name__ == "__main__":
    asyncio.run(main())
