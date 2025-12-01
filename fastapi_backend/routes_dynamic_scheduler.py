"""
Dynamic Scheduler API Routes
RESTful endpoints for managing dynamic jobs
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.job_registry import JobRegistryService
from services.job_executor import JobExecutor
from job_templates.registry import get_template_registry

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/scheduler", tags=["Dynamic Scheduler"])


# ===== Pydantic Models =====

class ScheduleConfig(BaseModel):
    """Schedule configuration"""
    type: str = Field(..., description="Schedule type: interval or cron")
    interval_seconds: Optional[int] = Field(None, description="Interval in seconds (for interval type)")
    expression: Optional[str] = Field(None, description="Cron expression (for cron type)")
    timezone: str = Field(default="UTC", description="Timezone for cron schedule")


class RetryPolicy(BaseModel):
    """Retry policy configuration"""
    max_retries: int = Field(default=3, ge=0, le=10)
    retry_delay_seconds: int = Field(default=300, ge=1)


class NotificationConfig(BaseModel):
    """Notification configuration"""
    on_success: List[str] = Field(default_factory=list)
    on_failure: List[str] = Field(default_factory=list)


class JobDefinition(BaseModel):
    """Job definition for creation"""
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    template_type: str = Field(..., description="Template type to use")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    schedule: ScheduleConfig
    enabled: bool = Field(default=True)
    timeout_seconds: int = Field(default=3600, ge=1, le=86400)
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)
    notifications: NotificationConfig = Field(default_factory=NotificationConfig)


class JobUpdate(BaseModel):
    """Job update model"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    parameters: Optional[Dict[str, Any]] = None
    schedule: Optional[ScheduleConfig] = None
    enabled: Optional[bool] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=86400)
    retry_policy: Optional[RetryPolicy] = None
    notifications: Optional[NotificationConfig] = None


# ===== Template Management Endpoints =====

