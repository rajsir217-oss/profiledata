"""
Standalone SMS diagnostic - decrypts rajadmin phone and tests SimpleTexting API.
Uses Fernet directly (no project imports) to avoid dependency issues.

Required env vars:
  MONGODB_URL, ENCRYPTION_KEY, SIMPLETEXTING_API_TOKEN, SIMPLETEXTING_ACCOUNT_PHONE
"""
import asyncio
import os
import sys
import httpx
from cryptography.fernet import Fernet
from motor.motor_asyncio import AsyncIOMotorClient


def decrypt(value, key):
    if not value or not isinstance(value, str) or not value.startswith("gAAAAA"):
        return value
    try:
        return Fernet(key.encode() if isinstance(key, str) else key).decrypt(value.encode()).decode()
    except Exception as e:
        return f"DECRYPT_FAILED: {e}"


def normalize(phone):
    digits = "".join(filter(str.isdigit, str(phone or "")))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits if len(digits) == 10 else ""


async def main(do_send: bool):
    mongodb_url = os.getenv("MONGODB_URL")
    enc_key = os.getenv("ENCRYPTION_KEY")
    api_token = os.getenv("SIMPLETEXTING_API_TOKEN")
    account_phone = os.getenv("SIMPLETEXTING_ACCOUNT_PHONE")

    print("=" * 70)
    print("SMS DIAGNOSTIC")
    print("=" * 70)
    print(f"API Token: {(api_token[:8] + '...') if api_token else 'MISSING'}")
    print(f"Account Phone: {account_phone}")
    print()

    client = AsyncIOMotorClient(mongodb_url)
    db = client.matrimonialDB
    user = await db.users.find_one({"username": {"$regex": "^rajadmin$", "$options": "i"}})
    client.close()

    raw_phone = user.get("contactNumber")
    phone = decrypt(raw_phone, enc_key)
    print(f"Decrypted phone: {phone}")
    formatted = normalize(phone)
    print(f"Normalized (10-digit): {formatted}")
    print(f"smsOptIn: {user.get('smsOptIn')}")
    print()

    if not formatted:
        print("❌ Phone normalization failed - cannot send")
        return

    base_url = "https://api-app2.simpletexting.com/v2"
    headers = {"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"}

    # 1. Verify account-phones (validates token + sender number)
    print("-" * 70)
    print("1. GET /api/account-phones (validate token & sender)")
    async with httpx.AsyncClient(timeout=30.0) as c:
        try:
            r = await c.get(f"{base_url}/api/account-phones", headers=headers)
            print(f"   Status: {r.status_code}")
            print(f"   Body: {r.text[:600]}")
        except Exception as e:
            print(f"   Error: {e}")

    if not do_send:
        print("\n(Skipping actual send. Re-run with 'send' arg to send a real SMS.)")
        return

    # 2. Send the message
    payload = {
        "contactPhone": formatted,
        "accountPhone": account_phone,
        "text": "[L3V3LMATCHES | rajadmin] Login code: 654321\n\nExpires in 5 minutes.",
        "mode": "AUTO",
    }
    print("\n" + "-" * 70)
    print("2. POST /api/messages (real send)")
    print(f"   Payload: {payload}")
    async with httpx.AsyncClient(timeout=30.0) as c:
        try:
            r = await c.post(f"{base_url}/api/messages", headers=headers, json=payload)
            print(f"   Status: {r.status_code}")
            print(f"   Headers: {dict(r.headers)}")
            print(f"   Body: {r.text}")
        except Exception as e:
            print(f"   Error: {e}")


if __name__ == "__main__":
    do_send = len(sys.argv) > 1 and sys.argv[1] == "send"
    asyncio.run(main(do_send))
