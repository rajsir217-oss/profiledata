import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_collections():
    load_dotenv('fastapi_backend/.env.production')
    mongodb_url = os.getenv('MONGODB_URL')
    if not mongodb_url:
        load_dotenv('fastapi_backend/.env')
        mongodb_url = os.getenv('MONGODB_URL')
        
    client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    db = client.matrimonialDB
    
    collections = await db.list_collection_names()
    print(f"Collections: {collections}")
    
    print("\n--- scheduled_jobs ---")
    s_jobs = await db.scheduled_jobs.find({'templateType': 'database_cleanup'}).to_list(length=5)
    for j in s_jobs:
        print(f"ID: {j['_id']}, Name: {j.get('name')}")
        
    print("\n--- dynamic_jobs ---")
    d_jobs = await db.dynamic_jobs.find({'template_type': 'database_cleanup'}).to_list(length=5)
    for j in d_jobs:
        print(f"ID: {j['_id']}, Name: {j.get('name')}")
        print(f"Parameters: {j.get('parameters', {}).get('cleanup_targets')}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_collections())
