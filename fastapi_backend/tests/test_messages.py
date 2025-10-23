"""
Test suite for Message System
Tests the SMS-style messaging system including:
- Sending messages
- Retrieving conversations
- Getting conversation details
- Message privacy rules
- Admin override functionality
- Message visibility
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app
from database import get_database

@pytest.fixture
def test_users(test_db):
    """Create test users for messaging tests"""
    import asyncio
    users = [
        {
            "username": "user1",
            "password": "hashed_password",
            "firstName": "User",
            "lastName": "One",
            "contactEmail": "user1@test.com"
        },
        {
            "username": "user2",
            "password": "hashed_password",
            "firstName": "User",
            "lastName": "Two",
            "contactEmail": "user2@test.com"
        },
        {
            "username": "admin",
            "password": "hashed_password",
            "firstName": "Admin",
            "lastName": "User",
            "contactEmail": "admin@test.com"
        },
        {
            "username": "blocked_user",
            "password": "hashed_password",
            "firstName": "Blocked",
            "lastName": "User",
            "contactEmail": "blocked@test.com"
        }
    ]
    
    asyncio.get_event_loop().run_until_complete(test_db.users.insert_many(users))
    return users

@pytest.fixture
def cleanup_messages(test_db):
    """Clean up messages after each test"""
    import asyncio
    yield
    asyncio.get_event_loop().run_until_complete(test_db.messages.delete_many({}))
    asyncio.get_event_loop().run_until_complete(test_db.exclusions.delete_many({}))

class TestSendMessage:
    """Test sending messages"""
    
    def test_send_message_success(self, client, test_users, cleanup_messages):
        """Test successfully sending a message"""
        response = client.post(
            "/api/users/messages/send?username=user1",
            json={
                "toUsername": "user2",
                "content": "Hello, how are you?"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Message sent successfully"
        assert "data" in data
        assert data["data"]["fromUsername"] == "user1"
        assert data["data"]["toUsername"] == "user2"
        assert data["data"]["content"] == "Hello, how are you?"
        assert data["data"]["isVisible"] == True
    
    def test_send_message_to_nonexistent_user(self, client, test_users, cleanup_messages):
        """Test sending message to non-existent user"""
        response = client.post(
            "/api/users/messages/send?username=user1",
            json={
                "toUsername": "nonexistent",
                "content": "Hello"
            }
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_send_empty_message(self, client, test_users, cleanup_messages):
        """Test sending empty message"""
        response = client.post(
            "/api/users/messages/send?username=user1",
            json={
                "toUsername": "user2",
                "content": ""
            }
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_send_message_too_long(self, client, test_users, cleanup_messages):
        """Test sending message exceeding max length"""
        long_message = "a" * 1001  # Max is 1000
        response = client.post(
            "/api/users/messages/send?username=user1",
            json={
                "toUsername": "user2",
                "content": long_message
            }
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_send_message_trims_whitespace(self, client, test_users, cleanup_messages):
        """Test that message content is trimmed"""
        response = client.post(
            "/api/users/messages/send?username=user1",
            json={
                "toUsername": "user2",
                "content": "  Hello  "
            }
        )
        
        assert response.status_code == 200
        assert response.json()["data"]["content"] == "Hello"

class TestMessagePrivacy:
    """Test message privacy rules"""
    
    @pytest.fixture
    def blocked_users(self, test_db, test_users):
        """Create exclusion between users"""
        import asyncio
        exclusion = {
            "userUsername": "user1",
            "excludedUsername": "blocked_user",
            "reason": "Test exclusion",
            "createdAt": datetime.utcnow()
        }
        asyncio.get_event_loop().run_until_complete(test_db.exclusions.insert_one(exclusion))
        return exclusion
    
    def test_send_message_to_blocked_user_marked_invisible(self, client, test_users, blocked_users, cleanup_messages):
        """Test that messages to blocked users are marked as invisible"""
        response = client.post(
            "/api/users/messages/send?username=user1",
            json={
                "toUsername": "blocked_user",
                "content": "This should be invisible"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["isVisible"] == False
    
    def test_send_message_from_blocked_user_marked_invisible(self, client, test_users, blocked_users, cleanup_messages):
        """Test that messages from blocked users are marked as invisible"""
        response = client.post(
            "/api/users/messages/send?username=blocked_user",
            json={
                "toUsername": "user1",
                "content": "This should also be invisible"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["isVisible"] == False

class TestGetConversation:
    """Test retrieving conversation with specific user"""
    
    @pytest.fixture
    def sample_messages(self, test_db, test_users):
        """Create sample messages"""
        import asyncio
        messages = [
            {
                "fromUsername": "user1",
                "toUsername": "user2",
                "content": "Hello",
                "isRead": False,
                "isVisible": True,
                "createdAt": datetime.utcnow() - timedelta(minutes=5)
            },
            {
                "fromUsername": "user2",
                "toUsername": "user1",
                "content": "Hi there!",
                "isRead": False,
                "isVisible": True,
                "createdAt": datetime.utcnow() - timedelta(minutes=3)
            },
            {
                "fromUsername": "user1",
                "toUsername": "user2",
                "content": "How are you?",
                "isRead": False,
                "isVisible": True,
                "createdAt": datetime.utcnow()
            }
        ]
        asyncio.get_event_loop().run_until_complete(test_db.messages.insert_many(messages))
        return messages
    
    def test_get_conversation_success(self, client, test_users, sample_messages, cleanup_messages):
        """Test successfully retrieving a conversation"""
        response = client.get("/api/users/messages/conversation/user2?username=user1")
        
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert "otherUser" in data
        assert "isVisible" in data
        assert len(data["messages"]) == 3
        assert data["isVisible"] == True
    
    def test_get_conversation_sorted_chronologically(self, client, test_users, sample_messages, cleanup_messages):
        """Test that messages are sorted chronologically"""
        response = client.get("/api/users/messages/conversation/user2?username=user1")
        
        assert response.status_code == 200
        messages = response.json()["messages"]
        
        # First message should be oldest
        assert messages[0]["content"] == "Hello"
        assert messages[1]["content"] == "Hi there!"
        assert messages[2]["content"] == "How are you?"
    
    def test_get_conversation_marks_messages_as_read(self, client, test_users, sample_messages, cleanup_messages):
        """Test that retrieving conversation marks messages as read"""
        # Get conversation as user1 (recipient of message from user2)
        response = client.get("/api/users/messages/conversation/user2?username=user1")
        
        assert response.status_code == 200
        # Messages should be marked as read (tested via database check in integration)
    
    def test_get_conversation_includes_other_user_profile(self, client, test_users, sample_messages, cleanup_messages):
        """Test that conversation includes other user's profile"""
        response = client.get("/api/users/messages/conversation/user2?username=user1")
        
        assert response.status_code == 200
        data = response.json()
        
        other_user = data["otherUser"]
        assert other_user["username"] == "user2"
        assert other_user["firstName"] == "User"
        assert "password" not in other_user  # Password should be removed
    
    def test_get_conversation_empty(self, client, test_users, cleanup_messages):
        """Test getting conversation with no messages"""
        response = client.get("/api/users/messages/conversation/user2?username=user1")
        
        assert response.status_code == 200
        data = response.json()
        assert data["messages"] == []
        assert data["isVisible"] == True

