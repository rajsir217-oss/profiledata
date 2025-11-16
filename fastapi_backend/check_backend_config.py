#!/usr/bin/env python3
"""
Check what configuration the running backend actually has
"""

import httpx
import asyncio

async def check():
    print("🔍 Checking backend SMS configuration...\n")
    
    # Test if backend can send SMS
    try:
        async with httpx.AsyncClient() as client:
            # Try to trigger SMS send
            response = await client.post(
                "http://localhost:8000/api/auth/mfa/send-code",
                json={
                    "username": "admin",
                    "channel": "sms"
                }
            )
            
            result = response.json()
            print(f"Status: {response.status_code}")
            print(f"Response: {result}\n")
            
            if result.get("success"):
                if "EMAIL" in result.get("message", "").upper():
                    print("❌ SMS FAILED - Fell back to EMAIL")
                    print("   This means SimpleTexting service is not enabled")
                    print("\n🔧 Backend needs restart to load new .env.local")
                elif "SMS" in result.get("message", "").upper():
                    print("✅ SMS sent successfully via SimpleTexting!")
            else:
                print(f"❌ Failed: {result.get('message')}")
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
