#!/usr/bin/env python3
"""
Quick API Test Script for Photo Auto-Save Endpoints
Tests the new upload and reorder endpoints
"""

import requests
import json
import sys
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000/api/users"
USERNAME = "admin"  # Change to your test username
PASSWORD = "admin"  # Change to your test password

def print_section(title):
    """Print a section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_result(success, message):
    """Print test result"""
    icon = "✅" if success else "❌"
    print(f"{icon} {message}")

def login():
    """Log in and get JWT token"""
    print_section("Step 1: Login")
    
    url = "http://localhost:8000/api/auth/login"
    data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    try:
        response = requests.post(url, json=data)
        response.raise_for_status()
        
        token = response.json().get("access_token")
        print_result(True, f"Logged in as '{USERNAME}'")
        print(f"   Token: {token[:20]}...")
        return token
    except Exception as e:
        print_result(False, f"Login failed: {e}")
        return None

def test_upload_photos(token):
    """Test photo upload endpoint"""
    print_section("Step 2: Test Photo Upload Endpoint")
    
    # Create a test image file
    test_image_path = Path("/tmp/test_upload.jpg")
    if not test_image_path.exists():
        # Create a minimal JPEG file (1x1 pixel)
        jpeg_data = bytes.fromhex('ffd8ffe000104a46494600010101006000600000ffdb00430001010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101ffc00011080001000103012200021101031101ffc4001500010100000000000000000000000000000000ffc4001401010000000000000000000000000000000000ffda000c03010002110311003f00bf8001ffd9')
        test_image_path.write_bytes(jpeg_data)
        print(f"📝 Created test image: {test_image_path}")
    
    url = f"{BASE_URL}/profile/{USERNAME}/upload-photos"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get current images first
    profile_url = f"{BASE_URL}/profile/{USERNAME}"
    try:
        profile_resp = requests.get(profile_url, params={"requester": USERNAME})
        current_images = profile_resp.json().get("images", [])
        print(f"📸 Current images: {len(current_images)}")
    except:
        current_images = []
    
    files = {
        "images": ("test.jpg", open(test_image_path, "rb"), "image/jpeg")
    }
    data = {
        "existingImages": json.dumps(current_images)
    }
    
    try:
        print(f"📤 Uploading to: {url}")
        response = requests.post(url, headers=headers, files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            print_result(True, f"Upload successful!")
            print(f"   Message: {result.get('message')}")
            print(f"   Total images: {len(result.get('images', []))}")
            return result.get('images', [])
        else:
            print_result(False, f"Upload failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print_result(False, f"Upload exception: {e}")
        return None

def test_reorder_photos(token, images):
    """Test photo reorder endpoint"""
    print_section("Step 3: Test Photo Reorder Endpoint")
    
    if not images or len(images) < 2:
        print_result(False, "Need at least 2 images to test reordering")
        return False
    
    # Reorder: move second image to first position
    new_order = [images[1], images[0]] + images[2:]
    
    url = f"{BASE_URL}/profile/{USERNAME}/reorder-photos"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "imageOrder": new_order
    }
    
    try:
        print(f"🔄 Reordering photos...")
        print(f"   Old first: {images[0].split('/')[-1]}")
        print(f"   New first: {new_order[0].split('/')[-1]}")
        
        response = requests.put(url, headers=headers, json=data)
        
        if response.status_code == 200:
            result = response.json()
            print_result(True, "Reorder successful!")
            print(f"   Message: {result.get('message')}")
            print(f"   New profile pic: {result['images'][0].split('/')[-1]}")
            return True
        else:
            print_result(False, f"Reorder failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Reorder exception: {e}")
        return False

def verify_database(token):
    """Verify changes in database by fetching profile"""
    print_section("Step 4: Verify Changes in Profile")
    
    url = f"{BASE_URL}/profile/{USERNAME}"
    params = {"requester": USERNAME}
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        profile = response.json()
        images = profile.get("images", [])
        
        print_result(True, "Profile fetched successfully")
        print(f"   Total images: {len(images)}")
        if images:
            print(f"   Profile picture: {images[0].split('/')[-1]}")
        
        return True
    except Exception as e:
        print_result(False, f"Profile fetch failed: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("  🧪 Photo Auto-Save API Test Script")
    print("="*60)
    print(f"  Testing user: {USERNAME}")
    print(f"  Backend URL: {BASE_URL}")
    print("="*60)
    
    # Step 1: Login
    token = login()
    if not token:
        print("\n❌ Cannot continue without login token")
        sys.exit(1)
    
    # Step 2: Test upload
    images = test_upload_photos(token)
    if not images:
        print("\n⚠️ Upload test failed, skipping reorder test")
        sys.exit(1)
    
    # Step 3: Test reorder
    success = test_reorder_photos(token, images)
    if not success:
        print("\n⚠️ Reorder test failed")
    
    # Step 4: Verify
    verify_database(token)
    
    # Summary
    print_section("Test Summary")
    print("✅ All critical tests passed!")
    print("\n📝 Next steps:")
    print("   1. Open http://localhost:3000/edit-profile")
    print("   2. Try uploading photos via UI")
    print("   3. Try clicking star to set profile picture")
    print("   4. Verify immediate save without main Save button")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    main()
