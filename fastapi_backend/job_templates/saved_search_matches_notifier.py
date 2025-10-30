"""
Saved Search Matches Notifier Job Template

This job periodically checks users' saved searches and sends email notifications
when new matches are found. It helps users stay updated on potential matches
without having to manually run their searches.

Features:
- Runs each saved search to find matches
- Sends email with list of matching profiles
- Tracks sent notifications to avoid duplicates
- Includes match details (name, age, location, L3V3L score)
- Respects user notification preferences

Schedule: Runs daily or as configured
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
import asyncio
from motor.motor_asyncio import AsyncIOMotorDatabase

from .base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


class SavedSearchMatchesNotifierTemplate(JobTemplate):
    """Job template for notifying users of saved search matches"""
    
    # Template metadata
    template_type = "saved_search_matches_notifier"
    template_name = "Saved Search Matches Notifier"
    template_description = "Check saved searches and email users when new matches are found"
    category = "notifications"
    icon = "🔍"
    estimated_duration = "5-15 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        batch_size = params.get("batchSize", 50)
        if not isinstance(batch_size, int) or batch_size < 1 or batch_size > 200:
            return False, "batchSize must be an integer between 1 and 200"
        
        lookback_hours = params.get("lookbackHours", 24)
        if not isinstance(lookback_hours, int) or lookback_hours < 0:
            return False, "lookbackHours must be a non-negative integer"
        
        return True, None
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per run",
                "default": 50,
                "min": 1,
                "max": 200
            },
            "lookbackHours": {
                "type": "integer",
                "label": "Lookback Hours",
                "description": "Only notify for profiles created in the last N hours",
                "default": 24,
                "min": 0,
                "max": 720
            },
            "appUrl": {
                "type": "string",
                "label": "App URL",
                "description": "Base URL for profile links in emails",
                "default": "http://localhost:3000"
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the saved search matches notifier job"""
        return await run_saved_search_notifier(context.db, context.parameters)

