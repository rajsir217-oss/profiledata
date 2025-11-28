from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from config import Settings

async def check():
    s = Settings()
    client = AsyncIOMotorClient(s.mongodb_url)
    db = client[s.database_name]
    
    count = await db.invitations.count_documents({})
    print(f'Total invitations: {count}')
    
    with_subject = await db.invitations.count_documents({'emailSubject': {'$exists': True}})
    print(f'With emailSubject: {with_subject}')
    
    with_comments = await db.invitations.count_documents({'comments': {'$exists': True}})
    print(f'With comments: {with_comments}')
    
    # Check one with comments
    inv_with_comments = await db.invitations.find_one({'comments': {'$exists': True}})
    if inv_with_comments:
        print(f'\nSample with comments:')
        print(f'  name: {inv_with_comments.get("name")}')
        print(f'  comments: {inv_with_comments.get("comments")}')
        print(f'  emailSubject: {inv_with_comments.get("emailSubject")}')
    
    client.close()

asyncio.run(check())
