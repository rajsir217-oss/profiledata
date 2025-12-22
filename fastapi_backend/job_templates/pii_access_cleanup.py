"""
PII Access Cleanup Job Template
Deletes expired PII access records after 5 days (both requester and requestee sides)
"""

from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
from .base import JobTemplate, JobExecutionContext, JobResult
import logging

logger = logging.getLogger(__name__)


class PIIAccessCleanupTemplate(JobTemplate):
    """Job template for cleaning up expired PII access records (mutual share)"""
    
    # Template metadata
    template_type = "pii_access_cleanup"
    template_name = "PII Access Cleanup"
    template_description = "Delete expired PII access records (removes both requester and requestee sides after expiry)"
    category = "maintenance"
    icon = "🧹"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        expiry_days = params.get("expiryDays", 10)
        if not isinstance(expiry_days, int) or expiry_days < 1 or expiry_days > 365:
            return False, "expiryDays must be an integer between 1 and 365"
        
        return True, None
    
    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "expiryDays": 5,  # Delete access records after 5 days
            "dryRun": False,
            "batchSize": 100
        }
    
    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "expiryDays": {
                "type": "integer",
                "label": "Expiry Days",
                "description": "Delete PII access records older than this many days",
                "default": 10,
                "min": 1,
                "max": 365
            },
            "dryRun": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "Preview what would be deleted without actually deleting",
                "default": False
            },
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of records to process per run",
                "default": 100,
                "min": 1,
                "max": 500
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the PII access cleanup job"""
        start_time = datetime.utcnow()
        deleted_count = 0
        errors = []
        
        try:
            params = context.parameters
            expiry_days = params.get("expiryDays", 10)
            dry_run = params.get("dryRun", False)
            batch_size = params.get("batchSize", 100)
            
            # Calculate cutoff date
            cutoff_date = datetime.utcnow() - timedelta(days=expiry_days)
            
            context.log("info", f"🧹 PII Access Cleanup Job Started")
            context.log("info", f"📅 Cutoff date: {cutoff_date.isoformat()}")
            context.log("info", f"{'🔍 DRY RUN MODE' if dry_run else '🗑️  LIVE DELETION MODE'}")
            
            # ========================================================
            # STEP 1: Delete expired access based on expiresAt field
            # This handles records where expiresAt has passed
            # ========================================================
            context.log("info", "")
            context.log("info", "📋 Step 1: Deleting records with expired expiresAt...")
            
            expired_query = {
                "expiresAt": {"$lt": datetime.utcnow()},
                "isActive": True  # Only active records that have expired
            }
            
            expired_count = await context.db.pii_access.count_documents(expired_query)
            context.log("info", f"   Found {expired_count} records with expired expiresAt")
            
            if not dry_run and expired_count > 0:
                result = await context.db.pii_access.delete_many(expired_query)
                deleted_count += result.deleted_count
                context.log("info", f"   ✅ Deleted {result.deleted_count} expired records")
            
            # ========================================================
            # STEP 2: Delete old access records based on grantedAt
            # This handles records older than expiry_days
            # ========================================================
            context.log("info", "")
            context.log("info", f"📋 Step 2: Deleting records older than {expiry_days} days...")
            
            old_query = {
                "grantedAt": {"$lt": cutoff_date}
            }
            
            old_count = await context.db.pii_access.count_documents(old_query)
            context.log("info", f"   Found {old_count} records older than {expiry_days} days")
            
            if not dry_run and old_count > 0:
                result = await context.db.pii_access.delete_many(old_query)
                deleted_count += result.deleted_count
                context.log("info", f"   ✅ Deleted {result.deleted_count} old records")
            
            # ========================================================
            # STEP 3: Clean up orphaned reciprocal access
            # If one side is deleted, delete the other side too
            # ========================================================
            context.log("info", "")
            context.log("info", "📋 Step 3: Cleaning up orphaned reciprocal access...")
            
            # Find reciprocal records where the original might be missing
            reciprocal_records = await context.db.pii_access.find({
                "isReciprocal": True
            }).limit(batch_size).to_list(batch_size)
            
            orphaned_count = 0
            for reciprocal in reciprocal_records:
                # Check if the original access still exists
                original_exists = await context.db.pii_access.find_one({
                    "granterUsername": reciprocal.get("grantedToUsername"),
                    "grantedToUsername": reciprocal.get("granterUsername"),
                    "accessType": reciprocal.get("accessType"),
                    "isReciprocal": {"$ne": True}
                })
                
                if not original_exists:
                    orphaned_count += 1
                    if not dry_run:
                        await context.db.pii_access.delete_one({"_id": reciprocal["_id"]})
                        deleted_count += 1
            
            context.log("info", f"   Found {orphaned_count} orphaned reciprocal records")
            if orphaned_count > 0 and not dry_run:
                context.log("info", f"   ✅ Deleted {orphaned_count} orphaned reciprocal records")
            
            # ========================================================
            # STEP 4: Also clean up related PII requests
            # Delete old approved/rejected requests
            # ========================================================
            context.log("info", "")
            context.log("info", f"📋 Step 4: Cleaning up old PII requests...")
            
            old_requests_query = {
                "status": {"$in": ["approved", "rejected", "revoked", "cancelled"]},
                "updatedAt": {"$lt": cutoff_date}
            }
            
            old_requests_count = await context.db.pii_requests.count_documents(old_requests_query)
            context.log("info", f"   Found {old_requests_count} old processed requests")
            
            if not dry_run and old_requests_count > 0:
                result = await context.db.pii_requests.delete_many(old_requests_query)
                deleted_count += result.deleted_count
                context.log("info", f"   ✅ Deleted {result.deleted_count} old requests")
            
            # Summary
            context.log("info", "")
            context.log("info", "="*60)
            context.log("info", f"📊 SUMMARY:")
            context.log("info", f"   Mode: {'DRY RUN' if dry_run else 'LIVE'}")
            context.log("info", f"   Expired records found: {expired_count}")
            context.log("info", f"   Old records found: {old_count}")
            context.log("info", f"   Orphaned reciprocal found: {orphaned_count}")
            context.log("info", f"   Old requests found: {old_requests_count}")
            context.log("info", f"   Total {'would be' if dry_run else ''} deleted: {expired_count + old_count + orphaned_count + old_requests_count if dry_run else deleted_count}")
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            return JobResult(
                status="success",
                message=f"{'Would delete' if dry_run else 'Deleted'} {deleted_count} expired PII access records",
                details={
                    "dry_run": dry_run,
                    "expiry_days": expiry_days,
                    "expired_by_date": expired_count,
                    "old_by_granted_at": old_count,
                    "orphaned_reciprocal": orphaned_count,
                    "old_requests": old_requests_count,
                    "total_deleted": deleted_count
                },
                records_processed=expired_count + old_count + orphaned_count + old_requests_count,
                records_affected=deleted_count,
                duration_seconds=duration
            )
            
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            context.log("error", f"Job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Failed to clean up PII access: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )


# Export the template
__all__ = ['PIIAccessCleanupTemplate']
