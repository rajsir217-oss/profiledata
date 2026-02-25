#!/usr/bin/env python3
"""
Test Admin Messages System
Tests the critical messages system using the admin user
"""

import asyncio
import sys
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

class AdminMessagesTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.username = "admin"
        self.password = "admin123"  # Try common admin password
    
    async def test_login(self):
        """Test admin login"""
        print("🔐 Testing Admin Login...")
        
        login_data = {
            "username": self.username,
            "password": self.password
        }
        
        try:
            response = requests.post(f"{self.base_url}/api/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                print(f"✅ Admin login successful!")
                return True
            else:
                print(f"❌ Admin login failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    async def test_unattended_messages(self):
        """Test unattended messages endpoint"""
        print("\n📬 Testing Admin Unattended Messages...")
        
        if not self.token:
            print("❌ No token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.get(f"{self.base_url}/api/messages/unattended", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Unattended messages endpoint working!")
                print(f"   Total unattended: {data.get('unattendedCount', 0)}")
                print(f"   Critical: {data.get('criticalCount', 0)}")
                print(f"   High: {data.get('highCount', 0)}")
                print(f"   Medium: {data.get('mediumCount', 0)}")
                
                # Show individual conversations
                conversations = data.get('conversations', [])
                print(f"\n   Individual Conversations:")
                for i, conv in enumerate(conversations):
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
                    
                    print(f"   {i+1}. {urgency_emoji} {sender.get('username', 'unknown')} - {urgency} ({waiting_days} days)")
                    print(f"      Message: {message[:50]}...")
                
                return True
            else:
                print(f"❌ Unattended messages failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Unattended messages error: {e}")
            return False
    
    async def test_conversations(self):
        """Test conversations endpoint"""
        print("\n💬 Testing Admin Conversations...")
        
        if not self.token:
            print("❌ No token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.get(f"{self.base_url}/api/messages/conversations", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                conversations = data.get('conversations', [])
                print(f"✅ Conversations endpoint working!")
                print(f"   Found {len(conversations)} conversations")
                
                # Show first few conversations
                for i, conv in enumerate(conversations[:5]):
                    print(f"   {i+1}. {conv.get('username', 'unknown')} - {conv.get('unreadCount', 0)} unread")
                    print(f"      Last message: {conv.get('lastMessage', 'No message')[:50]}...")
                
                return True
            else:
                print(f"❌ Conversations failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Conversations error: {e}")
            return False
    
    async def test_direct_db_check(self):
        """Test direct database check to verify messages exist"""
        print("\n🗄️ Testing Direct Database Check...")
        
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            from dotenv import load_dotenv
            import os
            
            load_dotenv('.env')
            client = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))
            db = client[os.getenv('DATABASE_NAME', 'matrimonialDB')]
            
            # Check messages to admin
            messages = await db.messages.find({'to_username': 'admin', 'is_read': False}).sort('timestamp', -1).to_list(None)
            
            print(f"✅ Found {len(messages)} unattended messages to admin")
            
            for msg in messages:
                waiting_days = (datetime.utcnow() - msg['timestamp']).days
                
                if waiting_days >= 10:
                    urgency = '🔴 CRITICAL'
                elif waiting_days >= 6:
                    urgency = '🟠 HIGH'
                elif waiting_days >= 3:
                    urgency = '🟡 MEDIUM'
                else:
                    urgency = '🔵 PENDING'
                
                print(f"   {urgency} {msg['from_username']} - {waiting_days} days waiting")
                print(f"      Message: {msg['message'][:50]}...")
            
            client.close()
            return True
            
        except Exception as e:
            print(f"❌ Database check error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all tests"""
        print("🧪 Admin Messages System Test")
        print("=" * 50)
        
        tests = [
            ("Direct Database Check", self.test_direct_db_check),
            ("Admin Login", self.test_login),
            ("Unattended Messages", self.test_unattended_messages),
            ("Conversations", self.test_conversations),
        ]
        
        results = []
        
        for test_name, test_func in tests:
            try:
                result = await test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} test crashed: {e}")
                results.append((test_name, False))
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 Test Results Summary:")
        print("=" * 50)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"   {test_name}: {status}")
            if result:
                passed += 1
        
        print(f"\n   Overall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Admin messages system is working correctly.")
            print("\n📝 Next steps:")
            print("   1. Login to the frontend as admin")
            print("   2. Navigate to the Messages page")
            print("   3. You should see:")
            print("      - Critical banner with 2 critical messages")
            print("      - Conversations sorted by urgency")
            print("      - Quick action buttons for critical/high messages")
            print("      - Enhanced visual design with animations")
        else:
            print("⚠️  Some tests failed. Please check the logs above.")
        
        return passed == total

async def main():
    """Main function"""
    tester = AdminMessagesTester()
    success = await tester.run_all_tests()
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
