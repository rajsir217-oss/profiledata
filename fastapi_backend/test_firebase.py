"""
Quick test script to verify Firebase Cloud Messaging connection
Run this to make sure Firebase is properly configured
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

print("🔥 Testing Firebase Configuration...")
print("=" * 60)

# Check environment variables
print(f"Project ID: {os.getenv('FIREBASE_PROJECT_ID')}")
print(f"Client Email: {os.getenv('FIREBASE_CLIENT_EMAIL')}")
print(f"Private Key ID: {os.getenv('FIREBASE_PRIVATE_KEY_ID')}")
print(f"Private Key (first 50 chars): {os.getenv('FIREBASE_PRIVATE_KEY')[:50]}...")
print("=" * 60)

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
