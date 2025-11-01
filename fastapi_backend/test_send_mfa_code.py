"""
Test the MFA send-code endpoint
"""
import requests
import json

print("=" * 60)
print("Testing /api/auth/mfa/send-code")
print("=" * 60)

try:
    response = requests.post(
        "http://localhost:8000/api/auth/mfa/send-code",
        json={
            "username": "admin"
        },
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response:")
    print(json.dumps(response.json(), indent=2))
    
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"Status Code: {e.response.status_code}")
        try:
            print(f"Response: {e.response.json()}")
        except:
            print(f"Response Text: {e.response.text}")
