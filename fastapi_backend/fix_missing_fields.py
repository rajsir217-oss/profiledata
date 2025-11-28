from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from config import Settings
from datetime import datetime

async def fix():
    s = Settings()
    client = AsyncIOMotorClient(s.mongodb_url)
    db = client[s.database_name]
    
    # Find invitations missing fields
    missing_subject = await db.invitations.find({'emailSubject': {'$exists': False}}).to_list(None)
    missing_comments = await db.invitations.find({'comments': {'$exists': False}}).to_list(None)
    
    print(f'Found {len(missing_subject)} missing emailSubject')
    print(f'Found {len(missing_comments)} missing comments')
    
    # Update all missing emailSubject
    result1 = await db.invitations.update_many(
        {'emailSubject': {'$exists': False}},
        {'$set': {
            'emailSubject': "You're Invited to Join USVedika for US Citizens & GC Holders",
            'updatedAt': datetime.utcnow()
        }}
    )
    print(f'✅ Updated {result1.modified_count} invitations with emailSubject')
    
    # Update all missing comments
    result2 = await db.invitations.update_many(
        {'comments': {'$exists': False}},
        {'$set': {
            'comments': '',
            'updatedAt': datetime.utcnow()
        }}
    )
    print(f'✅ Updated {result2.modified_count} invitations with comments')
    
    # Update all missing customMessage
    result3 = await db.invitations.update_many(
        {'customMessage': {'$exists': False}},
        {'$set': {
            'customMessage': '',
            'updatedAt': datetime.utcnow()
        }}
    )
    print(f'✅ Updated {result3.modified_count} invitations with customMessage')
    
    client.close()

asyncio.run(fix())
