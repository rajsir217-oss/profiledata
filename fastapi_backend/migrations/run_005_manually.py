"""
Manual runner for migration 005
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings
import importlib.util

settings = Settings()


async def main():
    print("🔧 Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    
    print(f"✅ Connected to: {settings.database_name}")
    
    # Load and run the migration
    spec = importlib.util.spec_from_file_location(
        "migration_005",
        Path(__file__).parent / "scripts" / "005_populate_age_and_height.py"
    )
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    
    up = migration.up
    
    await up(db)
    
    client.close()
    print("✅ Done!")


if __name__ == "__main__":
    asyncio.run(main())
