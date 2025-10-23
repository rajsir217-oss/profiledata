"""
Image Validation and Moderation System
Validates uploaded images for appropriate content and legal compliance
"""

import logging
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class ImageValidator:
    """
    Image validation system to check for:
    1. Valid image format
    2. Appropriate content (no inappropriate/explicit images)
    3. Legal compliance (age verification indicators)
    4. Image quality (resolution, file size)
    """
    
    def __init__(self):
        self.valid_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
        self.max_file_size = 10 * 1024 * 1024  # 10MB
        self.min_resolution = (200, 200)  # Minimum 200x200 pixels
        
    def validate_image(self, image_path: str) -> Dict:
        """
        Comprehensive image validation
        
        Args:
            image_path: Path to image file
            
        Returns:
            dict with:
                - valid: bool
                - issues: list of issues found
                - warnings: list of warnings
                - flags: dict of specific flags
        """
        result = {
            'valid': True,
            'issues': [],
            'warnings': [],
            'flags': {
                'inappropriate_content': False,
                'low_quality': False,
                'suspicious': False,
                'verified': False
            },
            'validation_date': datetime.utcnow().isoformat()
        }
        
        # Check if file exists
        if not os.path.exists(image_path):
            result['valid'] = False
            result['issues'].append('File not found')
            return result
        
        # Check file extension
        file_ext = Path(image_path).suffix.lower()
        if file_ext not in self.valid_extensions:
            result['valid'] = False
            result['issues'].append(f'Invalid file type: {file_ext}')
            return result
        
        # Check file size
        file_size = os.path.getsize(image_path)
        if file_size > self.max_file_size:
            result['valid'] = False
            result['issues'].append(f'File too large: {file_size / 1024 / 1024:.2f}MB (max: 10MB)')
        elif file_size < 1024:  # Less than 1KB
            result['warnings'].append('File suspiciously small')
            result['flags']['suspicious'] = True
        
        # Try to load image and check properties
        try:
            from PIL import Image
            
            with Image.open(image_path) as img:
                # Check image dimensions
                width, height = img.size
                
                if width < self.min_resolution[0] or height < self.min_resolution[1]:
                    result['issues'].append(f'Image resolution too low: {width}x{height} (min: 200x200)')
                    result['flags']['low_quality'] = True
                    result['valid'] = False
                
                # Check if image is too small (likely placeholder)
                if width < 100 or height < 100:
                    result['warnings'].append('Image very small, might be placeholder')
                    result['flags']['suspicious'] = True
                
                # Check aspect ratio (too extreme might be suspicious)
                aspect_ratio = width / height if height > 0 else 0
                if aspect_ratio > 5 or aspect_ratio < 0.2:
                    result['warnings'].append(f'Unusual aspect ratio: {aspect_ratio:.2f}')
                    result['flags']['suspicious'] = True
                
                # Verify image format
                if img.format not in ['JPEG', 'PNG', 'WEBP', 'HEIC', 'HEIF']:
                    result['warnings'].append(f'Unusual image format: {img.format}')
                
        except Exception as e:
            result['valid'] = False
            result['issues'].append(f'Failed to load image: {str(e)}')
            result['flags']['suspicious'] = True
            return result
        
        # Content moderation (basic checks)
        # Note: For production, integrate with Azure Content Moderator, AWS Rekognition, or Google Vision API
        content_check = self._check_content_basic(image_path)
        if not content_check['safe']:
            result['valid'] = False
            result['issues'].extend(content_check['issues'])
            result['flags']['inappropriate_content'] = True
        
        # All checks passed
        if result['valid'] and not result['issues']:
            result['flags']['verified'] = True
        
        return result
    
    def _check_content_basic(self, image_path: str) -> Dict:
        """
        Basic content check (placeholder for more sophisticated checks)
        
        For production, integrate with:
        - Azure Content Moderator API
        - AWS Rekognition Content Moderation
        - Google Cloud Vision Safe Search
        - Sightengine API
        
        Args:
            image_path: Path to image
            
        Returns:
            dict with 'safe' bool and 'issues' list
        """
        # This is a placeholder implementation
        # In production, use proper AI-based content moderation services
        
        result = {
            'safe': True,
            'issues': []
        }
        
        try:
            from PIL import Image
            import numpy as np
            
            with Image.open(image_path) as img:
                # Convert to RGB if needed
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Get image data
                img_array = np.array(img)
                
                # Basic heuristics (NOT comprehensive, just examples):
                
                # 1. Check for extreme brightness/darkness (might indicate inappropriate editing)
                avg_brightness = np.mean(img_array)
                if avg_brightness < 10:
                    result['issues'].append('Image extremely dark - manual review needed')
                    result['safe'] = False
                
                # 2. Check for unusual color distribution
                # (Real content moderation would use ML models here)
                
                # 3. Check EXIF data for age indicators
                # (Would check for location, camera type, timestamps)
                
        except Exception as e:
            logger.warning(f"Content check failed: {e}")
            # On error, flag for manual review
            result['issues'].append('Automated check failed - manual review required')
            result['safe'] = False
        
        return result
    
    def validate_multiple_images(self, image_paths: List[str]) -> Dict[str, Dict]:
        """
        Validate multiple images
        
        Args:
            image_paths: List of image paths
            
        Returns:
            dict mapping image_path to validation result
        """
        results = {}
        
        for image_path in image_paths:
            try:
                results[image_path] = self.validate_image(image_path)
            except Exception as e:
                logger.error(f"Error validating {image_path}: {e}")
                results[image_path] = {
                    'valid': False,
                    'issues': [f'Validation error: {str(e)}'],
                    'warnings': [],
                    'flags': {
                        'inappropriate_content': False,
                        'low_quality': False,
                        'suspicious': True,
                        'verified': False
                    }
                }
        
        return results
    
    def get_validation_summary(self, validation_results: Dict[str, Dict]) -> Dict:
        """
        Get summary of validation results
        
        Args:
            validation_results: Results from validate_multiple_images
            
        Returns:
            Summary dict
        """
        total = len(validation_results)
        valid = sum(1 for r in validation_results.values() if r['valid'])
        flagged = sum(1 for r in validation_results.values() if any(r['flags'].values()))
        
        return {
            'total_images': total,
            'valid_images': valid,
            'invalid_images': total - valid,
            'flagged_images': flagged,
            'needs_review': total - valid > 0 or flagged > 0,
            'all_verified': valid == total and flagged == 0
        }


