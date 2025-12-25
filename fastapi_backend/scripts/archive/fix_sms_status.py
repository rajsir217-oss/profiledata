from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from config import Settings

async def fix():
    s = Settings()
    client = AsyncIOMotorClient(s.mongodb_url)
    db = client[s.database_name]
    
    # Update all 'not_sent' to 'pending'
    result = await db.invitations.update_many(
        {'smsStatus': 'not_sent'},
        {'$set': {'smsStatus': 'pending'}}
    )
    
    print(f'✅ Updated {result.modified_count} invitations: not_sent → pending')
    
    client.close()

asyncio.run(fix())
