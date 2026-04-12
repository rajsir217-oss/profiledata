# fastapi_backend/services/storage_service.py
"""
Storage service that supports both local filesystem and Google Cloud Storage
"""
import logging
import uuid
import os
import io
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from PIL import Image

logger = logging.getLogger(__name__)


class StorageService:
    """Unified storage service for local and cloud storage"""
    
    def __init__(self, use_gcs: bool = False, bucket_name: Optional[str] = None):
        self.use_gcs = use_gcs
        self.bucket_name = bucket_name
        self.gcs_client = None
        self.gcs_bucket = None
        
        if self.use_gcs:
            self._initialize_gcs()
    
    def _initialize_gcs(self):
        """Initialize Google Cloud Storage client"""
        try:
            from google.cloud import storage
            self.gcs_client = storage.Client()
            self.gcs_bucket = self.gcs_client.bucket(self.bucket_name)
            
            # Store signing credentials for signed URL generation on Cloud Run
            # Cloud Run default credentials don't have a private key,
            # so we use IAM signBlob API via the access token approach
            self._signing_credentials = None
            self._signer_email = None
            try:
                import google.auth
                from google.auth import compute_engine
                from google.auth.transport import requests as auth_requests
                
                credentials, project = google.auth.default()
                if isinstance(credentials, compute_engine.Credentials):
                    # On Cloud Run, credentials.service_account_email returns "default"
                    # We must explicitly fetch the real email from the metadata server
                    auth_request = auth_requests.Request()
                    credentials.refresh(auth_request)
                    
                    sa_email = credentials.service_account_email
                    if not sa_email or sa_email == "default":
                        # Fetch from metadata server directly (use urllib - always available)
                        import urllib.request
                        metadata_url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email"
                        req = urllib.request.Request(metadata_url, headers={"Metadata-Flavor": "Google"})
                        with urllib.request.urlopen(req, timeout=5) as resp:
                            sa_email = resp.read().decode("utf-8").strip()
                    
                    if sa_email and sa_email != "default":
                        self._signing_credentials = credentials
                        self._signer_email = sa_email
                        logger.info(f"✅ IAM signing configured for: {self._signer_email}")
                    else:
                        logger.warning("⚠️ Could not resolve service account email for IAM signing")
            except Exception as sign_err:
                logger.warning(f"⚠️ Could not configure IAM signing: {sign_err}")
            
            logger.info(f"✅ Google Cloud Storage initialized: bucket={self.bucket_name}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize GCS: {e}")
            logger.warning("⚠️ Falling back to local storage")
            self.use_gcs = False
    
    async def save_file(self, upload_file: UploadFile, folder: str = "uploads") -> str:
        """
        Save uploaded file to storage (local or GCS)
        
        Args:
            upload_file: FastAPI UploadFile object
            folder: Folder/prefix for organizing files
            
        Returns:
            Public URL or relative path to the file
        """
        # Generate unique filename
        file_extension = Path(upload_file.filename).suffix.lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Read file content
        content = await upload_file.read()
        original_size_mb = len(content) / (1024 * 1024)
        
        # Compress image if it's a common image format
        if file_extension in ['.jpg', '.jpeg', '.png', '.webp']:
            try:
                content = self._compress_image(content, file_extension)
                new_size_mb = len(content) / (1024 * 1024)
                logger.info(f"✨ Compressed image: {original_size_mb:.2f}MB -> {new_size_mb:.2f}MB ({(1 - new_size_mb/original_size_mb)*100:.1f}% reduction)")
                file_size_mb = new_size_mb
            except Exception as e:
                logger.warning(f"⚠️ Image compression failed, saving original: {e}")
                file_size_mb = original_size_mb
        else:
            file_size_mb = original_size_mb
        
        # Log storage destination
        storage_type = "GCS" if self.use_gcs else "Local"
        logger.info(f"📤 Uploading {unique_filename} ({file_size_mb:.2f}MB) to {storage_type} storage")
        
        if self.use_gcs:
            return await self._save_to_gcs(unique_filename, content, folder, file_size_mb)
        else:
            return await self._save_to_local(unique_filename, content, folder, file_size_mb)

    def generate_signed_url(self, filename: str, folder: str = "uploads", expiration_minutes: int = 15) -> Optional[str]:
        """
        Generate a signed URL for direct GCS access.
        This saves CPU/Network costs by offloading file serving to GCS directly.
        
        On Cloud Run (Compute Engine credentials), uses IAM signBlob API.
        With service account key file, uses local signing.
        """
        if not self.use_gcs:
            return None
            
        try:
            from datetime import timedelta
            blob_path = f"{folder}/{filename}"
            blob = self.gcs_bucket.blob(blob_path)
            
            # Try standard signing first (works with service account key files)
            try:
                url = blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(minutes=expiration_minutes),
                    method="GET",
                )
                return url
            except Exception as sign_err:
                # If standard signing fails (no private key), use IAM signBlob API
                if self._signing_credentials and self._signer_email:
                    logger.debug(f"Using IAM signBlob for {filename}")
                    # Refresh credentials to ensure token is valid
                    from google.auth.transport import requests as auth_requests
                    self._signing_credentials.refresh(auth_requests.Request())
                    url = blob.generate_signed_url(
                        version="v4",
                        expiration=timedelta(minutes=expiration_minutes),
                        method="GET",
                        service_account_email=self._signer_email,
                        access_token=self._signing_credentials.token,
                    )
                    return url
                else:
                    raise sign_err
        except Exception as e:
            logger.error(f"❌ Failed to generate signed URL for {filename}: {e}")
            return None

    def _compress_image(self, content: bytes, extension: str) -> bytes:
        """
        Resize and compress image to reduce storage and network egress costs
        Target: Max width/height 1600px, quality 80
        """
        img = Image.open(io.BytesIO(content))
        
        # Convert RGBA to RGB if saving as JPEG
        if img.mode in ('RGBA', 'P') and extension in ['.jpg', '.jpeg']:
            img = img.convert('RGB')
            
        # 1. Resize if too large (1600px is plenty for web profiles)
        max_size = 1600
        if img.width > max_size or img.height > max_size:
            ratio = min(max_size / img.width, max_size / img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)
            
        # 2. Compress and save to buffer
        output = io.BytesIO()
        
        # Use JPEG for best compression of photos
        save_format = 'JPEG' if extension in ['.jpg', '.jpeg'] else img.format
        if not save_format:
            save_format = 'PNG'
            
        save_params = {'optimize': True}
        if save_format == 'JPEG':
            save_params['quality'] = 80  # 80 is the "sweet spot" for quality vs size
            
        img.save(output, format=save_format, **save_params)
        return output.getvalue()
    
    async def _save_to_gcs(self, filename: str, content: bytes, folder: str, file_size_mb: float) -> str:
        """Save file to Google Cloud Storage"""
        try:
            # Create blob path
            blob_path = f"{folder}/{filename}"
            blob = self.gcs_bucket.blob(blob_path)
            
            # Upload file
            blob.upload_from_string(content, content_type="image/jpeg")

            logger.info(f"✅ File uploaded to GCS: {blob_path} ({file_size_mb:.2f}MB)")

            # Return relative path (served via protected media endpoint)
            return f"/uploads/{filename}"
            
        except Exception as e:
            logger.error(f"❌ GCS upload failed: {e}", exc_info=True)
            # Fallback to local storage
            logger.warning("⚠️ Falling back to local storage")
            return await self._save_to_local(filename, content, folder, file_size_mb)
    
    async def _save_to_local(self, filename: str, content: bytes, folder: str, file_size_mb: float) -> str:
        """Save file to local filesystem"""
        try:
            import aiofiles
            from config import settings
            
            # Create directory
            upload_dir = Path(settings.upload_dir)
            upload_dir.mkdir(exist_ok=True)
            
            file_path = upload_dir / filename
            
            # Save file
            async with aiofiles.open(file_path, 'wb') as out_file:
                await out_file.write(content)
            
            logger.info(f"✅ File saved locally: {filename} ({file_size_mb:.2f}MB)")
            
            # Return relative path
            return f"/{settings.upload_dir}/{filename}"
            
        except Exception as e:
            logger.error(f"❌ Local save failed: {e}", exc_info=True)
            raise
    
    async def delete_file(self, file_path: str) -> bool:
        """
        Delete file from storage
        
        Args:
            file_path: Full URL (GCS) or relative path (local)
            
        Returns:
            True if deleted successfully
        """
        if self.use_gcs:
            return await self._delete_from_gcs(file_path)
        else:
            return await self._delete_from_local(file_path)
    
    async def _delete_from_gcs(self, public_url: str) -> bool:
        """Delete file from Google Cloud Storage"""
        try:
            blob_path = None
            if public_url.startswith('https://'):
                # Format: https://storage.googleapis.com/{bucket}/{path}
                parts = public_url.split(f'{self.bucket_name}/')
                if len(parts) >= 2:
                    blob_path = parts[1]
            else:
                filename = public_url.split('/')[-1]
                if filename:
                    blob_path = f"uploads/{filename}"

            if not blob_path:
                logger.warning(f"⚠️ Invalid GCS path: {public_url}")
                return False

            blob = self.gcs_bucket.blob(blob_path)
            blob.delete()
            
            logger.info(f"✅ File deleted from GCS: {blob_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ GCS delete failed: {e}")
            return False
    
    async def _delete_from_local(self, file_path: str) -> bool:
        """Delete file from local filesystem"""
        try:
            from config import settings
            
            # Extract filename from path
            filename = file_path.replace(f'/{settings.upload_dir}/', '').replace('uploads/', '')
            full_path = Path(settings.upload_dir) / filename
            
            if full_path.exists():
                full_path.unlink()
                logger.info(f"✅ File deleted locally: {filename}")
                return True
            else:
                logger.warning(f"⚠️ File not found: {full_path}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Local delete failed: {e}")
            return False


    async def rotate_file(self, file_path: str, degrees: int = 90, folder: str = "uploads") -> bool:
        """
        Rotate an image file in-place (on GCS or local disk).
        
        Args:
            file_path: Relative path like /uploads/abc123.jpg
            degrees: Clockwise rotation (90, 180, 270)
            folder: Storage folder prefix
            
        Returns:
            True if rotated successfully
        """
        filename = file_path.split('/')[-1]
        if not filename:
            logger.error(f"❌ rotate_file: invalid path '{file_path}'")
            return False
        
        try:
            if self.use_gcs:
                return await self._rotate_gcs(filename, degrees, folder)
            else:
                return await self._rotate_local(filename, degrees)
        except Exception as e:
            logger.error(f"❌ rotate_file failed for {filename}: {e}", exc_info=True)
            return False
    
    async def _rotate_gcs(self, filename: str, degrees: int, folder: str) -> bool:
        """Download from GCS, rotate, re-upload."""
        blob_path = f"{folder}/{filename}"
        blob = self.gcs_bucket.blob(blob_path)
        
        content = blob.download_as_bytes()
        logger.info(f"🔄 Downloaded {blob_path} ({len(content)} bytes) for rotation")
        
        rotated = self._rotate_image_bytes(content, degrees)
        
        blob.cache_control = "no-cache, no-store, must-revalidate"
        blob.upload_from_string(rotated, content_type="image/jpeg")
        logger.info(f"✅ Rotated {blob_path} by {degrees}° and re-uploaded")
        return True
    
    async def _rotate_local(self, filename: str, degrees: int) -> bool:
        """Read local file, rotate, overwrite."""
        from config import settings
        
        full_path = Path(settings.upload_dir) / filename
        if not full_path.exists():
            logger.error(f"❌ File not found for rotation: {full_path}")
            return False
        
        content = full_path.read_bytes()
        logger.info(f"🔄 Read {full_path} ({len(content)} bytes) for rotation")
        
        rotated = self._rotate_image_bytes(content, degrees)
        
        full_path.write_bytes(rotated)
        logger.info(f"✅ Rotated {full_path} by {degrees}° and saved")
        return True
    
    def _rotate_image_bytes(self, content: bytes, degrees: int) -> bytes:
        """Rotate image bytes by given degrees clockwise. Strips EXIF orientation."""
        img = Image.open(io.BytesIO(content))
        
        # Strip EXIF orientation to prevent double-rotation
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        
        # Pillow rotates counter-clockwise, so negate for clockwise
        img = img.rotate(-degrees, expand=True)
        
        # Convert RGBA → RGB for JPEG
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        output = io.BytesIO()
        fmt = 'JPEG'
        img.save(output, format=fmt, quality=85, optimize=True)
        return output.getvalue()


# Global storage service instance
_storage_service: Optional[StorageService] = None


def initialize_storage_service(use_gcs: bool = False, bucket_name: Optional[str] = None):
    """Initialize global storage service"""
    global _storage_service
    _storage_service = StorageService(use_gcs=use_gcs, bucket_name=bucket_name)
    logger.info(f"📦 Storage service initialized (GCS: {use_gcs})")


def get_storage_service() -> StorageService:
    """Get global storage service instance"""
    if _storage_service is None:
        raise RuntimeError("Storage service not initialized. Call initialize_storage_service() first.")
    return _storage_service
