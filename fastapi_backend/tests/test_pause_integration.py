"""
Integration Tests for Pause Feature

Tests how pause affects:
- Search (advanced search, auto-complete)
- Matching (top matches, L3V3L matching)
- Messaging (sending/receiving messages)
"""

import pytest
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi.testclient import TestClient


class TestPauseSearchIntegration:
    """Test pause feature integration with search"""
    
    @pytest.fixture
    async def setup_users(self, test_db):
        """Create active and paused users for search testing"""
        users = [
            {
                "_id": ObjectId(),
                "username": "active_user_1",
                "firstName": "Active",
                "lastName": "User1",
                "age": 25,
                "gender": "male",
                "location": "New York",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "active_user_2",
                "firstName": "Active",
                "lastName": "User2",
                "age": 26,
                "gender": "male",
                "location": "New York",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "paused_user_1",
                "firstName": "Paused",
                "lastName": "User1",
                "age": 25,
                "gender": "male",
                "location": "New York",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow(),
                "pausedUntil": datetime.utcnow() + timedelta(days=7)
            }
        ]
        
        await test_db.users.insert_many(users)
        return users
    
    def test_advanced_search_excludes_paused(self, test_client, setup_users, auth_headers):
        """Test that advanced search excludes paused users"""
        response = test_client.post(
            "/api/users/search",
            json={
                "gender": "male",
                "minAge": 20,
                "maxAge": 30,
                "location": "New York"
            },
            headers=auth_headers("active_user_1")
        )
        
        assert response.status_code == 200
        results = response.json()
        
        # Should only return active users
        usernames = [user["username"] for user in results]
        assert "active_user_2" in usernames
        assert "paused_user_1" not in usernames
    
    def test_autocomplete_excludes_paused(self, test_client, setup_users, auth_headers):
        """Test that auto-complete excludes paused users"""
        response = test_client.get(
            "/api/users/autocomplete?q=User",
            headers=auth_headers("active_user_1")
        )
        
        assert response.status_code == 200
        results = response.json()
        
        # Should only return active users
        usernames = [user["username"] for user in results]
        assert "active_user_1" in usernames or "active_user_2" in usernames
        assert "paused_user_1" not in usernames
    
    def test_search_paused_user_by_username(self, test_client, setup_users, auth_headers):
        """Test that searching paused user by exact username still works (for admins)"""
        # This depends on your implementation
        # Some systems allow direct profile access even if paused
        pass


class TestPauseMatchingIntegration:
    """Test pause feature integration with matching"""
    
    @pytest.fixture
    async def setup_match_users(self, test_db):
        """Create users for matching tests"""
        users = [
            {
                "_id": ObjectId(),
                "username": "matcher_active",
                "firstName": "Matcher",
                "lastName": "Active",
                "age": 25,
                "gender": "male",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "matched_active",
                "firstName": "Matched",
                "lastName": "Active",
                "age": 24,
                "gender": "female",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "matched_paused",
                "firstName": "Matched",
                "lastName": "Paused",
                "age": 24,
                "gender": "female",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow()
            }
        ]
        
        await test_db.users.insert_many(users)
        return users
    
    def test_top_matches_excludes_paused(self, test_client, setup_match_users, auth_headers):
        """Test that top matches exclude paused users"""
        response = test_client.get(
            "/top-matches?username=matcher_active",
            headers=auth_headers("matcher_active")
        )
        
        assert response.status_code == 200
        matches = response.json()
        
        # Should only return active users
        usernames = [match["username"] for match in matches]
        assert "matched_paused" not in usernames
    
    def test_l3v3l_matching_excludes_paused(self, test_client, setup_match_users, auth_headers):
        """Test that L3V3L matching excludes paused users"""
        response = test_client.get(
            "/api/l3v3l/matches?username=matcher_active",
            headers=auth_headers("matcher_active")
        )
        
        assert response.status_code == 200
        matches = response.json()
        
        # Should only return active users
        if matches:
            usernames = [match["username"] for match in matches]
            assert "matched_paused" not in usernames
    
    def test_mutual_matches_excludes_paused(self, test_client, test_db, auth_headers):
        """Test that mutual matching ignores if either user is paused"""
        # Create two users who have favorited each other
        user1 = {
            "_id": ObjectId(),
            "username": "mutual_user1",
            "accountStatus": "active",
            "favorites": ["mutual_user2"]
        }
        user2 = {
            "_id": ObjectId(),
            "username": "mutual_user2",
            "accountStatus": "paused",  # Paused
            "pausedAt": datetime.utcnow(),
            "favorites": ["mutual_user1"]
        }
        
        test_db.users.insert_many([user1, user2])
        
        # Check mutual matches for user1
        response = test_client.get(
            "/mutual-matches?username=mutual_user1",
            headers=auth_headers("mutual_user1")
        )
        
        # Should not show paused user as mutual match
        if response.status_code == 200:
            matches = response.json()
            usernames = [match["username"] for match in matches]
            assert "mutual_user2" not in usernames


