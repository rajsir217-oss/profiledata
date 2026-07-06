#!/usr/bin/env python3
"""Run search optimization migrations"""

import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from migrations.add_search_indexes import up as add_indexes_up, down as add_indexes_down
from migrations.precompute_sort_fields import up as precompute_fields_up, down as precompute_fields_down

async def main():
    # Parse arguments
    env = "local"
    action = "up"
    migration = "all"  # "all", "indexes", "fields"

    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--env" and i + 1 < len(sys.argv):
            env = sys.argv[i + 1]
        elif arg == "down":
            action = "down"
        elif arg == "up":
            action = "up"
        elif arg in ["all", "indexes", "fields"]:
            migration = arg

    # Load .env file based on environment
    if env == "production":
        env_file = Path(__file__).parent / ".env.production"
    elif env == "staging":
        env_file = Path(__file__).parent / ".env.staging"
    else:
        env_file = Path(__file__).parent / ".env"
        if not env_file.exists():
            env_file = Path(__file__).parent / ".env.local"

    load_dotenv(env_file)

    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "matrimonialDB")

    print(f"Environment: {env}")
    print(f"Using env file: {env_file}")
    print(f"MongoDB URL: {mongodb_url}")
    print(f"Database: {database_name}")
    print(f"Migration: {migration}")
    print(f"Action: {action}")
    print()

    db = AsyncIOMotorClient(mongodb_url)[database_name]

    if action == "down":
        print("Running migration down...")
        if migration == "all" or migration == "fields":
            print("\n=== Pre-computed Sort Fields Migration (DOWN) ===")
            await precompute_fields_down(db)
        if migration == "all" or migration == "indexes":
            print("\n=== Search Indexes Migration (DOWN) ===")
            await add_indexes_down(db)
    else:
        print("Running migration up...")
        if migration == "all" or migration == "indexes":
            print("\n=== Search Indexes Migration (UP) ===")
            await add_indexes_up(db)
        if migration == "all" or migration == "fields":
            print("\n=== Pre-computed Sort Fields Migration (UP) ===")
            await precompute_fields_up(db)

    print("\n✅ All migrations completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
