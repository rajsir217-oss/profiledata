"""
Pause Analytics Service
Track and analyze pause feature usage patterns
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from collections import defaultdict


class PauseAnalyticsService:
    """Service for tracking and analyzing pause feature usage"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users_collection = db.users
    
    async def get_overview_stats(self) -> Dict[str, Any]:
        """
        Get overview statistics for pause feature
        
        Returns:
            Dict with total pauses, active paused, average duration, etc.
        """
        # Total users who have ever paused
        total_users_paused = await self.users_collection.count_documents({
            "pauseCount": {"$gt": 0}
        })
        
        # Currently paused accounts
        active_paused = await self.users_collection.count_documents({
            "accountStatus": "paused"
        })
        
        # Total pause events (sum of all pauseCount)
        pipeline = [
            {"$match": {"pauseCount": {"$exists": True}}},
            {"$group": {
                "_id": None,
                "totalPauses": {"$sum": "$pauseCount"},
                "avgPauseCount": {"$avg": "$pauseCount"}
            }}
        ]
        
        pause_stats = await self.users_collection.aggregate(pipeline).to_list(1)
        total_pauses = pause_stats[0]["totalPauses"] if pause_stats else 0
        avg_pause_count = pause_stats[0]["avgPauseCount"] if pause_stats else 0
        
        # Average duration for manual pauses (excluding auto-unpause)
        manual_pipeline = [
            {
                "$match": {
                    "accountStatus": "paused",
                    "pausedAt": {"$exists": True},
                    "pausedUntil": {"$ne": None}
                }
            },
            {
                "$project": {
                    "duration": {
                        "$subtract": ["$pausedUntil", "$pausedAt"]
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "avgDuration": {"$avg": "$duration"}
                }
            }
        ]
        
        duration_stats = await self.users_collection.aggregate(manual_pipeline).to_list(1)
        avg_duration_ms = duration_stats[0]["avgDuration"] if duration_stats else 0
        avg_duration_days = avg_duration_ms / (1000 * 60 * 60 * 24) if avg_duration_ms else 0
        
        return {
            "totalUsersPaused": total_users_paused,
            "activePausedAccounts": active_paused,
            "totalPauseEvents": total_pauses,
            "averagePauseCount": round(avg_pause_count, 2),
            "averageDurationDays": round(avg_duration_days, 1)
        }
    
    async def get_pause_reasons_distribution(self) -> List[Dict[str, Any]]:
        """
        Get distribution of pause reasons
        
        Returns:
            List of {reason, count, percentage}
        """
        pipeline = [
            {
                "$match": {
                    "pauseReason": {"$exists": True, "$ne": None}
                }
            },
            {
                "$group": {
                    "_id": "$pauseReason",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"count": -1}
            }
        ]
        
        results = await self.users_collection.aggregate(pipeline).to_list(None)
        
        total = sum(r["count"] for r in results)
        
        return [
            {
                "reason": r["_id"],
                "count": r["count"],
                "percentage": round((r["count"] / total * 100), 1) if total > 0 else 0
            }
            for r in results
        ]
    
    async def get_duration_patterns(self) -> Dict[str, Any]:
        """
        Get pause duration patterns (3d, 7d, 14d, 30d, manual)
        
        Returns:
            Dict with duration breakdowns
        """
        now = datetime.utcnow()
        
        # Get all paused users with duration info
        paused_users = await self.users_collection.find({
            "accountStatus": "paused",
            "pausedAt": {"$exists": True}
        }).to_list(None)
        
        patterns = {
            "3_days": 0,
            "7_days": 0,
            "14_days": 0,
            "30_days": 0,
            "manual": 0,
            "unknown": 0
        }
        
        for user in paused_users:
            if not user.get("pausedUntil"):
                patterns["manual"] += 1
                continue
            
            paused_at = user["pausedAt"]
            paused_until = user["pausedUntil"]
            
            # Calculate duration in days
            duration = (paused_until - paused_at).days
            
            # Categorize (with 1-day tolerance)
            if 2 <= duration <= 4:
                patterns["3_days"] += 1
            elif 5 <= duration <= 8:
                patterns["7_days"] += 1
            elif 12 <= duration <= 16:
                patterns["14_days"] += 1
            elif 28 <= duration <= 32:
                patterns["30_days"] += 1
            else:
                patterns["unknown"] += 1
        
        total = sum(patterns.values())
        
        return {
            "patterns": patterns,
            "total": total,
            "percentages": {
                key: round((count / total * 100), 1) if total > 0 else 0
                for key, count in patterns.items()
            }
        }
    
    async def get_time_series_data(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get time-series data for pause/unpause events
        
        Args:
            days: Number of days to look back
        
        Returns:
            List of {date, pauses, unpauses, net_change}
        """
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Note: This is a simplified version
        # In production, you'd want to log pause/unpause events separately
        # For now, we'll return current state
        
        pipeline = [
            {
                "$match": {
                    "pausedAt": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$pausedAt"
                        }
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await self.users_collection.aggregate(pipeline).to_list(None)
        
        return [
            {
                "date": r["_id"],
                "pauses": r["count"],
                "unpauses": 0,  # Would need separate tracking
                "netChange": r["count"]
            }
            for r in results
        ]
    
    async def get_top_pausers(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get users with highest pause counts
        
        Args:
            limit: Number of top users to return
        
        Returns:
            List of {username, pauseCount, currentStatus}
        """
        pipeline = [
            {
                "$match": {
                    "pauseCount": {"$gt": 0}
                }
            },
            {
                "$sort": {"pauseCount": -1}
            },
            {
                "$limit": limit
            },
            {
                "$project": {
                    "username": 1,
                    "pauseCount": 1,
                    "accountStatus": 1,
                    "pausedAt": 1,
                    "pauseReason": 1
                }
            }
        ]
        
        results = await self.users_collection.aggregate(pipeline).to_list(None)
        
        return [
            {
                "username": r["username"],
                "pauseCount": r["pauseCount"],
                "currentStatus": r.get("accountStatus", "active"),
                "pausedAt": r.get("pausedAt"),
                "pauseReason": r.get("pauseReason")
            }
            for r in results
        ]
    
    async def get_auto_unpause_stats(self) -> Dict[str, Any]:
        """
        Get statistics about auto-unpause feature
        
        Returns:
            Dict with auto-unpause metrics
        """
        # Users scheduled for auto-unpause
        now = datetime.utcnow()
        
        scheduled_unpause = await self.users_collection.count_documents({
            "accountStatus": "paused",
            "pausedUntil": {"$ne": None, "$gt": now}
        })
        
        overdue_unpause = await self.users_collection.count_documents({
            "accountStatus": "paused",
            "pausedUntil": {"$ne": None, "$lte": now}
        })
        
        manual_pause = await self.users_collection.count_documents({
            "accountStatus": "paused",
            "pausedUntil": None
        })
        
        return {
            "scheduledAutoUnpause": scheduled_unpause,
            "overdueAutoUnpause": overdue_unpause,
            "manualPauseOnly": manual_pause,
            "totalPaused": scheduled_unpause + overdue_unpause + manual_pause
        }
    
    async def get_comprehensive_report(self) -> Dict[str, Any]:
        """
        Get comprehensive analytics report
        
        Returns:
            Dict with all analytics data
        """
        overview = await self.get_overview_stats()
        reasons = await self.get_pause_reasons_distribution()
        durations = await self.get_duration_patterns()
        auto_unpause = await self.get_auto_unpause_stats()
        top_pausers = await self.get_top_pausers(limit=5)
        time_series = await self.get_time_series_data(days=30)
        
        return {
            "overview": overview,
            "reasonsDistribution": reasons,
            "durationPatterns": durations,
            "autoUnpauseStats": auto_unpause,
            "topPausers": top_pausers,
            "timeSeries": time_series,
            "generatedAt": datetime.utcnow()
        }
