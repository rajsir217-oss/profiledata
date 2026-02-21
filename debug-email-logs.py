#!/usr/bin/env python3

"""
Debug script to check email delivery logs
"""

import sys
import os
sys.path.append('/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend')

try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
    
    # Load environment
    load_dotenv()
    
    # Connect to MongoDB
    mongodb_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    print(f'🔗 Connecting to MongoDB: {mongodb_url}')
    
    client = MongoClient(mongodb_url)
    db = client.matrimonialDB
    
    print('\n📊 Checking notification logs...')
    
    # Check total logs
    total_logs = db.notification_log.count_documents({})
    print(f'Total notification logs: {total_logs}')
    
    # Check email logs specifically
    email_logs = list(db.notification_log.find({'channel': 'email'}).limit(3))
    print(f'Email logs found: {len(email_logs)}')
    
    if email_logs:
        print('\n📧 Sample email log:')
        for log in email_logs:
            print(f'  Username: {log.get("username")}')
            print(f'  Trigger: {log.get("trigger")}')
            print(f'  Status: {log.get("status")}')
            print(f'  Sent At: {log.get("sentAt")}')
            print(f'  Created At: {log.get("createdAt")}')
            print('  ---')
    
    # Check all channels
    print('\n📋 All channels in logs:')
    pipeline = [
        {'$group': {'_id': '$channel', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    channel_stats = list(db.notification_log.aggregate(pipeline))
    
    for stat in channel_stats:
        print(f'  {stat["_id"]}: {stat["count"]} logs')
    
    # Check recent logs
    print('\n🕐 Recent logs (last 24 hours):')
    from datetime import datetime, timedelta
    yesterday = datetime.utcnow() - timedelta(days=1)
    
    recent_logs = list(db.notification_log.find({
        'createdAt': {'$gte': yesterday}
    }).sort('createdAt', -1).limit(5))
    
    print(f'Recent logs: {len(recent_logs)}')
    for log in recent_logs:
        print(f'  {log.get("createdAt")} - {log.get("channel")} - {log.get("trigger")} - {log.get("username")}')
    
    # Check if email notifier job exists
    print('\n🔧 Checking email notifier job...')
    email_job = db.dynamic_jobs.find_one({'template_name': 'email_notifier'})
    if email_job:
        print(f'Email notifier job found: {email_job.get("status", "unknown")}')
        print(f'Last run: {email_job.get("last_run", "never")}')
    else:
        print('❌ Email notifier job not found!')
    
    # Check notification queue for email items
    print('\n📬 Checking notification queue for email items...')
    email_queue = list(db.notification_queue.find({'channels': 'email'}).limit(3))
    print(f'Email items in queue: {len(email_queue)}')
    
    if email_queue:
        for item in email_queue:
            print(f'  {item.get("username")} - {item.get("trigger")} - {item.get("status")}')
    
    client.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
