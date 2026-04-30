"""
Admin Backups Router
List, download, and delete database backups from local storage and GCS.
"""

import logging
from typing import Optional
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/backups", tags=["admin-backups"])

BACKUP_DIR = Path("backups")


def _require_admin(current_user: dict):
    """Raise 403 if user is not admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


@router.get("")
async def list_backups(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    List all backups from backup_history collection + local files.
    Returns combined list sorted by timestamp (newest first).
    """
    _require_admin(current_user)

    backups = []

    # 1. Get backup records from database — filtered by current environment
    from config import settings
    current_env = getattr(settings, "env", "development") or "development"

    try:
        env_filter = {"$or": [
            {"environment": current_env},
            {"environment": {"$exists": False}},  # legacy records without env tag
        ]}
        cursor = db.backup_history.find(env_filter).sort("timestamp", -1).limit(100)
        db_records = await cursor.to_list(length=100)

        for rec in db_records:
            rec["_id"] = str(rec["_id"])
            # Check if local file still exists
            local_path = rec.get("local_path", "")
            rec["local_exists"] = Path(local_path).exists() if local_path else False
            backups.append(rec)
    except Exception as e:
        logger.warning(f"Failed to query backup_history: {e}")

    # 2. Discover local files not tracked in DB
    tracked_filenames = {b.get("filename") for b in backups}

    if BACKUP_DIR.exists():
        for f in sorted(BACKUP_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.is_file() and f.name not in tracked_filenames:
                stat = f.stat()
                backups.append({
                    "_id": None,
                    "filename": f.name,
                    "timestamp": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    "size_bytes": stat.st_size,
                    "method": "unknown",
                    "collections": "unknown",
                    "local_path": str(f),
                    "local_exists": True,
                    "gcs_url": None,
                    "database": "unknown",
                    "status": "completed",
                })

    # 3. Check GCS for backups not tracked locally
    if settings.use_gcs and settings.gcs_bucket_name:
        try:
            from google.cloud import storage as gcs_storage
            client = gcs_storage.Client()
            bucket = client.bucket(settings.gcs_bucket_name)

            gcs_filenames = {b.get("filename") for b in backups}
            blobs = bucket.list_blobs(prefix="backups/")

            for blob in blobs:
                name = blob.name.split("/")[-1]
                if name and name not in gcs_filenames:
                    backups.append({
                        "_id": None,
                        "filename": name,
                        "timestamp": blob.time_created.isoformat() if blob.time_created else None,
                        "size_bytes": blob.size or 0,
                        "method": "unknown",
                        "collections": "unknown",
                        "local_path": None,
                        "local_exists": False,
                        "gcs_url": f"gs://{settings.gcs_bucket_name}/{blob.name}",
                        "gcs_bucket": settings.gcs_bucket_name,
                        "database": "unknown",
                        "status": "completed",
                    })
        except Exception as e:
            logger.warning(f"GCS listing failed: {e}")

    return {
        "backups": backups,
        "total": len(backups),
        "gcs_configured": bool(settings.use_gcs and settings.gcs_bucket_name),
        "local_dir": str(BACKUP_DIR),
    }


@router.get("/download/{filename}")
async def download_backup(
    filename: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Download a backup file. Streams from local disk if available;
    otherwise downloads from GCS to a temp file and streams it.
    """
    _require_admin(current_user)

    local_path = BACKUP_DIR / filename
    if local_path.exists():
        from fastapi.responses import FileResponse
        return FileResponse(
            str(local_path),
            media_type="application/octet-stream",
            filename=filename,
        )

    # File not local — try GCS
    from config import settings
    if settings.use_gcs and settings.gcs_bucket_name:
        try:
            from google.cloud import storage as gcs_storage
            client = gcs_storage.Client()
            bucket = client.bucket(settings.gcs_bucket_name)
            blob = bucket.blob(f"backups/{filename}")

            if not blob.exists():
                raise HTTPException(status_code=404, detail="Backup not found in GCS")

            # Download to temp file and stream
            import tempfile
            temp_dir = tempfile.mkdtemp(prefix="backup_download_")
            temp_path = Path(temp_dir) / filename
            blob.download_to_filename(str(temp_path))

            from fastapi.responses import FileResponse
            return FileResponse(
                str(temp_path),
                media_type="application/octet-stream",
                filename=filename,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"GCS download failed for {filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to download from GCS: {str(e)}")

    raise HTTPException(status_code=404, detail="Backup file not found")


@router.delete("/{filename}")
async def delete_backup(
    filename: str,
    delete_gcs: bool = True,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Delete a backup from local storage, GCS, and database records.
    """
    _require_admin(current_user)

    deleted_local = False
    deleted_gcs = False

    # Delete local file
    local_path = BACKUP_DIR / filename
    if local_path.exists():
        local_path.unlink()
        deleted_local = True
        logger.info(f"🗑️ Deleted local backup: {filename}")

    # Delete from GCS
    from config import settings
    if delete_gcs and settings.use_gcs and settings.gcs_bucket_name:
        try:
            from google.cloud import storage as gcs_storage
            client = gcs_storage.Client()
            bucket = client.bucket(settings.gcs_bucket_name)
            blob = bucket.blob(f"backups/{filename}")
            if blob.exists():
                blob.delete()
                deleted_gcs = True
                logger.info(f"🗑️ Deleted GCS backup: backups/{filename}")
        except Exception as e:
            logger.warning(f"GCS delete failed: {e}")

    # Delete DB record
    await db.backup_history.delete_many({"filename": filename})

    if not deleted_local and not deleted_gcs:
        raise HTTPException(status_code=404, detail="Backup not found in local or GCS")

    return {
        "success": True,
        "deleted_local": deleted_local,
        "deleted_gcs": deleted_gcs,
        "message": f"Backup '{filename}' deleted",
    }


@router.post("/trigger")
async def trigger_backup(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Manually trigger a backup immediately (runs the backup job inline).
    """
    _require_admin(current_user)

    from job_templates.backup_job import BackupJobTemplate
    from job_templates.base import JobExecutionContext

    template = BackupJobTemplate()

    # Build a minimal execution context
    context = JobExecutionContext(
        job_id="manual_backup",
        job_name="Manual Backup",
        parameters={
            "retention_days": 30,
            "upload_to_gcs": True,
            "gcs_prefix": "backups",
            "collections": "",
        },
        db=db,
    )

    logger.info(f"💾 Manual backup triggered by {current_user.get('username')}")
    result = await template.execute(context)

    return {
        "success": result.status == "success",
        "message": result.message,
        "details": result.details,
    }


@router.get("/restore-command/{filename}")
async def get_restore_command(
    filename: str,
    target_uri: str = "",
    current_user: dict = Depends(get_current_user),
):
    """
    Returns the mongorestore command for a given backup file.
    Does NOT execute it — restore is always manual.

    Query params:
      target_uri: Optional MongoDB URI for the destination (default: dev localhost)
    """
    _require_admin(current_user)

    from config import settings

    # Default to localhost dev URI if not provided
    dest_uri = target_uri or "mongodb://localhost:27017"
    dest_db = settings.database_name + "_dev"

    if filename.endswith(".archive.gz"):
        # mongodump archive format
        prod_cmd = (
            f'mongorestore --uri="{settings.mongodb_url}" '
            f'--db={settings.database_name}_restore '
            f'--archive=backups/{filename} --gzip '
            f'--nsFrom="{settings.database_name}.*" '
            f'--nsTo="{settings.database_name}_restore.*"'
        )
        dev_cmd = (
            f'mongorestore --uri="{dest_uri}" '
            f'--nsFrom="{settings.database_name}.*" '
            f'--nsTo="{dest_db}.*" '
            f'--archive=backups/{filename} --gzip'
        )
        restore_type = "mongorestore"
    elif filename.endswith(".tar.gz"):
        # Python JSON dump format
        prod_cmd = (
            f"# 1. Extract the archive\n"
            f"tar -xzf backups/{filename} -C backups/\n"
            f"# 2. For each collection JSON file:\n"
            f'# mongoimport --uri="{settings.mongodb_url}" '
            f'--db={settings.database_name}_restore '
            f'--collection=<collection_name> --file=backups/<dir>/<collection>.json --jsonArray'
        )
        dev_cmd = (
            f"# 1. Extract the archive\n"
            f"tar -xzf backups/{filename} -C ./restore_temp/\n"
            f"# 2. For each collection JSON file:\n"
            f'for f in restore_temp/*/*.json; do\n'
            f'  coll=$(basename "$f" .json)\n'
            f'  mongoimport --uri="{dest_uri}" --db={dest_db} '
            f'--collection="$coll" --file="$f" --jsonArray --drop\n'
            f'done\n'
            f"# 3. Cleanup: rm -rf restore_temp/"
        )
        restore_type = "mongoimport"
    else:
        prod_cmd = "Unknown backup format"
        dev_cmd = "Unknown backup format"
        restore_type = "unknown"

    return {
        "filename": filename,
        "restore_type": restore_type,
        "command": prod_cmd,
        "dev_command": dev_cmd,
        "dest_uri": dest_uri,
        "dest_db": dest_db,
        "warning": "Always restore to a TEMP database first (_restore suffix), inspect, then merge into production.",
        "dev_note": "Use the dev_command for restoring to your local dev environment. It targets localhost:27017 by default.",
    }
