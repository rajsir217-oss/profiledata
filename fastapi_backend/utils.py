# fastapi_backend/utils.py
import os
import aiofiles
from pathlib import Path
from fastapi import UploadFile
from typing import List
import uuid
from config import settings

async def save_upload_file(upload_file: UploadFile) -> str:
    """Save uploaded file and return the file path"""
    # Create uploads directory if it doesn't exist
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(exist_ok=True)
    
    # Generate unique filename
    file_extension = Path(upload_file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await upload_file.read()
        await out_file.write(content)
    
    return f"/{settings.upload_dir}/{unique_filename}"

async def save_multiple_files(files: List[UploadFile]) -> List[str]:
    """Save multiple files and return list of paths"""
    file_paths = []
    for file in files:
        # Validate file type
        if not file.content_type.startswith('image/'):
            continue
        # Validate file size (5MB max)
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:
            continue
        await file.seek(0)  # Reset file pointer
        
        path = await save_upload_file(file)
        file_paths.append(path)
    
    return file_paths

def get_full_image_url(image_path: str) -> str:
    """Convert relative image path to full URL"""
    if image_path.startswith('http'):
        return image_path
    return f"{settings.backend_url}{image_path}"
