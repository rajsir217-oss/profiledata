# fastapi_backend/services/activity_logger.py
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.activity_models import (
    ActivityLog, ActivityType, ActivityLogFilter, 
    ActivityStats, ActivityLogCreate
)
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import asyncio
from collections import defaultdict
import json

class ActivityLogger:
    """Service for logging user activities with batch processing and privacy controls"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.activity_logs
        self.batch_queue = []
        self.batch_size = 100
        self.batch_timeout = 5  # seconds
        self._flush_task = None
        
    async def initialize(self):
        """Initialize the activity logger and create indexes"""
        try:
            # Check if TTL index exists with wrong config and drop it
            existing_indexes = await self.collection.index_information()
            if "timestamp_1" in existing_indexes:
                index_info = existing_indexes["timestamp_1"]
                # If it doesn't have expireAfterSeconds, drop it
                if "expireAfterSeconds" not in index_info:
                    print("⚠️ Dropping old timestamp index without TTL")
                    await self.collection.drop_index("timestamp_1")
            
            # Create indexes for performance
            await self.collection.create_index("username")
            await self.collection.create_index("action_type")
            await self.collection.create_index([("username", 1), ("timestamp", -1)])
            await self.collection.create_index([("action_type", 1), ("timestamp", -1)])
            
            # TTL index for automatic deletion after 120 days
            # Note: This replaces any existing timestamp index
            await self.collection.create_index(
                "timestamp",
                expireAfterSeconds=10368000,  # 120 days (120 * 24 * 60 * 60)
                name="timestamp_1"
            )
            
            print("✅ Activity logger initialized with indexes")
            
            # Start periodic flush task
            self._flush_task = asyncio.create_task(self._periodic_flush())
            
        except Exception as e:
            print(f"❌ Error initializing activity logger: {e}")
    
    async def _periodic_flush(self):
        """Periodically flush batch queue"""
        while True:
            await asyncio.sleep(self.batch_timeout)
            if self.batch_queue:
                await self._flush_batch()
    
    async def log_activity(
        self,
        username: str,
        action_type: ActivityType,
        target_username: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        page_url: Optional[str] = None,
        referrer_url: Optional[str] = None,
        session_id: Optional[str] = None,
        duration_ms: Optional[int] = None,
        pii_logged: bool = False
    ):
        """Log a single activity asynchronously"""
        
        # Mask IP address for privacy
        if ip_address:
            ip_address = self._mask_ip(ip_address)
        
        # Create activity log entry
        activity = ActivityLog(
            username=username,
            action_type=action_type,
            target_username=target_username,
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
            page_url=page_url,
            referrer_url=referrer_url,
            session_id=session_id,
            timestamp=datetime.utcnow(),
            duration_ms=duration_ms,
            pii_logged=pii_logged
        )
        
        # Add to batch queue
        self.batch_queue.append(activity.dict(by_alias=True, exclude={'id'}))
        
        # Flush if batch is full
        if len(self.batch_queue) >= self.batch_size:
            await self._flush_batch()
    
    async def _flush_batch(self):
        """Flush batch queue to database"""
        if not self.batch_queue:
            return
        
        try:
            batch_to_insert = self.batch_queue.copy()
            self.batch_queue.clear()
            
            if batch_to_insert:
                await self.collection.insert_many(batch_to_insert)
                print(f"✅ Flushed {len(batch_to_insert)} activity logs to database")
        except Exception as e:
            print(f"❌ Error flushing activity logs: {e}")
            # Re-add to queue if failed
            self.batch_queue.extend(batch_to_insert)
    
    @staticmethod
    def _mask_ip(ip_address: str) -> str:
        """Mask last octet of IP for privacy (192.168.1.123 -> 192.168.1.0)"""
        try:
            parts = ip_address.split('.')
            if len(parts) == 4:
                parts[-1] = '0'
                return '.'.join(parts)
            # IPv6 or other format - return first part only
            return ip_address.split(':')[0] + ':****'
        except:
            return "unknown"
    
    async def get_logs(
        self,
        filters: ActivityLogFilter
    ) -> Tuple[List[ActivityLog], int]:
        """Get activity logs with filters and pagination"""
        
        query = {}
        
        if filters.username:
            query["username"] = filters.username
        
        # Multi-select action_types takes precedence over single action_type
        if filters.action_types and len(filters.action_types) > 0:
            query["action_type"] = {"$in": filters.action_types}
        elif filters.action_type:
            query["action_type"] = filters.action_type.value
        
        if filters.target_username:
            query["target_username"] = filters.target_username
        
        if filters.session_id:
            query["session_id"] = filters.session_id
        
        if filters.start_date or filters.end_date:
            query["timestamp"] = {}
            if filters.start_date:
                query["timestamp"]["$gte"] = filters.start_date
            if filters.end_date:
                query["timestamp"]["$lte"] = filters.end_date
        
        # Get total count
        total = await self.collection.count_documents(query)
        
        # Get paginated results
        skip = (filters.page - 1) * filters.limit
        cursor = self.collection.find(query).sort("timestamp", -1).skip(skip).limit(filters.limit)
        logs = await cursor.to_list(length=filters.limit)
        
        # Convert ObjectId to string for each log
        for log in logs:
            if "_id" in log:
                log["_id"] = str(log["_id"])
        
        return [ActivityLog(**log) for log in logs], total
    
    async def get_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> ActivityStats:
        """Get activity statistics"""
        
        # Default to last 30 days
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()
        
        query = {"timestamp": {"$gte": start_date, "$lte": end_date}}
        
        # Total activities
        total = await self.collection.count_documents(query)
        
        # Unique users
        unique_users = len(await self.collection.distinct("username", query))
        
        # Top actions
        pipeline = [
            {"$match": query},
            {"$group": {"_id": "$action_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_actions_cursor = self.collection.aggregate(pipeline)
        top_actions = {doc["_id"]: doc["count"] async for doc in top_actions_cursor}
        
        # Most active users
        pipeline = [
            {"$match": query},
            {"$group": {"_id": "$username", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        most_active_cursor = self.collection.aggregate(pipeline)
        most_active = [{"username": doc["_id"], "count": doc["count"]} async for doc in most_active_cursor]
        
        return ActivityStats(
            total_activities=total,
            unique_users=unique_users,
            top_actions=top_actions,
            most_active_users=most_active,
            date_range={
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        )
    
    async def delete_old_logs(self, days: int = 30) -> int:
        """Delete logs older than specified days (except audit logs)"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Don't delete audit logs (PII requests, admin actions, etc.)
        audit_actions = [
            ActivityType.PII_REQUEST_SENT.value,
            ActivityType.PII_REQUEST_APPROVED.value,
            ActivityType.PII_REQUEST_DENIED.value,
            ActivityType.PII_ACCESS_REVOKED.value,
            ActivityType.USER_STATUS_CHANGED.value,
            ActivityType.USER_DELETED.value,
            ActivityType.ROLE_CHANGED.value,
            ActivityType.USER_SUSPENDED.value,
            ActivityType.USER_BANNED.value
        ]
        
        query = {
            "timestamp": {"$lt": cutoff_date},
            "action_type": {"$nin": audit_actions}
        }
        
        result = await self.collection.delete_many(query)
        print(f"🗑️ Deleted {result.deleted_count} old activity logs (older than {days} days)")
        return result.deleted_count
    
    async def export_logs(
        self,
        filters: ActivityLogFilter,
        format: str = "json"
    ) -> List[Dict[str, Any]]:
        """Export logs for download - fetches ALL matching logs"""
        # Build query from filters (same as get_logs but no pagination)
        query = {}
        
        if filters.username:
            query["username"] = filters.username
        
        # Multi-select action_types takes precedence over single action_type
        if filters.action_types and len(filters.action_types) > 0:
            query["action_type"] = {"$in": filters.action_types}
        elif filters.action_type:
            query["action_type"] = filters.action_type.value
        
        if filters.target_username:
            query["target_username"] = filters.target_username
        
        if filters.session_id:
            query["session_id"] = filters.session_id
        
        if filters.start_date or filters.end_date:
            query["timestamp"] = {}
            if filters.start_date:
                query["timestamp"]["$gte"] = filters.start_date
            if filters.end_date:
                query["timestamp"]["$lte"] = filters.end_date
        
        # Fetch ALL logs without pagination limit
        cursor = self.collection.find(query).sort("timestamp", -1)
        raw_logs = await cursor.to_list(length=None)  # None = no limit
        
        # Convert ObjectId to string
        for log in raw_logs:
            if "_id" in log:
                log["_id"] = str(log["_id"])
        
        # Convert to ActivityLog objects
        logs = [ActivityLog(**log) for log in raw_logs]
        
        if format == "csv":
            # Convert to CSV-friendly format
            return [
                {
                    "timestamp": log.timestamp.isoformat(),
                    "username": log.username,
                    "action": log.action_type,
                    "target": log.target_username or "",
                    "ip_address": log.ip_address or "",
                    "page": log.page_url or "",
                    "duration_ms": log.duration_ms or 0,
                    "metadata": json.dumps(log.metadata)
                }
                for log in logs
            ]
        else:
            # JSON format - convert datetime to string for JSON serialization
            return [
                {
                    **log.dict(by_alias=True),
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None
                }
                for log in logs
            ]
    
    async def cleanup(self):
        """Cleanup resources"""
        if self._flush_task:
            self._flush_task.cancel()
        # Final flush
        await self._flush_batch()

# Global instance
activity_logger: Optional[ActivityLogger] = None

def get_activity_logger() -> ActivityLogger:
    """Get activity logger instance"""
    if activity_logger is None:
        raise RuntimeError("Activity logger not initialized. Call initialize_activity_logger() first.")
    return activity_logger

async def initialize_activity_logger(db: AsyncIOMotorDatabase):
    """Initialize activity logger"""
    global activity_logger
    activity_logger = ActivityLogger(db)
    await activity_logger.initialize()
    return activity_logger
