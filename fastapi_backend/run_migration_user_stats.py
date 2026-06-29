#!/usr/bin/env python3
"""Run user_stats_daily migration"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from migrations.create_user_stats_daily import up, down
import sys

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "matrimonialDB"

async def main():
    db = AsyncIOMotorClient(MONGODB_URL)[DATABASE_NAME]
    
    if len(sys.argv) > 1 and sys.argv[1] == "down":
        print("Running migration down...")
        await down(db)
    else:
        print("Running migration up...")
        await up(db)

if __name__ == "__main__":
    asyncio.run(main())
