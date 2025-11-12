"""
Age Updater Job Template
========================

Updates the age field for all users based on birthMonth and birthYear.
Only runs when user count >= 1000 to optimize performance.

For < 1000 users, age is calculated dynamically during search.
For >= 1000 users, age is pre-calculated and stored for faster queries.

Schedule: Daily at 00:05 (just after midnight)
"""

from datetime import datetime
from typing import Dict, Any, Tuple, Optional
import logging
from .base import JobTemplate, JobExecutionContext, JobResult

logger = logging.getLogger(__name__)


def calculate_age(birth_month: int, birth_year: int) -> int:
    """Calculate age from birth month and year"""
    today = datetime.now()
    age = today.year - birth_year
    # If current month hasn't reached birth month yet, subtract 1
    if today.month < birth_month:
        age -= 1
    return age


class AgeUpdaterTemplate(JobTemplate):
    """Job template for updating user ages"""
    
    # Template metadata
    template_type = "age_updater"
    template_name = "Age Updater"
    template_description = "Updates age field for all users (only when user count >= 1000)"
    category = "maintenance"
    icon = "🎂"
    estimated_duration = "5-10 minutes (for 1000+ users)"
    resource_usage = "medium"
    risk_level = "low"
    
    def get_default_schedule(self) -> str:
        """Daily at 00:05"""
        return "0 5 0 * * *"  # cron: second minute hour day month weekday
    
    def get_schema(self) -> Dict[str, Any]:
        """Define job parameters schema"""
        return {
            "type": "object",
            "properties": {
                "minUserThreshold": {
                    "type": "integer",
                    "description": "Minimum number of users required to run the job",
                    "default": 1000,
                    "minimum": 100
                },
                "batchSize": {
                    "type": "integer",
                    "description": "Number of users to update per batch",
                    "default": 100,
                    "minimum": 10,
                    "maximum": 1000
                }
            }
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        min_threshold = params.get("minUserThreshold", 1000)
        batch_size = params.get("batchSize", 100)
        
        if min_threshold < 100:
            return False, "minUserThreshold must be at least 100"
        
        if batch_size < 10 or batch_size > 1000:
            return False, "batchSize must be between 10 and 1000"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute the age updater job
        
        Args:
            context: Job execution context with db and parameters
        
        Returns:
            JobResult with execution details
        """
        start_time = datetime.now()
        db = context.db
        params = context.parameters
        
        if not db:
            return JobResult(
                status="failed",
                message="Database connection not available",
                errors=["No database connection"],
                duration_seconds=0.0
            )
        
        min_threshold = params.get("minUserThreshold", 1000)
        batch_size = params.get("batchSize", 100)
        
        try:
            logger.info(f"🔄 Age Updater Job started (threshold: {min_threshold} users)")
            
            # Count total users
            total_users = await db.users.count_documents({})
            logger.info(f"📊 Total users in database: {total_users}")
            
            # Check threshold
            if total_users < min_threshold:
                context.log("info", f"⏭️  Skipping age update - user count ({total_users}) below threshold ({min_threshold})")
                duration = (datetime.now() - start_time).total_seconds()
                return JobResult(
                    status="success",
                    message=f"Skipped: Only {total_users} users (threshold: {min_threshold})",
                    details={
                        "totalUsers": total_users,
                        "threshold": min_threshold,
                        "skipped": True
                    },
                    records_processed=0,
                    records_affected=0,
                    duration_seconds=duration
                )
            
            logger.info(f"✅ Threshold met ({total_users} >= {min_threshold}). Starting age updates...")
            
            # Find all users with birthMonth and birthYear
            users_cursor = db.users.find(
                {
                    "birthMonth": {"$exists": True, "$ne": None},
                    "birthYear": {"$exists": True, "$ne": None}
                },
                {"_id": 1, "username": 1, "birthMonth": 1, "birthYear": 1, "age": 1}
            )
            
            users_to_update = await users_cursor.to_list(None)
            
            if not users_to_update:
                context.log("warning", "⚠️  No users found with birthMonth and birthYear fields")
                duration = (datetime.now() - start_time).total_seconds()
                return JobResult(
                    status="success",
                    message="No users with birth info found",
                    details={"totalUsers": total_users},
                    records_processed=0,
                    records_affected=0,
                    warnings=["No users with birthMonth and birthYear"],
                    duration_seconds=duration
                )
            
            logger.info(f"📝 Found {len(users_to_update)} users to update")
            
            # Update ages in batches
            updated_count = 0
            unchanged_count = 0
            error_count = 0
            
            for i in range(0, len(users_to_update), batch_size):
                batch = users_to_update[i:i + batch_size]
                
                for user in batch:
                    try:
                        birth_month = user.get("birthMonth")
                        birth_year = user.get("birthYear")
                        current_age = user.get("age")
                        
                        # Calculate new age
                        new_age = calculate_age(birth_month, birth_year)
                        
                        # Only update if age changed (birthday happened)
                        if current_age != new_age:
                            result = await db.users.update_one(
                                {"_id": user["_id"]},
                                {"$set": {"age": new_age}}
                            )
                            
                            if result.modified_count > 0:
                                updated_count += 1
                                logger.debug(f"✅ Updated {user.get('username')}: age {current_age} → {new_age}")
                            else:
                                unchanged_count += 1
                        else:
                            unchanged_count += 1
                    
                    except Exception as e:
                        error_count += 1
                        logger.error(f"❌ Error updating {user.get('username', 'unknown')}: {e}")
                
                # Log batch progress
                logger.info(f"📊 Batch {i // batch_size + 1}: Processed {min(i + batch_size, len(users_to_update))} / {len(users_to_update)}")
            
            # Summary
            duration = (datetime.now() - start_time).total_seconds()
            context.log("info", "=" * 70)
            context.log("info", f"✅ Age Updater Job completed!")
            context.log("info", f"   • Total users: {total_users}")
            context.log("info", f"   • Users with birth info: {len(users_to_update)}")
            context.log("info", f"   • Ages updated: {updated_count}")
            context.log("info", f"   • Unchanged: {unchanged_count}")
            context.log("info", f"   • Errors: {error_count}")
            context.log("info", "=" * 70)
            
            return JobResult(
                status="success" if error_count == 0 else "partial",
                message=f"Updated {updated_count} user ages",
                details={
                    "totalUsers": total_users,
                    "usersWithBirthInfo": len(users_to_update),
                    "usersUnchanged": unchanged_count,
                    "threshold": min_threshold,
                    "batchSize": batch_size
                },
                records_processed=len(users_to_update),
                records_affected=updated_count,
                errors=[f"Failed to update {error_count} users"] if error_count > 0 else [],
                duration_seconds=duration
            )
        
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            context.log("error", f"❌ Age Updater Job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
