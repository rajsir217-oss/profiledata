"""
Queue Manager Service
Advanced queue management with pause, cleanup, dead letter queue, and rate limiting
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from pymongo.database import Database
import logging
import asyncio
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class QueueStatus(Enum):
    """Queue operational status"""
    NORMAL = "normal"
    PAUSED = "paused"
    EMERGENCY_STOP = "emergency_stop"
    MAINTENANCE = "maintenance"


@dataclass
class QueueMetrics:
    """Queue metrics for monitoring"""
    total_pending: int
    total_processing: int
    total_failed: int
    total_sent: int
    processing_rate: float  # notifications/minute
    failure_rate: float     # percentage
    oldest_pending_age: timedelta
    stuck_processing_count: int


class QueueManager:
    """Advanced queue management service"""
    
    def __init__(self, db: Database):
        self.db = db
        self.queue_collection = db.notification_queue
        self.dead_letter_collection = db.notification_dead_letter
        self.rate_limit_collection = db.notification_rate_limits
        self.queue_status_collection = db.queue_status
        
    # ============================================
    # Queue Control (Pause/Resume)
    # ============================================
    
    async def pause_queue(
        self, 
        reason: str = "Manual pause",
        duration_minutes: Optional[int] = None,
        emergency: bool = False
    ) -> Dict[str, Any]:
        """
        Pause the notification queue
        
        Args:
            reason: Why queue is being paused
            duration_minutes: Auto-resume after X minutes (None = indefinite)
            emergency: Emergency stop (immediate, overrides other pauses)
        """
        status = QueueStatus.EMERGENCY_STOP if emergency else QueueStatus.PAUSED
        resume_at = None
        
        if duration_minutes:
            resume_at = datetime.utcnow() + timedelta(minutes=duration_minutes)
        
        # Update queue status
        await self.queue_status_collection.update_one(
            {"_id": "queue_control"},
            {
                "$set": {
                    "status": status.value,
                    "paused_at": datetime.utcnow(),
                    "pause_reason": reason,
                    "resume_at": resume_at,
                    "paused_by": "system"  # Could be passed as parameter
                },
                "$unset": {"resumed_at": "", "resume_reason": ""}
            },
            upsert=True
        )
        
        # Mark all processing notifications as pending (graceful pause)
        reset_modified = 0
        if not emergency:
            reset_count = await self.queue_collection.update_many(
                {"status": "processing"},
                {
                    "$set": {
                        "status": "pending",
                        "statusReason": f"Queue paused: {reason}",
                        "pausedAt": datetime.utcnow()
                    }
                }
            )
            reset_modified = reset_count.modified_count
            logger.info(f"🛑 Queue paused gracefully - reset {reset_modified} processing items")
        else:
            logger.warning(f"🚨 EMERGENCY STOP - Queue halted immediately")
        
        return {
            "status": status.value,
            "reason": reason,
            "resume_at": resume_at.isoformat() if resume_at else None,
            "reset_count": reset_modified
        }
    
    async def resume_queue(self, reason: str = "Manual resume") -> Dict[str, Any]:
        """Resume the paused notification queue"""
        
        # Update queue status
        await self.queue_status_collection.update_one(
            {"_id": "queue_control"},
            {
                "$set": {
                    "status": QueueStatus.NORMAL.value,
                    "resumed_at": datetime.utcnow(),
                    "resume_reason": reason
                },
                "$unset": {
                    "paused_at": "",
                    "pause_reason": "",
                    "resume_at": ""
                }
            }
        )
        
        logger.info(f"▶️ Queue resumed: {reason}")
        
        return {
            "status": QueueStatus.NORMAL.value,
            "reason": reason,
            "resumed_at": datetime.utcnow().isoformat()
        }
    
    async def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status and control information"""
        status_doc = await self.queue_status_collection.find_one({"_id": "queue_control"})
        
        if not status_doc:
            return {
                "status": QueueStatus.NORMAL.value,
                "paused_at": None,
                "resume_at": None,
                "reason": None
            }
        
        # Check if auto-resume is needed
        if status_doc.get("status") in [QueueStatus.PAUSED.value, QueueStatus.EMERGENCY_STOP.value]:
            resume_at = status_doc.get("resume_at")
            if resume_at and datetime.utcnow() >= resume_at:
                # Auto-resume
                await self.resume_queue("Auto-resume after timeout")
                status_doc["status"] = QueueStatus.NORMAL.value
                status_doc["resume_reason"] = "Auto-resume after timeout"
        
        return status_doc
    
    # ============================================
    # Queue Cleanup
    # ============================================
    
    async def cleanup_queue(
        self,
        age_days: int = 30,
        failed_age_days: int = 7,
        sent_age_days: int = 7,
        batch_size: int = 1000,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Comprehensive queue cleanup
        
        Args:
            age_days: Clean pending notifications older than this
            failed_age_days: Clean failed notifications older than this  
            sent_age_days: Clean sent notifications older than this
            batch_size: Process in batches
            dry_run: Don't actually delete, just report
        """
        stats = {
            "pending_deleted": 0,
            "failed_deleted": 0,
            "sent_deleted": 0,
            "dead_letter_moved": 0,
            "total_deleted": 0
        }
        
        try:
            # 1. Move old failed notifications to dead letter queue
            failed_cutoff = datetime.utcnow() - timedelta(days=failed_age_days)
            failed_query = {
                "status": "failed",
                "createdAt": {"$lt": failed_cutoff}
            }
            
            if not dry_run:
                moved_count = await self._move_to_dead_letter(failed_query, batch_size)
                stats["dead_letter_moved"] = moved_count
                logger.info(f"📦 Moved {moved_count} old failed notifications to dead letter queue")
            else:
                failed_count = await self.queue_collection.count_documents(failed_query)
                stats["dead_letter_moved"] = failed_count
                logger.info(f"[DRY RUN] Would move {failed_count} failed notifications to dead letter queue")
            
            # 2. Delete old pending notifications
            if age_days > 0:
                pending_cutoff = datetime.utcnow() - timedelta(days=age_days)
                pending_query = {
                    "status": "pending",
                    "createdAt": {"$lt": pending_cutoff}
                }
                
                deleted = await self._delete_notifications(pending_query, batch_size, dry_run)
                stats["pending_deleted"] = deleted
                logger.info(f"{'[DRY RUN] Would delete' if dry_run else 'Deleted'} {deleted} old pending notifications")
            
            # 3. Delete old sent notifications
            if sent_age_days > 0:
                sent_cutoff = datetime.utcnow() - timedelta(days=sent_age_days)
                sent_query = {
                    "status": "sent",
                    "sentAt": {"$lt": sent_cutoff}
                }
                
                deleted = await self._delete_notifications(sent_query, batch_size, dry_run)
                stats["sent_deleted"] = deleted
                logger.info(f"{'[DRY RUN] Would delete' if dry_run else 'Deleted'} {deleted} old sent notifications")
            
            # 4. Clean up very old dead letter notifications
            dead_letter_cutoff = datetime.utcnow() - timedelta(days=90)
            dead_letter_query = {"createdAt": {"$lt": dead_letter_cutoff}}
            
            deleted = await self._delete_dead_letter(dead_letter_query, batch_size, dry_run)
            stats["dead_letter_deleted"] = deleted
            logger.info(f"{'[DRY RUN] Would delete' if dry_run else 'Deleted'} {deleted} very old dead letter notifications")
            
            stats["total_deleted"] = sum([
                stats["pending_deleted"],
                stats["failed_deleted"], 
                stats["sent_deleted"],
                stats.get("dead_letter_deleted", 0)
            ])
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Queue cleanup failed: {e}")
            raise
    
    async def _move_to_dead_letter(self, query: Dict, batch_size: int) -> int:
        """Move notifications to dead letter queue"""
        total_moved = 0
        
        while True:
            # Get batch
            batch = await self.queue_collection.find(query).limit(batch_size).to_list(batch_size)
            if not batch:
                break
            
            # Prepare dead letter documents
            dead_letter_docs = []
            for notif in batch:
                dead_letter_doc = notif.copy()
                dead_letter_doc["originalQueueId"] = str(notif["_id"])
                dead_letter_doc["movedToDeadLetterAt"] = datetime.utcnow()
                dead_letter_doc["moveReason"] = "Max cleanup age exceeded"
                dead_letter_doc.pop("_id", None)  # Remove old _id
                dead_letter_docs.append(dead_letter_doc)
            
            # Insert into dead letter collection
            if dead_letter_docs:
                await self.dead_letter_collection.insert_many(dead_letter_docs)
            
            # Delete from main queue
            notification_ids = [n["_id"] for n in batch]
            result = await self.queue_collection.delete_many({"_id": {"$in": notification_ids}})
            
            total_moved += result.deleted_count
            await asyncio.sleep(0.1)  # Small delay to avoid overwhelming DB
        
        return total_moved
    
    async def _delete_notifications(self, query: Dict, batch_size: int, dry_run: bool) -> int:
        """Delete notifications in batches"""
        if dry_run:
            count = await self.queue_collection.count_documents(query)
            return count
        
        total_deleted = 0
        while True:
            # Get batch of IDs
            batch = await self.queue_collection.find(query, {"_id": 1}).limit(batch_size).to_list(batch_size)
            if not batch:
                break
            
            notification_ids = [n["_id"] for n in batch]
            result = await self.queue_collection.delete_many({"_id": {"$in": notification_ids}})
            
            total_deleted += result.deleted_count
            await asyncio.sleep(0.1)
        
        return total_deleted
    
    async def _delete_dead_letter(self, query: Dict, batch_size: int, dry_run: bool) -> int:
        """Delete dead letter notifications in batches"""
        if dry_run:
            count = await self.dead_letter_collection.count_documents(query)
            return count
        
        total_deleted = 0
        while True:
            batch = await self.dead_letter_collection.find(query, {"_id": 1}).limit(batch_size).to_list(batch_size)
            if not batch:
                break
            
            notification_ids = [n["_id"] for n in batch]
            result = await self.dead_letter_collection.delete_many({"_id": {"$in": notification_ids}})
            
            total_deleted += result.deleted_count
            await asyncio.sleep(0.1)
        
        return total_deleted
    
    # ============================================
    # Dead Letter Queue Management
    # ============================================
    
    async def get_dead_letter_queue(
        self,
        limit: int = 100,
        status_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get dead letter queue items"""
        query = {}
        if status_filter:
            query["status"] = status_filter
        
        cursor = self.dead_letter_collection.find(query).sort("movedToDeadLetterAt", -1).limit(limit)
        dead_letters = []
        
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            dead_letters.append(doc)
        
        return dead_letters
    
    async def retry_dead_letter_notification(
        self,
        dead_letter_id: str,
        reset_attempts: bool = True
    ) -> bool:
        """Retry a dead letter notification"""
        try:
            from bson import ObjectId
            
            # Get dead letter item
            dead_letter = await self.dead_letter_collection.find_one({"_id": ObjectId(dead_letter_id)})
            if not dead_letter:
                return False
            
            # Create new notification in main queue
            new_notification = dead_letter.copy()
            new_notification.pop("_id", None)
            new_notification.pop("originalQueueId", None)
            new_notification.pop("movedToDeadLetterAt", None)
            new_notification.pop("moveReason", None)
            
            if reset_attempts:
                new_notification["attempts"] = 0
                new_notification["statusReason"] = "Retried from dead letter queue"
            
            new_notification["status"] = "pending"
            new_notification["createdAt"] = datetime.utcnow()
            new_notification["retriedAt"] = datetime.utcnow()
            
            # Insert into main queue
            await self.queue_collection.insert_one(new_notification)
            
            # Remove from dead letter queue
            await self.dead_letter_collection.delete_one({"_id": ObjectId(dead_letter_id)})
            
            logger.info(f"🔄 Retried dead letter notification {dead_letter_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to retry dead letter notification {dead_letter_id}: {e}")
            return False
    
    # ============================================
    # Rate Limiting
    # ============================================
    
    async def check_rate_limit(
        self,
        username: str,
        channel: str,
        window_minutes: int = 60,
        max_notifications: int = 10
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if user/channel is rate limited
        
        Returns:
            (allowed, rate_limit_info)
        """
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=window_minutes)
        
        # Count recent notifications
        recent_count = await self.queue_collection.count_documents({
            "username": username,
            "channels": {"$in": [channel]},
            "createdAt": {"$gte": window_start},
            "status": {"$in": ["pending", "processing", "sent"]}
        })
        
        # Check rate limit
        allowed = recent_count < max_notifications
        
        rate_limit_info = {
            "allowed": allowed,
            "current_count": recent_count,
            "max_allowed": max_notifications,
            "window_minutes": window_minutes,
            "reset_time": (window_start + timedelta(minutes=window_minutes)).isoformat(),
            "remaining": max(0, max_notifications - recent_count)
        }
        
        # Log rate limit hit
        if not allowed:
            logger.warning(f"🚫 Rate limit exceeded for {username}/{channel}: {recent_count}/{max_notifications}")
        
        return allowed, rate_limit_info
    
    async def get_rate_limit_stats(self) -> Dict[str, Any]:
        """Get rate limiting statistics"""
        now = datetime.utcnow()
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)
        
        # Active rate limits
        active_limits = await self.rate_limit_collection.count_documents({
            "expiresAt": {"$gt": now}
        })
        
        # Recent notifications by hour
        hourly_stats = await self.queue_collection.aggregate([
            {"$match": {"createdAt": {"$gte": hour_ago}}},
            {"$group": {
                "_id": {
                    "username": "$username",
                    "channel": {"$arrayElemAt": ["$channels", 0]}
                },
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]).to_list(10)
        
        return {
            "active_rate_limits": active_limits,
            "hourly_top_senders": hourly_stats,
            "total_last_hour": await self.queue_collection.count_documents({"createdAt": {"$gte": hour_ago}}),
            "total_last_day": await self.queue_collection.count_documents({"createdAt": {"$gte": day_ago}})
        }
    
    # ============================================
    # Queue Metrics & Monitoring
    # ============================================
    
    async def get_queue_metrics(self) -> QueueMetrics:
        """Get comprehensive queue metrics"""
        now = datetime.utcnow()
        
        # Basic counts
        pending = await self.queue_collection.count_documents({"status": "pending"})
        processing = await self.queue_collection.count_documents({"status": "processing"})
        failed = await self.queue_collection.count_documents({"status": "failed"})
        sent = await self.queue_collection.count_documents({"status": "sent"})
        
        # Processing rate (last hour)
        hour_ago = now - timedelta(hours=1)
        sent_last_hour = await self.queue_collection.count_documents({
            "status": "sent",
            "sentAt": {"$gte": hour_ago}
        })
        processing_rate = sent_last_hour / 60.0  # per minute
        
        # Failure rate (last hour)
        failed_last_hour = await self.queue_collection.count_documents({
            "status": "failed",
            "failedAt": {"$gte": hour_ago}
        })
        total_last_hour = sent_last_hour + failed_last_hour
        failure_rate = (failed_last_hour / total_last_hour * 100) if total_last_hour > 0 else 0
        
        # Oldest pending age
        oldest_pending = await self.queue_collection.find_one(
            {"status": "pending"},
            sort=[("createdAt", 1)]
        )
        oldest_pending_age = now - oldest_pending["createdAt"] if oldest_pending else timedelta(0)
        
        # Stuck processing count (> 10 minutes)
        stuck_cutoff = now - timedelta(minutes=10)
        stuck_processing = await self.queue_collection.count_documents({
            "status": "processing",
            "processingStartedAt": {"$lt": stuck_cutoff}
        })
        
        return QueueMetrics(
            total_pending=pending,
            total_processing=processing,
            total_failed=failed,
            total_sent=sent,
            processing_rate=processing_rate,
            failure_rate=failure_rate,
            oldest_pending_age=oldest_pending_age,
            stuck_processing_count=stuck_processing
        )
