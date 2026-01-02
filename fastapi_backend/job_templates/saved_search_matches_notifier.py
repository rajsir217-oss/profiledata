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
from zoneinfo import ZoneInfo
from motor.motor_asyncio import AsyncIOMotorDatabase

from .base import JobTemplate, JobExecutionContext, JobResult
from config import settings
from services.notification_service import NotificationService
from crypto_utils import PIIEncryption
from models.notification_models import (
    NotificationTrigger, 
    NotificationChannel, 
    NotificationPriority,
    NotificationQueueCreate
)

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
                "description": "Only notify for profiles created in the last N hours (168 = 7 days)",
                "default": 168,
                "min": 0,
                "max": 720
            },
            "appUrl": {
                "type": "string",
                "label": "App URL",
                "description": "Base URL for profile links in emails",
                "default": settings.frontend_url
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the saved search matches notifier job"""
        print("🚀🚀🚀 CLASS EXECUTE METHOD CALLED 🚀🚀🚀", flush=True)
        return await run_saved_search_notifier(context.db, context.parameters)


def get_effective_notification_settings(search: Dict[str, Any]) -> Dict[str, Any]:
    notifications = search.get('notifications') or {}
    effective = dict(notifications) if isinstance(notifications, dict) else {}

    admin_override = search.get('adminOverride') or {}
    if isinstance(admin_override, dict) and admin_override:
        if admin_override.get('disabled') is True:
            effective['enabled'] = False
        elif 'enabled' in admin_override:
            effective['enabled'] = bool(admin_override.get('enabled'))

        for key in ['frequency', 'time', 'dayOfWeek', 'timezone']:
            value = admin_override.get(key)
            if value is not None and value != '':
                effective[key] = value

    return effective

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
        .match-name {{
            font-size: 18px;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 12px 0;
        }}
        .match-badge {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
            margin-bottom: 12px;
        }}
        .match-details {{
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 12px;
        }}
        .match-detail {{
            display: flex;
            align-items: flex-start;
            font-size: 14px;
            color: #4a5568;
            line-height: 1.4;
        }}
        .match-detail-icon {{
            margin-right: 6px;
            font-size: 14px;
            flex-shrink: 0;
        }}
        .view-profile-btn {{
            display: inline-block;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            font-size: 14px;
            margin-top: 8px;
            transition: color 0.2s ease;
        }}
        .view-profile-btn:hover {{
            color: #764ba2;
            text-decoration: underline;
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
        <h1>� L3V3LMATCH</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">New matches for your saved search!</p>
    </div>
    
    <div style="padding: 20px 30px;">
        <h2 style="margin: 0 0 15px 0; color: #2d3748;">Hi {user_first_name}! 👋</h2>
        <p style="color: #4a5568; font-size: 16px; margin: 0 0 20px 0;">
            Great news! We found <strong style="color: #667eea;">{match_count} new profile{plural}</strong> matching your saved search:
        </p>
    </div>
    
    <div class="search-name">
        <h2 style="margin: 0 0 10px 0; color: #2d3748;">� {search_name}</h2>
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
<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
    <h3 style="font-size: 18px; font-weight: 700; color: #1a202c; margin: 0 0 8px 0;">{name}</h3>
    {l3v3l_badge}
    <div style="margin: 12px 0;">
        <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
            <span style="margin-right: 8px;">🆔</span>
            <span>Profile ID: <strong>{profile_id}</strong></span>
        </div>
        <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
            <span style="margin-right: 8px;">🎂</span>
            <span>{age} years old</span>
        </div>
        <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
            <span style="margin-right: 8px;">📏</span>
            <span>{height}</span>
        </div>
        <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
            <span style="margin-right: 8px;">📍</span>
            <span>{location}</span>
        </div>
        <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
            <span style="margin-right: 8px;">🎓</span>
            <span>{education}</span>
        </div>
        {religion_detail}
        {occupation_detail}
    </div>
    <a href="{profile_url}" style="display: inline-block; color: #667eea; text-decoration: none; font-weight: 500; font-size: 14px; margin-top: 8px;">View Full Profile →</a>
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
    print("🔍🔍🔍 JOB STARTING - saved_search_matches_notifier 🔍🔍🔍", flush=True)
    logger.info("🔍 Starting Saved Search Matches Notifier job...")
    
    start_time = datetime.utcnow()
    stats = {
        'users_processed': 0,
        'searches_checked': 0,
        'searches_with_schedule': 0,
        'searches_due_now': 0,
        'emails_sent': 0,
        'total_matches_found': 0,
        'skipped_not_due': 0,
        'errors': 0
    }
    
    try:
        # Detect manual run from UI (triggered_by starts with 'manual:' or manualRun flag)
        triggered_by = params.get('triggered_by', '')
        is_manual_run = triggered_by.startswith('manual') or params.get('manualRun', False)
        logger.info(f"🔧 triggered_by='{triggered_by}', is_manual_run={is_manual_run}")
        
        # Get configuration
        batch_size = params.get('batchSize', 50)
        lookback_hours = params.get('lookbackHours', 168)  # Check for profiles created in last 7 days (168 hours)
        app_url = params.get('appUrl') or settings.frontend_url

        # Apply overrides for manual runs
        if is_manual_run:
            force_run = True  # Bypass schedule check
            lookback_hours = 0  # Check all profiles
            clear_tracking = params.get('clearTracking', True)  # Clear tracking for manual runs by default
            logger.info("🎯 Manual run detected - bypassing schedule and lookback filters")
            if clear_tracking:
                logger.info("🗑️ Will clear notification tracking to resend all matches")
        else:
            force_run = params.get('forceRun', False)  # For testing - bypass schedule check
            clear_tracking = params.get('clearTracking', False)
        
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
                
                # DECRYPT email if encrypted (PII encryption)
                if user_email and user_email.startswith('gAAAAA'):
                    try:
                        pii_encryptor = PIIEncryption()
                        user_email = pii_encryptor.decrypt(user_email)
                    except Exception as e:
                        logger.error(f"❌ Failed to decrypt email for {username}: {e}")
                        continue
                
                # Process each saved search
                for search in searches:
                    try:
                        stats['searches_checked'] += 1
                        search_id = str(search['_id'])
                        search_name = search.get('name', 'Untitled Search')
                        search_description = search.get('description', '')
                        criteria = search.get('criteria', {})
                        
                        # Check if notifications are enabled for this search
                        notifications = get_effective_notification_settings(search)
                        if not notifications.get('enabled'):
                            logger.debug(f"  ⏭️ Skipping '{search_name}' - notifications not enabled")
                            continue
                        
                        stats['searches_with_schedule'] += 1
                        
                        # Check if it's time to send based on schedule
                        if not is_notification_due(search, db, username, search_id, force_run, notifications=notifications):
                            stats['skipped_not_due'] += 1
                            logger.debug(f"  ⏰ Skipping '{search_name}' - not due yet based on schedule")
                            continue
                        
                        stats['searches_due_now'] += 1
                        logger.info(f"  ✅ Processing '{search_name}' - due for notification")
                        
                        # Find matches for this search
                        matches = await find_matches_for_search(db, username, criteria, lookback_hours)
                        
                        if not matches:
                            logger.info(f"  No new matches for search '{search_name}'")
                            continue
                        
                        # Clear tracking if requested (for manual testing)
                        if clear_tracking:
                            await db.saved_search_notifications.delete_one({
                                'username': username,
                                'search_id': search_id
                            })
                            logger.debug(f"  🗑️ Cleared tracking for '{search_name}' to allow resending")
                        
                        # Filter out previously notified matches
                        new_matches = await filter_new_matches(db, username, search_id, matches)
                        
                        if not new_matches:
                            logger.info(f"  All matches for '{search_name}' were already notified")
                            continue
                        
                        stats['total_matches_found'] += len(new_matches)
                        
                        # Send email notification
                        print(f"📧 About to send email to {username} ({user_email}) with {len(new_matches)} matches", flush=True)
                        logger.info(f"📧 About to send email to {username} ({user_email}) with {len(new_matches)} matches")
                        email_sent = await send_matches_email(
                            db,
                            user_email,
                            username,
                            search_name,
                            search_description,
                            new_matches,
                            app_url
                        )
                        print(f"📧 send_matches_email returned: {email_sent}", flush=True)
                        logger.info(f"📧 send_matches_email returned: {email_sent}")
                        
                        if email_sent:
                            stats['emails_sent'] += 1
                            
                            # Mark matches as notified
                            await mark_matches_notified(db, username, search_id, new_matches)
                            
                            # Update last notification time (with matches count for history)
                            await update_last_notification_time(db, username, search_id, len(new_matches))
                            
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
            message=f"Processed {stats['users_processed']} users, {stats['searches_checked']} searches ({stats['searches_due_now']} due, {stats['skipped_not_due']} skipped), sent {stats['emails_sent']} emails with {stats['total_matches_found']} total matches",
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
    query: Dict[str, Any] = {
        'username': {'$ne': username}
    }

    query_and = query.get('$and')
    if not isinstance(query_and, list):
        query_and = []
        query['$and'] = query_and

    query_and.append({
        '$or': [
            {'accountStatus': 'active'},
            {'status.status': 'active'}
        ]
    })
    
    logger.info(f"🔍 Building query for user '{username}' with criteria: {criteria}")
    
    # Apply gender filter
    if criteria.get('gender'):
        query['gender'] = {'$regex': f'^{criteria["gender"]}$', '$options': 'i'}
    
    # Apply age range using birthYear (age field is not populated in DB)
    # Calculate birth year range from age range
    if criteria.get('ageMin') or criteria.get('ageMax'):
        current_year = datetime.now().year
        birth_year_query = {}
        
        # If ageMin is 33, birthYear should be <= current_year - 33 (e.g., 2025 - 33 = 1992)
        if criteria.get('ageMin'):
            try:
                age_min = int(criteria['ageMin'])
                birth_year_query['$lte'] = current_year - age_min
            except (ValueError, TypeError):
                pass
        
        # If ageMax is 37, birthYear should be >= current_year - 37 (e.g., 2025 - 37 = 1988)
        if criteria.get('ageMax'):
            try:
                age_max = int(criteria['ageMax'])
                birth_year_query['$gte'] = current_year - age_max
            except (ValueError, TypeError):
                pass
        
        if birth_year_query:
            query['birthYear'] = birth_year_query
            logger.info(f"📅 Age filter: ageMin={criteria.get('ageMin')}, ageMax={criteria.get('ageMax')} -> birthYear query: {birth_year_query}")
    
    # Apply height range
    if criteria.get('heightMinFeet') or criteria.get('heightMaxFeet'):
        height_patterns = []
        
        # Build height min pattern (e.g., 5'6" or taller)
        if criteria.get('heightMinFeet'):
            try:
                min_feet = int(criteria['heightMinFeet'])
                min_inches = int(criteria.get('heightMinInches', 0))
                # Match heights >= min (e.g., 5'6", 5'7"... 6'0", 6'1"...)
                # This is simplified - just match heights starting from min_feet
                for feet in range(min_feet, 8):  # Up to 7 feet
                    if feet == min_feet:
                        # For the minimum feet, only inches >= min_inches
                        for inches in range(min_inches, 12):
                            height_patterns.append(f"{feet}'{inches}\"")
                    else:
                        # For taller feet, all inches
                        for inches in range(0, 12):
                            height_patterns.append(f"{feet}'{inches}\"")
            except (ValueError, TypeError):
                pass
        
        if height_patterns:
            query['height'] = {'$in': height_patterns}
    
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
    # NOTE: For scheduled runs, we want to notify about NEW profiles only
    # For manual runs, lookback_hours is set to 0 to check ALL profiles
    if lookback_hours > 0:
        cutoff_time = datetime.utcnow() - timedelta(hours=lookback_hours)
        cutoff_iso = cutoff_time.isoformat()
        query_and.append({
            '$or': [
                {'createdAt': {'$gte': cutoff_time}},
                {'created_at': {'$gte': cutoff_time}},
                {'createdAt': {'$gte': cutoff_iso}},
                {'created_at': {'$gte': cutoff_iso}}
            ]
        })
        logger.info(f"📅 Filtering profiles created after {cutoff_time} (last {lookback_hours} hours)")
    
    # Log the final query
    logger.info(f"📊 Final MongoDB query: {query}")
    
    # Fetch matches - sorted by createdAt descending (newest first)
    cursor = db.users.find(query).sort("createdAt", -1).limit(20)  # Limit to top 20 matches, newest first
    matches = await cursor.to_list(length=20)
    
    logger.info(f"✅ Found {len(matches)} matches for query")
    
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
        # Initialize PII encryption for decryption
        pii_encryptor = PIIEncryption()
        
        # Build match cards HTML - limit to 5 profiles to keep email concise
        matches_html_parts = []
        display_matches = matches[:5]  # Show only first 5 matches
        
        for match in display_matches:
            # Decrypt PII fields
            decrypted_match = pii_encryptor.decrypt_user_pii(match)
            
            # Get age - either from age field or calculate from birthYear + birthMonth
            age = decrypted_match.get('age')
            if not age and decrypted_match.get('birthYear'):
                # Calculate age from birthYear and birthMonth
                now = datetime.now()
                birth_year = decrypted_match.get('birthYear')
                birth_month = decrypted_match.get('birthMonth', 1)  # Default to January if not set
                
                if isinstance(birth_year, str):
                    birth_year = int(birth_year)
                if isinstance(birth_month, str):
                    birth_month = int(birth_month)
                
                # Calculate age considering month
                age = now.year - birth_year
                if now.month < birth_month:
                    age -= 1  # Birthday hasn't occurred yet this year
            elif not age and decrypted_match.get('dateOfBirth'):
                # Fallback to dateOfBirth for legacy records
                age = calculate_age(decrypted_match.get('dateOfBirth'))
            
            # Format height
            height = decrypted_match.get('height', 'Not specified')
            
            # Location - use decrypted values
            location = decrypted_match.get('location') or decrypted_match.get('state') or 'Location not specified'
            
            # Education
            education = 'Not specified'
            if decrypted_match.get('education'):
                if isinstance(decrypted_match['education'], list) and len(decrypted_match['education']) > 0:
                    education = decrypted_match['education'][0].get('degree', 'Not specified')
                elif isinstance(decrypted_match['education'], str):
                    education = decrypted_match['education']
            
            # Religion (optional)
            religion_detail = ''
            if decrypted_match.get('religion'):
                religion_detail = f'''
                <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
                    <span style="margin-right: 8px;">🕉️</span>
                    <span>{decrypted_match['religion']}</span>
                </div>
                '''
            
            # Occupation - check occupation field first, then workExperience array for current job
            occupation = decrypted_match.get('occupation')
            if not occupation:
                work_exp = decrypted_match.get('workExperience', [])
                if isinstance(work_exp, list) and len(work_exp) > 0:
                    # Find current job (isCurrent=True) or use the first entry
                    current_job = None
                    for job in work_exp:
                        if isinstance(job, dict) and job.get('isCurrent'):
                            current_job = job
                            break
                    if not current_job and work_exp:
                        current_job = work_exp[0] if isinstance(work_exp[0], dict) else None
                    
                    if current_job:
                        job_title = current_job.get('jobTitle') or current_job.get('title') or current_job.get('position')
                        company = current_job.get('company') or current_job.get('employer')
                        if job_title:
                            occupation = f"{job_title}" + (f" at {company}" if company else "")
            
            occupation_detail = ''
            if occupation:
                occupation_detail = f'''
                <div style="display: flex; align-items: center; font-size: 14px; color: #4a5568; margin-bottom: 6px;">
                    <span style="margin-right: 8px;">💼</span>
                    <span>{occupation}</span>
                </div>
                '''
            
            # L3V3L badge (if score exists)
            l3v3l_badge = ''
            if decrypted_match.get('matchScore'):
                l3v3l_badge = f'<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; display: inline-block; margin-bottom: 8px;">🦋 {decrypted_match["matchScore"]}% Match</span>'
            
            # Build profile URL
            profile_url = f"{app_url}/profile/{decrypted_match['username']}"
            
            # Get display name
            name = decrypted_match.get('firstName', decrypted_match['username'])
            if decrypted_match.get('lastName'):
                name += f" {decrypted_match['lastName'][0]}."
            
            # Get profileId
            profile_id = decrypted_match.get('profileId', '')
            
            match_html = MATCH_CARD_TEMPLATE.format(
                name=name,
                profile_id=profile_id or 'N/A',
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
        total_matches = len(matches)
        displayed_count = len(display_matches)
        plural = 'es' if total_matches != 1 else ''
        
        # Show "more matches" note if there are more than 5
        more_note = ''
        if total_matches > 5:
            more_note = f'<p style="margin: 10px 0 0 0; font-size: 14px; color: #718096;">Showing top {displayed_count} of {total_matches} matches. Click below to see all.</p>'
        
        matches_container = f'''
        <div style="background: #f0f4ff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px; color: #4a5568;">Found <strong style="color: #667eea; font-size: 24px;">{total_matches}</strong> new match{plural} for you!</p>
            {more_note}
        </div>
        <div style="margin-top: 20px;">
            {''.join(matches_html_parts)}
        </div>
        '''
        
        # Get user info for personalization
        user = await db.users.find_one({'username': username})
        user_first_name = user.get('firstName', username) if user else username
        
        email_html = EMAIL_TEMPLATE.format(
            user_first_name=user_first_name,
            match_count=len(matches),
            plural=plural,
            search_name=search_name,
            search_description=search_description or 'Your saved search criteria',
            matches_html=matches_container,
            app_url=app_url
        )
        
        # Queue notification via NotificationService
        # The notification template will render the email with profile cards
        notification_service = NotificationService(db)
        
        # Build template data with the pre-rendered HTML
        template_data = {
            'user': {
                'firstName': user_first_name,
                'username': username
            },
            'matchCount': len(matches),
            'plural': plural,
            'searchName': search_name,
            'searchDescription': search_description or 'Your saved search criteria',
            'matchesHtml': matches_container,
            'appUrl': app_url
        }
        
        # Queue the notification
        queue_item = NotificationQueueCreate(
            username=username,
            trigger=NotificationTrigger.SAVED_SEARCH_MATCHES,
            channels=[NotificationChannel.EMAIL],
            priority=NotificationPriority.MEDIUM,
            templateData=template_data
        )
        await notification_service.enqueue_notification(queue_item)
        
        logger.info(f"✅ Queued notification for {username}: {len(matches)} matches for '{search_name}'")
        return True
        
    except Exception as e:
        import traceback
        logger.error(f"❌ Error sending email to {to_email}: {e}")
        logger.error(f"❌ Full traceback: {traceback.format_exc()}")
        return False


def is_notification_due(search: Dict[str, Any], db, username: str, search_id: str, force_run: bool = False, notifications: Optional[Dict[str, Any]] = None) -> bool:
    """
    Check if it's time to send notification based on the search's schedule
    
    Args:
        search: The saved search document
        db: Database instance (for async call later)
        username: Username
        search_id: Search ID
        force_run: If True, bypass schedule check (for testing)
        
    Returns:
        True if notification should be sent now, False otherwise
    """
    # For testing, allow bypassing schedule check
    if force_run:
        return True
    
    notifications = notifications if isinstance(notifications, dict) else (search.get('notifications') or {})
    if not notifications.get('enabled'):
        return False
    
    frequency = notifications.get('frequency', 'daily')
    notification_time = notifications.get('time', '09:00')  # HH:MM format
    day_of_week = notifications.get('dayOfWeek', 'monday')  # for weekly
    
    # Get user's timezone from search or default to US/Pacific (most users are in PST/PDT)
    user_timezone_str = notifications.get('timezone', 'America/Los_Angeles')
    try:
        user_tz = ZoneInfo(user_timezone_str)
    except Exception:
        logger.warning(f"Invalid timezone '{user_timezone_str}', defaulting to America/Los_Angeles")
        user_tz = ZoneInfo('America/Los_Angeles')
    
    # Get current time in user's timezone
    now_utc = datetime.utcnow().replace(tzinfo=ZoneInfo('UTC'))
    now_user = now_utc.astimezone(user_tz)
    current_hour = now_user.hour
    current_minute = now_user.minute
    current_weekday = now_user.strftime('%A').lower()  # 'monday', 'tuesday', etc.
    
    # Parse notification time
    try:
        notif_hour, notif_minute = map(int, notification_time.split(':'))
    except:
        logger.warning(f"Invalid notification time format: {notification_time}, defaulting to 09:00")
        notif_hour, notif_minute = 9, 0
    
    # Check if we're within the notification window (within 1 hour of scheduled time)
    # This allows the job to run hourly and still catch the notifications
    scheduled_today = now_user.replace(hour=notif_hour, minute=notif_minute, second=0, microsecond=0)
    delta_seconds = min(
        abs((now_user - scheduled_today).total_seconds()),
        abs((now_user - (scheduled_today + timedelta(days=1))).total_seconds()),
        abs((now_user - (scheduled_today - timedelta(days=1))).total_seconds())
    )
    time_matches = delta_seconds < 60 * 60
    
    logger.debug(f"Schedule check for '{search.get('name')}': user_tz={user_timezone_str}, "
                 f"now={now_user.strftime('%H:%M %A')}, scheduled={notif_hour:02d}:{notif_minute:02d}, "
                 f"time_matches={time_matches}")
    
    if not time_matches:
        return False
    
    # For weekly notifications, also check the day
    if frequency == 'weekly':
        if current_weekday != day_of_week.lower():
            return False
    
    # Check if we already sent a notification today (or this week for weekly)
    # This prevents duplicate sends if the job runs multiple times in the window
    # We'll implement this check in update_last_notification_time tracking
    
    return True


async def update_last_notification_time(db, username: str, search_id: str, matches_count: int = 0):
    """
    Update the last notification timestamp for a search
    Updates both the tracking collection and the saved_searches document
    """
    now = datetime.utcnow()
    
    # Update tracking collection (for duplicate prevention)
    await db.saved_search_notifications.update_one(
        {
            'username': username,
            'search_id': search_id
        },
        {
            '$set': {
                'last_notification_sent': now
            }
        },
        upsert=True
    )
    
    # Also update the saved_searches document with notification history
    # This is what the admin UI reads for "Last Sent" status
    from bson import ObjectId
    try:
        notification_record = {
            'sentAt': now,
            'status': 'sent',
            'matchesCount': matches_count
        }
        
        await db.saved_searches.update_one(
            {'_id': ObjectId(search_id)},
            {
                '$push': {
                    'notificationHistory': {
                        '$each': [notification_record],
                        '$slice': -10  # Keep only last 10 records
                    }
                },
                '$set': {
                    'notifications.lastSent': now
                }
            }
        )
        logger.debug(f"Updated notification history for search {search_id}")
    except Exception as e:
        logger.error(f"Error updating saved_searches notification history: {e}")


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
