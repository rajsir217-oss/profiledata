"""
Test suite for notification race condition prevention
Tests atomic claim mechanism and stuck notification recovery
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from bson import ObjectId

from models.notification_models import (
    NotificationStatus,
    NotificationChannel,
    NotificationTrigger,
    NotificationPriority
)


class MockCollection:
    """Mock MongoDB collection with find_one_and_update support"""
    
    def __init__(self):
        self.data = []
        self.find_one_and_update_calls = []
        self.update_many_calls = []
    
    async def find_one_and_update(self, query, update, return_document=False):
        """Atomic find and update - simulates MongoDB behavior"""
        self.find_one_and_update_calls.append({"query": query, "update": update})
        
        for i, item in enumerate(self.data):
            # Check if item matches query
            if self._matches_query(item, query):
                # Apply update
                if "$set" in update:
                    item.update(update["$set"])
                return item
        return None
    
    async def update_many(self, query, update):
        """Update multiple documents"""
        self.update_many_calls.append({"query": query, "update": update})
        
        modified = 0
        for item in self.data:
            if self._matches_query(item, query):
                if "$set" in update:
                    item.update(update["$set"])
                modified += 1
        
        return MagicMock(modified_count=modified)
    
    async def insert_one(self, document):
        document["_id"] = ObjectId()
        self.data.append(document)
        return MagicMock(inserted_id=document["_id"])
    
    async def find_one(self, query):
        for item in self.data:
            if self._matches_query(item, query):
                return item
        return None
    
    def _matches_query(self, item, query):
        """Simple query matching for tests"""
        for key, value in query.items():
            if key.startswith("$"):
                continue  # Skip operators for simple matching
            if key not in item:
                return False
            if isinstance(value, dict) and "$in" in value:
                if item[key] not in value["$in"]:
                    return False
            elif item.get(key) != value:
                return False
        return True


class TestAtomicNotificationClaim:
    """Tests for atomic notification claiming to prevent race conditions"""
    
    @pytest.mark.asyncio
    async def test_get_pending_uses_find_one_and_update(self):
        """Test that get_pending_notifications uses atomic find_one_and_update"""
        mock_collection = MockCollection()
        mock_collection.data = [
            {
                "_id": ObjectId(),
                "username": "user1",
                "status": NotificationStatus.PENDING,
                "channels": [NotificationChannel.EMAIL],
                "trigger": NotificationTrigger.FAVORITED,
                "priority": NotificationPriority.MEDIUM,
                "templateData": {},
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                "attempts": 0
            }
        ]
        
        mock_db = MagicMock()
        mock_db.notification_queue = mock_collection
        mock_db.notification_preferences = MagicMock()
        mock_db.notification_preferences.find_one = AsyncMock(return_value=None)
        
        from services.notification_service import NotificationService
        service = NotificationService(mock_db)
        
        notifications = await service.get_pending_notifications(
            channel=NotificationChannel.EMAIL,
            limit=10
        )
        
        # Verify find_one_and_update was called (atomic operation)
        assert len(mock_collection.find_one_and_update_calls) > 0
        
        # Verify status was set to PROCESSING
        call = mock_collection.find_one_and_update_calls[0]
        assert call["update"]["$set"]["status"] == NotificationStatus.PROCESSING
    
    @pytest.mark.asyncio
    async def test_notification_claimed_only_once(self):
        """Test that a notification can only be claimed by one process"""
        # This test verifies the concept - actual MongoDB find_one_and_update
        # is atomic and prevents race conditions. Our mock simulates this.
        
        mock_collection = MockCollection()
        notification_id = ObjectId()
        
        # Override find_one_and_update to properly simulate atomic behavior
        claim_count = 0
        original_data = {
            "_id": notification_id,
            "username": "user1",
            "status": NotificationStatus.PENDING,
            "channels": [NotificationChannel.EMAIL],
            "trigger": NotificationTrigger.FAVORITED,
            "priority": NotificationPriority.MEDIUM,
            "templateData": {},
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "attempts": 0
        }
        mock_collection.data = [original_data.copy()]
        
        async def atomic_find_and_update(query, update, return_document=False):
            nonlocal claim_count
            # Only return document on first call (simulates atomic claim)
            for item in mock_collection.data:
                if item.get("status") == NotificationStatus.PENDING:
                    item["status"] = NotificationStatus.PROCESSING
                    claim_count += 1
                    return item
            return None
        
        mock_collection.find_one_and_update = atomic_find_and_update
        
        mock_db = MagicMock()
        mock_db.notification_queue = mock_collection
        mock_db.notification_preferences = MagicMock()
        mock_db.notification_preferences.find_one = AsyncMock(return_value=None)
        
        from services.notification_service import NotificationService
        service = NotificationService(mock_db)
        
        # First claim should succeed
        notifications1 = await service.get_pending_notifications(
            channel=NotificationChannel.EMAIL,
            limit=10
        )
        assert len(notifications1) == 1
        assert claim_count == 1
        
        # Second claim should return empty (notification already PROCESSING)
        notifications2 = await service.get_pending_notifications(
            channel=NotificationChannel.EMAIL,
            limit=10
        )
        assert len(notifications2) == 0
        assert claim_count == 1  # Still 1, not claimed again
    
    @pytest.mark.asyncio
    async def test_processing_status_exists(self):
        """Test that PROCESSING status exists in NotificationStatus enum"""
        assert hasattr(NotificationStatus, 'PROCESSING')
        assert NotificationStatus.PROCESSING.value == "processing"


class TestStuckNotificationRecovery:
    """Tests for recovering notifications stuck in PROCESSING state"""
    
    @pytest.mark.asyncio
    async def test_reset_stuck_processing(self):
        """Test that stuck PROCESSING notifications are reset to PENDING"""
        mock_collection = MockCollection()
        
        # Add a stuck notification (processing started 15 minutes ago)
        stuck_time = datetime.utcnow() - timedelta(minutes=15)
        mock_collection.data = [
            {
                "_id": ObjectId(),
                "username": "user1",
                "status": NotificationStatus.PROCESSING,
                "processingStartedAt": stuck_time,
                "channels": [NotificationChannel.EMAIL],
                "trigger": NotificationTrigger.FAVORITED,
                "priority": NotificationPriority.MEDIUM,
                "templateData": {},
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                "attempts": 0
            }
        ]
        
        mock_db = MagicMock()
        mock_db.notification_queue = mock_collection
        mock_db.notification_preferences = MagicMock()
        
        from services.notification_service import NotificationService
        service = NotificationService(mock_db)
        
        # Reset stuck notifications (timeout 10 minutes)
        reset_count = await service.reset_stuck_processing(timeout_minutes=10)
        
        # Verify update_many was called
        assert len(mock_collection.update_many_calls) == 1
        
        # Verify the query looks for PROCESSING status
        call = mock_collection.update_many_calls[0]
        assert call["query"]["status"] == NotificationStatus.PROCESSING
        
        # Verify it resets to PENDING
        assert call["update"]["$set"]["status"] == NotificationStatus.PENDING
    
    @pytest.mark.asyncio
    async def test_recent_processing_not_reset(self):
        """Test that recently started PROCESSING notifications are not reset"""
        mock_collection = MockCollection()
        
        # Add a notification that just started processing (1 minute ago)
        recent_time = datetime.utcnow() - timedelta(minutes=1)
        mock_collection.data = [
            {
                "_id": ObjectId(),
                "username": "user1",
                "status": NotificationStatus.PROCESSING,
                "processingStartedAt": recent_time,
                "channels": [NotificationChannel.EMAIL],
                "trigger": NotificationTrigger.FAVORITED,
                "priority": NotificationPriority.MEDIUM,
                "templateData": {},
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                "attempts": 0
            }
        ]
        
        mock_db = MagicMock()
        mock_db.notification_queue = mock_collection
        mock_db.notification_preferences = MagicMock()
        
        from services.notification_service import NotificationService
        service = NotificationService(mock_db)
        
        # Reset with 10 minute timeout - should not affect recent notification
        reset_count = await service.reset_stuck_processing(timeout_minutes=10)
        
        # The notification should still be PROCESSING (not reset)
        # because it started less than 10 minutes ago
        assert mock_collection.data[0]["status"] == NotificationStatus.PROCESSING


class TestNotificationStatusTransitions:
    """Tests for notification status transitions"""
    
    def test_valid_status_values(self):
        """Test all expected status values exist"""
        expected_statuses = [
            "pending",
            "scheduled",
            "processing",
            "sent",
            "delivered",
            "failed",
            "cancelled"
        ]
        
        for status in expected_statuses:
            assert status in [s.value for s in NotificationStatus]
    
    def test_processing_status_value(self):
        """Test PROCESSING status has correct value"""
        assert NotificationStatus.PROCESSING.value == "processing"
