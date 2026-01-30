"""
System Cleanup Job Template
Runs system maintenance tasks (sessions, expired data, temp files, etc.)
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
from .base import JobTemplate, JobExecutionContext, JobResult
import time
import logging

logger = logging.getLogger(__name__)


class SystemCleanupTemplate(JobTemplate):
    """Template for system cleanup tasks"""
    
    template_type = "system_cleanup"
    template_name = "System Cleanup"
    template_description = "Clean up expired sessions, old job executions, and system maintenance"
    category = "maintenance"
    icon = "🧹"
    estimated_duration = "1-5 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "cleanup_sessions": {
                    "type": "boolean",
                    "description": "Clean up expired user sessions",
                    "default": True
                },
                "cleanup_job_executions": {
                    "type": "boolean",
                    "description": "Clean up old job execution records",
                    "default": True
                },
                "cleanup_notification_logs": {
                    "type": "boolean",
                    "description": "Clean up old notification logs",
                    "default": True
                },
                "session_days_to_keep": {
                    "type": "integer",
                    "description": "Days to keep session data",
                    "minimum": 1,
                    "maximum": 365,
                    "default": 7
                },
                "job_execution_days_to_keep": {
                    "type": "integer",
                    "description": "Days to keep job execution history",
                    "minimum": 1,
                    "maximum": 365,
                    "default": 30
                },
                "notification_log_days_to_keep": {
                    "type": "integer",
                    "description": "Days to keep notification logs",
                    "minimum": 1,
                    "maximum": 365,
                    "default": 30
                },
                "cleanup_excluded_messages": {
                    "type": "boolean",
                    "description": "Clean up messages from excluded users after grace period",
                    "default": True
                },
                "excluded_messages_days": {
                    "type": "integer",
                    "description": "Days after exclusion before deleting messages",
                    "minimum": 7,
                    "maximum": 365,
                    "default": 30
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # All parameters are optional with defaults
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute system cleanup"""
        start_time = time.time()
        params = context.parameters
        
        # Get parameters with defaults
        cleanup_sessions = params.get("cleanup_sessions", True)
        cleanup_job_executions = params.get("cleanup_job_executions", True)
        cleanup_notification_logs = params.get("cleanup_notification_logs", True)
        cleanup_excluded_messages = params.get("cleanup_excluded_messages", True)
        session_days = params.get("session_days_to_keep", 7)
        job_exec_days = params.get("job_execution_days_to_keep", 30)
        notif_log_days = params.get("notification_log_days_to_keep", 30)
        excluded_msg_days = params.get("excluded_messages_days", 30)
        
        context.log("INFO", "🧹 Starting system cleanup...")
        
        total_deleted = 0
        cleanup_results = {}
        errors = []
        
        try:
            # 1. Clean up expired sessions
            if cleanup_sessions:
                try:
                    cutoff = datetime.utcnow() - timedelta(days=session_days)
                    result = await context.db.sessions.delete_many({
                        "$or": [
                            {"expires_at": {"$lt": datetime.utcnow()}},
                            {"created_at": {"$lt": cutoff}},
                            {"last_activity": {"$lt": cutoff}}
                        ]
                    })
                    deleted = result.deleted_count
                    cleanup_results["sessions"] = deleted
                    total_deleted += deleted
                    context.log("INFO", f"   ✅ Sessions: Deleted {deleted} expired records")
                except Exception as e:
                    errors.append(f"Sessions cleanup failed: {str(e)}")
                    context.log("ERROR", f"   ❌ Sessions cleanup failed: {str(e)}")
            
            # 2. Clean up old job executions
            if cleanup_job_executions:
                try:
                    cutoff = datetime.utcnow() - timedelta(days=job_exec_days)
                    result = await context.db.job_executions.delete_many({
                        "started_at": {"$lt": cutoff}
                    })
                    deleted = result.deleted_count
                    cleanup_results["job_executions"] = deleted
                    total_deleted += deleted
                    context.log("INFO", f"   ✅ Job Executions: Deleted {deleted} old records")
                except Exception as e:
                    errors.append(f"Job executions cleanup failed: {str(e)}")
                    context.log("ERROR", f"   ❌ Job executions cleanup failed: {str(e)}")
            
            # 3. Clean up old notification logs
            if cleanup_notification_logs:
                try:
                    cutoff = datetime.utcnow() - timedelta(days=notif_log_days)
                    result = await context.db.notification_log.delete_many({
                        "timestamp": {"$lt": cutoff}
                    })
                    deleted = result.deleted_count
                    cleanup_results["notification_logs"] = deleted
                    total_deleted += deleted
                    context.log("INFO", f"   ✅ Notification Logs: Deleted {deleted} old records")
                except Exception as e:
                    errors.append(f"Notification logs cleanup failed: {str(e)}")
                    context.log("ERROR", f"   ❌ Notification logs cleanup failed: {str(e)}")
            
            # 4. Clean up sent notifications from queue (older than 7 days)
            try:
                cutoff = datetime.utcnow() - timedelta(days=7)
                result = await context.db.notification_queue.delete_many({
                    "status": "sent",
                    "updatedAt": {"$lt": cutoff}
                })
                deleted = result.deleted_count
                cleanup_results["sent_notifications"] = deleted
                total_deleted += deleted
                context.log("INFO", f"   ✅ Sent Notifications: Deleted {deleted} old records")
            except Exception as e:
                errors.append(f"Sent notifications cleanup failed: {str(e)}")
                context.log("ERROR", f"   ❌ Sent notifications cleanup failed: {str(e)}")
            
            # 5. Clean up messages from excluded users (after grace period)
            if cleanup_excluded_messages:
                try:
                    cutoff = datetime.utcnow() - timedelta(days=excluded_msg_days)
                    
                    # Find exclusions older than the grace period
                    old_exclusions = await context.db.exclusions.find({
                        "createdAt": {"$lt": cutoff}
                    }).to_list(1000)
                    
                    messages_deleted = 0
                    exclusions_processed = 0
                    
                    for exclusion in old_exclusions:
                        user1 = exclusion.get("userUsername")
                        user2 = exclusion.get("excludedUsername")
                        
                        if not user1 or not user2:
                            continue
                        
                        # Delete messages between these two users
                        result = await context.db.messages.delete_many({
                            "$or": [
                                {"fromUsername": user1, "toUsername": user2},
                                {"fromUsername": user2, "toUsername": user1}
                            ]
                        })
                        messages_deleted += result.deleted_count
                        exclusions_processed += 1
                    
                    cleanup_results["excluded_messages"] = messages_deleted
                    cleanup_results["exclusions_processed"] = exclusions_processed
                    total_deleted += messages_deleted
                    context.log("INFO", f"   ✅ Excluded Messages: Deleted {messages_deleted} messages from {exclusions_processed} exclusions (>{excluded_msg_days} days old)")
                except Exception as e:
                    errors.append(f"Excluded messages cleanup failed: {str(e)}")
                    context.log("ERROR", f"   ❌ Excluded messages cleanup failed: {str(e)}")
            
            duration = time.time() - start_time
            
            # Determine status
            if errors and len(errors) >= 3:
                status = "failed"
                message = f"System cleanup failed with {len(errors)} errors"
            elif errors:
                status = "partial"
                message = f"System cleanup completed with {len(errors)} errors. Deleted {total_deleted} total records."
            else:
                status = "success"
                message = f"System cleanup completed successfully. Deleted {total_deleted} total records."
            
            context.log("INFO", f"🧹 {message}")
            
            return JobResult(
                status=status,
                message=message,
                details=cleanup_results,
                records_affected=total_deleted,
                duration_seconds=duration,
                errors=errors if errors else None
            )
            
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"System cleanup failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"System cleanup failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
