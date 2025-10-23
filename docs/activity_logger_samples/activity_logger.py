# fastapi_backend/services/activity_logger.py
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.activity_models import ActivityLog, ActivityType, ActivityLogFilter
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio
from collections import defaultdict

class ActivityLogger:
    """Service for logging user activities"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.activity_logs
        self.batch_queue = []
        self.batch_size = 100
        self.batch_timeout = 5  # seconds
        
    async def log_activity(
        self,
        username: str,
        action_type: ActivityType,
        target_username: Optional[str] = None,
        metadata: Dict[str, Any] = None,
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
            await self.collection.insert_many(self.batch_queue)
            print(f"✅ Flushed {len(self.batch_queue)} activity logs")
            self.batch_queue.clear()
        except Exception as e:
            print(f"❌ Error flushing activity logs: {e}")
    
    @staticmethod
    def _mask_ip(ip_address: str) -> str:
        """Mask last octet of IP for privacy"""
        parts = ip_address.split('.')
        if len(parts) == 4:
            parts[-1] = '0'
            return '.'.join(parts)
        return ip_address
    
    async def get_logs(
        self,
        filters: ActivityLogFilter
    ) -> tuple[List[ActivityLog], int]:
        """Get activity logs with filters"""
        
        query = {}
        
        if filters.username:
            query["username"] = filters.username
        
        if filters.action_type:
            query["action_type"] = filters.action_type
        
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
        
        return [ActivityLog(**log) for log in logs], total
    
    async def get_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
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
        
        return {
            "total_activities": total,
            "unique_users": unique_users,
            "top_actions": top_actions,
            "most_active_users": most_active,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
    
    async def delete_old_logs(self, days: int = 30):
        """Delete logs older than specified days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Don't delete audit logs (PII requests, admin actions)
        audit_actions = [
            ActivityType.PII_REQUEST_SENT,
            ActivityType.PII_REQUEST_APPROVED,
            ActivityType.PII_REQUEST_DENIED,
            ActivityType.USER_STATUS_CHANGED,
            ActivityType.USER_DELETED,
            ActivityType.ROLE_CHANGED
        ]
        
        query = {
            "timestamp": {"$lt": cutoff_date},
            "action_type": {"$nin": audit_actions}
        }
        
        result = await self.collection.delete_many(query)
        print(f"🗑️ Deleted {result.deleted_count} old activity logs")
        return result.deleted_count
    
    async def export_logs(
        self,
        filters: ActivityLogFilter,
        format: str = "json"
    ) -> List[Dict[str, Any]]:
        """Export logs for download"""
        logs, _ = await self.get_logs(filters)
        
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
                    "duration_ms": log.duration_ms or 0
                }
                for log in logs
            ]
        else:
            # JSON format
            return [log.dict() for log in logs]

# Global instance
activity_logger: Optional[ActivityLogger] = None

def get_activity_logger() -> ActivityLogger:
    """Get activity logger instance"""
    if activity_logger is None:
        raise RuntimeError("Activity logger not initialized")
    return activity_logger

async def initialize_activity_logger(db: AsyncIOMotorDatabase):
    """Initialize activity logger"""
    global activity_logger
    activity_logger = ActivityLogger(db)
    
    # Create indexes
    await activity_logger.collection.create_index("username")
    await activity_logger.collection.create_index("action_type")
    await activity_logger.collection.create_index("timestamp")
    await activity_logger.collection.create_index([("username", 1), ("timestamp", -1)])
    
    # TTL index for automatic deletion (30 days)
    await activity_logger.collection.create_index(
        "timestamp",
        expireAfterSeconds=2592000  # 30 days
    )
    
    print("✅ Activity logger initialized")
