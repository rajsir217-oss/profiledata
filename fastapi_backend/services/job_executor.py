"""
Job Executor Engine
Executes dynamic jobs using job templates
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import asyncio
import logging
import traceback

from job_templates.base import JobExecutionContext, JobResult
from job_templates.registry import get_template_registry

logger = logging.getLogger(__name__)


class JobExecutor:
    """Executes dynamic jobs with templates"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.executions_collection = db.job_executions
        self.template_registry = get_template_registry()
    
    async def execute_job(
        self,
        job: Dict[str, Any],
        triggered_by: str = "scheduler"
    ) -> Dict[str, Any]:
        """
        Execute a job
        
        Args:
            job: Job document
            triggered_by: Who/what triggered the execution
            
        Returns:
            Execution result document
        """
        job_id = job["_id"]
        job_name = job["name"]
        template_type = job["template_type"]
        parameters = job["parameters"]
        timeout_seconds = job.get("timeout_seconds", 3600)
        
        logger.info(f"▶️ Executing job: {job_name} (template: {template_type})")
        
        # Create execution record
        execution_id = await self._create_execution_record(job, triggered_by)
        
        try:
            # Get template
            template = self.template_registry.get(template_type)
            if not template:
                raise ValueError(f"Template type '{template_type}' not found")
            
            # Create execution context
            context = JobExecutionContext(
                job_id=job_id,
                job_name=job_name,
                parameters=parameters,
                db=self.db,
                triggered_by=triggered_by,
                execution_id=execution_id
            )
            
            # Pre-execution hook
            should_continue = await template.pre_execute(context)
            if not should_continue:
                result = JobResult(
                    status="cancelled",
                    message="Job execution cancelled by pre_execute hook"
                )
                await self._update_execution_record(execution_id, result, context, job)
                return await self._get_execution_record(execution_id)
            
            # Execute with timeout
            start_time = datetime.utcnow()
            
            try:
                result = await asyncio.wait_for(
                    template.execute(context),
                    timeout=timeout_seconds
                )
            except asyncio.TimeoutError:
                result = JobResult(
                    status="timeout",
                    message=f"Job execution timed out after {timeout_seconds} seconds",
                    errors=[f"Timeout after {timeout_seconds}s"]
                )
            except Exception as e:
                result = await template.on_error(context, e)
            
            # Calculate duration
            end_time = datetime.utcnow()
            result.duration_seconds = (end_time - start_time).total_seconds()
            
            # Post-execution hook
            await template.post_execute(context, result)
            
            # Update execution record
            await self._update_execution_record(execution_id, result, context, job)
            
            # Send notifications if configured
            await self._send_notifications(job, result, context)
            
            logger.info(f"✅ Job completed: {job_name} - {result.status}")
            
            return await self._get_execution_record(execution_id)
            
        except Exception as e:
            logger.error(f"❌ Job execution error: {job_name} - {str(e)}", exc_info=True)
            
            # Create error result
            result = JobResult(
                status="failed",
                message=f"Job execution failed: {str(e)}",
                errors=[str(e), traceback.format_exc()]
            )
            
            # Update execution record
            await self._update_execution_record(execution_id, result, None, job)
            
            return await self._get_execution_record(execution_id)
    
    async def _create_execution_record(
        self,
        job: Dict[str, Any],
        triggered_by: str
    ) -> str:
        """Create initial execution record"""
        execution_doc = {
            "job_id": job["_id"],
            "job_name": job["name"],
            "template_type": job["template_type"],
            "status": "running",
            "started_at": datetime.utcnow(),
            "completed_at": None,
            "duration_seconds": None,
            "result": {},
            "error": None,
            "logs": [],
            "triggered_by": triggered_by,
            "execution_host": "server-01"  # Could get actual hostname
        }
        
        result = await self.executions_collection.insert_one(execution_doc)
        execution_id = str(result.inserted_id)
        
        logger.debug(f"Created execution record: {execution_id}")
        
        return execution_id
    
    async def _update_execution_record(
        self,
        execution_id: str,
        result: JobResult,
        context: Optional[JobExecutionContext],
        job: Dict[str, Any]
    ):
        """Update execution record with results"""
        update_doc = {
            "status": result.status,
            "completed_at": datetime.utcnow(),
            "duration_seconds": result.duration_seconds,
            "result": result.to_dict(),
            "error": result.errors[0] if result.errors else None
        }
        
        if context:
            update_doc["logs"] = [
                {
                    "timestamp": log["timestamp"].isoformat() if isinstance(log["timestamp"], datetime) else log["timestamp"],
                    "level": log["level"],
                    "message": log["message"]
                }
                for log in context.logs
            ]
        
        await self.executions_collection.update_one(
            {"_id": ObjectId(execution_id)},
            {"$set": update_doc}
        )
        
        logger.debug(f"Updated execution record: {execution_id}")
    
    async def _get_execution_record(self, execution_id: str) -> Dict[str, Any]:
        """Get execution record by ID"""
        execution = await self.executions_collection.find_one({"_id": ObjectId(execution_id)})
        if execution:
            execution["_id"] = str(execution["_id"])
        return execution
    
    async def _send_notifications(
        self,
        job: Dict[str, Any],
        result: JobResult,
        context: JobExecutionContext
    ):
        """Send notifications based on job configuration"""
        notifications = job.get("notifications", {})
        
        # Check if we should notify based on status
        should_notify = False
        
        if result.status == "success" and notifications.get("on_success"):
            should_notify = True
            recipients = notifications["on_success"]
        elif result.status in ["failed", "timeout"] and notifications.get("on_failure"):
            should_notify = True
            recipients = notifications["on_failure"]
        
        if should_notify and recipients:
            # In production, send actual notifications
            # For now, just log
            logger.info(f"📧 Would send notification to: {recipients}")
            logger.info(f"   Status: {result.status}, Message: {result.message}")
            
            # TODO: Implement actual email sending
            # await send_email(
            #     to=recipients,
            #     subject=f"Job {job['name']}: {result.status}",
            #     body=f"Job '{job['name']}' {result.status}.\n\nMessage: {result.message}"
            # )
    
    async def execute_job_by_id(
        self,
        job_id: str,
        triggered_by: str = "manual"
    ) -> Optional[Dict[str, Any]]:
        """
        Execute a job by its ID
        
        Args:
            job_id: Job ID
            triggered_by: Who triggered the execution
            
        Returns:
            Execution result or None if job not found
        """
        from .job_registry import JobRegistryService
        
        registry = JobRegistryService(self.db)
        job = await registry.get_job(job_id)
        
        if not job:
            logger.error(f"Job not found: {job_id}")
            return None
        
        if not job.get("enabled", True):
            logger.warning(f"Job is disabled: {job['name']}")
            return None
        
        return await self.execute_job(job, triggered_by)
    
    async def get_execution(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get an execution by ID"""
        return await self._get_execution_record(execution_id)
    
    async def list_executions(
        self,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """List job executions with filters"""
        query = filters or {}
        
        executions = await self.executions_collection.find(query).sort("started_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        for execution in executions:
            execution["_id"] = str(execution["_id"])
        
        return executions
    
    async def delete_execution(self, execution_id: str) -> bool:
        """Delete an execution record"""
        try:
            result = await self.executions_collection.delete_one({"_id": ObjectId(execution_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting execution {execution_id}: {e}")
            return False