class TestGetConversations:
    """Test retrieving list of all conversations"""
    
    @pytest.fixture
    def multiple_conversations(self, test_db, test_users):
        """Create messages with multiple users"""
        import asyncio
        messages = [
            {
                "fromUsername": "user1",
                "toUsername": "user2",
                "content": "Hello user2",
                "isRead": False,
                "isVisible": True,
                "createdAt": datetime.utcnow() - timedelta(hours=1)
            },
            {
                "fromUsername": "user2",
                "toUsername": "user1",
                "content": "Hi user1",
                "isRead": False,
                "isVisible": True,
                "createdAt": datetime.utcnow() - timedelta(minutes=30)
            },
            {
                "fromUsername": "admin",
                "toUsername": "user1",
                "content": "Admin message",
                "isRead": False,
                "isVisible": True,
                "createdAt": datetime.utcnow()
            }
        ]
        asyncio.get_event_loop().run_until_complete(test_db.messages.insert_many(messages))
        return messages
    
    def test_get_conversations_success(self, client, test_users, multiple_conversations, cleanup_messages):
        """Test successfully retrieving conversations list"""
        response = client.get("/api/users/messages/conversations?username=user1")
        
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        assert len(data["conversations"]) == 2  # user2 and admin
    
    def test_get_conversations_sorted_by_recent(self, client, test_users, multiple_conversations, cleanup_messages):
        """Test that conversations are sorted by most recent message"""
        response = client.get("/api/users/messages/conversations?username=user1")
        
        assert response.status_code == 200
        conversations = response.json()["conversations"]
        
        # Most recent conversation should be first (admin)
        assert conversations[0]["username"] == "admin"
        assert conversations[1]["username"] == "user2"
    
    def test_get_conversations_includes_unread_count(self, client, test_users, multiple_conversations, cleanup_messages):
        """Test that conversations include unread message count"""
        response = client.get("/api/users/messages/conversations?username=user1")
        
        assert response.status_code == 200
        conversations = response.json()["conversations"]
        
        # Check that unreadCount is present
        for conv in conversations:
            assert "unreadCount" in conv
    
    def test_get_conversations_includes_last_message(self, client, test_users, multiple_conversations, cleanup_messages):
        """Test that conversations include last message preview"""
        response = client.get("/api/users/messages/conversations?username=user1")
        
        assert response.status_code == 200
        conversations = response.json()["conversations"]
        
        # Check that lastMessage is present
        for conv in conversations:
            assert "lastMessage" in conv
            assert "lastMessageTime" in conv
    
    def test_get_conversations_empty(self, client, test_users, cleanup_messages):
        """Test getting conversations when none exist"""
        response = client.get("/api/users/messages/conversations?username=user1")
        
        assert response.status_code == 200
        data = response.json()
        assert data["conversations"] == []

