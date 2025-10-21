"""Check if jobs have enabled field"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_jobs():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.matrimonialDB
    
    jobs = await db.dynamic_jobs.find().to_list(length=10)
    
    print(f"Found {len(jobs)} jobs\n")
    
    for job in jobs:
        print(f"Job: {job.get('name', 'NO NAME')}")
        print(f"  _id: {job.get('_id')}")
        print(f"  Has 'enabled' field: {'enabled' in job}")
        print(f"  enabled value: {job.get('enabled', 'NOT SET')}")
        print(f"  templateType: {job.get('templateType', 'NOT SET')}")
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_jobs())
