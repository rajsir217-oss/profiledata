from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from config import Settings
from models.invitation_models import InvitationDB
from pydantic import ValidationError

async def check():
    s = Settings()
    client = AsyncIOMotorClient(s.mongodb_url)
    db = client[s.database_name]
    
    cursor = db.invitations.find({})
    invitations = await cursor.to_list(None)
    
    print(f'Checking {len(invitations)} invitations...\n')
    
    errors = []
    for doc in invitations:
        try:
            # Try to create InvitationDB model
            doc['id'] = str(doc['_id'])
            InvitationDB(**doc)
        except ValidationError as e:
            errors.append({
                'email': doc.get('email'),
                'name': doc.get('name'),
                'error': str(e)
            })
    
    if errors:
        print(f'❌ Found {len(errors)} invitations with validation errors:\n')
        for err in errors[:10]:  # Show first 10
            print(f"  {err['name']} <{err['email']}>")
            print(f"    Error: {err['error'][:200]}\n")
    else:
        print('✅ All invitations are valid!')
    
    client.close()

asyncio.run(check())
