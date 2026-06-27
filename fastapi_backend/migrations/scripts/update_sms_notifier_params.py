"""
Update sms_notifier job parameters in production MongoDB:
- batchSize: 10 (per run, every 5 min)
- maxDailyMessages: 50 (daily hard cap, reserves ~50 slots for OTP/MFA)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGODB_URL = "mongodb+srv://rajl3v3l_db_user:3F01eZUHTY9tx07u@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority&appName=MongoCluster0"

async def update_sms_notifier_params():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client.matrimonialDB

    job = await db.dynamic_jobs.find_one({"template_type": "sms_notifier"})
    if not job:
        print("❌ sms_notifier job not found in dynamic_jobs")
        client.close()
        return

    print(f"Found job: {job.get('_id')}")
    print(f"Current parameters: {job.get('parameters')}")

    result = await db.dynamic_jobs.update_one(
        {"template_type": "sms_notifier"},
        {"$set": {
            "parameters.batchSize": 10,
            "parameters.maxDailyMessages": 50,
            "updatedAt": datetime.utcnow()
        }}
    )

    if result.modified_count == 1:
        updated = await db.dynamic_jobs.find_one({"template_type": "sms_notifier"})
        print(f"\n✅ Updated parameters: {updated.get('parameters')}")
    else:
        print("⚠️  No changes made (already up to date?)")

    client.close()

if __name__ == "__main__":
    asyncio.run(update_sms_notifier_params())