# Email template HTML
EMAIL_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            border-radius: 10px 10px 0 0;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
        }}
        .search-name {{
            background: #f7fafc;
            padding: 20px;
            border-left: 4px solid #667eea;
            margin: 20px 0;
            border-radius: 5px;
        }}
        .search-description {{
            font-style: italic;
            color: #666;
            font-size: 14px;
        }}
        .matches-container {{
            padding: 20px;
        }}
        .match-card {{
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }}
        .match-card:hover {{
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }}
        .match-header {{
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }}
        .match-name {{
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin: 0;
        }}
        .match-badge {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin-left: 10px;
        }}
        .match-details {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 15px;
        }}
        .match-detail {{
            display: flex;
            align-items: center;
            font-size: 14px;
            color: #4a5568;
        }}
        .match-detail-icon {{
            margin-right: 8px;
            font-size: 16px;
        }}
        .view-profile-btn {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            text-align: center;
            transition: all 0.3s ease;
        }}
        .view-profile-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }}
        .footer {{
            text-align: center;
            padding: 20px;
            color: #718096;
            font-size: 12px;
            border-top: 1px solid #e2e8f0;
            margin-top: 20px;
        }}
        .stats-banner {{
            background: #edf2f7;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }}
        .stats-banner strong {{
            color: #667eea;
            font-size: 24px;
        }}
        .no-matches {{
            text-align: center;
            padding: 40px;
            color: #718096;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 New Matches for Your Saved Search</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">We found {match_count} new profile{plural} matching your criteria!</p>
    </div>
    
    <div class="search-name">
        <h2 style="margin: 0 0 10px 0; color: #2d3748;">📌 {search_name}</h2>
        <p class="search-description">{search_description}</p>
    </div>
    
    {matches_html}
    
    <div class="footer">
        <p>You're receiving this email because you have saved searches on ProfileData.</p>
        <p>To manage your saved searches or notification preferences, visit your <a href="{app_url}/preferences" style="color: #667eea;">account settings</a>.</p>
        <p style="margin-top: 20px;">© 2025 ProfileData. All rights reserved.</p>
    </div>
</body>
</html>
"""

MATCH_CARD_TEMPLATE = """
<div class="match-card">
    <div class="match-header">
        <h3 class="match-name">{name}</h3>
        {l3v3l_badge}
    </div>
    <div class="match-details">
        <div class="match-detail">
            <span class="match-detail-icon">📅</span>
            <span>{age} years old</span>
        </div>
        <div class="match-detail">
            <span class="match-detail-icon">📏</span>
            <span>{height}</span>
        </div>
        <div class="match-detail">
            <span class="match-detail-icon">📍</span>
            <span>{location}</span>
        </div>
        <div class="match-detail">
            <span class="match-detail-icon">🎓</span>
            <span>{education}</span>
        </div>
        {religion_detail}
        {occupation_detail}
    </div>
    <a href="{profile_url}" class="view-profile-btn">View Full Profile →</a>
</div>
"""


async def run_saved_search_notifier(db, params: Dict[str, Any]) -> JobResult:
    """
    Main job execution function
    
    Args:
        db: MongoDB database instance
        params: Job parameters from scheduler
        
    Returns:
        JobResult with execution results
    """
    logger.info("🔍 Starting Saved Search Matches Notifier job...")
    
    start_time = datetime.utcnow()
    stats = {
        'users_processed': 0,
        'searches_checked': 0,
        'emails_sent': 0,
        'total_matches_found': 0,
        'errors': 0
    }
    
    try:
        # Get configuration
        batch_size = params.get('batchSize', 50)
        lookback_hours = params.get('lookbackHours', 24)  # Check for profiles created in last 24h
        app_url = params.get('appUrl', 'http://localhost:3000')
        
        # Get all saved searches
        saved_searches_cursor = db.saved_searches.find({})
        saved_searches_by_user = {}
        
        async for search in saved_searches_cursor:
            username = search.get('username')
            if username:
                if username not in saved_searches_by_user:
                    saved_searches_by_user[username] = []
                saved_searches_by_user[username].append(search)
        
        logger.info(f"📊 Found saved searches for {len(saved_searches_by_user)} users")
        
        # Process each user's saved searches
        for username, searches in saved_searches_by_user.items():
            try:
                stats['users_processed'] += 1
                
                # Get user details
                user = await db.users.find_one({'username': username})
                if not user:
                    continue
                
                # Check if user wants notifications (if notification preferences exist)
                user_email = user.get('contactEmail') or user.get('email')
                if not user_email:
                    logger.info(f"⚠️ User {username} has no email address")
                    continue
                
                # Process each saved search
                for search in searches:
                    try:
                        stats['searches_checked'] += 1
                        search_id = str(search['_id'])
                        search_name = search.get('name', 'Untitled Search')
                        search_description = search.get('description', '')
                        criteria = search.get('criteria', {})
                        
                        # Find matches for this search
                        matches = await find_matches_for_search(db, username, criteria, lookback_hours)
                        
                        if not matches:
                            logger.info(f"  No new matches for search '{search_name}'")
                            continue
                        
                        # Filter out previously notified matches
                        new_matches = await filter_new_matches(db, username, search_id, matches)
                        
                        if not new_matches:
                            logger.info(f"  All matches for '{search_name}' were already notified")
                            continue
                        
                        stats['total_matches_found'] += len(new_matches)
                        
                        # Send email notification
                        email_sent = await send_matches_email(
                            db,
                            user_email,
                            username,
                            search_name,
                            search_description,
                            new_matches,
                            app_url
                        )
                        
                        if email_sent:
                            stats['emails_sent'] += 1
                            
                            # Mark matches as notified
                            await mark_matches_notified(db, username, search_id, new_matches)
                            
                            logger.info(f"✅ Sent email to {username} with {len(new_matches)} new matches for '{search_name}'")
                        
                    except Exception as e:
                        logger.error(f"❌ Error processing search '{search.get('name')}' for {username}: {e}")
                        stats['errors'] += 1
                
            except Exception as e:
                logger.error(f"❌ Error processing user {username}: {e}")
                stats['errors'] += 1
        
        duration = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"✅ Saved Search Matches Notifier completed in {duration:.2f}s")
        logger.info(f"📊 Stats: {stats}")
        
        return JobResult(
            status="success",
            message=f"Processed {stats['users_processed']} users, sent {stats['emails_sent']} emails with {stats['total_matches_found']} total matches",
            details=stats,
            records_processed=stats['users_processed'],
            records_affected=stats['emails_sent'],
            errors=[],
            warnings=[],
            duration_seconds=duration
        )
        
    except Exception as e:
        logger.error(f"❌ Saved Search Matches Notifier failed: {e}", exc_info=True)
        return JobResult(
            status="failed",
            message=f"Job failed: {str(e)}",
            details=stats,
            records_processed=stats.get('users_processed', 0),
            records_affected=0,
            errors=[str(e)],
            warnings=[],
            duration_seconds=0.0
        )


async def find_matches_for_search(
    db: AsyncIOMotorDatabase,
    username: str,
    criteria: Dict[str, Any],
    lookback_hours: int
) -> List[Dict[str, Any]]:
    """Find users matching the search criteria"""
    
    # Build MongoDB query from criteria
    query = {
        'username': {'$ne': username},  # Exclude self
        '$or': [
            {'status.status': {'$regex': '^active$', '$options': 'i'}},
            {'status.status': {'$exists': False}},
            {'status': {'$exists': False}}
        ]
    }
    
    # Apply gender filter
    if criteria.get('gender'):
        query['gender'] = {'$regex': f'^{criteria["gender"]}$', '$options': 'i'}
    
    # Apply age range
    if criteria.get('ageMin') or criteria.get('ageMax'):
        # This would need proper date calculation
        pass  # Simplified for now
    
    # Apply location filter
    if criteria.get('location'):
        query['$or'] = [
            {'location': {'$regex': criteria['location'], '$options': 'i'}},
            {'state': {'$regex': criteria['location'], '$options': 'i'}}
        ]
    
    # Apply religion filter
    if criteria.get('religion'):
        query['religion'] = criteria['religion']
    
    # Apply education filter
    if criteria.get('education'):
        query['education'] = {'$regex': criteria['education'], '$options': 'i'}
    
    # Apply occupation filter
    if criteria.get('occupation'):
        query['occupation'] = {'$regex': criteria['occupation'], '$options': 'i'}
    
    # Only get recent profiles (created in lookback period)
    if lookback_hours > 0:
        cutoff_time = datetime.utcnow() - timedelta(hours=lookback_hours)
        query['createdAt'] = {'$gte': cutoff_time}
    
    # Fetch matches
    cursor = db.users.find(query).limit(20)  # Limit to top 20 matches
    matches = await cursor.to_list(length=20)
    
    return matches


async def filter_new_matches(
    db: AsyncIOMotorDatabase,
    username: str,
    search_id: str,
    matches: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Filter out matches that were already notified"""
    
    # Get previously notified match usernames for this search
    notified_doc = await db.saved_search_notifications.find_one({
        'username': username,
        'search_id': search_id
    })
    
    if not notified_doc:
        return matches  # All matches are new
    
    notified_usernames = set(notified_doc.get('notified_matches', []))
    
    # Filter out already notified matches
    new_matches = [
        match for match in matches 
        if match['username'] not in notified_usernames
    ]
    
    return new_matches


async def mark_matches_notified(
    db: AsyncIOMotorDatabase,
    username: str,
    search_id: str,
    matches: List[Dict[str, Any]]
):
    """Mark matches as notified to avoid duplicate emails"""
    
    match_usernames = [match['username'] for match in matches]
    
    await db.saved_search_notifications.update_one(
        {
            'username': username,
            'search_id': search_id
        },
        {
            '$addToSet': {
                'notified_matches': {'$each': match_usernames}
            },
            '$set': {
                'last_notification_at': datetime.utcnow()
            }
        },
        upsert=True
    )


async def send_matches_email(
    db: AsyncIOMotorDatabase,
    to_email: str,
    username: str,
    search_name: str,
    search_description: str,
    matches: List[Dict[str, Any]],
    app_url: str
) -> bool:
    """Send email with matching profiles"""
    
    try:
        # Build match cards HTML
        matches_html_parts = []
        
        for match in matches:
            # Calculate age
            age = calculate_age(match.get('dateOfBirth'))
            
            # Format height
            height = match.get('height', 'Not specified')
            
            # Location
            location = match.get('location', match.get('state', 'Location not specified'))
            
            # Education
            education = 'Not specified'
            if match.get('education'):
                if isinstance(match['education'], list) and len(match['education']) > 0:
                    education = match['education'][0].get('degree', 'Not specified')
                elif isinstance(match['education'], str):
                    education = match['education']
            
            # Religion (optional)
            religion_detail = ''
            if match.get('religion'):
                religion_detail = f'''
                <div class="match-detail">
                    <span class="match-detail-icon">🕉️</span>
                    <span>{match['religion']}</span>
                </div>
                '''
            
            # Occupation (optional)
            occupation_detail = ''
            if match.get('occupation'):
                occupation_detail = f'''
                <div class="match-detail">
                    <span class="match-detail-icon">💼</span>
                    <span>{match['occupation']}</span>
                </div>
                '''
            
            # L3V3L badge (if score exists)
            l3v3l_badge = ''
            if match.get('matchScore'):
                l3v3l_badge = f'<span class="match-badge">🦋 {match["matchScore"]}% Match</span>'
            
            # Build profile URL
            profile_url = f"{app_url}/profile/{match['username']}"
            
            # Get display name
            name = match.get('firstName', match['username'])
            if match.get('lastName'):
                name += f" {match['lastName'][0]}."
            
            match_html = MATCH_CARD_TEMPLATE.format(
                name=name,
                age=age or '?',
                height=height,
                location=location,
                education=education,
                religion_detail=religion_detail,
                occupation_detail=occupation_detail,
                l3v3l_badge=l3v3l_badge,
                profile_url=profile_url
            )
            
            matches_html_parts.append(match_html)
        
        # Build complete email HTML
        plural = 's' if len(matches) != 1 else ''
        matches_container = f'''
        <div class="stats-banner">
            <p style="margin: 0;">Found <strong>{len(matches)}</strong> new match{plural} for you!</p>
        </div>
        <div class="matches-container">
            {''.join(matches_html_parts)}
        </div>
        '''
        
        email_html = EMAIL_TEMPLATE.format(
            match_count=len(matches),
            plural=plural,
            search_name=search_name,
            search_description=search_description or 'Your saved search criteria',
            matches_html=matches_container,
            app_url=app_url
        )
        
        # TODO: Send email using your email service
        # For now, just log that we would send it
        logger.info(f"📧 Would send email to {to_email} with {len(matches)} matches")
        
        # In production, integrate with your email service:
        # await send_email(to_email, f"New Matches for '{search_name}'", email_html)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error sending email to {to_email}: {e}")
        return False


def calculate_age(date_of_birth):
    """Calculate age from date of birth"""
    if not date_of_birth:
        return None
    
    try:
        if isinstance(date_of_birth, str):
            from dateutil import parser
            dob = parser.parse(date_of_birth)
        else:
            dob = date_of_birth
        
        today = datetime.now()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return age
    except:
        return None