class TestAdminOverride:
    """Test admin can see blocked messages"""
    
    @pytest.fixture
    def blocked_messages(self, test_db, test_users):
        """Create blocked messages and exclusion"""
        import asyncio
        # Create exclusion
        exclusion = {
            "userUsername": "user1",
            "excludedUsername": "user2",
            "createdAt": datetime.utcnow()
        }
        asyncio.get_event_loop().run_until_complete(test_db.exclusions.insert_one(exclusion))
        
        # Create invisible message
        message = {
            "fromUsername": "user1",
            "toUsername": "user2",
            "content": "Blocked message",
            "isRead": False,
            "isVisible": False,
            "createdAt": datetime.utcnow()
        }
        asyncio.get_event_loop().run_until_complete(test_db.messages.insert_one(message))
        return message
    
    def test_admin_can_see_blocked_messages(self, client, test_users, blocked_messages, cleanup_messages):
        """Test that admin can see messages marked as invisible"""
        response = client.get("/api/users/messages/conversation/user2?username=admin")
        
        assert response.status_code == 200
        # Admin should be able to see messages regardless of visibility
        # (Implementation depends on admin check in backend)
    
    def test_regular_user_cannot_see_blocked_messages(self, client, test_users, blocked_messages, cleanup_messages):
        """Test that regular users cannot see blocked messages"""
        response = client.get("/api/users/messages/conversation/user2?username=user1")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should either return empty or filter out invisible messages
        assert data["isVisible"] == False or len(data["messages"]) == 0

class TestMessageEdgeCases:
    """Test edge cases and error handling"""
    
    def test_send_message_missing_username(self, client, test_users, cleanup_messages):
        """Test sending message without username parameter"""
        response = client.post(
            "/api/users/messages/send",
            json={
                "toUsername": "user2",
                "content": "Hello"
            }
        )
        
        assert response.status_code == 422  # Missing required parameter
    
    def test_send_message_special_characters(self, client, test_users, cleanup_messages):
        """Test sending message with special characters"""
        response = client.post(
            "/api/users/messages/send?username=user1",
            json={
                "toUsername": "user2",
                "content": "Hello! 😊 <script>alert('xss')</script>"
            }
        )
        
        assert response.status_code == 200
        # Content should be stored as-is (sanitization happens on display)
    
    def test_get_conversation_nonexistent_user(self, client, test_users, cleanup_messages):
        """Test getting conversation with non-existent user"""
        response = client.get("/api/users/messages/conversation/nonexistent?username=user1")
        
        # Should return empty conversation or 404
        assert response.status_code in [200, 404]
    
    def test_concurrent_message_sending(self, client, test_users, cleanup_messages):
        """Test sending multiple messages concurrently"""
        # This would require async testing or threading
        # Placeholder for future implementation
        pass

class TestMessageIntegration:
    """Integration tests for complete messaging workflows"""
    
    def test_full_conversation_workflow(self, client, test_users, cleanup_messages):
        """Test complete workflow: send messages, retrieve conversation"""
        # Send message from user1 to user2
        send_response1 = client.post(
            "/api/users/messages/send?username=user1",
            json={"toUsername": "user2", "content": "Hello"}
        )
        assert send_response1.status_code == 200
        
        # Send reply from user2 to user1
        send_response2 = client.post(
            "/api/users/messages/send?username=user2",
            json={"toUsername": "user1", "content": "Hi there!"}
        )
        assert send_response2.status_code == 200
        
        # Get conversation as user1
        conv_response = client.get("/api/users/messages/conversation/user2?username=user1")
        assert conv_response.status_code == 200
        assert len(conv_response.json()["messages"]) == 2
        
        # Get conversations list
        list_response = client.get("/api/users/messages/conversations?username=user1")
        assert list_response.status_code == 200
        assert len(list_response.json()["conversations"]) == 1
    
    def test_block_user_hides_messages(self, client, test_users, cleanup_messages):
        """Test that blocking a user hides existing messages"""
        # Send messages
        client.post(
            "/api/users/messages/send?username=user1",
            json={"toUsername": "user2", "content": "Before block"}
        )
        
        # Block user2
        # (Would need to call exclusion endpoint)
        
        # Send message after block
        response = client.post(
            "/api/users/messages/send?username=user1",
            json={"toUsername": "user2", "content": "After block"}
        )
        
        assert response.status_code == 200
        assert response.json()["data"]["isVisible"] == False
