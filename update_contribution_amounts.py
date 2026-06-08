#!/usr/bin/env python3
"""
Script to update contribution amounts in MongoDB
Changes from [5, 10, 15] to [10, 15, 25]
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def update_contribution_amounts():
    """Update contribution amounts in site_settings"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
    db = client.matrimonialDB
    
    try:
        # Get current site settings
        site_settings = await db.site_settings.find_one({"_id": "site_settings"})
        
        if not site_settings:
            print("❌ No site_settings found!")
            return
        
        print("📋 Current site_settings:")
        print(f"   Enabled: {site_settings.get('contributions', {}).get('enabled', False)}")
        print(f"   Amounts: {site_settings.get('contributions', {}).get('amounts', 'Not set')}")
        
        # Update amounts
        result = await db.site_settings.update_one(
            {"_id": "site_settings"},
            {"$set": {"contributions.amounts": [10, 15, 25]}}
        )
        
        if result.modified_count > 0:
            print("\n✅ Successfully updated contribution amounts to [10, 15, 25]")
        else:
            print("\n⚠️ No update needed - amounts already set to [10, 15, 25]")
        
        # Verify update
        updated = await db.site_settings.find_one({"_id": "site_settings"})
        print(f"\n📊 New amounts: {updated.get('contributions', {}).get('amounts', 'Not set')}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()  # Motor's close() is synchronous

if __name__ == "__main__":
    asyncio.run(update_contribution_amounts())
