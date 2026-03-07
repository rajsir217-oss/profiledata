"""Message Cleanup Job Template - deletes messages older than N days"""
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from .base import JobTemplate, JobExecutionContext, JobResult


class MessageCleanupTemplate(JobTemplate):
    template_type = "message_cleanup"
    template_name = "Message Cleanup"
    template_description = "Delete messages/chats older than specified days. Also cleans conversation_status and blocked_message_attempts."
    category = "maintenance"
    icon = "🗑️"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "medium"

    def get_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "max_age_days": {
                    "type": "integer", "label": "Max Age (Days)",
                    "description": "Delete messages older than this many days",
                    "default": 120, "min": 30, "max": 730
                },
                "cleanup_conversation_status": {
                    "type": "boolean", "label": "Clean Conversation Status",
                    "description": "Also delete conversation_status records older than max_age_days",
                    "default": True
                },
                "cleanup_blocked_attempts": {
                    "type": "boolean", "label": "Clean Blocked Attempts",
                    "description": "Also delete blocked_message_attempts older than max_age_days",
                    "default": True
                },
                "batch_size": {
                    "type": "integer", "label": "Batch Size",
                    "description": "Messages to delete per batch",
                    "default": 500, "min": 50, "max": 5000
                },
                "dry_run": {
                    "type": "boolean", "label": "Dry Run",
                    "description": "Preview without deleting", "default": False
                }
            },
            "required": ["max_age_days"]
        }

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        d = params.get("max_age_days", 120)
        b = params.get("batch_size", 500)
        if not (30 <= d <= 730): return False, "max_age_days must be 30-730"
        if not (50 <= b <= 5000): return False, "batch_size must be 50-5000"
        return True, None

    async def execute(self, context: JobExecutionContext) -> JobResult:
        start = datetime.utcnow()
        db = context.db
        p = context.parameters
        max_age = p.get("max_age_days", 120)
        do_conv = p.get("cleanup_conversation_status", True)
        do_blocked = p.get("cleanup_blocked_attempts", True)
        dry_run = p.get("dry_run", False)
        cutoff = datetime.utcnow() - timedelta(days=max_age)
        cutoff_str = cutoff.isoformat()

        context.log("info", f"🗑️ Message cleanup: max_age={max_age}d, cutoff={cutoff_str}, dry_run={dry_run}")

        total_deleted = 0
        details = {}

        try:
            # 1. Messages collection (createdAt field)
            msg_query = {"createdAt": {"$lt": cutoff_str}}
            msg_count = await db.messages.count_documents(msg_query)
            context.log("info", f"📨 Messages older than {max_age}d: {msg_count}")
            if not dry_run and msg_count > 0:
                r = await db.messages.delete_many(msg_query)
                details["messages_deleted"] = r.deleted_count
                total_deleted += r.deleted_count
                context.log("info", f"  ✅ Deleted {r.deleted_count} messages")
            else:
                details["messages_deleted"] = 0
                details["messages_would_delete"] = msg_count

            # 2. Conversation status (createdAt field)
            if do_conv:
                conv_query = {"createdAt": {"$lt": cutoff_str}}
                conv_count = await db.conversation_status.count_documents(conv_query)
                context.log("info", f"💬 Conversation status older than {max_age}d: {conv_count}")
                if not dry_run and conv_count > 0:
                    r = await db.conversation_status.delete_many(conv_query)
                    details["conversation_status_deleted"] = r.deleted_count
                    total_deleted += r.deleted_count
                else:
                    details["conversation_status_deleted"] = 0
                    details["conversation_status_would_delete"] = conv_count

            # 3. Blocked message attempts (attemptedAt field)
            if do_blocked:
                blk_query = {"attemptedAt": {"$lt": cutoff_str}}
                blk_count = await db.blocked_message_attempts.count_documents(blk_query)
                context.log("info", f"🚫 Blocked attempts older than {max_age}d: {blk_count}")
                if not dry_run and blk_count > 0:
                    r = await db.blocked_message_attempts.delete_many(blk_query)
                    details["blocked_attempts_deleted"] = r.deleted_count
                    total_deleted += r.deleted_count
                else:
                    details["blocked_attempts_deleted"] = 0
                    details["blocked_attempts_would_delete"] = blk_count

            dur = (datetime.utcnow() - start).total_seconds()
            mode = "simulated" if dry_run else "completed"
            context.log("info", f"✅ Message cleanup {mode}: {total_deleted} total deleted in {dur:.1f}s")

            return JobResult(
                status="success",
                message=f"Message cleanup {mode} - {total_deleted} records deleted",
                details={"max_age_days": max_age, "cutoff": cutoff_str, "dry_run": dry_run, **details},
                records_processed=msg_count + (conv_count if do_conv else 0) + (blk_count if do_blocked else 0),
                records_affected=total_deleted,
                duration_seconds=dur
            )
        except Exception as e:
            context.log("error", f"❌ Message cleanup failed: {e}")
            return JobResult(
                status="failed", message=f"Message cleanup failed: {e}",
                details={"error": str(e)}, errors=[str(e)],
                duration_seconds=(datetime.utcnow() - start).total_seconds()
            )
