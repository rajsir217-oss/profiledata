from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from config import Settings

async def fix():
    s = Settings()
    client = AsyncIOMotorClient(s.mongodb_url)
    db = client[s.database_name]
    
    # Find emails with comma (multiple emails)
    cursor = db.invitations.find({'email': {'$regex': r','}})
    invitations = await cursor.to_list(None)
    
    print(f'Found {len(invitations)} invitations with multiple emails:\n')
    
    for inv in invitations:
        old_email = inv['email']
        # Take the first email before the comma
        new_email = old_email.split(',')[0].strip()
        print(f'  {inv["name"]}: {old_email} → {new_email}')
        
        await db.invitations.update_one(
            {'_id': inv['_id']},
            {'$set': {'email': new_email}}
        )
    
    print(f'\n✅ Fixed {len(invitations)} emails')
    
    client.close()

asyncio.run(fix())
