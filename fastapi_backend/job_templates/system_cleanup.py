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
                "cleanup_config": {
                    "type": "string",
                    "description": "JSON array of cleanup configurations. Example: [{\"collection\": \"sessions\", \"days_old\": 1, \"date_field\": \"created_at\"}]",
                    "default": """[
  {"collection": "sessions", "days_old": 1, "date_field": "created_at"},
  {"collection": "logs", "days_old": 1, "date_field": "created_at"},
  {"collection": "activity_logs", "days_old": 1, "date_field": "timestamp"},
  {"collection": "job_executions", "days_old": 1, "date_field": "started_at"},
  {"collection": "notifications", "days_old": 1, "date_field": "createdAt"},
  {"collection": "favorites", "days_old": 45, "date_field": "createdAt"},
  {"collection": "shortlists", "days_old": 45, "date_field": "createdAt"},
  {"collection": "audit_logs", "days_old": 30, "date_field": "timestamp"},
  {"collection": "messages", "days_old": 120, "date_field": "createdAt"},
  {"collection": "conversation_status", "days_old": 120, "date_field": "createdAt"},
  {"collection": "blocked_message_attempts", "days_old": 120, "date_field": "attemptedAt"},
  {"collection": "notification_log", "days_old": 30, "date_field": "createdAt"},
  {"collection": "notification_queue", "days_old": 7, "date_field": "createdAt"},
  {"collection": "registration_interests", "days_old": 30, "date_field": "updatedAt", "filter": {"$or": [{"status": "rejected"}, {"archived": true}]}}
]"""
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
        
        # Get cleanup config JSON
        import json
        cleanup_config_str = params.get("cleanup_config")
        cleanup_excluded_messages = params.get("cleanup_excluded_messages", True)
        excluded_msg_days = params.get("excluded_messages_days", 30)
        
        # Parse cleanup config
        try:
            cleanup_config = json.loads(cleanup_config_str) if cleanup_config_str else []
        except json.JSONDecodeError as e:
            context.log("ERROR", f"Invalid cleanup_config JSON: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Invalid cleanup_config JSON: {str(e)}",
                errors=[f"Invalid JSON: {str(e)}"],
                duration_seconds=time.time() - start_time
            )
        
        context.log("INFO", f"🧹 Starting database cleanup with {len(cleanup_config)} collection configurations...")
        
        total_deleted = 0
        cleanup_results = {}
        errors = []
        
        try:
            # Process each cleanup configuration
            for config in cleanup_config:
                collection = config.get("collection")
                days_old = config.get("days_old", 30)
                date_field = config.get("date_field", "createdAt")
                filter_query = config.get("filter", {})
                
                if not collection:
                    context.log("WARNING", f"   ⚠️ Skipping config with missing collection name")
                    continue
                
                try:
                    cutoff = datetime.utcnow() - timedelta(days=days_old)
                    
                    # Build query: date filter + custom filter
                    query = {
                        date_field: {"$lt": cutoff}
                    }
                    if filter_query:
                        query = {**query, **filter_query}
                    
                    # Special handling for sessions (also check expires_at and last_activity)
                    if collection == "sessions":
                        query = {
                            "$or": [
                                {"expires_at": {"$lt": datetime.utcnow()}},
                                {"created_at": {"$lt": cutoff}},
                                {"last_activity": {"$lt": cutoff}}
                            ]
                        }
                    
                    result = await context.db[collection].delete_many(query)
                    deleted = result.deleted_count
                    cleanup_results[collection] = deleted
                    total_deleted += deleted
                    
                    filter_desc = f" (filter: {filter_query})" if filter_query else ""
                    context.log("INFO", f"   ✅ {collection}: Deleted {deleted} records (> {days_old} days{filter_desc})")
                except Exception as e:
                    errors.append(f"{collection} cleanup failed: {str(e)}")
                    context.log("ERROR", f"   ❌ {collection} cleanup failed: {str(e)}")
            
            # Clean up messages from excluded users (after grace period)
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
                message = f"Database cleanup failed with {len(errors)} errors"
            elif errors:
                status = "partial"
                message = f"Database cleanup completed with {len(errors)} errors. Deleted {total_deleted} total records."
            else:
                status = "success"
                message = f"Database cleanup completed successfully. Deleted {total_deleted} total records."
            
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
            context.log("ERROR", f"Database cleanup failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Database cleanup failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