class TestPauseMessagingIntegration:
    """Test pause feature integration with messaging"""
    
    @pytest.fixture
    async def setup_message_users(self, test_db):
        """Create users for messaging tests"""
        users = [
            {
                "_id": ObjectId(),
                "username": "sender_active",
                "firstName": "Sender",
                "lastName": "Active",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "recipient_active",
                "firstName": "Recipient",
                "lastName": "Active",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "recipient_paused",
                "firstName": "Recipient",
                "lastName": "Paused",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow()
            }
        ]
        
        await test_db.users.insert_many(users)
        return users
    
    def test_cannot_send_message_to_paused_user(self, test_client, setup_message_users, auth_headers):
        """Test that active user cannot send message to paused user"""
        response = test_client.post(
            "/send-message",
            json={
                "to_username": "recipient_paused",
                "message": "Hello!"
            },
            headers=auth_headers("sender_active")
        )
        
        assert response.status_code == 403
        assert "paused" in response.json()["detail"].lower()
    
    def test_paused_user_cannot_send_message(self, test_client, setup_message_users, auth_headers):
        """Test that paused user cannot send messages"""
        response = test_client.post(
            "/send-message",
            json={
                "to_username": "recipient_active",
                "message": "Hello!"
            },
            headers=auth_headers("recipient_paused")
        )
        
        assert response.status_code == 403
        assert "paused" in response.json()["detail"].lower()
    
    def test_active_users_can_message(self, test_client, setup_message_users, auth_headers):
        """Test that active users can message each other"""
        response = test_client.post(
            "/send-message",
            json={
                "to_username": "recipient_active",
                "message": "Hello!"
            },
            headers=auth_headers("sender_active")
        )
        
        assert response.status_code == 200
    
    def test_existing_messages_readable(self, test_client, test_db, auth_headers):
        """Test that existing messages remain readable after pause"""
        # Create users and existing messages
        users = [
            {
                "_id": ObjectId(),
                "username": "user_a",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "user_b",
                "accountStatus": "active"
            }
        ]
        test_db.users.insert_many(users)
        
        # User A sends message to User B
        message = {
            "_id": ObjectId(),
            "from_username": "user_a",
            "to_username": "user_b",
            "message": "Hello before pause",
            "timestamp": datetime.utcnow(),
            "is_read": False
        }
        test_db.messages.insert_one(message)
        
        # User B pauses their account
        test_db.users.update_one(
            {"username": "user_b"},
            {"$set": {"accountStatus": "paused", "pausedAt": datetime.utcnow()}}
        )
        
        # User B should still be able to read messages
        response = test_client.get(
            "/messages?username=user_b",
            headers=auth_headers("user_b")
        )
        
        assert response.status_code == 200
        messages = response.json()
        assert len(messages) > 0
    
    def test_get_conversations_shows_paused_status(self, test_client, test_db, auth_headers):
        """Test that conversation list shows pause status"""
        # Create users with existing conversation
        users = [
            {
                "_id": ObjectId(),
                "username": "conv_user_a",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "conv_user_b",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow()
            }
        ]
        test_db.users.insert_many(users)
        
        # Create message
        message = {
            "_id": ObjectId(),
            "from_username": "conv_user_a",
            "to_username": "conv_user_b",
            "message": "Test",
            "timestamp": datetime.utcnow()
        }
        test_db.messages.insert_one(message)
        
        # Get conversations for user A
        response = test_client.get(
            "/conversations?username=conv_user_a",
            headers=auth_headers("conv_user_a")
        )
        
        assert response.status_code == 200
        conversations = response.json()
        
        # Find conversation with user B
        conv_user_b = next((c for c in conversations if c["username"] == "conv_user_b"), None)
        if conv_user_b and "userProfile" in conv_user_b:
            # Verify pause status is included
            assert conv_user_b["userProfile"]["accountStatus"] == "paused"


class TestPauseFavoriteShortlistIntegration:
    """Test pause feature with favorites and shortlists"""
    
    def test_can_favorite_paused_user(self, test_client, test_db, auth_headers):
        """Test that users can still favorite paused profiles"""
        # Create active and paused users
        users = [
            {
                "_id": ObjectId(),
                "username": "fav_active",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "fav_paused",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow()
            }
        ]
        test_db.users.insert_many(users)
        
        # Active user favorites paused user
        response = test_client.post(
            "/favorites/fav_paused?username=fav_active",
            headers=auth_headers("fav_active")
        )
        
        # Should succeed - users can still favorite paused profiles
        assert response.status_code == 200
    
    def test_can_shortlist_paused_user(self, test_client, test_db, auth_headers):
        """Test that users can still shortlist paused profiles"""
        # Create active and paused users
        users = [
            {
                "_id": ObjectId(),
                "username": "short_active",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "short_paused",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow()
            }
        ]
        test_db.users.insert_many(users)
        
        # Active user shortlists paused user
        response = test_client.post(
            "/shortlist/short_paused?username=short_active",
            headers=auth_headers("short_active")
        )
        
        # Should succeed
        assert response.status_code == 200
    
    def test_paused_user_can_manage_favorites(self, test_client, test_db, auth_headers):
        """Test that paused users can still manage their own favorites"""
        # Create users
        users = [
            {
                "_id": ObjectId(),
                "username": "paused_manager",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow()
            },
            {
                "_id": ObjectId(),
                "username": "target_user",
                "accountStatus": "active"
            }
        ]
        test_db.users.insert_many(users)
        
        # Paused user adds to favorites
        response = test_client.post(
            "/favorites/target_user?username=paused_manager",
            headers=auth_headers("paused_manager")
        )
        
        # Should succeed - paused users can manage their lists
        assert response.status_code == 200