# Global validator instance
image_validator = ImageValidator()


async def validate_user_images(db, username: str) -> Dict:
    """
    Validate all images for a user
    
    Args:
        db: Database connection
        username: Username to validate images for
        
    Returns:
        Validation summary and results
    """
    try:
        # Get user
        user = await db.users.find_one({'username': username})
        if not user:
            return {'error': 'User not found'}
        
        # Get image paths
        images = user.get('images', [])
        if not images:
            return {
                'username': username,
                'total_images': 0,
                'validation_summary': {
                    'total_images': 0,
                    'valid_images': 0,
                    'invalid_images': 0,
                    'flagged_images': 0,
                    'needs_review': False,
                    'all_verified': True
                },
                'results': {}
            }
        
        # Convert relative paths to absolute
        from config import settings
        upload_dir = Path(settings.upload_dir)
        
        absolute_paths = []
        for img in images:
            # Remove /uploads/ prefix if present
            img_clean = img.replace('/uploads/', '').replace('uploads/', '')
            abs_path = upload_dir / img_clean
            absolute_paths.append(str(abs_path))
        
        # Validate images
        validation_results = image_validator.validate_multiple_images(absolute_paths)
        
        # Get summary
        summary = image_validator.get_validation_summary(validation_results)
        
        # Update user document with validation status
        validation_status = {
            'last_validated': datetime.utcnow().isoformat(),
            'summary': summary,
            'needs_review': summary['needs_review'],
            'all_verified': summary['all_verified']
        }
        
        await db.users.update_one(
            {'username': username},
            {'$set': {'imageValidation': validation_status}}
        )
        
        logger.info(f"✅ Validated {len(images)} images for user {username}")
        
        return {
            'username': username,
            'total_images': len(images),
            'validation_summary': summary,
            'results': validation_results,
            'validation_status': validation_status
        }
        
    except Exception as e:
        logger.error(f"Error validating user images: {e}", exc_info=True)
        return {'error': str(e)}
