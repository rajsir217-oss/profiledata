"""
Migration Script: Convert Static Age/Height Ranges to Relative Preferences

This script converts existing static partner criteria (absolute age and height ranges)
to relative preferences (offsets from user's own age and height).

Author: System
Date: 2025-10-17
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings


def calculate_age(dob_str):
    """Calculate age from date of birth string"""
    try:
        if not dob_str:
            return None
        birth_date = datetime.fromisoformat(dob_str.replace('Z', '+00:00'))
        today = datetime.now()
        age = today.year - birth_date.year
        if today.month < birth_date.month or (today.month == birth_date.month and today.day < birth_date.day):
            age -= 1
        return age
    except:
        return None


def parse_height_to_inches(height_str):
    """Parse height string (e.g., '5'8\"') to total inches"""
    try:
        if not height_str:
            return None
        # Match patterns like "5'8" or "5'8\"" or "5' 8\""
        import re
        match = re.match(r"(\d+)'[ ]?(\d+)", height_str)
        if match:
            feet = int(match.group(1))
            inches = int(match.group(2))
            return (feet * 12) + inches
        return None
    except:
        return None


async def migrate_to_relative_preferences():
    """Migrate all users from static to relative partner preferences"""
    
    print("=" * 70)
    print("🔄 MIGRATION: Static to Relative Partner Preferences")
    print("=" * 70)
    print()
    
    # Connect to MongoDB
    print("📡 Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    try:
        # Test connection
        await client.admin.command('ping')
        print("✅ MongoDB connection successful")
        print()
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        client.close()
        return
    
    # Get all users
    print("📊 Fetching users...")
    users = await db.users.find({}).to_list(length=None)
    print(f"Found {len(users)} users")
    print()
    
    # Stats
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    print("🔧 Processing users...")
    print("-" * 70)
    
    for user in users:
        username = user.get('username', 'unknown')
        
        try:
            # Check if user already has relative preferences
            partner_criteria = user.get('partnerCriteria', {})
            if partner_criteria.get('ageRangeRelative') or partner_criteria.get('heightRangeRelative'):
                print(f"⏭️  {username}: Already has relative preferences, skipping")
                skipped_count += 1
                continue
            
            # Calculate user's age
            dob = user.get('dob') or user.get('dateOfBirth')
            user_age = calculate_age(dob)
            
            # Parse user's height
            height = user.get('height')
            user_height_inches = parse_height_to_inches(height)
            
            # Prepare updates
            updates = {}
            
            # Convert age range if exists
            age_range = partner_criteria.get('ageRange', {})
            min_age = age_range.get('min')
            max_age = age_range.get('max')
            
            if user_age and (min_age or max_age):
                try:
                    min_age = int(min_age) if min_age else user_age
                    max_age = int(max_age) if max_age else user_age + 5
                    
                    min_offset = min_age - user_age
                    max_offset = max_age - user_age
                    
                    updates['partnerCriteria.ageRangeRelative'] = {
                        'minOffset': min_offset,
                        'maxOffset': max_offset
                    }
                    print(f"  📅 Age: {min_age}-{max_age} → {min_offset} to {max_offset} years relative")
                except:
                    # Default relative range if conversion fails
                    updates['partnerCriteria.ageRangeRelative'] = {
                        'minOffset': -2,
                        'maxOffset': 5
                    }
                    print(f"  📅 Age: Using default relative range (-2 to +5 years)")
            elif user_age:
                # No existing age range, set default
                updates['partnerCriteria.ageRangeRelative'] = {
                    'minOffset': -2,
                    'maxOffset': 5
                }
                print(f"  📅 Age: No previous range, using default (-2 to +5 years)")
            
            # Convert height range if exists
            height_range = partner_criteria.get('heightRange', {})
            min_feet = height_range.get('minFeet')
            max_feet = height_range.get('maxFeet')
            min_inches_part = height_range.get('minInches', 0)
            max_inches_part = height_range.get('maxInches', 0)
            
            if user_height_inches and (min_feet or max_feet):
                try:
                    min_feet = int(min_feet) if min_feet else 0
                    max_feet = int(max_feet) if max_feet else 0
                    min_inches_part = int(min_inches_part) if min_inches_part else 0
                    max_inches_part = int(max_inches_part) if max_inches_part else 0
                    
                    min_total_inches = (min_feet * 12) + min_inches_part if min_feet else user_height_inches
                    max_total_inches = (max_feet * 12) + max_inches_part if max_feet else user_height_inches + 6
                    
                    min_offset = min_total_inches - user_height_inches
                    max_offset = max_total_inches - user_height_inches
                    
                    updates['partnerCriteria.heightRangeRelative'] = {
                        'minInches': min_offset,
                        'maxInches': max_offset
                    }
                    print(f"  📏 Height: {min_feet}'{min_inches_part}\" - {max_feet}'{max_inches_part}\" → {min_offset} to {max_offset} inches relative")
                except:
                    # Default relative range if conversion fails
                    updates['partnerCriteria.heightRangeRelative'] = {
                        'minInches': -3,
                        'maxInches': 6
                    }
                    print(f"  📏 Height: Using default relative range (-3 to +6 inches)")
            elif user_height_inches:
                # No existing height range, set default
                updates['partnerCriteria.heightRangeRelative'] = {
                    'minInches': -3,
                    'maxInches': 6
                }
                print(f"  📏 Height: No previous range, using default (-3 to +6 inches)")
            
            # Apply updates if any
            if updates:
                await db.users.update_one(
                    {'username': username},
                    {'$set': updates}
                )
                print(f"✅ {username}: Migrated successfully")
                migrated_count += 1
            else:
                print(f"⚠️  {username}: No age or height data to migrate")
                skipped_count += 1
            
            print()
            
        except Exception as e:
            print(f"❌ {username}: Error - {e}")
            error_count += 1
            print()
    
    # Summary
    print("=" * 70)
    print("📊 MIGRATION SUMMARY")
    print("=" * 70)
    print(f"✅ Successfully migrated: {migrated_count} users")
    print(f"⏭️  Skipped (already migrated): {skipped_count} users")
    print(f"❌ Errors: {error_count} users")
    print(f"📈 Total processed: {len(users)} users")
    print()
    print("🎉 Migration complete!")
    print()
    
    # Close connection
    client.close()
    print("🔌 MongoDB connection closed")


if __name__ == "__main__":
    print()
    print("⚠️  WARNING: This script will modify user data in the database!")
    print("   It will convert static age/height ranges to relative preferences.")
    print()
    
    response = input("Do you want to proceed? (yes/no): ").strip().lower()
    
    if response == 'yes':
        print()
        asyncio.run(migrate_to_relative_preferences())
    else:
        print("❌ Migration cancelled")
