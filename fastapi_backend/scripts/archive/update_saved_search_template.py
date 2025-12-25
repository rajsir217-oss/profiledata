#!/usr/bin/env python3
"""
Update saved_search_matches template with UserCard-style layout
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv


async def update_template():
    load_dotenv('.env.local')
    
    # Connect to MongoDB
    mongodb_url = os.getenv('MONGODB_URL')
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    
    # Updated body with UserCard-style vertical layout
    new_body = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 20px;
            color: #667eea;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .message {
            font-size: 16px;
            line-height: 1.8;
            margin-bottom: 30px;
        }
        .search-box {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px 20px;
            margin: 20px 0;
        }
        .search-box strong {
            color: #667eea;
            font-size: 18px;
        }
        .search-box p {
            margin: 8px 0 0 0;
            color: #666;
            font-size: 14px;
        }
        .matches-container {
            margin: 30px 0;
        }
        .match-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }
        .match-name {
            font-size: 18px;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 12px 0;
        }
        .match-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
            margin-bottom: 12px;
        }
        .match-details {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 12px;
        }
        .match-detail {
            display: flex;
            align-items: flex-start;
            font-size: 14px;
            color: #4a5568;
            line-height: 1.4;
        }
        .match-detail-icon {
            margin-right: 6px;
            font-size: 14px;
            flex-shrink: 0;
        }
        .view-profile-link {
            display: inline-block;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            margin-top: 8px;
        }
        .view-profile-link:hover {
            color: #764ba2;
            text-decoration: underline;
        }
        .cta-section {
            text-align: center;
            margin: 40px 0 20px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            padding: 16px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .tip-box {
            border-top: 1px solid #e2e8f0;
            margin-top: 30px;
            padding-top: 20px;
            font-size: 14px;
            color: #666;
        }
        .tip-box strong {
            font-size: 16px;
        }
        .tip-box a {
            color: #667eea;
            text-decoration: none;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e2e8f0;
        }
        .footer strong {
            color: #333;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 New Matches Found!</h1>
            <p>Your saved search has new results</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Hello {{user.firstName}}! 👋
            </div>
            
            <div class="message">
                <p>Great news! We found <strong>{{matchCount}} new match{{plural}}</strong> for your saved search:</p>
                
                <div class="search-box">
                    <strong>{{searchName}}</strong>
                    {% if searchDescription %}
                    <p>{{searchDescription}}</p>
                    {% endif %}
                </div>
            </div>
            
            <!-- Matches HTML will be injected here -->
            {{{matchesHtml}}}
            
            <div class="cta-section">
                <a href="{{app.searchUrl}}" class="cta-button">
                    View All Matches →
                </a>
            </div>
            
            <div class="tip-box">
                <p><strong>💡 Tip:</strong> You can adjust your notification frequency in your <a href="{{app.preferencesUrl_tracked}}">notification preferences</a>.</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>L3V3LMATCH</strong> - Premium Matrimonial Platform</p>
            <p>
                <a href="{{app.dashboardUrl}}">Dashboard</a> • 
                <a href="{{app.preferencesUrl_tracked}}">Preferences</a> • 
                <a href="{{app.unsubscribeUrl_tracked}}">Unsubscribe</a>
            </p>
            <img src="{{app.trackingPixelUrl}}" width="1" height="1" alt="" style="display: block; margin: 10px auto 0;">
        </div>
    </div>
</body>
</html>"""
    
    result = await db.notification_templates.update_one(
        {'trigger': 'saved_search_matches', 'channel': 'email'},
        {
            '$set': {
                'body': new_body,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    print(f"✅ Updated saved_search_matches template")
    print(f"   Matched: {result.matched_count}")
    print(f"   Modified: {result.modified_count}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(update_template())
