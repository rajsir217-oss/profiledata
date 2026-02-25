#!/usr/bin/env python3
"""
Debug Messages Issue
Check why frontend is not showing messages
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta

async def debug_messages():
    """Debug why frontend doesn't show messages"""
    
    load_dotenv('.env')
    mongodb_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    database_name = os.getenv('DATABASE_NAME', 'matrimonialDB')
    client = AsyncIOMotorClient(mongodb_url)
    db = client[database_name]
    
    print('🔍 Debugging Frontend Messages Issue')
    print('=' * 50)
    
    # 1. Check admin user
    admin_user = await db.users.find_one({'username': 'admin'})
    print(f'1. Admin user exists: {admin_user is not None}')
    
    # 2. Check messages collection
    total_messages = await db.messages.count_documents({})
    print(f'2. Total messages in DB: {total_messages}')
    
    # 3. Check different field names
    to_username_count = await db.messages.count_documents({'to_username': 'admin'})
    username_count = await db.messages.count_documents({'username': 'admin'})
    print(f'3. Messages with to_username=admin: {to_username_count}')
    print(f'   Messages with username=admin: {username_count}')
    
    # 4. Check sample message structure
    sample_msg = await db.messages.find_one({'to_username': 'admin'})
    if sample_msg:
        print(f'4. Sample message fields: {list(sample_msg.keys())}')
    
    # 5. Check if frontend might be filtering by date
    now = datetime.utcnow()
    one_day_ago = now - timedelta(days=1)
    recent_messages = await db.messages.count_documents({
        'to_username': 'admin',
        'timestamp': {'$gte': one_day_ago}
    })
    print(f'5. Recent messages (last 24h): {recent_messages}')
    
    # 6. Check all messages to admin with details
    all_admin_msgs = await db.messages.find({'to_username': 'admin'}).limit(5).to_list(None)
    print(f'6. First 5 messages to admin:')
    for i, msg in enumerate(all_admin_msgs, 1):
        print(f'   {i}. From: {msg.get("from_username", "unknown")}')
        print(f'      Message: {msg.get("message", "No message")[:30]}...')
        print(f'      Read: {msg.get("is_read", False)}')
        print(f'      Timestamp: {msg.get("timestamp")}')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(debug_messages())
