"""Get rajadmin mfa structure - no decryption needed"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    user = await db.users.find_one({"username": {"$regex": "^rajadmin$", "$options": "i"}})
    if not user:
        print("not found")
        return
    print("mfa:", user.get("mfa"))
    print("smsOptIn:", user.get("smsOptIn"))
    raw = user.get("contactNumber")
    print("contactNumber present:", bool(raw), "| encrypted:", isinstance(raw, str) and raw.startswith("gAAAAA"))
    print("contactNumber length:", len(raw) if raw else 0)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
