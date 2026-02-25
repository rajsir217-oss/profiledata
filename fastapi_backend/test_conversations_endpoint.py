#!/usr/bin/env python3
"""
Test Conversations Endpoint
Check what the /messages/conversations endpoint returns
"""

import asyncio
import sys
import requests
import json

BASE_URL = "http://localhost:8000"

async def test_conversations_endpoint():
    """Test the conversations endpoint that the frontend calls"""
    
    print("🧪 Testing Conversations Endpoint")
    print("=" * 50)
    
    # Test 1: Without authentication (should fail)
    print("\n1️⃣ Testing without authentication:")
    try:
        response = requests.get(f"{BASE_URL}/api/users/messages/conversations")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 2: Try to login as admin with different passwords
    print("\n2️⃣ Testing admin login:")
    
    passwords_to_try = ["admin", "admin123", "Admin!2345", "password", "123456"]
    
    for password in passwords_to_try:
        try:
            login_data = {"username": "admin", "password": password}
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
            print(f"   Trying password '{password or 'empty'}': {login_response.status_code}")
            
            if login_response.status_code == 200:
                token = login_response.json().get("access_token")
                print("   ✅ Login successful!")
                
                # Test 3: With authentication
                print("\n3️⃣ Testing conversations endpoint with authentication:")
                headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                
                # Test both endpoints
                print("   Testing /api/users/messages/conversations:")
                conv_response1 = requests.get(f"{BASE_URL}/api/users/messages/conversations", headers=headers)
                print(f"      Status: {conv_response1.status_code}")
                
                if conv_response1.status_code == 200:
                    data = conv_response1.json()
                    print(f"      ✅ Conversations endpoint working!")
                    print(f"      Conversations count: {len(data.get('conversations', []))}")
                    
                    # Show first few conversations
                    conversations = data.get('conversations', [])
                    print(f"\n      First 3 conversations:")
                    for i, conv in enumerate(conversations[:3], 1):
                        print(f"      {i}. Username: {conv.get('username', 'unknown')}")
                        print(f"         Last message: {conv.get('lastMessage', 'No message')[:50]}...")
                        print(f"         Unread count: {conv.get('unreadCount', 0)}")
                        print()
                    break
                else:
                    print(f"      ❌ Conversations endpoint failed: {conv_response1.status_code}")
                    print(f"      Response: {conv_response1.text[:300]}")
                
                # Also test the unattended messages endpoint
                print("   Testing /api/users/messages/unattended:")
                unattended_response = requests.get(f"{BASE_URL}/api/users/messages/unattended", headers=headers)
                print(f"      Status: {unattended_response.status_code}")
                
                if unattended_response.status_code == 200:
                    unattended_data = unattended_response.json()
                    print(f"      ✅ Unattended messages endpoint working!")
                    print(f"      Total unattended: {unattended_data.get('unattendedCount', 0)}")
                    print(f"      Critical: {unattended_data.get('criticalCount', 0)}")
                    print(f"      High: {unattended_data.get('highCount', 0)}")
                    
                    # Show unattended conversations
                    unattended_convos = unattended_data.get('conversations', [])
                    print(f"\n      Unattended conversations ({len(unattended_convos)}):")
                    for i, conv in enumerate(unattended_convos[:3], 1):
                        sender = conv.get('sender', {})
                        urgency = conv.get('urgency', 'unknown')
                        waiting_days = conv.get('lastMessage', {}).get('waitingDays', 0)
                        message = conv.get('lastMessage', {}).get('message', 'No message')
                        
                        urgency_emoji = {
                            'critical': '🔴',
                            'high': '🟠',
                            'medium': '🟡',
                            'pending': '🔵'
                        }.get(urgency, '❓')
                        
                        print(f"      {i}. {urgency_emoji} {sender.get('username', 'unknown')} - {urgency} ({waiting_days} days)")
                        print(f"         Message: {message[:50]}...")
                else:
                    print(f"      ❌ Unattended messages endpoint failed: {unattended_response.status_code}")
                    print(f"      Response: {unattended_response.text[:300]}")
                break
            else:
                print(f"   Response: {login_response.text[:100]}")
        except Exception as e:
            print(f"   Error with password '{password}': {e}")
    
    print("\n✅ Test completed - check results above")

if __name__ == "__main__":
    asyncio.run(test_conversations_endpoint())
