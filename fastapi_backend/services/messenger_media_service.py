"""
Messenger Media Service
Handles file uploads for messenger messages.
Supports local storage (dev) and GCS (production) — mirrors existing upload_dir / use_gcs pattern.
"""

import logging
import os
import uuid
import mimetypes
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path

from config import settings

logger = logging.getLogger(__name__)

# Allowed MIME types and max sizes (bytes)
ALLOWED_TYPES = {
    "image": {
        "mimes": {"image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"},
        "max_size": 10 * 1024 * 1024,  # 10 MB
    },
    "document": {
        "mimes": {
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "text/plain",
            "text/csv",
        },
        "max_size": 25 * 1024 * 1024,  # 25 MB
    },
    "audio": {
        "mimes": {"audio/ogg", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"},
        "max_size": 10 * 1024 * 1024,  # 10 MB
    },
}

# Flatten all allowed MIME types for quick lookup
ALL_ALLOWED_MIMES = set()
for cat in ALLOWED_TYPES.values():
    ALL_ALLOWED_MIMES.update(cat["mimes"])

MESSENGER_UPLOAD_SUBDIR = "messenger_media"


def _category_for_mime(mime: str) -> Optional[str]:
    for cat, cfg in ALLOWED_TYPES.items():
        if mime in cfg["mimes"]:
            return cat
    return None


def validate_file(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> Tuple[bool, str, str]:
    """
    Validate an uploaded file.
    Returns (is_valid, error_message, detected_category).
    """
    mime = content_type or mimetypes.guess_type(filename)[0] or ""
    category = _category_for_mime(mime)

    if not category:
        return False, f"File type '{mime}' is not allowed", ""

    max_size = ALLOWED_TYPES[category]["max_size"]
    if len(file_bytes) > max_size:
        mb = max_size / (1024 * 1024)
        return False, f"File too large. Max {mb:.0f} MB for {category}", category

    if len(file_bytes) == 0:
        return False, "File is empty", category

    return True, "", category


async def upload_file(
    file_bytes: bytes,
    filename: str,
    username: str,
    content_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Store an uploaded file and return metadata.
    Uses GCS in production, local filesystem in development.
    Returns dict with url, thumbnailUrl, mimeType, fileSize, fileName.
    """
    mime = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    ext = Path(filename).suffix or ""
    unique_name = f"{uuid.uuid4().hex}{ext}"
    category = _category_for_mime(mime) or "document"

    # Build storage path: messenger_media/{username}/{category}/{unique_name}
    relative_path = f"{MESSENGER_UPLOAD_SUBDIR}/{username}/{category}/{unique_name}"

    if settings.use_gcs and settings.gcs_bucket_name:
        url = await _upload_to_gcs(file_bytes, relative_path, mime)
    else:
        url = _upload_to_local(file_bytes, relative_path)

    result = {
        "url": url,
        "thumbnailUrl": None,  # TODO: generate thumbnails for images
        "mimeType": mime,
        "fileSize": len(file_bytes),
        "fileName": filename,
    }

    logger.info(f"📎 Uploaded {category} for {username}: {filename} ({len(file_bytes)} bytes)")
    return result


def _upload_to_local(file_bytes: bytes, relative_path: str) -> str:
    """Save file to local filesystem (development)."""
    full_path = Path(settings.upload_dir) / relative_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(file_bytes)
    # Return URL relative to backend (served via static mount)
    return f"/{settings.upload_dir}/{relative_path}"


async def _upload_to_gcs(file_bytes: bytes, relative_path: str, mime: str) -> str:
    """Upload file to Google Cloud Storage (production)."""
    try:
        from google.cloud import storage as gcs_storage

        client = gcs_storage.Client(project=settings.gcs_project_id)
        bucket = client.bucket(settings.gcs_bucket_name)
        blob = bucket.blob(relative_path)
        blob.upload_from_string(file_bytes, content_type=mime)

        # Return public URL (or signed URL if bucket is private)
        url = f"https://storage.googleapis.com/{settings.gcs_bucket_name}/{relative_path}"
        return url
    except Exception as e:
        logger.error(f"❌ GCS upload failed: {e}")
        raise
