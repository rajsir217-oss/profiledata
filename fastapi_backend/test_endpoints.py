#!/usr/bin/env python3
"""
Test API Endpoints
Test the critical messages system endpoints
"""

import asyncio
import sys
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

class EndpointTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.username = "testuser123"
        self.password = "test123"
    
    async def login(self):
        """Login and get JWT token"""
        
        login_data = {
            "username": self.username,
            "password": self.password
        }
        
        try:
            response = requests.post(f"{self.base_url}/api/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                print(f"✅ Logged in as '{self.username}'")
                return True
            else:
                print(f"❌ Login failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    async def test_unattended_endpoint(self):
        """Test the unattended messages endpoint"""
        
        if not self.token:
            print("❌ No token available")
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.get(f"{self.base_url}/api/messages/unattended", headers=headers)
            
            print(f"\n📬 Unattended Messages Endpoint:")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success!")
                print(f"Total unattended: {data.get('unattendedCount', 0)}")
                print(f"Critical: {data.get('criticalCount', 0)}")
                print(f"High: {data.get('highCount', 0)}")
                print(f"Medium: {data.get('mediumCount', 0)}")
                
                # Show individual conversations
                conversations = data.get('conversations', [])
                print(f"\nConversations:")
                for conv in conversations:
                    sender = conv.get('sender', {})
                    urgency = conv.get('urgency', 'unknown')
                    waiting_days = conv.get('lastMessage', {}).get('waitingDays', 0)
                    print(f"  • {sender.get('username', 'unknown')} - {urgency} ({waiting_days} days)")
            else:
                print(f"❌ Failed: {response.text}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    async def test_conversations_endpoint(self):
        """Test the conversations endpoint"""
        
        if not self.token:
            print("❌ No token available")
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.get(f"{self.base_url}/api/messages/conversations", headers=headers)
            
            print(f"\n💬 Conversations Endpoint:")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                conversations = data.get('conversations', [])
                print(f"✅ Success! Found {len(conversations)} conversations")
                
                # Show first few conversations
                for i, conv in enumerate(conversations[:5]):
                    print(f"  {i+1}. {conv.get('username', 'unknown')} - {conv.get('lastMessage', 'No message')[:30]}...")
            else:
                print(f"❌ Failed: {response.text}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    async def test_send_message(self, to_username="testuser2"):
        """Test sending a message"""
        
        if not self.token:
            print("❌ No token available")
            return
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        message_data = {
            "toUsername": to_username,
            "content": "Hi! This is a test message from the API test."
        }
        
        try:
            response = requests.post(f"{self.base_url}/api/messages/send?username={self.username}", 
                                  json=message_data, headers=headers)
            
            print(f"\n📤 Send Message Endpoint:")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Message sent successfully!")
                print(f"Message ID: {data.get('data', {}).get('_id', 'unknown')}")
            else:
                print(f"❌ Failed: {response.text}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

async def main():
    """Main function"""
    
    tester = EndpointTester()
    
    print("🧪 API Endpoint Tester")
    print("=" * 50)
    
    # Login first
    if not await tester.login():
        print("❌ Cannot proceed without login")
        return
    
    # Test endpoints
    await tester.test_unattended_endpoint()
    await tester.test_conversations_endpoint()
    await tester.test_send_message()
    
    print("\n🎉 Testing complete!")

if __name__ == "__main__":
    asyncio.run(main())
