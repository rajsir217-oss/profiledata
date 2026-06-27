"""Get rajadmin phone from production DB (decrypted)"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(__file__))
from crypto_utils import get_encryptor


def decrypt_val(value):
    if not value:
        return value
    if isinstance(value, str) and value.startswith("gAAAAA"):
        try:
            return get_encryptor().decrypt(value)
        except Exception as e:
            return f"DECRYPT_FAILED: {e}"
    return value


async def main():
    mongodb_url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB

    user = await db.users.find_one({"username": {"$regex": "^rajadmin$", "$options": "i"}})
    if not user:
        print("❌ rajadmin not found")
        return

    raw_phone = user.get("contactNumber")
    print(f"Raw contactNumber: {raw_phone}")
    print(f"Decrypted phone: {decrypt_val(raw_phone)}")
    print(f"smsOptIn: {user.get('smsOptIn')}")
    print(f"MFA: {user.get('mfa')}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
