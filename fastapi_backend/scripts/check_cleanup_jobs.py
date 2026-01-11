import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_jobs():
    load_dotenv('fastapi_backend/.env.production')
    mongodb_url = os.getenv('MONGODB_URL')
    if not mongodb_url:
        load_dotenv('fastapi_backend/.env')
        mongodb_url = os.getenv('MONGODB_URL')
        
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    print(f"Checking jobs in {mongodb_url.split('@')[-1] if '@' in mongodb_url else 'unknown'}")
    
    jobs = await db.scheduled_jobs.find({'templateType': 'database_cleanup'}).to_list(length=10)
    print(f"Found {len(jobs)} cleanup jobs")
    
    for job in jobs:
        print(f"\nJob ID: {job['_id']}")
        print(f"Name: {job.get('name')}")
        print(f"Targets: {len(job.get('parameters', {}).get('cleanup_targets', []))}")
        for target in job.get('parameters', {}).get('cleanup_targets', []):
            print(f"  - {target.get('collection')}: {target.get('date_field')} ({target.get('days_old')} days)")
            
    client.close()

if __name__ == "__main__":
    asyncio.run(check_jobs())
