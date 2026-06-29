#!/usr/bin/env python3
"""Run user_stats_daily migration"""

import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from migrations.create_user_stats_daily import up, down

async def main():
    # Parse arguments
    env = "local"
    action = "up"

    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--env" and i + 1 < len(sys.argv):
            env = sys.argv[i + 1]
        elif arg == "down":
            action = "down"
        elif arg == "up":
            action = "up"

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

    db = AsyncIOMotorClient(mongodb_url)[database_name]

    if action == "down":
        print("Running migration down...")
        await down(db)
    else:
        print("Running migration up...")
        await up(db)

if __name__ == "__main__":
    asyncio.run(main())
