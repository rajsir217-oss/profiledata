"""
Tests for PauseService

Tests pause functionality including:
- Pausing accounts
- Unpausing accounts
- Getting pause status
- Updating pause settings
- Auto-unpause checks
"""

import pytest
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi import HTTPException

from services.pause_service import PauseService


class TestPauseService:
    """Test suite for PauseService"""
    
    @pytest.fixture
    async def pause_service(self, test_db):
        """Create PauseService instance with test database"""
        return PauseService(test_db)
    
    @pytest.fixture
    async def test_user(self, test_db):
        """Create a test user"""
        user = {
            "_id": ObjectId(),
            "username": "test_pause_user",
            "firstName": "Test",
            "lastName": "User",
            "accountStatus": "active",
            "pausedAt": None,
            "pausedUntil": None,
            "pauseReason": None,
            "pauseMessage": None,
            "pauseCount": 0,
            "lastUnpausedAt": None
        }
        await test_db.users.insert_one(user)
        return user
    
    @pytest.fixture
    async def paused_user(self, test_db):
        """Create a paused test user"""
        user = {
            "_id": ObjectId(),
            "username": "paused_user",
            "firstName": "Paused",
            "lastName": "User",
            "accountStatus": "paused",
            "pausedAt": datetime.utcnow(),
            "pausedUntil": datetime.utcnow() + timedelta(days=7),
            "pauseReason": "vacation",
            "pauseMessage": "Taking a break",
            "pauseCount": 1,
            "lastUnpausedAt": None
        }
        await test_db.users.insert_one(user)
        return user
    
    # ==================== Pause Account Tests ====================
    
    async def test_pause_account_success(self, pause_service, test_user):
        """Test successfully pausing an account"""
        result = await pause_service.pause_account(
            username=test_user["username"],
            duration="7d",
            reason="vacation",
            message="Going on vacation"
        )
        
        assert result["success"] is True
        assert result["accountStatus"] == "paused"
        assert result["pauseReason"] == "vacation"
        assert result["pauseMessage"] == "Going on vacation"
        assert "pausedAt" in result
        assert "pausedUntil" in result
        
        # Verify database was updated
        updated_user = await pause_service.db.users.find_one({"username": test_user["username"]})
        assert updated_user["accountStatus"] == "paused"
        assert updated_user["pauseCount"] == 1
    
    async def test_pause_account_3_days(self, pause_service, test_user):
        """Test pausing account for 3 days"""
        result = await pause_service.pause_account(
            username=test_user["username"],
            duration="3d"
        )
        
        paused_until = datetime.fromisoformat(result["pausedUntil"].replace("Z", "+00:00"))
        expected_until = datetime.utcnow() + timedelta(days=3)
        
        # Allow 1 minute tolerance for test execution time
        assert abs((paused_until - expected_until).total_seconds()) < 60
    
    async def test_pause_account_manual_duration(self, pause_service, test_user):
        """Test pausing account with manual duration (no auto-unpause)"""
        result = await pause_service.pause_account(
            username=test_user["username"],
            duration="manual"
        )
        
        assert result["pausedUntil"] is None
    
    async def test_pause_already_paused_account(self, pause_service, paused_user):
        """Test pausing an already paused account (should fail)"""
        with pytest.raises(HTTPException) as exc_info:
            await pause_service.pause_account(
                username=paused_user["username"],
                duration="7d"
            )
        
        assert exc_info.value.status_code == 400
        assert "already paused" in str(exc_info.value.detail).lower()
    
    async def test_pause_nonexistent_user(self, pause_service):
        """Test pausing a non-existent user"""
        with pytest.raises(HTTPException) as exc_info:
            await pause_service.pause_account(
                username="nonexistent_user",
                duration="7d"
            )
        
        assert exc_info.value.status_code == 404
        assert "not found" in str(exc_info.value.detail).lower()
    
    async def test_pause_invalid_duration(self, pause_service, test_user):
        """Test pausing with invalid duration"""
        with pytest.raises(HTTPException) as exc_info:
            await pause_service.pause_account(
                username=test_user["username"],
                duration="invalid"
            )
        
        assert exc_info.value.status_code == 400
        assert "duration" in str(exc_info.value.detail).lower()
    
    async def test_pause_increments_count(self, pause_service, test_user):
        """Test that pausing increments pause count"""
        # Pause first time
        await pause_service.pause_account(
            username=test_user["username"],
            duration="7d"
        )
        
        # Unpause
        await pause_service.unpause_account(test_user["username"])
        
        # Pause second time
        result = await pause_service.pause_account(
            username=test_user["username"],
            duration="7d"
        )
        
        # Verify count increased
        user = await pause_service.db.users.find_one({"username": test_user["username"]})
        assert user["pauseCount"] == 2
    
    # ==================== Unpause Account Tests ====================
    
    async def test_unpause_account_success(self, pause_service, paused_user):
        """Test successfully unpausing an account"""
        result = await pause_service.unpause_account(paused_user["username"])
        
        assert result["success"] is True
        assert result["accountStatus"] == "active"
        assert "lastUnpausedAt" in result
        
        # Verify database was updated
        updated_user = await pause_service.db.users.find_one({"username": paused_user["username"]})
        assert updated_user["accountStatus"] == "active"
        assert updated_user["pausedAt"] is None
        assert updated_user["pausedUntil"] is None
        assert updated_user["lastUnpausedAt"] is not None
    
    async def test_unpause_active_account(self, pause_service, test_user):
        """Test unpausing an already active account (should fail)"""
        with pytest.raises(HTTPException) as exc_info:
            await pause_service.unpause_account(test_user["username"])
        
        assert exc_info.value.status_code == 400
        assert "not paused" in str(exc_info.value.detail).lower()
    
    async def test_unpause_nonexistent_user(self, pause_service):
        """Test unpausing a non-existent user"""
        with pytest.raises(HTTPException) as exc_info:
            await pause_service.unpause_account("nonexistent_user")
        
        assert exc_info.value.status_code == 404
        assert "not found" in str(exc_info.value.detail).lower()
    
    # ==================== Get Pause Status Tests ====================
    
    async def test_get_pause_status_active_user(self, pause_service, test_user):
        """Test getting pause status for active user"""
        status = await pause_service.get_pause_status(test_user["username"])
        
        assert status["isPaused"] is False
        assert status["accountStatus"] == "active"
        assert status["pausedAt"] is None
        assert status["pausedUntil"] is None
        assert status["pauseReason"] is None
        assert status["pauseMessage"] is None
        assert status["pauseCount"] == 0
    
    async def test_get_pause_status_paused_user(self, pause_service, paused_user):
        """Test getting pause status for paused user"""
        status = await pause_service.get_pause_status(paused_user["username"])
        
        assert status["isPaused"] is True
        assert status["accountStatus"] == "paused"
        assert status["pausedAt"] is not None
        assert status["pausedUntil"] is not None
        assert status["pauseReason"] == "vacation"
        assert status["pauseMessage"] == "Taking a break"
        assert status["pauseCount"] == 1
    
    async def test_get_pause_status_nonexistent_user(self, pause_service):
        """Test getting pause status for non-existent user"""
        with pytest.raises(HTTPException) as exc_info:
            await pause_service.get_pause_status("nonexistent_user")
        
        assert exc_info.value.status_code == 404
        assert "not found" in str(exc_info.value.detail).lower()
    
    # ==================== Update Pause Settings Tests ====================
    
    async def test_update_pause_settings_message(self, pause_service, paused_user):
        """Test updating pause message"""
        result = await pause_service.update_pause_settings(
            username=paused_user["username"],
            message="Updated message"
        )
        
        assert result["success"] is True
        assert result["pauseMessage"] == "Updated message"
        
        # Verify database was updated
        updated_user = await pause_service.db.users.find_one({"username": paused_user["username"]})
        assert updated_user["pauseMessage"] == "Updated message"
    
    async def test_update_pause_settings_duration(self, pause_service, paused_user):
        """Test updating pause duration"""
        result = await pause_service.update_pause_settings(
            username=paused_user["username"],
            duration="14d"
        )
        
        assert result["success"] is True
        
        # Verify new pausedUntil is approximately 14 days from now
        updated_user = await pause_service.db.users.find_one({"username": paused_user["username"]})
        expected_until = datetime.utcnow() + timedelta(days=14)
        actual_until = updated_user["pausedUntil"]
        
        # Allow 1 minute tolerance
        assert abs((actual_until - expected_until).total_seconds()) < 60
    
    async def test_update_pause_settings_manual_duration(self, pause_service, paused_user):
        """Test changing to manual duration (removes auto-unpause)"""
        result = await pause_service.update_pause_settings(
            username=paused_user["username"],
            duration="manual"
        )
        
        assert result["success"] is True
        assert result["pausedUntil"] is None
        
        # Verify database was updated
        updated_user = await pause_service.db.users.find_one({"username": paused_user["username"]})
        assert updated_user["pausedUntil"] is None
    
    async def test_update_pause_settings_active_user(self, pause_service, test_user):
        """Test updating pause settings for active user (should fail)"""
        with pytest.raises(HTTPException) as exc_info:
            await pause_service.update_pause_settings(
                username=test_user["username"],
                message="New message"
            )
        
        assert exc_info.value.status_code == 400
        assert "not paused" in str(exc_info.value.detail).lower()
    
    # ==================== Auto-Unpause Tests ====================
    
    async def test_check_auto_unpause_expired(self, pause_service, test_db):
        """Test auto-unpause for expired pause period"""
        # Create user with expired pause
        expired_user = {
            "_id": ObjectId(),
            "username": "expired_user",
            "accountStatus": "paused",
            "pausedAt": datetime.utcnow() - timedelta(days=8),
            "pausedUntil": datetime.utcnow() - timedelta(days=1),  # Expired yesterday
            "pauseReason": "vacation",
            "pauseCount": 1
        }
        await test_db.users.insert_one(expired_user)
        
        # Run auto-unpause check
        count = await pause_service.check_auto_unpause()
        
        assert count == 1
        
        # Verify user was unpaused
        updated_user = await test_db.users.find_one({"username": "expired_user"})
        assert updated_user["accountStatus"] == "active"
        assert updated_user["pausedAt"] is None
        assert updated_user["pausedUntil"] is None
    
    async def test_check_auto_unpause_not_expired(self, pause_service, paused_user):
        """Test auto-unpause doesn't unpause non-expired users"""
        initial_count = paused_user["pauseCount"]
        
        # Run auto-unpause check
        count = await pause_service.check_auto_unpause()
        
        assert count == 0
        
        # Verify user is still paused
        user = await pause_service.db.users.find_one({"username": paused_user["username"]})
        assert user["accountStatus"] == "paused"
        assert user["pauseCount"] == initial_count
    
    async def test_check_auto_unpause_manual_duration(self, pause_service, test_db):
        """Test auto-unpause ignores manual duration users"""
        # Create user with manual duration (no pausedUntil)
        manual_user = {
            "_id": ObjectId(),
            "username": "manual_user",
            "accountStatus": "paused",
            "pausedAt": datetime.utcnow() - timedelta(days=30),
            "pausedUntil": None,  # Manual duration
            "pauseReason": "personal",
            "pauseCount": 1
        }
        await test_db.users.insert_one(manual_user)
        
        # Run auto-unpause check
        count = await pause_service.check_auto_unpause()
        
        assert count == 0
        
        # Verify user is still paused
        user = await test_db.users.find_one({"username": "manual_user"})
        assert user["accountStatus"] == "paused"
    
    async def test_check_auto_unpause_multiple_users(self, pause_service, test_db):
        """Test auto-unpause handles multiple expired users"""
        # Create 3 users with expired pauses
        for i in range(3):
            expired_user = {
                "_id": ObjectId(),
                "username": f"expired_user_{i}",
                "accountStatus": "paused",
                "pausedAt": datetime.utcnow() - timedelta(days=8),
                "pausedUntil": datetime.utcnow() - timedelta(days=1),
                "pauseReason": "vacation",
                "pauseCount": 1
            }
            await test_db.users.insert_one(expired_user)
        
        # Run auto-unpause check
        count = await pause_service.check_auto_unpause()
        
        assert count == 3
        
        # Verify all users were unpaused
        for i in range(3):
            user = await test_db.users.find_one({"username": f"expired_user_{i}"})
            assert user["accountStatus"] == "active"
    
    # ==================== Edge Cases ====================
    
    async def test_pause_with_empty_message(self, pause_service, test_user):
        """Test pausing with empty message (should use None)"""
        result = await pause_service.pause_account(
            username=test_user["username"],
            duration="7d",
            message=""
        )
        
        assert result["pauseMessage"] is None or result["pauseMessage"] == ""
    
    async def test_pause_with_long_message(self, pause_service, test_user):
        """Test pausing with very long message"""
        long_message = "A" * 500
        result = await pause_service.pause_account(
            username=test_user["username"],
            duration="7d",
            message=long_message
        )
        
        assert result["pauseMessage"] == long_message
    
    async def test_pause_reason_all_types(self, pause_service, test_db):
        """Test all pause reason types"""
        reasons = ["vacation", "overwhelmed", "personal", "other"]
        
        for idx, reason in enumerate(reasons):
            user = {
                "_id": ObjectId(),
                "username": f"user_{reason}",
                "accountStatus": "active",
                "pauseCount": 0
            }
            await test_db.users.insert_one(user)
            
            result = await pause_service.pause_account(
                username=f"user_{reason}",
                duration="7d",
                reason=reason
            )
            
            assert result["pauseReason"] == reason