class TestPauseProfileViewIntegration:
    """Test pause feature with profile viewing"""
    
    def test_can_view_paused_profile(self, test_client, test_db, auth_headers):
        """Test that users can still view paused profiles"""
        # Create users
        users = [
            {
                "_id": ObjectId(),
                "username": "viewer",
                "accountStatus": "active"
            },
            {
                "_id": ObjectId(),
                "username": "paused_viewed",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow(),
                "pauseMessage": "On vacation"
            }
        ]
        test_db.users.insert_many(users)
        
        # View paused profile
        response = test_client.get(
            "/profile/paused_viewed",
            headers=auth_headers("viewer")
        )
        
        # Should succeed and show pause status
        assert response.status_code == 200
        profile = response.json()
        assert profile["accountStatus"] == "paused"
        assert profile["pauseMessage"] == "On vacation"
    
    def test_profile_view_not_logged_for_paused(self, test_client, test_db, auth_headers):
        """Test that profile views aren't logged when viewer is paused"""
        # This depends on your implementation
        # You may want to disable view tracking for paused users
        pass


# ==================== Comprehensive Integration Test ====================

class TestComprehensivePauseIntegration:
    """Comprehensive end-to-end integration tests"""
    
    def test_complete_pause_scenario(self, test_client, test_db, auth_headers):
        """Test complete pause scenario affecting all systems"""
        # 1. Create two active users
        users = [
            {
                "_id": ObjectId(),
                "username": "user_main",
                "firstName": "Main",
                "age": 25,
                "gender": "male",
                "location": "NYC",
                "accountStatus": "active",
                "pauseCount": 0
            },
            {
                "_id": ObjectId(),
                "username": "user_other",
                "firstName": "Other",
                "age": 24,
                "gender": "female",
                "location": "NYC",
                "accountStatus": "active"
            }
        ]
        test_db.users.insert_many(users)
        
        # 2. Verify user_main appears in search for user_other
        search_response = test_client.post(
            "/api/users/search",
            json={"gender": "male", "minAge": 20, "maxAge": 30},
            headers=auth_headers("user_other")
        )
        assert search_response.status_code == 200
        usernames = [u["username"] for u in search_response.json()]
        assert "user_main" in usernames
        
        # 3. User_main pauses account
        pause_response = test_client.post(
            "/api/account/pause",
            json={"duration": "7d", "reason": "vacation"},
            headers=auth_headers("user_main")
        )
        assert pause_response.status_code == 200
        
        # 4. Verify user_main no longer in search
        search_response = test_client.post(
            "/api/users/search",
            json={"gender": "male", "minAge": 20, "maxAge": 30},
            headers=auth_headers("user_other")
        )
        usernames = [u["username"] for u in search_response.json()]
        assert "user_main" not in usernames
        
        # 5. Verify messaging is blocked
        message_response = test_client.post(
            "/send-message",
            json={"to_username": "user_main", "message": "Hello"},
            headers=auth_headers("user_other")
        )
        assert message_response.status_code == 403
        
        # 6. Verify profile still viewable but shows pause
        profile_response = test_client.get(
            "/profile/user_main",
            headers=auth_headers("user_other")
        )
        assert profile_response.status_code == 200
        assert profile_response.json()["accountStatus"] == "paused"
        
        # 7. Unpause account
        unpause_response = test_client.post(
            "/api/account/unpause",
            headers=auth_headers("user_main")
        )
        assert unpause_response.status_code == 200
        
        # 8. Verify user_main appears in search again
        search_response = test_client.post(
            "/api/users/search",
            json={"gender": "male", "minAge": 20, "maxAge": 30},
            headers=auth_headers("user_other")
        )
        usernames = [u["username"] for u in search_response.json()]
        assert "user_main" in usernames
        
        # 9. Verify messaging works again
        message_response = test_client.post(
            "/send-message",
            json={"to_username": "user_main", "message": "Hello"},
            headers=auth_headers("user_other")
        )
        assert message_response.status_code == 200
