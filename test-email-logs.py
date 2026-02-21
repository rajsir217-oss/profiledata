#!/usr/bin/env python3

"""
Test script to generate sample email logs for testing
"""

import sys
import os
sys.path.append('/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend')

try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
    from datetime import datetime
    
    # Load environment
    load_dotenv()
    
    # Connect to MongoDB
    mongodb_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    print(f'🔗 Connecting to MongoDB: {mongodb_url}')
    
    client = MongoClient(mongodb_url)
    db = client.matrimonialDB
    
    print('\n📧 Creating sample email logs...')
    
    # Sample email logs
    sample_logs = [
        {
            'username': 'test_user1',
            'trigger': 'new_match',
            'channel': 'email',
            'priority': 'medium',
            'status': 'sent',
            'subject': '💕 You have a new match!',
            'preview': 'Great news! You matched with someone special.',
            'cost': 0.0,
            'sentAt': datetime.utcnow(),
            'createdAt': datetime.utcnow(),
            'opened': False,
            'templateData': {
                'recipient': {'firstName': 'John', 'username': 'test_user1'},
                'match': {'firstName': 'Jane', 'age': 28}
            }
        },
        {
            'username': 'test_user2',
            'trigger': 'mutual_favorite',
            'channel': 'email',
            'priority': 'high',
            'status': 'sent',
            'subject': '💖 It\'s a mutual favorite!',
            'preview': 'You both favorited each other - this could be special!',
            'cost': 0.0,
            'sentAt': datetime.utcnow(),
            'createdAt': datetime.utcnow(),
            'opened': True,
            'openedAt': datetime.utcnow(),
            'templateData': {
                'recipient': {'firstName': 'Sarah', 'username': 'test_user2'},
                'match': {'firstName': 'Mike', 'age': 32}
            }
        },
        {
            'username': 'test_user3',
            'trigger': 'profile_view',
            'channel': 'email',
            'priority': 'low',
            'status': 'failed',
            'subject': '👁️ Someone viewed your profile',
            'preview': 'Your profile caught someone\'s attention.',
            'cost': 0.0,
            'sentAt': datetime.utcnow(),
            'createdAt': datetime.utcnow(),
            'error': 'SMTP connection timeout',
            'templateData': {
                'recipient': {'firstName': 'Emily', 'username': 'test_user3'},
                'viewer': {'firstName': 'David'}
            }
        }
    ]
    
    # Insert sample logs
    result = db.notification_log.insert_many(sample_logs)
    print(f'✅ Created {len(result.inserted_ids)} sample email logs')
    
    # Verify insertion
    email_count = db.notification_log.count_documents({'channel': 'email'})
    print(f'📊 Total email logs in database: {email_count}')
    
    # Show recent logs
    recent_logs = list(db.notification_log.find({'channel': 'email'}).sort('sentAt', -1).limit(3))
    print('\n📋 Recent email logs:')
    for log in recent_logs:
        print(f'  {log.get("sentAt")} - {log.get("username")} - {log.get("trigger")} - {log.get("status")}')
    
    client.close()
    print('\n🎉 Test data created successfully!')
    print('🌐 Now visit: http://localhost:3000/notification-management')
    print('📱 Click on "DeliveryLog" tab, then "Email Log" sub-tab')
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
