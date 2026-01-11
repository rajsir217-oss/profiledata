#!/usr/bin/env python3
"""
Fix saved_search_matches notification template in production database
Remove Jinja2 conditionals that aren't being processed correctly
"""

import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from bson import ObjectId
from dotenv import load_dotenv

# Template without Jinja2 conditionals - use simple variable substitution only
TEMPLATE_BODY = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">💜 L3V3L MATCHES</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">🦋 L3V3L</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            
            <div style="font-size: 20px; color: #2d3748; margin-bottom: 20px; font-weight: 600;">
                Hi {{user.firstName}}! 👋
            </div>
            
            <div style="font-size: 16px; line-height: 1.8; margin-bottom: 30px; color: #333;">
                <p>Great news! We found <strong style="color: #667eea;">{{matchCount}} new match{{plural}}</strong> matching your saved search:</p>
                
                <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <strong style="color: #667eea; font-size: 18px;">🔍 {{searchName}}</strong>
                </div>
            </div>
            
            <!-- Matches HTML will be injected here -->
            {{matchesHtml}}
            
            <div style="text-align: center; margin: 40px 0 20px 0;">
                <a href="{{app.searchUrl}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                    View All Matches →
                </a>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px; font-size: 14px; color: #666;">
                <p><strong>💡 Tip:</strong> You can adjust your notification frequency in your <a href="{{app.preferencesUrl_tracked}}" style="color: #667eea; text-decoration: none;">notification preferences</a>.</p>
            </div>
            
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 30px 20px; text-align: center; color: #666; font-size: 14px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong>L3V3L MATCHES</strong> - Premium Matrimonial Platform</p>
            <p style="margin: 0;">
                <a href="{{app.dashboardUrl}}" style="color: #667eea; text-decoration: none;">Dashboard</a> • 
                <a href="{{app.preferencesUrl_tracked}}" style="color: #667eea; text-decoration: none;">Preferences</a> • 
                <a href="{{app.unsubscribeUrl_tracked}}" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
            </p>
            <img src="{{app.trackingPixelUrl}}" width="1" height="1" alt="" style="display: block; margin: 10px auto 0;">
        </div>
        
    </div>
</body>
</html>"""


async def fix_template():
    # Try .env.local first (for local dev), then .env.production
    if os.path.exists('.env.local'):
        load_dotenv('.env.local')
        print('Using .env.local')
    elif os.path.exists('.env.production'):
        load_dotenv('.env.production')
        print('Using .env.production')
    else:
        load_dotenv('.env')
        print('Using .env')
    
    mongodb_url = os.getenv('MONGODB_URL')
    # Remove quotes if present (from .env file)
    if mongodb_url:
        mongodb_url = mongodb_url.strip('"').strip("'")
    print(f'Connecting to MongoDB...')
    
    # Only use TLS for Atlas (mongodb+srv), not for local MongoDB
    if mongodb_url and 'mongodb+srv' in mongodb_url:
        client = AsyncIOMotorClient(mongodb_url, tlsCAFile=certifi.where())
    else:
        client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    # Delete existing template (by trigger only, since there's a unique index on trigger)
    result = await db.notification_templates.delete_many({
        'trigger': 'saved_search_matches'
    })
    print(f'🗑️  Deleted {result.deleted_count} existing template(s)')
    
    # Create fixed template
    template = {
        '_id': ObjectId(),
        'name': 'Saved Search Matches Notification',
        'description': 'Email sent when new profiles match a user saved search criteria',
        'trigger': 'saved_search_matches',
        'channel': 'email',
        'priority': 'medium',
        'enabled': True,
        'active': True,
        'subject': '🔍 {{matchCount}} New Match{{plural}} for "{{searchName}}"',
        'body': TEMPLATE_BODY,
        'variables': [
            'user.firstName',
            'user.username',
            'matchCount',
            'plural',
            'searchName',
            'matchesHtml',
            'app.searchUrl',
            'app.dashboardUrl',
            'app.preferencesUrl_tracked',
            'app.unsubscribeUrl_tracked',
            'app.trackingPixelUrl'
        ],
        'createdAt': datetime.now(timezone.utc),
        'updatedAt': datetime.now(timezone.utc)
    }
    
    result = await db.notification_templates.insert_one(template)
    print(f'✅ Fixed template created with ID: {result.inserted_id}')
    
    client.close()


if __name__ == "__main__":
    asyncio.run(fix_template())
