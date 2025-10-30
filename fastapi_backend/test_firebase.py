"""
Quick test script to verify Firebase Cloud Messaging connection
Run this to make sure Firebase is properly configured
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Get the directory where this script is located
script_dir = Path(__file__).parent

# Load environment variables from the fastapi_backend directory
env_path = script_dir / '.env.local'
load_dotenv(env_path)

print("🔥 Testing Firebase Configuration...")
print("=" * 60)

# Check environment variables
project_id = os.getenv('FIREBASE_PROJECT_ID')
client_email = os.getenv('FIREBASE_CLIENT_EMAIL')
private_key_id = os.getenv('FIREBASE_PRIVATE_KEY_ID')
private_key = os.getenv('FIREBASE_PRIVATE_KEY')

print(f"Project ID: {project_id}")
print(f"Client Email: {client_email}")
print(f"Private Key ID: {private_key_id}")
if private_key:
    print(f"Private Key (first 50 chars): {private_key[:50]}...")
else:
    print("Private Key: Not found")
print("=" * 60)

# Check if all required variables are present
if not all([project_id, client_email, private_key_id, private_key]):
    print("\n❌ ERROR: Missing Firebase environment variables!")
    print(f"\nLooked for .env.local at: {env_path}")
    print(f"File exists: {env_path.exists()}")
    print("\nMake sure you have .env.local in the fastapi_backend directory with:")
    print("  - FIREBASE_PROJECT_ID")
    print("  - FIREBASE_CLIENT_EMAIL")
    print("  - FIREBASE_PRIVATE_KEY_ID")
    print("  - FIREBASE_PRIVATE_KEY")
    exit(1)

# Try to initialize Firebase
try:
    from services.push_service import PushNotificationService
    
    print("\n✅ Initializing Firebase Admin SDK...")
    push_service = PushNotificationService()
    print("✅ Firebase Admin SDK initialized successfully!")
    print("\n🎉 SUCCESS! Firebase is properly configured.")
    print("\nYou can now:")
    print("  1. Start the backend server")
    print("  2. Create a push_notifier job in Dynamic Scheduler")
    print("  3. Send test notifications via /api/push-subscriptions/test")
    
except Exception as e:
    print(f"\n❌ ERROR: Failed to initialize Firebase")
    print(f"Error: {str(e)}")
    print("\nTroubleshooting:")
    print("  1. Check that .env.local has all Firebase variables set")
    print("  2. Verify the private key includes \\n for newlines")
    print("  3. Make sure firebase-admin is installed: pip install firebase-admin")
    exit(1)
