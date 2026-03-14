"""
Backup Job Template
Creates compressed mongodump backups → local + optional GCS upload.
Falls back to Python-based JSON dump if mongodump binary is not available.
Supports retention policies and automatic cleanup of old backups.
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from .base import JobTemplate, JobResult, JobExecutionContext
from pathlib import Path
import json
import gzip
import shutil
import subprocess
import logging

logger = logging.getLogger(__name__)

BACKUP_DIR = Path("backups")


class BackupJobTemplate(JobTemplate):
    """Template for MongoDB backup operations with GCS support"""
    
    template_type = "backup_job"
    template_name = "MongoDB Backup"
    template_description = "Full database backup via mongodump → local + GCS. Falls back to JSON dump if mongodump unavailable."
    category = "maintenance"
    icon = "💾"
    estimated_duration = "5-30 minutes"
    resource_usage = "high"
    risk_level = "low"
    
    def get_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "retention_days": {
                    "type": "integer",
                    "title": "Retention Days",
                    "description": "Days to keep old backups before cleanup",
                    "minimum": 1,
                    "maximum": 365,
                    "default": 30
                },
                "upload_to_gcs": {
                    "type": "boolean",
                    "title": "Upload to GCS",
                    "description": "Upload backup archive to Google Cloud Storage",
                    "default": True
                },
                "gcs_prefix": {
                    "type": "string",
                    "title": "GCS Prefix",
                    "description": "Folder prefix in the GCS bucket for backups",
                    "default": "backups"
                },
                "collections": {
                    "type": "string",
                    "title": "Collections (comma-separated)",
                    "description": "Specific collections to backup (empty = all)",
                    "default": ""
                }
            },
            "required": []
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        retention = params.get("retention_days", 30)
        if not isinstance(retention, int) or retention < 1 or retention > 365:
            return False, "retention_days must be between 1 and 365"
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        params = context.parameters
        retention_days = params.get("retention_days", 30)
        upload_to_gcs = params.get("upload_to_gcs", True)
        gcs_prefix = params.get("gcs_prefix", "backups")
        collections_str = params.get("collections", "")
        collections = [c.strip() for c in collections_str.split(",") if c.strip()] if collections_str else []
        
        from config import settings
        
        now = datetime.now(timezone.utc)
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        db_name = settings.database_name
        
        context.log("INFO", f"Starting backup of '{db_name}' at {timestamp}")
        
        # Ensure backup directory exists
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        
        try:
            # Try mongodump first, fall back to Python dump
            mongodump_available = self._check_mongodump()
            
            if mongodump_available:
                context.log("INFO", "Using mongodump binary")
                archive_path, method = await self._backup_mongodump(
                    context, settings.mongodb_url, db_name, timestamp, collections
                )
            else:
                context.log("INFO", "mongodump not found — using Python JSON dump")
                archive_path, method = await self._backup_python(
                    context, db_name, timestamp, collections
                )
            
            if not archive_path or not archive_path.exists():
                return JobResult(
                    status="failed",
                    message="Backup file was not created",
                    errors=["Archive file missing after backup"]
                )
            
            file_size = archive_path.stat().st_size
            size_mb = file_size / (1024 * 1024)
            context.log("INFO", f"Backup archive: {archive_path.name} ({size_mb:.1f} MB)")
            
            # Upload to GCS if configured
            gcs_url = None
            if upload_to_gcs and settings.use_gcs and settings.gcs_bucket_name:
                gcs_url = await self._upload_to_gcs(
                    context, archive_path, settings.gcs_bucket_name, gcs_prefix
                )
            elif upload_to_gcs:
                context.log("WARNING", "GCS not configured — backup saved locally only")
            
            # Log backup metadata to database
            backup_record = {
                "filename": archive_path.name,
                "timestamp": now,
                "size_bytes": file_size,
                "method": method,
                "collections": collections or "all",
                "local_path": str(archive_path),
                "gcs_url": gcs_url,
                "gcs_bucket": settings.gcs_bucket_name if gcs_url else None,
                "gcs_prefix": gcs_prefix if gcs_url else None,
                "database": db_name,
                "status": "completed",
            }
            await context.db.backup_history.insert_one(backup_record)
            
            # Cleanup old backups
            cleaned = await self._cleanup_old(context, retention_days, settings, gcs_prefix)
            
            msg = f"Backup complete: {archive_path.name} ({size_mb:.1f} MB, {method})"
            if gcs_url:
                msg += f" — uploaded to GCS"
            if cleaned > 0:
                msg += f" — cleaned {cleaned} old backup(s)"
            
            return JobResult(
                status="success",
                message=msg,
                details={
                    "filename": archive_path.name,
                    "size_mb": round(size_mb, 2),
                    "method": method,
                    "gcs_url": gcs_url,
                    "cleaned_count": cleaned,
                },
                records_processed=1,
                records_affected=1
            )
            
        except Exception as e:
            context.log("ERROR", f"Backup failed: {e}")
            return JobResult(
                status="failed",
                message=f"Backup failed: {str(e)}",
                errors=[str(e)]
            )
    
    def _check_mongodump(self) -> bool:
        """Check if mongodump binary is available."""
        try:
            result = subprocess.run(
                ["mongodump", "--version"],
                capture_output=True, text=True, timeout=10
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    async def _backup_mongodump(
        self, context, mongodb_url, db_name, timestamp, collections
    ) -> Tuple[Optional[Path], str]:
        """Run mongodump and produce a gzipped archive."""
        archive_name = f"{db_name}_{timestamp}.archive.gz"
        archive_path = BACKUP_DIR / archive_name
        
        cmd = [
            "mongodump",
            f"--uri={mongodb_url}",
            f"--db={db_name}",
            "--archive=" + str(archive_path),
            "--gzip",
        ]
        
        if collections:
            for coll in collections:
                cmd.extend([f"--collection={coll}"])
        
        context.log("INFO", f"Running: mongodump --db={db_name} --archive={archive_name} --gzip")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        
        if result.returncode != 0:
            context.log("ERROR", f"mongodump stderr: {result.stderr[:500]}")
            raise RuntimeError(f"mongodump failed: {result.stderr[:200]}")
        
        context.log("INFO", "mongodump completed successfully")
        return archive_path, "mongodump"
    
    async def _backup_python(
        self, context, db_name, timestamp, collections
    ) -> Tuple[Optional[Path], str]:
        """Python-based JSON dump as fallback."""
        backup_name = f"{db_name}_{timestamp}_json"
        backup_subdir = BACKUP_DIR / backup_name
        backup_subdir.mkdir(parents=True, exist_ok=True)
        
        if not collections:
            collections = await context.db.list_collection_names()
        
        total_records = 0
        for coll_name in collections:
            try:
                coll = context.db[coll_name]
                records = await coll.find({}).to_list(length=None)
                
                for r in records:
                    if "_id" in r:
                        r["_id"] = str(r["_id"])
                
                out_file = backup_subdir / f"{coll_name}.json"
                with open(out_file, "w") as f:
                    json.dump(records, f, default=str)
                
                total_records += len(records)
                context.log("INFO", f"  {coll_name}: {len(records)} records")
            except Exception as e:
                context.log("ERROR", f"  Failed {coll_name}: {e}")
        
        # Compress into a single .tar.gz
        archive_name = f"{db_name}_{timestamp}.tar.gz"
        archive_path = BACKUP_DIR / archive_name
        
        shutil.make_archive(
            str(BACKUP_DIR / f"{db_name}_{timestamp}"),
            "gztar",
            root_dir=str(BACKUP_DIR),
            base_dir=backup_name
        )
        
        # Clean up the uncompressed directory
        shutil.rmtree(backup_subdir, ignore_errors=True)
        
        context.log("INFO", f"Python dump complete: {total_records} records across {len(collections)} collections")
        return archive_path, "python_json"
    
    async def _upload_to_gcs(
        self, context, archive_path: Path, bucket_name: str, prefix: str
    ) -> Optional[str]:
        """Upload backup archive to GCS."""
        try:
            from google.cloud import storage
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            
            blob_path = f"{prefix}/{archive_path.name}"
            blob = bucket.blob(blob_path)
            
            context.log("INFO", f"Uploading to gs://{bucket_name}/{blob_path}")
            blob.upload_from_filename(str(archive_path))
            
            gcs_url = f"gs://{bucket_name}/{blob_path}"
            context.log("INFO", f"Uploaded to {gcs_url}")
            return gcs_url
        except Exception as e:
            context.log("ERROR", f"GCS upload failed: {e}")
            return None
    
    async def _cleanup_old(
        self, context, retention_days: int, settings, gcs_prefix: str
    ) -> int:
        """Remove backups older than retention_days from local and GCS."""
        cutoff = datetime.now(timezone.utc).timestamp() - (retention_days * 86400)
        cleaned = 0
        
        # Local cleanup
        if BACKUP_DIR.exists():
            for f in BACKUP_DIR.iterdir():
                if f.is_file() and f.stat().st_mtime < cutoff:
                    f.unlink()
                    cleaned += 1
                    context.log("INFO", f"Deleted old local backup: {f.name}")
        
        # GCS cleanup
        if settings.use_gcs and settings.gcs_bucket_name:
            try:
                from google.cloud import storage
                from datetime import timedelta
                client = storage.Client()
                bucket = client.bucket(settings.gcs_bucket_name)
                
                cutoff_dt = datetime.now(timezone.utc) - timedelta(days=retention_days)
                blobs = bucket.list_blobs(prefix=f"{gcs_prefix}/")
                
                for blob in blobs:
                    if blob.time_created and blob.time_created < cutoff_dt:
                        blob.delete()
                        cleaned += 1
                        context.log("INFO", f"Deleted old GCS backup: {blob.name}")
            except Exception as e:
                context.log("WARNING", f"GCS cleanup failed: {e}")
        
        # DB cleanup — remove old backup_history records
        try:
            from datetime import timedelta
            cutoff_dt = datetime.now(timezone.utc) - timedelta(days=retention_days)
            await context.db.backup_history.delete_many({
                "timestamp": {"$lt": cutoff_dt}
            })
        except Exception:
            pass
        
        return cleaned
