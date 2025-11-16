#!/usr/bin/env python3
"""
Test all endpoints to ensure PII is decrypted properly
"""

import asyncio
import httpx
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

# Test admin login to get auth
ADMIN_USERNAME = "admin"

async def test_endpoint(name: str, url: str, headers: Dict[str, str] = None) -> Dict[str, Any]:
    """Test an endpoint and check for encrypted data"""
    print(f"\n🧪 Testing: {name}")
    print(f"   URL: {url}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers or {})
            
            if response.status_code != 200:
                print(f"   ⚠️  Status: {response.status_code}")
                return {"passed": False, "reason": f"HTTP {response.status_code}"}
            
            data = response.json()
            
            # Check for encrypted strings (starts with 'gAAAAA')
            encrypted_found = check_for_encrypted_data(data)
            
            if encrypted_found:
                print(f"   ❌ FAILED - Found encrypted PII:")
                for item in encrypted_found:
                    print(f"      {item}")
                return {"passed": False, "encrypted": encrypted_found}
            else:
                print(f"   ✅ PASSED - No encrypted PII found")
                return {"passed": True}
                
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        return {"passed": False, "error": str(e)}

def check_for_encrypted_data(data: Any, path: str = "") -> list:
    """Recursively check for encrypted strings in response data"""
    encrypted = []
    
    if isinstance(data, dict):
        for key, value in data.items():
            new_path = f"{path}.{key}" if path else key
            encrypted.extend(check_for_encrypted_data(value, new_path))
    
    elif isinstance(data, list):
        for i, item in enumerate(data):
            new_path = f"{path}[{i}]"
            encrypted.extend(check_for_encrypted_data(item, new_path))
    
    elif isinstance(data, str) and data.startswith('gAAAAA'):
        encrypted.append(f"{path}: {data[:50]}...")
    
    return encrypted

async def main():
    print("=" * 60)
    print("🔍 PII Decryption Test Suite")
    print("=" * 60)
    
    # Test endpoints
    results = {}
    
    # 1. Profile Views
    results["profile_views"] = await test_endpoint(
        "Profile Views",
        f"{BASE_URL}/api/users/profile-views/admin"
    )
    
    # 2. PII Requests - Incoming
    results["pii_requests_incoming"] = await test_endpoint(
        "PII Requests (Incoming)",
        f"{BASE_URL}/api/users/pii-requests/admin/incoming"
    )
    
    # 3. PII Requests - Outgoing
    results["pii_requests_outgoing"] = await test_endpoint(
        "PII Requests (Outgoing)",
        f"{BASE_URL}/api/users/pii-requests/admin/outgoing"
    )
    
    # 4. Exclusions (Not Interested)
    results["exclusions"] = await test_endpoint(
        "Exclusions (Not Interested)",
        f"{BASE_URL}/api/users/exclusions/admin"
    )
    
    # 5. Favorites
    results["favorites"] = await test_endpoint(
        "Favorites",
        f"{BASE_URL}/api/users/favorites/admin"
    )
    
    # 6. Shortlist
    results["shortlist"] = await test_endpoint(
        "Shortlist",
        f"{BASE_URL}/api/users/shortlist/admin"
    )
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    
    passed = sum(1 for r in results.values() if r.get("passed"))
    total = len(results)
    
    for name, result in results.items():
        status = "✅ PASS" if result.get("passed") else "❌ FAIL"
        print(f"{status} {name}")
        if not result.get("passed") and "encrypted" in result:
            print(f"      Encrypted fields: {len(result['encrypted'])}")
    
    print(f"\n📈 Score: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! No encrypted PII found in responses.")
    else:
        print("\n⚠️  Some tests failed. Review the output above.")

if __name__ == "__main__":
    asyncio.run(main())
