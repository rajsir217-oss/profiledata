"""
Test login to see exact response when MFA is required
"""
import requests
import json

print("=" * 60)
print("Testing Login with MFA Enabled Account")
print("=" * 60)

try:
    response = requests.post(
        "http://localhost:8000/api/users/login",
        json={
            "username": "admin",
            "password": "admin123"  # Replace with actual password
        },
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"\nHeaders:")
    for key, value in response.headers.items():
        print(f"  {key}: {value}")
    print(f"\nResponse Body:")
    print(json.dumps(response.json(), indent=2))
    
except requests.exceptions.HTTPError as e:
    print(f"HTTP Error: {e}")
    print(f"Status Code: {e.response.status_code}")
    print(f"Response: {e.response.text}")
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"Status Code: {e.response.status_code}")
        print(f"Response:")
        try:
            print(json.dumps(e.response.json(), indent=2))
        except:
            print(e.response.text)

print("\n" + "=" * 60)
print("Expected: Status 403, detail='MFA_REQUIRED'")
print("=" * 60)
