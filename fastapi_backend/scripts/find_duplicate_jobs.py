import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_all_cleanup_jobs():
    # Try both local and parent directory paths for .env.production
    if os.path.exists('.env.production'):
        load_dotenv('.env.production')
    elif os.path.exists('fastapi_backend/.env.production'):
        load_dotenv('fastapi_backend/.env.production')
    
    mongodb_url = os.getenv('MONGODB_URL')
    if not mongodb_url:
        print("❌ MONGODB_URL not found in environment variables")
        return
        
    try:
        client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
        db = client.matrimonialDB
        
        print(f"Connected to production: {mongodb_url.split('@')[-1].split('/')[0] if '@' in mongodb_url else 'unknown'}")
        
        print("\n--- dynamic_jobs ---")
        d_jobs = await db.dynamic_jobs.find({
            '$or': [
                {'template_type': 'database_cleanup'},
                {'templateType': 'database_cleanup'},
                {'name': {'$regex': 'Cleanup', '$options': 'i'}}
            ]
        }).to_list(length=10)
        
        if not d_jobs:
            print("No jobs found in dynamic_jobs")
        for j in d_jobs:
            print(f"ID: {j['_id']}, Name: {j.get('name')}, Template: {j.get('template_type') or j.get('templateType')}")
            targets = j.get('parameters', {}).get('cleanup_targets', [])
            print(f"  Targets ({len(targets)}): {[t.get('collection') for t in targets]}")
            je_target = next((t for t in targets if t.get('collection') == 'job_executions'), None)
            if je_target:
                print(f"  -> job_executions field: {je_target.get('date_field')}")

        print("\n--- scheduled_jobs ---")
        s_jobs = await db.scheduled_jobs.find({
            '$or': [
                {'template_type': 'database_cleanup'},
                {'templateType': 'database_cleanup'},
                {'name': {'$regex': 'Cleanup', '$options': 'i'}}
            ]
        }).to_list(length=10)
        
        if not s_jobs:
            print("No jobs found in scheduled_jobs")
        for j in s_jobs:
            print(f"ID: {j['_id']}, Name: {j.get('name')}, Template: {j.get('template_type') or j.get('templateType')}")
            targets = j.get('parameters', {}).get('cleanup_targets', [])
            print(f"  Targets ({len(targets)}): {[t.get('collection') for t in targets]}")

        client.close()
    except Exception as e:
        print(f" Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_all_cleanup_jobs())
