"""
Test what the backend returns when logging in with MFA enabled
"""
import requests
import json

# Test login without MFA code
print("=" * 60)
print("Testing Login WITHOUT MFA code (should return MFA_REQUIRED)")
print("=" * 60)

try:
    response = requests.post(
        "http://localhost:8000/api/auth/login",
        json={
            "username": "admin",
            "password": "admin123"  # Replace with actual password
        }
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"Response Body:")
    print(json.dumps(response.json(), indent=2))
    
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"Status Code: {e.response.status_code}")
        print(f"Response Body: {e.response.text}")

print("\n" + "=" * 60)
print("Expected: Status 403, detail='MFA_REQUIRED', mfa_channel='email'")
print("=" * 60)
