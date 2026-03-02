"""Fix push_notifier job schema. Run: python migrations/fix_push_notifier_job.py"""
import asyncio, os
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.getenv("ENV_FILE", ".env"))
URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB = os.getenv("DATABASE_NAME", os.getenv("DB_NAME", "matrimonialDB"))

async def main():
    c = AsyncIOMotorClient(URL)
    db = c[DB]
    job = await db.dynamic_jobs.find_one({"name": "push_notifier"})
    if not job:
        print("No push_notifier job found"); c.close(); return
    print(f"Found job {job['_id']}")
    s, u = {"updatedAt": datetime.utcnow(), "nextRunAt": datetime.utcnow()}, {}
    if "enabled" not in job:
        s["enabled"] = job.get("isEnabled", True)
    if "isEnabled" in job:
        u["isEnabled"] = ""
    if not isinstance(job.get("schedule"), dict) or not job.get("schedule"):
        s["schedule"] = {"type":"interval","interval_seconds": job.get("interval", 60)}
    for f in ["schedule_type","interval","cron_expression"]:
        if f in job: u[f] = ""
    op = {"$set": s}
    if u: op["$unset"] = u
    r = await db.dynamic_jobs.update_one({"_id": job["_id"]}, op)
    print(f"Job updated: {r.modified_count}")
    cut = datetime.utcnow() - timedelta(minutes=10)
    r2 = await db.notification_queue.update_many(
        {"status":"processing","$or":[{"channels":{"$in":["push"]}},{"channel":"push"}],
         "processingStartedAt":{"$lt":cut}},
        {"$set":{"status":"pending","statusReason":"migration_reset"}})
    print(f"Reset {r2.modified_count} stuck push items")
    c.close()

if __name__ == "__main__":
    asyncio.run(main())
