# fastapi_backend/services/storage_service.py
"""
Storage service that supports both local filesystem and Google Cloud Storage
"""
import os
import uuid
import logging
from pathlib import Path
from typing import Optional
from fastapi import UploadFile

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
        file_extension = Path(upload_file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Read file content
        content = await upload_file.read()
        file_size_mb = len(content) / (1024 * 1024)
        
        if self.use_gcs:
            return await self._save_to_gcs(unique_filename, content, folder, file_size_mb)
        else:
            return await self._save_to_local(unique_filename, content, folder, file_size_mb)
    
    async def _save_to_gcs(self, filename: str, content: bytes, folder: str, file_size_mb: float) -> str:
        """Save file to Google Cloud Storage"""
        try:
            # Create blob path
            blob_path = f"{folder}/{filename}"
            blob = self.gcs_bucket.blob(blob_path)
            
            # Upload file
            blob.upload_from_string(content, content_type="image/jpeg")
            
            # Make publicly accessible
            blob.make_public()
            
            logger.info(f"✅ File uploaded to GCS: {blob_path} ({file_size_mb:.2f}MB)")
            
            # Return public URL
            return blob.public_url
            
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
        if self.use_gcs and file_path.startswith('https://'):
            return await self._delete_from_gcs(file_path)
        else:
            return await self._delete_from_local(file_path)
    
    async def _delete_from_gcs(self, public_url: str) -> bool:
        """Delete file from Google Cloud Storage"""
        try:
            # Extract blob path from public URL
            # Format: https://storage.googleapis.com/{bucket}/{path}
            parts = public_url.split(f'{self.bucket_name}/')
            if len(parts) < 2:
                logger.warning(f"⚠️ Invalid GCS URL: {public_url}")
                return False
            
            blob_path = parts[1]
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
