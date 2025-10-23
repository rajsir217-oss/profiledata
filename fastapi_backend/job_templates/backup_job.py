"""
Backup Job Template
Creates backups of database collections
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime
from .base import JobTemplate, JobResult, JobExecutionContext
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)


class BackupJobTemplate(JobTemplate):
    """Template for backup operations"""
    
    template_type = "backup_job"
    template_name = "Backup Job"
    template_description = "Create backups of database collections"
    category = "maintenance"
    icon = "💾"
    estimated_duration = "10-60 minutes"
    resource_usage = "high"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "collections": {
                    "type": "array",
                    "description": "Collections to backup (empty for all)",
                    "items": {"type": "string"}
                },
                "backup_type": {
                    "type": "string",
                    "description": "Type of backup",
                    "enum": ["full", "incremental"],
                    "default": "full"
                },
                "compression": {
                    "type": "boolean",
                    "description": "Compress backup files",
                    "default": True
                },
                "retention_days": {
                    "type": "integer",
                    "description": "Days to keep backups",
                    "minimum": 1,
                    "maximum": 365,
                    "default": 30
                },
                "destination": {
                    "type": "string",
                    "description": "Backup destination",
                    "enum": ["local", "s3", "ftp"],
                    "default": "local"
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        retention_days = params.get("retention_days", 30)
        if not isinstance(retention_days, int) or retention_days < 1 or retention_days > 365:
            return False, "Retention days must be between 1 and 365"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute backup job"""
        params = context.parameters
        collections = params.get("collections", [])
        backup_type = params.get("backup_type", "full")
        compression = params.get("compression", True)
        retention_days = params.get("retention_days", 30)
        destination = params.get("destination", "local")
        
        context.log("INFO", f"Starting {backup_type} backup")
        context.log("INFO", f"Destination: {destination}")
        
        try:
            # Create backup directory
            backup_dir = Path("backups") / datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_dir.mkdir(parents=True, exist_ok=True)
            
            # Get collections to backup
            if not collections:
                collections = await context.db.list_collection_names()
                context.log("INFO", f"Backing up all collections: {len(collections)}")
            else:
                context.log("INFO", f"Backing up {len(collections)} specified collections")
            
            backed_up = 0
            total_records = 0
            
            for collection_name in collections:
                try:
                    collection = context.db[collection_name]
                    records = await collection.find({}).to_list(length=None)
                    
                    # Convert ObjectId to string
                    for record in records:
                        if "_id" in record:
                            record["_id"] = str(record["_id"])
                    
                    # Save to file
                    backup_file = backup_dir / f"{collection_name}.json"
                    with open(backup_file, 'w') as f:
                        json.dump(records, f, indent=2, default=str)
                    
                    backed_up += 1
                    total_records += len(records)
                    context.log("INFO", f"Backed up {collection_name}: {len(records)} records")
                    
                except Exception as e:
                    context.log("ERROR", f"Failed to backup {collection_name}: {str(e)}")
            
            # Clean old backups
            await self._cleanup_old_backups(retention_days, context)
            
            context.log("INFO", f"Backup completed: {backed_up} collections, {total_records} records")
            
            return JobResult(
                status="success",
                message=f"Successfully backed up {backed_up} collections ({total_records} records)",
                details={
                    "backup_path": str(backup_dir),
                    "collections": backed_up,
                    "total_records": total_records,
                    "backup_type": backup_type
                },
                records_processed=backed_up,
                records_affected=total_records
            )
            
        except Exception as e:
            context.log("ERROR", f"Backup failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Backup job failed: {str(e)}",
                errors=[str(e)]
            )
    
    async def _cleanup_old_backups(self, retention_days: int, context: JobExecutionContext):
        """Remove backups older than retention period"""
        try:
            backups_dir = Path("backups")
            if not backups_dir.exists():
                return
            
            cutoff_date = datetime.utcnow().timestamp() - (retention_days * 86400)
            removed_count = 0
            
            for backup_path in backups_dir.iterdir():
                if backup_path.is_dir():
                    if backup_path.stat().st_mtime < cutoff_date:
                        # Remove old backup directory
                        import shutil
                        shutil.rmtree(backup_path)
                        removed_count += 1
            
            if removed_count > 0:
                context.log("INFO", f"Cleaned up {removed_count} old backup(s)")
        
        except Exception as e:
            context.log("WARNING", f"Failed to cleanup old backups: {str(e)}")