@router.get("/templates")
async def list_templates(
    current_user: Dict = Depends(get_current_user),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """
    List all available job templates
    
    Returns template metadata including:
    - Template type and name
    - Description and category
    - Parameter schema
    - Resource requirements
    """
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    registry = get_template_registry()
    
    if category:
        templates = registry.get_by_category(category)
        return {
            "templates": [t.get_metadata() for t in templates],
            "count": len(templates),
            "category": category
        }
    
    metadata = registry.get_metadata()
    return metadata


@router.get("/templates/{template_type}")
async def get_template(
    template_type: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get detailed information about a specific template"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    registry = get_template_registry()
    template = registry.get(template_type)
    
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_type}' not found")
    
    return template.get_metadata()


# ===== Job Management Endpoints =====

@router.post("/jobs")
async def create_job(
    job_definition: JobDefinition,
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a new dynamic job"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    username = current_user.get("username")
    try:
        service = JobRegistryService(db)
        job = await service.create_job(job_definition.dict(), created_by=username)
        
        return {
            "success": True,
            "message": f"Job '{job['name']}' created successfully",
            "job": job
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)}")


@router.get("/jobs")
async def list_jobs(
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    template_type: Optional[str] = Query(None, description="Filter by template type"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page")
):
    """List all dynamic jobs with filtering and pagination"""
    user_role = current_user.get("role_name")
    username = current_user.get("username")
    logger.info(f"📋 List jobs request from user: {username} with role: {user_role}")
    
    if user_role != "admin":
        logger.warning(f"⚠️ Non-admin user '{username}' attempted to access scheduler jobs")
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = JobRegistryService(db)
        
        # Build filters
        filters = {}
        if template_type:
            filters["template_type"] = template_type
        if enabled is not None:
            filters["enabled"] = enabled
        
        # Calculate skip
        skip = (page - 1) * limit
        
        result = await service.list_jobs(filters=filters, skip=skip, limit=limit)
        
        return result
    
    except Exception as e:
        logger.error(f"Error listing jobs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {str(e)}")


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get a specific job by ID"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = JobRegistryService(db)
        job = await service.get_job(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {"job": job}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get job: {str(e)}")


@router.put("/jobs/{job_id}")
async def update_job(
    job_id: str,
    updates: JobUpdate,
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update a job"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = JobRegistryService(db)
        
        # Filter out None values
        update_dict = {k: v for k, v in updates.dict().items() if v is not None}
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        job = await service.update_job(job_id, update_dict)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "success": True,
            "message": f"Job '{job['name']}' updated successfully",
            "job": job
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update job: {str(e)}")


@router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a job"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = JobRegistryService(db)
        success = await service.delete_job(job_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "success": True,
            "message": "Job deleted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete job: {str(e)}")


# ===== Job Execution Endpoints =====

@router.post("/jobs/{job_id}/run")
async def run_job_manually(
    job_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Manually trigger a job execution"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    username = current_user.get("username")
    try:
        executor = JobExecutor(db)
        execution = await executor.execute_job_by_id(job_id, triggered_by=f"manual:{username}")
        
        if not execution:
            raise HTTPException(status_code=404, detail="Job not found or disabled")
        
        return {
            "success": True,
            "message": "Job execution started",
            "execution": execution
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to run job: {str(e)}")


@router.get("/jobs/{job_id}/executions")
async def get_job_executions(
    job_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results")
):
    """Get execution history for a job"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = JobRegistryService(db)
        executions = await service.get_job_executions(job_id, limit=limit, status_filter=status)
        
        return {
            "job_id": job_id,
            "executions": executions,
            "count": len(executions)
        }
    
    except Exception as e:
        logger.error(f"Error getting executions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get executions: {str(e)}")


@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get details of a specific execution"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        executor = JobExecutor(db)
        execution = await executor.get_execution(execution_id)
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        return {"execution": execution}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting execution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get execution: {str(e)}")


@router.get("/executions")
async def list_executions(
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    status: Optional[str] = Query(None, description="Filter by status"),
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """List all job executions"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        executor = JobExecutor(db)
        
        filters = {}
        if status:
            filters["status"] = status
        if job_id:
            filters["job_id"] = job_id
        
        executions = await executor.list_executions(filters=filters, limit=limit, skip=skip)
        
        return {
            "executions": executions,
            "count": len(executions)
        }
    
    except Exception as e:
        logger.error(f"Error listing executions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list executions: {str(e)}")


@router.delete("/executions/{execution_id}")
async def delete_execution(
    execution_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete an execution record"""
    logger.info(f"🗑️ Delete execution request for ID: {execution_id} by user: {current_user.get('username')}")
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        executor = JobExecutor(db)
        success = await executor.delete_execution(execution_id)
        
        if not success:
            logger.warning(f"❌ Execution {execution_id} not found")
            raise HTTPException(status_code=404, detail="Execution not found")
        
        logger.info(f"✅ Successfully deleted execution: {execution_id}")
        return {
            "success": True,
            "message": "Execution record deleted"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting execution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete execution: {str(e)}")


# ===== Status & Health Endpoints =====

@router.get("/status")
async def get_scheduler_status(
    current_user: Dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get overall scheduler status and statistics"""
    user_role = current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = JobRegistryService(db)
        
        # Count jobs by status
        total_jobs = await db.dynamic_jobs.count_documents({})
        enabled_jobs = await db.dynamic_jobs.count_documents({"enabled": True})
        disabled_jobs = await db.dynamic_jobs.count_documents({"enabled": False})
        
        # Count executions by status
        total_executions = await db.job_executions.count_documents({})
        successful = await db.job_executions.count_documents({"status": "success"})
        failed = await db.job_executions.count_documents({"status": "failed"})
        running = await db.job_executions.count_documents({"status": "running"})
        
        # Get templates count
        registry = get_template_registry()
        template_count = len(registry.list_templates())
        
        return {
            "scheduler": {
                "status": "active",
                "template_count": template_count
            },
            "jobs": {
                "total": total_jobs,
                "enabled": enabled_jobs,
                "disabled": disabled_jobs
            },
            "executions": {
                "total": total_executions,
                "successful": successful,
                "failed": failed,
                "running": running,
                "success_rate": f"{(successful/total_executions*100):.1f}%" if total_executions > 0 else "N/A"
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")
