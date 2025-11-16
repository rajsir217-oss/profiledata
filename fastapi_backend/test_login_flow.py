#!/usr/bin/env python3
"""
Test the full login flow to see where it's failing
"""

import asyncio
import httpx
import sys

async def test_login():
    base_url = "http://localhost:8000"
    
    print("🔍 Testing Login Flow...\n")
    
    # Step 1: Try login without MFA code
    print("Step 1: Login attempt (should return MFA_REQUIRED)")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/api/users/login",
                json={
                    "username": "admin",
                    "password": "admin123"  # Update with actual password
                }
            )
            
            print(f"Status: {response.status_code}")
            print(f"Response: {response.json()}\n")
            
            if response.status_code == 403:
                data = response.json()
                if data.get("detail") == "MFA_REQUIRED":
                    print("✅ MFA correctly required")
                    print(f"   Channel: {data.get('mfa_channel')}")
                    print(f"   Contact: {data.get('contact_masked')}")
                    
                    # Step 2: Try to send MFA code
                    print("\nStep 2: Requesting MFA code...")
                    send_response = await client.post(
                        f"{base_url}/api/auth/mfa/send-code",
                        json={
                            "username": "admin",
                            "channel": "sms"
                        }
                    )
                    
                    print(f"Status: {send_response.status_code}")
                    print(f"Response: {send_response.json()}")
                    
                    if send_response.status_code == 200:
                        print("\n✅ MFA code sent successfully!")
                        print("📱 Check phone for SMS")
                    else:
                        print(f"\n❌ Failed to send MFA code")
                        print(f"   Error: {send_response.json()}")
                else:
                    print(f"❌ Unexpected 403: {data}")
            elif response.status_code == 200:
                print("✅ Login successful (MFA not enabled?)")
            else:
                print(f"❌ Unexpected status: {response.status_code}")
                print(f"   Response: {response.json()}")
                
    except httpx.ConnectError:
        print("❌ Cannot connect to backend at localhost:8000")
        print("   Is the backend running?")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_login())
