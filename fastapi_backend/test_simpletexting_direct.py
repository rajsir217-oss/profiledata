"""
Direct SimpleTexting API test - diagnose why SMS is not being delivered
Sends a real test message and prints the FULL API response.
"""
import asyncio
import os
import sys
import httpx


async def test_send(phone: str):
    api_token = os.getenv("SIMPLETEXTING_API_TOKEN")
    account_phone = os.getenv("SIMPLETEXTING_ACCOUNT_PHONE")

    print("=" * 70)
    print("SimpleTexting Direct API Test")
    print("=" * 70)
    print(f"API Token: {api_token[:8]}...{api_token[-4:] if api_token else 'NONE'}")
    print(f"Account Phone: {account_phone}")
    print(f"Target Phone: {phone}")
    print()

    if not api_token or not account_phone:
        print("❌ Missing credentials")
        return

    # Normalize phone (same logic as production)
    digits = "".join(filter(str.isdigit, str(phone or "")))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    formatted_phone = digits if len(digits) == 10 else ""
    print(f"Normalized phone: {formatted_phone}")

    if not formatted_phone:
        print("❌ Phone normalization failed")
        return

    base_url = "https://api-app2.simpletexting.com/v2"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "contactPhone": formatted_phone,
        "accountPhone": account_phone,
        "text": "[L3V3LMATCHES] TEST: Your login code is 123456. Expires in 5 minutes.",
        "mode": "AUTO"
    }

    print("\nPayload:")
    print(payload)
    print()

    # 1. Check account info first
    print("-" * 70)
    print("1. Checking account info...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            acct_resp = await client.get(
                f"{base_url}/api/account-phones",
                headers=headers
            )
            print(f"   Status: {acct_resp.status_code}")
            print(f"   Body: {acct_resp.text[:500]}")
        except Exception as e:
            print(f"   Error: {e}")

    # 2. Try sending the message
    print("\n" + "-" * 70)
    print("2. Sending test message...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{base_url}/api/messages",
                headers=headers,
                json=payload
            )
            print(f"   Status Code: {response.status_code}")
            print(f"   Response Headers: {dict(response.headers)}")
            print(f"   Response Body: {response.text}")
        except Exception as e:
            print(f"   Error: {e}")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 test_simpletexting_direct.py <phone_number>")
        print("Example: python3 test_simpletexting_direct.py 2035551234")
        sys.exit(1)
    asyncio.run(test_send(sys.argv[1]))
