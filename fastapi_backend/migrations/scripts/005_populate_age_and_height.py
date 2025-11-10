"""
Migration 005: Populate age and heightInches fields
Purpose: Calculate and populate missing age (from dateOfBirth/dob) and heightInches (from height string)
Date: 2025-11-10
"""

import sys
import os
import re
from pathlib import Path
from datetime import datetime, date

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import logging

logger = logging.getLogger(__name__)


def calculate_age(dob_str):
    """Calculate age from date of birth string"""
    if not dob_str:
        return None
    
    try:
        # Parse various date formats
        for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d']:
            try:
                dob = datetime.strptime(dob_str, fmt).date()
                today = date.today()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                return age
            except ValueError:
                continue
        return None
    except Exception as e:
        logger.warning(f"Could not parse DOB '{dob_str}': {e}")
        return None


def parse_height_to_inches(height_str):
    """Convert height string like '5'6\"' or '5 ft 6 in' to inches"""
    if not height_str:
        return None
    
    try:
        # Pattern 1: 5'6" or 5'6
        match = re.search(r"(\d+)'(\d+)", height_str)
        if match:
            feet = int(match.group(1))
            inches = int(match.group(2))
            return feet * 12 + inches
        
        # Pattern 2: 5ft 6in or 5 ft 6 in
        match = re.search(r"(\d+)\s*ft\s*(\d+)\s*in", height_str, re.IGNORECASE)
        if match:
            feet = int(match.group(1))
            inches = int(match.group(2))
            return feet * 12 + inches
        
        # Pattern 3: Just feet like "5"
        match = re.search(r"^(\d+)$", height_str)
        if match:
            feet = int(match.group(1))
            return feet * 12
        
        return None
    except Exception as e:
        logger.warning(f"Could not parse height '{height_str}': {e}")
        return None


async def up(db):
    """
    Migration: Populate missing age and heightInches fields
    
    Age is calculated from dateOfBirth or dob field
    HeightInches is parsed from height string field
    """
    
    logger.info("=" * 60)
    logger.info("MIGRATION 005: Populate age and heightInches")
    logger.info("=" * 60)
    
    try:
        # Find users missing age or heightInches
        users_to_update = await db.users.find({
            "$or": [
                {"age": {"$exists": False}},
                {"age": None},
                {"heightInches": {"$exists": False}},
                {"heightInches": None}
            ]
        }).to_list(length=None)
        
        total_users = len(users_to_update)
        logger.info(f"📊 Found {total_users} users with missing fields")
        
        if total_users == 0:
            logger.info("✅ All users already have age and heightInches!")
            logger.info("=" * 60)
            return
        
        updated_count = 0
        age_updated = 0
        height_updated = 0
        error_count = 0
        
        for i, user in enumerate(users_to_update, 1):
            username = user.get('username', 'UNKNOWN')
            update_fields = {}
            
            # Calculate age if missing
            if not user.get('age'):
                dob = user.get('dateOfBirth') or user.get('dob')
                if dob:
                    age = calculate_age(dob)
                    if age and 18 <= age <= 100:  # Sanity check
                        update_fields['age'] = age
                        age_updated += 1
                    else:
                        logger.warning(f"   ⚠️  {username}: Invalid age calculated: {age}")
            
            # Calculate heightInches if missing
            if not user.get('heightInches'):
                height_str = user.get('height')
                if height_str:
                    height_inches = parse_height_to_inches(height_str)
                    if height_inches and 48 <= height_inches <= 96:  # 4ft to 8ft sanity check
                        update_fields['heightInches'] = height_inches
                        height_updated += 1
                    else:
                        logger.warning(f"   ⚠️  {username}: Invalid height calculated: {height_inches} from '{height_str}'")
            
            # Update user if we have fields to update
            if update_fields:
                update_fields['updatedAt'] = datetime.now()
                
                try:
                    result = await db.users.update_one(
                        {"username": username},
                        {"$set": update_fields}
                    )
                    
                    if result.modified_count > 0:
                        updated_count += 1
                        fields_str = ", ".join([f"{k}={v}" for k, v in update_fields.items() if k != 'updatedAt'])
                        if i % 50 == 0:
                            logger.info(f"   Progress: {i}/{total_users} users processed...")
                        
                except Exception as e:
                    logger.error(f"❌ Failed to update {username}: {e}")
                    error_count += 1
        
        logger.info("=" * 60)
        logger.info(f"✅ Migration 005 complete!")
        logger.info(f"   Total users processed: {total_users}")
        logger.info(f"   Users updated: {updated_count}")
        logger.info(f"   Age fields added: {age_updated}")
        logger.info(f"   Height fields added: {height_updated}")
        logger.info(f"   Errors: {error_count}")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Migration 005 failed: {e}")
        raise


async def down(db):
    """Rollback: Remove calculated age and heightInches fields"""
    logger.info("🔄 Rolling back migration 005")
    logger.info("⚠️  Note: This will only remove fields, not restore original missing data")
    
    # We cannot safely rollback because we don't know which fields were added by this migration
    # vs which existed before
    logger.warning("⚠️  Rollback not fully implemented for safety - manual intervention required")
