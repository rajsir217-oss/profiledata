"""
Tests for Account Status API Routes

Tests the REST API endpoints for pause functionality:
- POST /api/account/pause
- POST /api/account/unpause  
- GET /api/account/pause-status
- PATCH /api/account/pause-settings
"""

import pytest
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi.testclient import TestClient


class TestAccountStatusRoutes:
    """Test suite for account status API endpoints"""
    
    @pytest.fixture
    async def test_user(self, test_db, test_token):
        """Create test user with auth token"""
        user = {
            "_id": ObjectId(),
            "username": "api_test_user",
            "firstName": "API",
            "lastName": "User",
            "accountStatus": "active",
            "pausedAt": None,
            "pausedUntil": None,
            "pauseReason": None,
            "pauseMessage": None,
            "pauseCount": 0
        }
        await test_db.users.insert_one(user)
        return user
    
    @pytest.fixture
    async def paused_user(self, test_db):
        """Create paused test user"""
        user = {
            "_id": ObjectId(),
            "username": "paused_api_user",
            "firstName": "Paused",
            "lastName": "User",
            "accountStatus": "paused",
            "pausedAt": datetime.utcnow(),
            "pausedUntil": datetime.utcnow() + timedelta(days=7),
            "pauseReason": "vacation",
            "pauseMessage": "On vacation",
            "pauseCount": 1
        }
        await test_db.users.insert_one(user)
        return user
    
    # ==================== POST /api/account/pause ====================
    
    def test_pause_account_success(self, test_client, test_user, auth_headers):
        """Test successfully pausing account via API"""
        response = test_client.post(
            "/api/account/pause",
            json={
                "duration": "7d",
                "reason": "vacation",
                "message": "Going on vacation"
            },
            headers=auth_headers(test_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["accountStatus"] == "paused"
        assert data["pauseReason"] == "vacation"
        assert data["pauseMessage"] == "Going on vacation"
        assert "pausedAt" in data
        assert "pausedUntil" in data
    
    def test_pause_account_minimal_data(self, test_client, test_user, auth_headers):
        """Test pausing with minimal required data"""
        response = test_client.post(
            "/api/account/pause",
            json={"duration": "7d"},
            headers=auth_headers(test_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["accountStatus"] == "paused"
    
    def test_pause_account_all_durations(self, test_client, test_db, auth_headers):
        """Test all valid duration options"""
        durations = ["3d", "7d", "14d", "30d", "manual"]
        
        for duration in durations:
            # Create new user for each test
            user = {
                "_id": ObjectId(),
                "username": f"user_{duration}",
                "accountStatus": "active",
                "pauseCount": 0
            }
            test_db.users.insert_one(user)
            
            response = test_client.post(
                "/api/account/pause",
                json={"duration": duration},
                headers=auth_headers(user["username"])
            )
            
            assert response.status_code == 200
            data = response.json()
            
            if duration == "manual":
                assert data["pausedUntil"] is None
            else:
                assert data["pausedUntil"] is not None
    
    def test_pause_account_unauthorized(self, test_client):
        """Test pausing without authentication"""
        response = test_client.post(
            "/api/account/pause",
            json={"duration": "7d"}
        )
        
        assert response.status_code == 401
    
    def test_pause_account_invalid_duration(self, test_client, test_user, auth_headers):
        """Test pausing with invalid duration"""
        response = test_client.post(
            "/api/account/pause",
            json={"duration": "invalid"},
            headers=auth_headers(test_user["username"])
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_pause_account_missing_duration(self, test_client, test_user, auth_headers):
        """Test pausing without duration"""
        response = test_client.post(
            "/api/account/pause",
            json={},
            headers=auth_headers(test_user["username"])
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_pause_already_paused(self, test_client, paused_user, auth_headers):
        """Test pausing already paused account"""
        response = test_client.post(
            "/api/account/pause",
            json={"duration": "7d"},
            headers=auth_headers(paused_user["username"])
        )
        
        assert response.status_code == 400
        assert "already paused" in response.json()["detail"].lower()
    
    # ==================== POST /api/account/unpause ====================
    
    def test_unpause_account_success(self, test_client, paused_user, auth_headers):
        """Test successfully unpausing account via API"""
        response = test_client.post(
            "/api/account/unpause",
            headers=auth_headers(paused_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["accountStatus"] == "active"
        assert "lastUnpausedAt" in data
    
    def test_unpause_active_account(self, test_client, test_user, auth_headers):
        """Test unpausing already active account"""
        response = test_client.post(
            "/api/account/unpause",
            headers=auth_headers(test_user["username"])
        )
        
        assert response.status_code == 400
        assert "not paused" in response.json()["detail"].lower()
    
    def test_unpause_unauthorized(self, test_client):
        """Test unpausing without authentication"""
        response = test_client.post("/api/account/unpause")
        
        assert response.status_code == 401
    
    # ==================== GET /api/account/pause-status ====================
    
    def test_get_pause_status_active(self, test_client, test_user, auth_headers):
        """Test getting pause status for active user"""
        response = test_client.get(
            "/api/account/pause-status",
            headers=auth_headers(test_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["isPaused"] is False
        assert data["accountStatus"] == "active"
        assert data["pausedAt"] is None
        assert data["pauseCount"] == 0
    
    def test_get_pause_status_paused(self, test_client, paused_user, auth_headers):
        """Test getting pause status for paused user"""
        response = test_client.get(
            "/api/account/pause-status",
            headers=auth_headers(paused_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["isPaused"] is True
        assert data["accountStatus"] == "paused"
        assert data["pausedAt"] is not None
        assert data["pauseReason"] == "vacation"
        assert data["pauseMessage"] == "On vacation"
        assert data["pauseCount"] == 1
    
    def test_get_pause_status_unauthorized(self, test_client):
        """Test getting pause status without authentication"""
        response = test_client.get("/api/account/pause-status")
        
        assert response.status_code == 401
    
    # ==================== PATCH /api/account/pause-settings ====================
    
    def test_update_pause_settings_message(self, test_client, paused_user, auth_headers):
        """Test updating pause message"""
        response = test_client.patch(
            "/api/account/pause-settings",
            json={"message": "Updated vacation message"},
            headers=auth_headers(paused_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["pauseMessage"] == "Updated vacation message"
    
    def test_update_pause_settings_duration(self, test_client, paused_user, auth_headers):
        """Test updating pause duration"""
        response = test_client.patch(
            "/api/account/pause-settings",
            json={"duration": "14d"},
            headers=auth_headers(paused_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["pausedUntil"] is not None
    
    def test_update_pause_settings_to_manual(self, test_client, paused_user, auth_headers):
        """Test changing duration to manual"""
        response = test_client.patch(
            "/api/account/pause-settings",
            json={"duration": "manual"},
            headers=auth_headers(paused_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["pausedUntil"] is None
    
    def test_update_pause_settings_both(self, test_client, paused_user, auth_headers):
        """Test updating both message and duration"""
        response = test_client.patch(
            "/api/account/pause-settings",
            json={
                "message": "Extended vacation",
                "duration": "30d"
            },
            headers=auth_headers(paused_user["username"])
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["pauseMessage"] == "Extended vacation"
        assert data["pausedUntil"] is not None
    
    def test_update_pause_settings_active_user(self, test_client, test_user, auth_headers):
        """Test updating settings for active user"""
        response = test_client.patch(
            "/api/account/pause-settings",
            json={"message": "New message"},
            headers=auth_headers(test_user["username"])
        )
        
        assert response.status_code == 400
        assert "not paused" in response.json()["detail"].lower()
    
    def test_update_pause_settings_empty_request(self, test_client, paused_user, auth_headers):
        """Test updating with no data (should fail)"""
        response = test_client.patch(
            "/api/account/pause-settings",
            json={},
            headers=auth_headers(paused_user["username"])
        )
        
        assert response.status_code == 400
        assert "message or duration" in response.json()["detail"].lower()
    
    def test_update_pause_settings_unauthorized(self, test_client):
        """Test updating settings without authentication"""
        response = test_client.patch(
            "/api/account/pause-settings",
            json={"message": "New message"}
        )
        
        assert response.status_code == 401


# ==================== Integration Tests ====================

class TestAccountStatusIntegration:
    """Integration tests for account status API endpoints"""
    
    def test_full_api_flow(self, test_client, test_db, auth_headers):
        """Test complete pause/unpause flow via API"""
        # Create user
        user = {
            "_id": ObjectId(),
            "username": "flow_user",
            "accountStatus": "active",
            "pauseCount": 0
        }
        test_db.users.insert_one(user)
        headers = auth_headers("flow_user")
        
        # 1. Check initial status
        response = test_client.get("/api/account/pause-status", headers=headers)
        assert response.status_code == 200
        assert response.json()["isPaused"] is False
        
        # 2. Pause account
        response = test_client.post(
            "/api/account/pause",
            json={
                "duration": "7d",
                "reason": "vacation",
                "message": "Going away"
            },
            headers=headers
        )
        assert response.status_code == 200
        assert response.json()["accountStatus"] == "paused"
        
        # 3. Check paused status
        response = test_client.get("/api/account/pause-status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["isPaused"] is True
        assert data["pauseMessage"] == "Going away"
        
        # 4. Update settings
        response = test_client.patch(
            "/api/account/pause-settings",
            json={"message": "Extended vacation"},
            headers=headers
        )
        assert response.status_code == 200
        assert response.json()["pauseMessage"] == "Extended vacation"
        
        # 5. Unpause
        response = test_client.post("/api/account/unpause", headers=headers)
        assert response.status_code == 200
        assert response.json()["accountStatus"] == "active"
        
        # 6. Verify final status
        response = test_client.get("/api/account/pause-status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["isPaused"] is False
        assert data["pauseCount"] == 1
    
    def test_pause_unpause_multiple_times(self, test_client, test_db, auth_headers):
        """Test pausing and unpausing multiple times"""
        # Create user
        user = {
            "_id": ObjectId(),
            "username": "multi_user",
            "accountStatus": "active",
            "pauseCount": 0
        }
        test_db.users.insert_one(user)
        headers = auth_headers("multi_user")
        
        # Pause and unpause 3 times
        for i in range(3):
            # Pause
            response = test_client.post(
                "/api/account/pause",
                json={"duration": "7d"},
                headers=headers
            )
            assert response.status_code == 200
            
            # Unpause
            response = test_client.post("/api/account/unpause", headers=headers)
            assert response.status_code == 200
        
        # Check final count
        response = test_client.get("/api/account/pause-status", headers=headers)
        assert response.status_code == 200
        assert response.json()["pauseCount"] == 3
    
    def test_concurrent_pause_requests(self, test_client, test_db, auth_headers):
        """Test handling concurrent pause requests"""
        # Create user
        user = {
            "_id": ObjectId(),
            "username": "concurrent_user",
            "accountStatus": "active",
            "pauseCount": 0
        }
        test_db.users.insert_one(user)
        headers = auth_headers("concurrent_user")
        
        # First pause should succeed
        response1 = test_client.post(
            "/api/account/pause",
            json={"duration": "7d"},
            headers=headers
        )
        assert response1.status_code == 200
        
        # Second pause should fail
        response2 = test_client.post(
            "/api/account/pause",
            json={"duration": "7d"},
            headers=headers
        )
        assert response2.status_code == 400
