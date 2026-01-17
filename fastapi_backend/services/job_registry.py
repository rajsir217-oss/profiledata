"""
Job Registry Service
Manages dynamic jobs lifecycle (CRUD operations)
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from pymongo import ReturnDocument
import logging
import pytz
from croniter import croniter

logger = logging.getLogger(__name__)


class JobRegistryService:
    """Service for managing dynamic jobs"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.jobs_collection = db.dynamic_jobs
        self.executions_collection = db.job_executions
    
    async def create_job(self, job_definition: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """
        Create a new dynamic job
        
        Args:
            job_definition: Job configuration
            created_by: Username of creator
            
        Returns:
            Created job document
        """
        # Validate template exists
        from job_templates.registry import get_template_registry
        registry = get_template_registry()
        
        template_type = job_definition.get("template_type")
        if not registry.exists(template_type):
            raise ValueError(f"Template type '{template_type}' does not exist")
        
        # Validate parameters
        template = registry.get(template_type)
        valid, error = template.validate_params(job_definition.get("parameters", {}))
        if not valid:
            raise ValueError(f"Parameter validation failed: {error}")
        
        # Calculate next run time
        next_run_at = self._calculate_next_run(job_definition.get("schedule", {}))
        
        # Prepare job document (use camelCase for timestamp fields for MongoDB)
        job_doc = {
            "name": job_definition["name"],
            "description": job_definition.get("description", ""),
            "template_type": template_type,
            "parameters": job_definition.get("parameters", {}),
            "schedule": job_definition.get("schedule", {}),
            "enabled": job_definition.get("enabled", True),
            "timeout_seconds": job_definition.get("timeout_seconds", 3600),
            "retry_policy": job_definition.get("retry_policy", {
                "max_retries": 3,
                "retry_delay_seconds": 300
            }),
            "notifications": job_definition.get("notifications", {}),
            "created_by": created_by,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "lastRunAt": None,
            "nextRunAt": next_run_at,
            "lastStatus": None,
            "version": 1
        }
        
        # Insert into database
        result = await self.jobs_collection.insert_one(job_doc)
        job_doc["_id"] = result.inserted_id
        
        logger.info(f"✅ Created dynamic job: {job_doc['name']} ({template_type})")
        
        return self._serialize_job(job_doc)
    
    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a job by ID
        
        Args:
            job_id: Job ID
            
        Returns:
            Job document or None
        """
        try:
            job_doc = await self.jobs_collection.find_one({"_id": ObjectId(job_id)})
            if job_doc:
                return self._serialize_job(job_doc)
            return None
        except Exception as e:
            logger.error(f"Error getting job {job_id}: {e}")
            return None
    
    async def list_jobs(
        self, 
        filters: Optional[Dict[str, Any]] = None,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "created_at",
        sort_order: int = -1
    ) -> Dict[str, Any]:
        """
        List jobs with filtering and pagination
        
        Args:
            filters: MongoDB query filters
            skip: Number of records to skip
            limit: Maximum number of records to return
            sort_by: Field to sort by
            sort_order: 1 for ascending, -1 for descending
            
        Returns:
            Dictionary with jobs list and pagination info
        """
        # Build MongoDB query from filters
        query = {}
        if filters:
            # Handle multi-select template_types with $in operator
            if "template_types" in filters and filters["template_types"]:
                query["template_type"] = {"$in": filters["template_types"]}
            elif "template_type" in filters:
                query["template_type"] = filters["template_type"]
            
            # Handle enabled filter
            if "enabled" in filters:
                query["enabled"] = filters["enabled"]
        
        # Get total count
        total = await self.jobs_collection.count_documents(query)
        
        # Get jobs
        cursor = self.jobs_collection.find(query).sort(sort_by, sort_order).skip(skip).limit(limit)
        jobs = await cursor.to_list(length=limit)
        
        return {
            "jobs": [self._serialize_job(job) for job in jobs],
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "pages": (total + limit - 1) // limit if limit > 0 else 1,
            "limit": limit
        }
    
    async def update_job(self, job_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update a job
        
        Args:
            job_id: Job ID
            updates: Fields to update
            
        Returns:
            Updated job document or None
        """
        try:
            # Don't allow updating certain fields
            protected_fields = ["_id", "created_by", "created_at", "createdAt", "version"]
            for field in protected_fields:
                updates.pop(field, None)
            
            # Validate parameters if being updated
            if "parameters" in updates or "template_type" in updates:
                job_doc = await self.get_job(job_id)
                if not job_doc:
                    return None
                
                template_type = updates.get("template_type", job_doc["template_type"])
                parameters = updates.get("parameters", job_doc["parameters"])
                
                from job_templates.registry import get_template_registry
                registry = get_template_registry()
                template = registry.get(template_type)
                
                if template:
                    valid, error = template.validate_params(parameters)
                    if not valid:
                        raise ValueError(f"Parameter validation failed: {error}")
            
            # Recalculate next run if schedule changed (use camelCase for MongoDB)
            if "schedule" in updates:
                next_run = self._calculate_next_run(updates["schedule"])
                updates["nextRunAt"] = next_run
                logger.info(f"📅 Schedule updated - next run calculated: {next_run}")
            
            # Update timestamps and version (use camelCase for MongoDB)
            updates["updatedAt"] = datetime.utcnow()
            
            # Update in database with proper MongoDB operators
            update_doc = {
                "$set": updates,
                "$inc": {"version": 1}
            }
            
            logger.debug(f"Updating job {job_id} with: {update_doc}")
            
            result = await self.jobs_collection.find_one_and_update(
                {"_id": ObjectId(job_id)},
                update_doc,
                return_document=ReturnDocument.AFTER
            )
            
            if result:
                logger.info(f"✅ Updated job: {result['name']}")
                return self._serialize_job(result)
            
            return None
            
        except Exception as e:
            logger.error(f"Error updating job {job_id}: {e}")
            raise
    
    async def delete_job(self, job_id: str) -> bool:
        """
        Delete a job
        
        Args:
            job_id: Job ID
            
        Returns:
            True if deleted, False otherwise
        """
        try:
            result = await self.jobs_collection.delete_one({"_id": ObjectId(job_id)})
            if result.deleted_count > 0:
                logger.info(f"✅ Deleted job: {job_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting job {job_id}: {e}")
            return False
    
    async def get_jobs_ready_to_run(self) -> List[Dict[str, Any]]:
        """
        Get all jobs that should run now
        
        Returns:
            List of job documents ready for execution
        """
        query = {
            "enabled": True,
            "nextRunAt": {"$lte": datetime.utcnow()}  # Fixed: use camelCase to match DB
        }
        
        jobs = await self.jobs_collection.find(query).to_list(length=None)
        return [self._serialize_job(job) for job in jobs]
    
    async def update_job_after_execution(
        self,
        job_id: str,
        execution_result: Dict[str, Any]
    ):
        """
        Update job after execution
        
        Args:
            job_id: Job ID
            execution_result: Result of job execution
        """
        try:
            job = await self.get_job(job_id)
            if not job:
                return
            
            # Calculate next run time
            schedule = self._get_effective_schedule(job)
            next_run_at = self._calculate_next_run(schedule)
            
            # Update job (use camelCase for MongoDB fields)
            update_fields = {
                "lastRunAt": datetime.utcnow(),
                "nextRunAt": next_run_at,
                "updatedAt": datetime.utcnow()
            }

            if schedule and not job.get("schedule"):
                update_fields["schedule"] = schedule
            
            # Update last status if provided in execution result
            if "status" in execution_result:
                update_fields["lastStatus"] = execution_result["status"]
            
            await self.jobs_collection.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": update_fields}
            )
            
            logger.debug(f"Updated job {job['name']} - Next run: {next_run_at}")
            
        except Exception as e:
            logger.error(f"Error updating job after execution: {e}")

    def _get_effective_schedule(self, job: Dict[str, Any]) -> Dict[str, Any]:
        schedule = job.get("schedule")
        if isinstance(schedule, dict) and schedule:
            return schedule

        schedule_type = job.get("schedule_type") or "interval"
        if schedule_type == "cron":
            return {
                "type": "cron",
                "expression": job.get("cron_expression") or "0 * * * *",
                "timezone": job.get("timezone") or "UTC"
            }

        return {
            "type": "interval",
            "interval_seconds": job.get("interval_seconds") or 3600
        }
    
    def _calculate_next_run(self, schedule: Dict[str, Any]) -> datetime:
        """
        Calculate next run time based on schedule
        
        Args:
            schedule: Schedule configuration
            
        Returns:
            Next run datetime
        """
        schedule_type = schedule.get("type", "interval")
        
        if schedule_type == "interval":
            interval_seconds = schedule.get("interval_seconds", 3600)
            return datetime.utcnow() + timedelta(seconds=interval_seconds)
        
        elif schedule_type == "cron":
            cron_expression = schedule.get("expression", "0 * * * *")
            timezone_str = schedule.get("timezone", "UTC")
            
            try:
                # Get timezone
                tz = pytz.timezone(timezone_str)
                
                # Get current time in the job's timezone
                now_tz = datetime.now(tz)
                
                # Use croniter to calculate next run time
                cron = croniter(cron_expression, now_tz)
                next_run_tz = cron.get_next(datetime)
                
                # Convert back to UTC for storage
                next_run_utc = next_run_tz.astimezone(pytz.UTC).replace(tzinfo=None)
                
                logger.debug(f"Cron '{cron_expression}' in {timezone_str}: next run at {next_run_utc} UTC")
                return next_run_utc
                
            except Exception as e:
                logger.error(f"Error parsing cron expression '{cron_expression}': {e}")
                # Fallback to 1 hour interval on error
                return datetime.utcnow() + timedelta(hours=1)
        
        else:
            # Default to 1 hour interval
            return datetime.utcnow() + timedelta(hours=1)
    
    def _serialize_job(self, job_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert MongoDB document to serializable dictionary"""
        job_doc["_id"] = str(job_doc["_id"])
        
        # Map camelCase MongoDB fields to snake_case for frontend
        if "templateType" in job_doc:
            job_doc["template_type"] = job_doc["templateType"]
        if "scheduleType" in job_doc:
            job_doc["schedule_type"] = job_doc["scheduleType"]
        if "intervalSeconds" in job_doc:
            job_doc["interval_seconds"] = job_doc["intervalSeconds"]
        if "cronExpression" in job_doc:
            job_doc["cron_expression"] = job_doc["cronExpression"]
        if "createdAt" in job_doc:
            job_doc["created_at"] = job_doc["createdAt"]
        if "updatedAt" in job_doc:
            job_doc["updated_at"] = job_doc["updatedAt"]
        if "nextRunAt" in job_doc:
            job_doc["next_run_at"] = job_doc["nextRunAt"]
        if "lastRunAt" in job_doc:
            job_doc["last_run_at"] = job_doc["lastRunAt"]
        if "lastStatus" in job_doc:
            job_doc["last_status"] = job_doc["lastStatus"]
            job_doc["last_run_status"] = job_doc["lastStatus"]  # Also map to last_run_status for frontend
        if "executionCount" in job_doc:
            job_doc["execution_count"] = job_doc["executionCount"]
        
        return job_doc
    
    async def get_job_executions(
        self,
        job_id: str,
        limit: int = 50,
        status_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get execution history for a job
        
        Args:
            job_id: Job ID
            limit: Maximum number of executions to return
            status_filter: Filter by status (success, failed, etc.)
            
        Returns:
            List of execution records
        """
        query = {"job_id": job_id}
        if status_filter:
            query["status"] = status_filter
        
        executions = await self.executions_collection.find(query).sort("started_at", -1).limit(limit).to_list(length=limit)
        
        # Serialize executions with field mapping
        return [self._serialize_execution(execution) for execution in executions]
    
    def _serialize_execution(self, execution: Dict[str, Any]) -> Dict[str, Any]:
        """Convert execution document to serializable dictionary with snake_case fields"""
        execution["_id"] = str(execution["_id"])
        
        # Map camelCase to snake_case for frontend
        field_mapping = {
            "jobId": "job_id",
            "startedAt": "started_at",
            "completedAt": "completed_at",
            "durationSeconds": "duration_seconds",
            "triggeredBy": "triggered_by",
            "executionHost": "execution_host"
        }
        
        for camel, snake in field_mapping.items():
            if camel in execution:
                execution[snake] = execution[camel]
        
        return execution
