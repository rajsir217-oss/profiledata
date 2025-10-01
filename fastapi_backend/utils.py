# fastapi_backend/utils.py
import os
import aiofiles
from pathlib import Path
from fastapi import UploadFile
from typing import List
import uuid
from config import settings
import logging

logger = logging.getLogger(__name__)

async def save_upload_file(upload_file: UploadFile) -> str:
    """Save uploaded file and return the file path"""
    try:
        # Create uploads directory if it doesn't exist
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(upload_file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        logger.debug(f"💾 Saving file '{upload_file.filename}' as '{unique_filename}'")
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await upload_file.read()
            file_size_mb = len(content) / (1024 * 1024)
            await out_file.write(content)
        
        logger.info(f"✅ File saved successfully: {unique_filename} ({file_size_mb:.2f}MB)")
        return f"/{settings.upload_dir}/{unique_filename}"
    except Exception as e:
        logger.error(f"❌ Error saving file '{upload_file.filename}': {e}", exc_info=True)
        raise

async def save_multiple_files(files: List[UploadFile]) -> List[str]:
    """Save multiple files and return list of paths"""
    file_paths = []
    logger.info(f"📁 Processing {len(files)} file(s) for upload...")
    
    for idx, file in enumerate(files, 1):
        logger.debug(f"Processing file {idx}/{len(files)}: {file.filename}")
        
        # Validate file type
        if not file.content_type.startswith('image/'):
            logger.warning(f"⚠️ Skipping non-image file: {file.filename} (type: {file.content_type})")
            continue
            
        # Validate file size (5MB max)
        content = await file.read()
        file_size_mb = len(content) / (1024 * 1024)
        
        if len(content) > 5 * 1024 * 1024:
            logger.warning(f"⚠️ Skipping file {file.filename}: too large ({file_size_mb:.2f}MB > 5MB)")
            continue
            
        await file.seek(0)  # Reset file pointer
        
        try:
            path = await save_upload_file(file)
            file_paths.append(path)
            logger.debug(f"✅ File {idx}/{len(files)} saved: {file.filename}")
        except Exception as e:
            logger.error(f"❌ Failed to save file {file.filename}: {e}")
            # Continue with other files even if one fails
            continue
    
    logger.info(f"✅ Successfully saved {len(file_paths)}/{len(files)} file(s)")
    return file_paths

def get_full_image_url(image_path: str) -> str:
    """Convert relative image path to full URL"""
    if image_path.startswith('http'):
        return image_path
    return f"{settings.backend_url}{image_path}"
