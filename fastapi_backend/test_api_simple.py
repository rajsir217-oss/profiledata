#!/usr/bin/env python3
"""
Simple test to verify the inactive users API is working
"""

import requests
import json

def test_api():
    """Test the inactive users API endpoint"""
    
    print("🔍 Testing Inactive Users API")
    print("=" * 40)
    
    # Test the main endpoint
    url = "http://localhost:8000/api/admin/inactive-users"
    
    try:
        print(f"Testing GET {url}")
        response = requests.get(url)
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response Data: {json.dumps(data, indent=2)}")
            
            if 'users' in data:
                print(f"✅ Found {len(data['users'])} inactive users")
                for user in data['users'][:3]:  # Show first 3 users
                    print(f"  - {user.get('username', 'Unknown')}: {user.get('daysElapsed', 'N/A')} days")
            else:
                print("❌ No 'users' field in response")
                
        elif response.status_code == 401:
            print("❌ Authentication required - need admin token")
        elif response.status_code == 403:
            print("❌ Admin access required")
        elif response.status_code == 404:
            print("❌ Endpoint not found - check if server is running")
        else:
            print(f"❌ Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error - Backend server not running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 40)

if __name__ == "__main__":
    test_api()
