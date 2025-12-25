from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from config import Settings
import re

async def fix():
    s = Settings()
    client = AsyncIOMotorClient(s.mongodb_url)
    db = client[s.database_name]
    
    # Find emails ending with period
    cursor = db.invitations.find({'email': {'$regex': r'\.$'}})
    invitations = await cursor.to_list(None)
    
    print(f'Found {len(invitations)} invitations with emails ending in period:')
    
    for inv in invitations:
        old_email = inv['email']
        new_email = old_email.rstrip('.')
        print(f'  {old_email} → {new_email}')
        
        await db.invitations.update_one(
            {'_id': inv['_id']},
            {'$set': {'email': new_email}}
        )
    
    print(f'\n✅ Fixed {len(invitations)} emails')
    
    client.close()

asyncio.run(fix())