# ==================== Integration Tests ====================

class TestPauseServiceIntegration:
    """Integration tests for pause service with other systems"""
    
    @pytest.fixture
    async def pause_service(self, test_db):
        return PauseService(test_db)
    
    async def test_full_pause_unpause_cycle(self, pause_service, test_db):
        """Test complete pause/unpause cycle"""
        # Create user
        user = {
            "_id": ObjectId(),
            "username": "cycle_user",
            "accountStatus": "active",
            "pauseCount": 0
        }
        await test_db.users.insert_one(user)
        
        # 1. Pause account
        pause_result = await pause_service.pause_account(
            username="cycle_user",
            duration="7d",
            reason="vacation",
            message="Going away"
        )
        assert pause_result["accountStatus"] == "paused"
        
        # 2. Check status
        status = await pause_service.get_pause_status("cycle_user")
        assert status["isPaused"] is True
        
        # 3. Update settings
        update_result = await pause_service.update_pause_settings(
            username="cycle_user",
            message="Extended vacation"
        )
        assert update_result["pauseMessage"] == "Extended vacation"
        
        # 4. Unpause
        unpause_result = await pause_service.unpause_account("cycle_user")
        assert unpause_result["accountStatus"] == "active"
        
        # 5. Verify final state
        final_user = await test_db.users.find_one({"username": "cycle_user"})
        assert final_user["accountStatus"] == "active"
        assert final_user["pauseCount"] == 1
        assert final_user["lastUnpausedAt"] is not None
