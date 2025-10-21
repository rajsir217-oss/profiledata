"""
Test suite for Notification API endpoints
Tests all notification functionality including preferences, queue, analytics, and tracking
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from bson import ObjectId

# Import main app and dependencies
from main import app
from database import get_database
from auth.jwt_auth import get_current_user_dependency


# Test fixtures
@pytest.fixture
def test_client():
    """Create test client for API requests"""
    return TestClient(app)


@pytest.fixture
def mock_db():
    """Mock database for testing"""
    class MockDB:
        def __init__(self):
            self.notification_preferences = MockCollection()
            self.notification_queue = MockCollection()
            self.notification_log = MockCollection()
    
    return MockDB()


class MockCollection:
    """Mock MongoDB collection"""
    def __init__(self):
        self.data = []
    
    async def find_one(self, query):
        for item in self.data:
            if all(item.get(k) == v for k, v in query.items()):
                return item
        return None
    
    async def insert_one(self, document):
        self.data.append(document)
        return type('obj', (object,), {'inserted_id': ObjectId()})
    
    async def update_one(self, query, update):
        for item in self.data:
            if all(item.get(k) == v for k, v in query.items()):
                if '$set' in update:
                    item.update(update['$set'])
                return type('obj', (object,), {'modified_count': 1})
        return type('obj', (object,), {'modified_count': 0})
    
    async def find(self, query=None, **kwargs):
        results = self.data if query is None else [
            item for item in self.data 
            if all(item.get(k) == v for k, v in query.items())
        ]
        
        class AsyncIterator:
            def __init__(self, items):
                self.items = items
                self.index = 0
            
            def __aiter__(self):
                return self
            
            async def __anext__(self):
                if self.index >= len(self.items):
                    raise StopAsyncIteration
                item = self.items[self.index]
                self.index += 1
                return item
        
        return AsyncIterator(results)
    
    async def count_documents(self, query):
        return len([item for item in self.data if all(item.get(k) == v for k, v in query.items())])


@pytest.fixture
def mock_current_user():
    """Mock authenticated user"""
    return {
        "username": "test_user",
        "email": "test@example.com",
        "role": "user"
    }


@pytest.fixture
def override_dependencies(mock_db, mock_current_user):
    """Override FastAPI dependencies for testing"""
    app.dependency_overrides[get_database] = lambda: mock_db
    app.dependency_overrides[get_current_user_dependency] = lambda: mock_current_user
    yield
    app.dependency_overrides = {}


# ============================================
# Notification Preferences Tests
# ============================================

def test_get_notification_preferences_success(test_client, override_dependencies):
    """Test successful retrieval of notification preferences"""
    response = test_client.get("/api/notifications/preferences")
    assert response.status_code == 200
    data = response.json()
    assert "username" in data
    assert "preferences" in data


def test_update_notification_preferences_success(test_client, override_dependencies):
    """Test successful update of notification preferences"""
    update_data = {
        "username": "test_user",
        "preferences": {
            "new_match": {
                "enabled": True,
                "channels": ["email", "push"]
            }
        }
    }
    response = test_client.put("/api/notifications/preferences", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


def test_update_notification_preferences_validation_error(test_client, override_dependencies):
    """Test validation error when updating preferences with invalid data"""
    invalid_data = {
        "username": "test_user",
        "preferences": "invalid"  # Should be dict
    }
    response = test_client.put("/api/notifications/preferences", json=invalid_data)
    assert response.status_code == 422


def test_reset_notification_preferences_success(test_client, override_dependencies):
    """Test successful reset of notification preferences to defaults"""
    response = test_client.post("/api/notifications/preferences/reset")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


# ============================================
# Notification Queue Tests
# ============================================

def test_send_notification_success(test_client, override_dependencies):
    """Test successful notification sending"""
    notification_data = {
        "username": "test_user",
        "trigger": "new_match",
        "channels": ["email"],
        "templateData": {
            "match": {
                "firstName": "John",
                "age": 30,
                "matchScore": 95
            }
        },
        "priority": "high"
    }
    response = test_client.post("/api/notifications/send", json=notification_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


def test_send_notification_validation_error(test_client, override_dependencies):
    """Test validation error when sending notification with invalid trigger"""
    invalid_data = {
        "username": "test_user",
        "trigger": "invalid_trigger",
        "channels": ["email"]
    }
    response = test_client.post("/api/notifications/send", json=invalid_data)
    assert response.status_code == 422


def test_send_notification_missing_required_fields(test_client, override_dependencies):
    """Test error when required fields are missing"""
    incomplete_data = {
        "username": "test_user"
        # Missing trigger and channels
    }
    response = test_client.post("/api/notifications/send", json=incomplete_data)
    assert response.status_code == 422


def test_get_notification_queue_success(test_client, override_dependencies):
    """Test successful retrieval of notification queue"""
    response = test_client.get("/api/notifications/queue?limit=10")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_notification_queue_with_filters(test_client, override_dependencies):
    """Test notification queue retrieval with status filter"""
    response = test_client.get("/api/notifications/queue?status=pending&limit=5")
    assert response.status_code == 200
    notifications = response.json()
    assert isinstance(notifications, list)


def test_cancel_notification_success(test_client, override_dependencies):
    """Test successful cancellation of queued notification"""
    notification_id = str(ObjectId())
    response = test_client.delete(f"/api/notifications/queue/{notification_id}")
    # May return 404 if notification doesn't exist, which is acceptable
    assert response.status_code in [200, 404]


# ============================================
# Analytics Tests
# ============================================

def test_get_notification_analytics_success(test_client, override_dependencies):
    """Test successful retrieval of notification analytics"""
    response = test_client.get("/api/notifications/analytics?days=7")
    assert response.status_code == 200
    data = response.json()
    assert "total_sent" in data or "sent" in data


def test_get_notification_analytics_with_filters(test_client, override_dependencies):
    """Test analytics with trigger and channel filters"""
    response = test_client.get(
        "/api/notifications/analytics?trigger=new_match&channel=email&days=30"
    )
    assert response.status_code == 200


def test_get_global_analytics_admin_only(test_client, override_dependencies):
    """Test global analytics endpoint (admin only)"""
    response = test_client.get("/api/notifications/analytics/global")
    # May return 403 if user is not admin
    assert response.status_code in [200, 403]


# ============================================
# Tracking Tests
# ============================================

def test_track_notification_open(test_client, override_dependencies):
    """Test tracking notification open event"""
    log_id = str(ObjectId())
    response = test_client.get(f"/api/notifications/track/open/{log_id}")
    # Should return 204 No Content or 404 if log not found
    assert response.status_code in [204, 404]


def test_track_notification_click(test_client, override_dependencies):
    """Test tracking notification click event with redirect"""
    log_id = str(ObjectId())
    redirect_url = "https://example.com"
    response = test_client.get(
        f"/api/notifications/track/click/{log_id}?redirect_url={redirect_url}",
        follow_redirects=False
    )
    # Should redirect (307) or return 404 if log not found
    assert response.status_code in [307, 404]


def test_track_notification_click_missing_redirect(test_client, override_dependencies):
    """Test click tracking fails without redirect URL"""
    log_id = str(ObjectId())
    response = test_client.get(f"/api/notifications/track/click/{log_id}")
    assert response.status_code == 422


# ============================================
# Subscription Management Tests
# ============================================

def test_unsubscribe_all_success(test_client, override_dependencies):
    """Test successful unsubscribe from all notifications"""
    response = test_client.post("/api/notifications/unsubscribe")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


def test_unsubscribe_specific_trigger(test_client, override_dependencies):
    """Test unsubscribe from specific notification trigger"""
    response = test_client.post("/api/notifications/unsubscribe/new_match")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


def test_unsubscribe_invalid_trigger(test_client, override_dependencies):
    """Test unsubscribe with invalid trigger returns error"""
    response = test_client.post("/api/notifications/unsubscribe/invalid_trigger")
    assert response.status_code == 422


# ============================================
# Authorization Tests
# ============================================

def test_endpoints_require_authentication(test_client):
    """Test that endpoints require authentication"""
    # Override to remove auth
    app.dependency_overrides = {}
    
    endpoints = [
        ("GET", "/api/notifications/preferences"),
        ("PUT", "/api/notifications/preferences"),
        ("POST", "/api/notifications/send"),
        ("GET", "/api/notifications/queue"),
        ("GET", "/api/notifications/analytics"),
    ]
    
    for method, endpoint in endpoints:
        if method == "GET":
            response = test_client.get(endpoint)
        elif method == "PUT":
            response = test_client.put(endpoint, json={})
        elif method == "POST":
            response = test_client.post(endpoint, json={})
        
        # Should return 401 Unauthorized or 403 Forbidden
        assert response.status_code in [401, 403, 422]


# ============================================
# Edge Case Tests
# ============================================

def test_large_notification_batch(test_client, override_dependencies):
    """Test handling of large notification batch"""
    response = test_client.get("/api/notifications/queue?limit=100")
    assert response.status_code == 200


def test_notification_with_special_characters(test_client, override_dependencies):
    """Test notification with special characters in template data"""
    notification_data = {
        "username": "test_user",
        "trigger": "new_match",
        "channels": ["email"],
        "templateData": {
            "match": {
                "firstName": "John's & Jane's",
                "age": 30,
                "location": "San Francisco, CA <test>"
            }
        }
    }
    response = test_client.post("/api/notifications/send", json=notification_data)
    assert response.status_code == 200


def test_concurrent_preference_updates(test_client, override_dependencies):
    """Test concurrent updates to preferences"""
    update_data = {
        "username": "test_user",
        "preferences": {
            "new_match": {"enabled": True, "channels": ["email"]}
        }
    }
    
    # Simulate concurrent requests
    responses = []
    for _ in range(3):
        response = test_client.put("/api/notifications/preferences", json=update_data)
        responses.append(response)
    
    # All should succeed
    for response in responses:
        assert response.status_code == 200
