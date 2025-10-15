"""
Migration script to add heightInches field to existing users
Converts height from "5'8"" format to numeric inches (68)
"""

import asyncio
import re
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def cm_to_feet_inches(cm):
    """Convert centimeters to feet and inches format"""
    total_inches = cm / 2.54
    feet = int(total_inches // 12)
    inches = int(total_inches % 12)
    return feet, inches, int(total_inches)

def parse_height_to_inches(height_str):
    """Convert height string '5'8"' or '5 ft 8 in' or '170 cm' to total inches"""
    if not height_str:
        return None, None
    
    height_str = str(height_str).strip()
    
    # Check if it's in cm format (e.g., "170 cm", "170cm", "170")
    cm_match = re.match(r"(\d+)\s*cm?$", height_str, re.IGNORECASE)
    if cm_match:
        cm = int(cm_match.group(1))
        feet, inches, total_inches = cm_to_feet_inches(cm)
        new_format = f"{feet}'{inches}\""
        logger.info(f"   📏 Converted {height_str} → {new_format} ({total_inches} inches)")
        return total_inches, new_format
    
    # Match formats: "5'8"" or "5 ft 8 in" or "5'8\""
    match = re.match(r"(\d+)['\s]+(ft\s+)?(\d+)[\"\s]*(in)?", height_str)
    if match:
        feet = int(match.group(1))
        inches = int(match.group(3))
        return feet * 12 + inches, None  # No format change needed
    
    return None, None

async def migrate_heights():
    """Add heightInches field to all users who have height but no heightInches"""
    
    # Connect to MongoDB
    logger.info(f"🔌 Connecting to MongoDB at {settings.mongodb_url}...")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    logger.info("🔄 Starting height migration...")
    
    try:
        # Find all users who have height but no heightInches
        users = await db.users.find({
            "height": {"$exists": True, "$ne": None, "$ne": ""},
            "$or": [
                {"heightInches": {"$exists": False}},
                {"heightInches": None}
            ]
        }).to_list(length=None)
        
        logger.info(f"📊 Found {len(users)} users needing height migration")
        
        updated_count = 0
        failed_count = 0
        converted_cm_count = 0
        
        for user in users:
            username = user.get("username", "unknown")
            height = user.get("height")
            
            if not height:
                continue
                
            height_inches, new_format = parse_height_to_inches(height)
            
            if height_inches is not None:
                # Prepare update data
                update_data = {"heightInches": height_inches}
                
                # If height was in cm, also update the height field to ft'inch" format
                if new_format:
                    update_data["height"] = new_format
                    converted_cm_count += 1
                
                # Update user with heightInches (and possibly new height format)
                result = await db.users.update_one(
                    {"username": username},
                    {"$set": update_data}
                )
                
                if result.modified_count > 0:
                    if new_format:
                        logger.info(f"✅ {username}: {height} → {new_format} ({height_inches} inches)")
                    else:
                        logger.info(f"✅ {username}: {height} → {height_inches} inches")
                    updated_count += 1
                else:
                    logger.warning(f"⚠️ {username}: Update failed")
                    failed_count += 1
            else:
                logger.warning(f"❌ {username}: Could not parse height '{height}'")
                failed_count += 1
        
        logger.info(f"""
╔══════════════════════════════════════╗
║     MIGRATION SUMMARY                ║
╠══════════════════════════════════════╣
║ ✅ Successfully updated: {updated_count:4d}     ║
║ 📏 Converted from cm:    {converted_cm_count:4d}     ║
║ ❌ Failed/Skipped:       {failed_count:4d}     ║
║ 📊 Total processed:      {len(users):4d}     ║
╚══════════════════════════════════════╝
        """)
        
    except Exception as e:
        logger.error(f"❌ Migration error: {e}", exc_info=True)
    finally:
        client.close()
        logger.info("🔌 Database connection closed")

if __name__ == "__main__":
    asyncio.run(migrate_heights())
