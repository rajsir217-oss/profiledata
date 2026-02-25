#!/usr/bin/env python3
"""
Test Messages Generator
Creates test conversations with different urgency levels for testing the critical messages system
"""

import asyncio
import sys
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import DESCENDING
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env')

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "matrimonialDB")

class TestMessageGenerator:
    def __init__(self):
        self.client = AsyncIOMotorClient(MONGODB_URL)
        self.db = self.client[DATABASE_NAME]
        self.messages_collection = self.db.messages
        self.users_collection = self.db.users
        
    async def get_test_users(self):
        """Get existing users for testing"""
        users = await self.users_collection.find({"username": {"$ne": "admin"}}).limit(10).to_list(None)
        return users
    
    async def create_test_conversations(self, test_username="testuser1"):
        """Create test conversations with different urgency levels"""
        
        # Get test users
        test_users = await self.get_test_users()
        if not test_users:
            print("❌ No test users found. Please create some users first.")
            return
        
        # Define urgency levels and their waiting periods
        urgency_configs = [
            {"urgency": "critical", "days": 12, "message": "Hi! I've been waiting to hear back from you. Are you interested in connecting?"},
            {"urgency": "critical", "days": 15, "message": "Hello! I sent you a message a while ago. Would love to chat if you're available."},
            {"urgency": "high", "days": 8, "message": "Hi there! I'm really interested in getting to know you better."},
            {"urgency": "high", "days": 7, "message": "Hello! I came across your profile and would love to connect."},
            {"urgency": "medium", "days": 4, "message": "Hi! How are you doing? Would be nice to chat."},
            {"urgency": "medium", "days": 5, "message": "Hello! Hope you're having a good week."},
            {"urgency": "pending", "days": 2, "message": "Hi there! Just wanted to say hello."},
            {"urgency": "pending", "days": 1, "message": "Hello! Nice to meet you."},
        ]
        
        created_count = 0
        
        for i, config in enumerate(urgency_configs):
            if i >= len(test_users):
                break
                
            sender = test_users[i]
            receiver_username = test_username
            
            # Calculate timestamp based on urgency days
            timestamp = datetime.utcnow() - timedelta(days=config["days"])
            
            # Create test message
            message = {
                "from_username": sender["username"],
                "to_username": receiver_username,
                "message": config["message"],
                "timestamp": timestamp,
                "is_read": False,
                "created_at": timestamp,
                "updated_at": timestamp,
                "visibility": {
                    "from_user": True,
                    "to_user": True,
                    "admin_only": False
                }
            }
            
            # Check if message already exists
            existing = await self.messages_collection.find_one({
                "from_username": sender["username"],
                "to_username": receiver_username,
                "message": config["message"]
            })
            
            if existing:
                print(f"⚠️  Message from {sender['username']} already exists, skipping...")
                continue
            
            # Insert message
            result = await self.messages_collection.insert_one(message)
            
            if result.inserted_id:
                print(f"✅ Created {config['urgency']} message from {sender['username']} ({config['days']} days old)")
                created_count += 1
            else:
                print(f"❌ Failed to create message from {sender['username']}")
        
        print(f"\n🎉 Created {created_count} test messages for user '{test_username}'")
        
    async def create_two_way_conversations(self, test_username="testuser1"):
        """Create two-way conversations with replies"""
        
        test_users = await self.get_test_users()
        if not test_users:
            print("❌ No test users found.")
            return
        
        # Create conversations where test user replied to some but not others
        conversations = [
            {
                "sender": test_users[0] if len(test_users) > 0 else None,
                "receiver": test_username,
                "initial_message": "Hi! I'd love to get to know you better.",
                "reply": "Hi there! Thanks for reaching out. I'd like to chat too.",
                "reply_delay_days": 1,
                "status": "replied"
            },
            {
                "sender": test_users[1] if len(test_users) > 1 else None,
                "receiver": test_username,
                "initial_message": "Hello! How are you doing?",
                "reply": None,  # No reply - this will be urgent
                "reply_delay_days": None,
                "status": "pending"
            },
            {
                "sender": test_users[2] if len(test_users) > 2 else None,
                "receiver": test_username,
                "initial_message": "Hi! I think we might be a good match.",
                "reply": None,  # No reply - this will be urgent
                "reply_delay_days": None,
                "status": "pending"
            }
        ]
        
        created_count = 0
        
        for conv in conversations:
            if not conv["sender"]:
                continue
                
            sender = conv["sender"]
            
            # Create initial message
            initial_timestamp = datetime.utcnow() - timedelta(days=10)
            initial_message = {
                "from_username": sender["username"],
                "to_username": conv["receiver"],
                "message": conv["initial_message"],
                "timestamp": initial_timestamp,
                "is_read": True,
                "created_at": initial_timestamp,
                "updated_at": initial_timestamp,
                "visibility": {
                    "from_user": True,
                    "to_user": True,
                    "admin_only": False
                }
            }
            
            # Insert initial message
            result1 = await self.messages_collection.insert_one(initial_message)
            
            # Create reply if specified
            if conv["reply"]:
                reply_timestamp = initial_timestamp + timedelta(days=conv["reply_delay_days"])
                reply_message = {
                    "from_username": conv["receiver"],
                    "to_username": sender["username"],
                    "message": conv["reply"],
                    "timestamp": reply_timestamp,
                    "is_read": False,
                    "created_at": reply_timestamp,
                    "updated_at": reply_timestamp,
                    "visibility": {
                        "from_user": True,
                        "to_user": True,
                        "admin_only": False
                    }
                }
                
                result2 = await self.messages_collection.insert_one(reply_message)
                
                if result1.inserted_id and result2.inserted_id:
                    print(f"✅ Created two-way conversation with {sender['username']} (replied)")
                    created_count += 1
            else:
                if result1.inserted_id:
                    print(f"✅ Created one-way conversation with {sender['username']} (no reply)")
                    created_count += 1
        
        print(f"\n🎉 Created {created_count} two-way conversations")
    
    async def cleanup_test_messages(self, test_username="testuser1"):
        """Clean up test messages"""
        
        result = await self.messages_collection.delete_many({
            "$or": [
                {"from_username": test_username},
                {"to_username": test_username}
            ]
        })
        
        print(f"🧹 Cleaned up {result.deleted_count} test messages for '{test_username}'")
    
    async def show_urgent_messages(self, test_username="testuser1"):
        """Show current urgent messages for test user"""
        
        # Get messages sent TO test user that haven't been replied to
        pipeline = [
            {
                "$match": {
                    "to_username": test_username,
                    "is_read": False
                }
            },
            {
                "$sort": {"timestamp": DESCENDING}
            },
            {
                "$group": {
                    "_id": "$from_username",
                    "last_message": {"$first": "$$ROOT"},
                    "message_count": {"$sum": 1}
                }
            }
        ]
        
        conversations = await self.messages_collection.aggregate(pipeline).to_list(None)
        
        print(f"\n📬 Unattended conversations for '{test_username}':")
        print("=" * 60)
        
        for conv in conversations:
            last_msg = conv["last_message"]
            waiting_days = (datetime.utcnow() - last_msg["timestamp"]).days
            
            # Determine urgency
            if waiting_days >= 10:
                urgency = "🔴 CRITICAL"
            elif waiting_days >= 6:
                urgency = "🟠 HIGH"
            elif waiting_days >= 3:
                urgency = "🟡 MEDIUM"
            else:
                urgency = "🔵 PENDING"
            
            print(f"{urgency} {conv['_id']} - {waiting_days} days waiting")
            print(f"   Message: {last_msg['message'][:50]}...")
            print(f"   Sent: {last_msg['timestamp'].strftime('%Y-%m-%d %H:%M')}")
            print()
    
    async def close(self):
        """Close database connection"""
        self.client.close()

async def main():
    """Main function"""
    generator = TestMessageGenerator()
    
    try:
        print("🧪 Test Messages Generator")
        print("=" * 50)
        
        if len(sys.argv) < 2:
            print("Usage:")
            print("  python test_messages.py <command> [username]")
            print("\nCommands:")
            print("  create [username]  - Create test messages")
            print("  conversations [username] - Create two-way conversations")
            print("  show [username]   - Show urgent messages")
            print("  cleanup [username] - Clean up test messages")
            print("\nDefault username: testuser1")
            return
        
        command = sys.argv[1].lower()
        username = sys.argv[2] if len(sys.argv) > 2 else "testuser1"
        
        if command == "create":
            await generator.create_test_conversations(username)
        elif command == "conversations":
            await generator.create_two_way_conversations(username)
        elif command == "show":
            await generator.show_urgent_messages(username)
        elif command == "cleanup":
            await generator.cleanup_test_messages(username)
        else:
            print(f"❌ Unknown command: {command}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await generator.close()

if __name__ == "__main__":
    asyncio.run(main())
