# fastapi_backend/cleanup_scheduler.py
"""
Data Cleanup Scheduler - Automatically cleans up old favorites, shortlists, and messages
Sends notifications at 30, 10, and 1 day intervals before cleanup
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class CleanupScheduler:
    """Manages automatic cleanup of user data with notifications"""
    
    # Default cleanup periods (in days)
    DEFAULT_CLEANUP_DAYS = 90
    MIN_CLEANUP_DAYS = 30
    MAX_CLEANUP_DAYS = 365
    
    # Notification intervals (days before cleanup)
    NOTIFICATION_INTERVALS = [30, 10, 1]
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def run_cleanup_cycle(self):
        """Run one cleanup cycle - check and clean data"""
        logger.info("🔄 Running cleanup cycle...")
        
        # Get all users
        users = await self.db.users.find({}).to_list(length=None)
        
        for user in users:
            try:
                await self.process_user_cleanup(user)
            except Exception as e:
                logger.error(f"❌ Error processing cleanup for {user.get('username')}: {e}")
        
        logger.info("✅ Cleanup cycle completed")
    
    async def process_user_cleanup(self, user: Dict):
        """Process cleanup for a single user"""
        username = user.get('username')
        
        # Get user's cleanup settings
        cleanup_days = await self.get_user_cleanup_days(username)
        
        # Check and send notifications
        await self.check_and_send_notifications(username, cleanup_days)
        
        # Perform cleanup if needed
        await self.cleanup_expired_data(username, cleanup_days)
    
    async def get_user_cleanup_days(self, username: str) -> int:
        """Get user's cleanup preference or default"""
        user = await self.db.users.find_one({"username": username})
        
        if user and "cleanup_settings" in user:
            days = user["cleanup_settings"].get("cleanup_days", self.DEFAULT_CLEANUP_DAYS)
            # Validate range
            return max(self.MIN_CLEANUP_DAYS, min(days, self.MAX_CLEANUP_DAYS))
        
        return self.DEFAULT_CLEANUP_DAYS
    
    async def check_and_send_notifications(self, username: str, cleanup_days: int):
        """Check if user needs notifications about upcoming cleanup"""
        cutoff_date = datetime.utcnow() - timedelta(days=cleanup_days)
        
        # Check each notification interval
        for days_before in self.NOTIFICATION_INTERVALS:
            notification_date = datetime.utcnow() - timedelta(days=cleanup_days - days_before)
            
            # Check if we need to send notification for this interval
            if await self.should_send_notification(username, days_before):
                # Count items that will be cleaned
                stats = await self.get_cleanup_stats(username, notification_date)
                
                if stats['total'] > 0:
                    await self.send_cleanup_warning(username, days_before, stats)
    
    async def should_send_notification(self, username: str, days_before: int) -> bool:
        """Check if notification for this interval was already sent"""
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Check if we already sent this notification today
        existing = await self.db.cleanup_notifications.find_one({
            "username": username,
            "days_before": days_before,
            "sent_at": {"$gte": today}
        })
        
        return existing is None
    
    async def get_cleanup_stats(self, username: str, cutoff_date: datetime) -> Dict:
        """Get count of items that will be cleaned up"""
        # Count favorites older than cutoff
        favorites_count = await self.db.favorites.count_documents({
            "username": username,
            "created_at": {"$lte": cutoff_date}
        })
        
        # Count shortlist items older than cutoff
        shortlist_count = await self.db.shortlist.count_documents({
            "username": username,
            "created_at": {"$lte": cutoff_date}
        })
        
        # Count messages older than cutoff
        messages_count = await self.db.messages.count_documents({
            "$or": [
                {"sender": username},
                {"recipient": username}
            ],
            "timestamp": {"$lte": cutoff_date}
        })
        
        return {
            "favorites": favorites_count,
            "shortlist": shortlist_count,
            "messages": messages_count,
            "total": favorites_count + shortlist_count + messages_count
        }
    
    async def send_cleanup_warning(self, username: str, days_before: int, stats: Dict):
        """Send warning notification about upcoming cleanup"""
        logger.info(f"⚠️ Sending {days_before}-day cleanup warning to {username}")
        
        # Create in-app notification
        notification = {
            "username": username,
            "type": "cleanup_warning",
            "title": f"Data Cleanup in {days_before} Days",
            "message": f"Your inactive data will be cleaned in {days_before} days. "
                      f"Items to be removed: {stats['favorites']} favorites, "
                      f"{stats['shortlist']} shortlist items, {stats['messages']} messages.",
            "data": stats,
            "days_before": days_before,
            "created_at": datetime.utcnow(),
            "read": False
        }
        
        await self.db.notifications.insert_one(notification)
        
        # Log that we sent this notification
        await self.db.cleanup_notifications.insert_one({
            "username": username,
            "days_before": days_before,
            "sent_at": datetime.utcnow(),
            "stats": stats
        })
        
        # TODO: Send email notification
        await self.send_cleanup_email(username, days_before, stats)
    
    async def send_cleanup_email(self, username: str, days_before: int, stats: Dict):
        """Send email notification about cleanup (placeholder)"""
        # Get user email
        user = await self.db.users.find_one({"username": username})
        if not user or not user.get("contactEmail"):
            return
        
        email = user["contactEmail"]
        
        # Email content
        subject = f"Data Cleanup Warning - {days_before} Days Remaining"
        body = f"""
        Hello {username},
        
        This is a reminder that your inactive data will be automatically cleaned up in {days_before} days.
        
        Items scheduled for cleanup:
        - Favorites: {stats['favorites']}
        - Shortlist: {stats['shortlist']}
        - Messages: {stats['messages']}
        
        To prevent cleanup, please log in and interact with these items.
        
        You can adjust your cleanup preferences in Settings.
        
        Thank you,
        L3V3L Team
        """
        
        # TODO: Integrate with email service
        logger.info(f"📧 Would send email to {email}: {subject}")
    
    async def cleanup_expired_data(self, username: str, cleanup_days: int):
        """Clean up data older than cleanup_days"""
        cutoff_date = datetime.utcnow() - timedelta(days=cleanup_days)
        
        # Delete old favorites
        favorites_result = await self.db.favorites.delete_many({
            "username": username,
            "created_at": {"$lte": cutoff_date}
        })
        
        # Delete old shortlist items
        shortlist_result = await self.db.shortlist.delete_many({
            "username": username,
            "created_at": {"$lte": cutoff_date}
        })
        
        # Delete old messages
        messages_result = await self.db.messages.delete_many({
            "$or": [
                {"sender": username},
                {"recipient": username}
            ],
            "timestamp": {"$lte": cutoff_date}
        })
        
        total_deleted = (
            favorites_result.deleted_count +
            shortlist_result.deleted_count +
            messages_result.deleted_count
        )
        
        if total_deleted > 0:
            logger.info(f"🗑️ Cleaned up {total_deleted} items for {username}")
            
            # Send cleanup completion notification
            await self.send_cleanup_complete_notification(username, {
                "favorites": favorites_result.deleted_count,
                "shortlist": shortlist_result.deleted_count,
                "messages": messages_result.deleted_count,
                "total": total_deleted,
                "date": datetime.utcnow().isoformat()
            })
            
            # Log cleanup action
            await self.db.cleanup_logs.insert_one({
                "username": username,
                "cleanup_date": datetime.utcnow(),
                "cutoff_date": cutoff_date,
                "items_deleted": {
                    "favorites": favorites_result.deleted_count,
                    "shortlist": shortlist_result.deleted_count,
                    "messages": messages_result.deleted_count
                },
                "total_deleted": total_deleted,
                "cleanup_days": cleanup_days
            })
    
    async def send_cleanup_complete_notification(self, username: str, stats: Dict):
        """Send notification that cleanup was completed"""
        logger.info(f"✅ Sending cleanup completion notification to {username}")
        
        notification = {
            "username": username,
            "type": "cleanup_complete",
            "title": "Data Cleanup Completed",
            "message": f"Your inactive data was cleaned up on {stats['date']}. "
                      f"Items removed: {stats['favorites']} favorites, "
                      f"{stats['shortlist']} shortlist items, {stats['messages']} messages.",
            "data": stats,
            "created_at": datetime.utcnow(),
            "read": False
        }
        
        await self.db.notifications.insert_one(notification)


# Note: CleanupScheduler class is now used by the unified scheduler
# The standalone start/stop/update methods have been removed
# Scheduler is managed by unified_scheduler.py
# Settings are updated directly via API routes in cleanup_routes.py
