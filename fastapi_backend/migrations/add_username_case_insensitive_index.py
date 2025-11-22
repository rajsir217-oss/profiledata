#!/usr/bin/env python3
"""
Migration: Add case-insensitive index on username field

This migration creates a case-insensitive index on the username field
to support efficient case-insensitive username lookups.

Date: 2025-11-22
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

async def run_migration():
    """Add case-insensitive index on username field"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print("=" * 80)
    print("MIGRATION: Add Case-Insensitive Index on Username")
    print("=" * 80)
    
    try:
        # Check existing indexes
        print("\n📋 Checking existing indexes on 'users' collection...")
        existing_indexes = await db.users.index_information()
        print(f"   Found {len(existing_indexes)} existing indexes")
        
        # Check if case-insensitive username index already exists
        has_ci_index = False
        for idx_name, idx_info in existing_indexes.items():
            if 'username' in str(idx_info.get('key', [])):
                collation = idx_info.get('collation', {})
                if collation.get('locale') == 'en' and collation.get('strength') == 2:
                    has_ci_index = True
                    print(f"   ✅ Case-insensitive username index already exists: {idx_name}")
                    break
        
        if not has_ci_index:
            # Create case-insensitive index
            print("\n🔨 Creating case-insensitive index on 'username' field...")
            index_name = await db.users.create_index(
                "username",
                unique=True,
                collation={
                    "locale": "en",
                    "strength": 2  # Case-insensitive comparison
                },
                name="username_case_insensitive"
            )
            print(f"   ✅ Created index: {index_name}")
        
        # Verify index was created
        print("\n🔍 Verifying indexes after migration...")
        final_indexes = await db.users.index_information()
        print(f"   Total indexes: {len(final_indexes)}")
        
        for idx_name, idx_info in final_indexes.items():
            if 'username' in str(idx_info.get('key', [])):
                print(f"   - {idx_name}: {idx_info.get('key')}")
                if idx_info.get('collation'):
                    print(f"     Collation: {idx_info['collation']}")
        
        print("\n" + "=" * 80)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ ERROR during migration: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()
    
    return True

if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)
