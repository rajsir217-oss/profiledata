"""
Test suite for Profile View Tracking functionality
Tests the profile view tracking system including:
- Tracking profile views
- Retrieving profile views
- View count statistics
- Duplicate view handling
- Self-view prevention
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app
from database import get_database

client = TestClient(app)

@pytest.fixture
async def test_users(test_db):
    """Create test users for profile view testing"""
    users = [
        {
            "username": "viewer1",
            "password": "hashed_password",
            "firstName": "John",
            "lastName": "Viewer",
            "contactEmail": "viewer1@test.com"
        },
        {
            "username": "viewer2",
            "password": "hashed_password",
            "firstName": "Jane",
            "lastName": "Viewer",
            "contactEmail": "viewer2@test.com"
        },
        {
            "username": "profile_owner",
            "password": "hashed_password",
            "firstName": "Profile",
            "lastName": "Owner",
            "contactEmail": "owner@test.com"
        }
    ]
    
    await test_db.users.insert_many(users)
    return users

@pytest.fixture
async def cleanup_profile_views(test_db):
    """Clean up profile views after each test"""
    yield
    await test_db.profile_views.delete_many({})

class TestProfileViewTracking:
    """Test profile view tracking functionality"""
    
    def test_track_profile_view_success(self, test_users, cleanup_profile_views):
        """Test successfully tracking a profile view"""
        response = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Profile view tracked"
        assert "id" in data
    
    def test_track_self_view_ignored(self, test_users, cleanup_profile_views):
        """Test that self-views are not tracked"""
        response = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "viewer1",
                "viewedByUsername": "viewer1"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Self-view not tracked"
    
    def test_track_view_nonexistent_profile(self, test_users, cleanup_profile_views):
        """Test tracking view for non-existent profile"""
        response = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "nonexistent",
                "viewedByUsername": "viewer1"
            }
        )
        
        assert response.status_code == 404
        assert "Profile user not found" in response.json()["detail"]
    
    def test_track_view_nonexistent_viewer(self, test_users, cleanup_profile_views):
        """Test tracking view by non-existent viewer"""
        response = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "profile_owner",
                "viewedByUsername": "nonexistent"
            }
        )
        
        assert response.status_code == 404
        assert "Viewer user not found" in response.json()["detail"]
    
    def test_duplicate_view_within_24h_updates_timestamp(self, test_users, cleanup_profile_views):
        """Test that duplicate views within 24h update timestamp instead of creating new record"""
        # First view
        response1 = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1"
            }
        )
        assert response1.status_code == 200
        assert "Profile view tracked" in response1.json()["message"]
        
        # Second view within 24h
        response2 = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1"
            }
        )
        assert response2.status_code == 200
        assert "Profile view updated" in response2.json()["message"]
    
    def test_multiple_viewers_tracked_separately(self, test_users, cleanup_profile_views):
        """Test that multiple viewers are tracked separately"""
        # Viewer 1
        response1 = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1"
            }
        )
        assert response1.status_code == 200
        
        # Viewer 2
        response2 = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer2"
            }
        )
        assert response2.status_code == 200
        
        # Both should be tracked
        assert response1.json()["id"] != response2.json()["id"]

class TestGetProfileViews:
    """Test retrieving profile views"""
    
    @pytest.fixture
    async def sample_views(self, test_db, test_users):
        """Create sample profile views"""
        views = [
            {
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1",
                "viewedAt": datetime.utcnow(),
                "createdAt": datetime.utcnow()
            },
            {
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer2",
                "viewedAt": datetime.utcnow() - timedelta(hours=2),
                "createdAt": datetime.utcnow() - timedelta(hours=2)
            }
        ]
        await test_db.profile_views.insert_many(views)
        return views
    
    def test_get_profile_views_success(self, test_users, sample_views, cleanup_profile_views):
        """Test successfully retrieving profile views"""
        response = client.get("/api/users/profile-views/profile_owner")
        
        assert response.status_code == 200
        data = response.json()
        assert "views" in data
        assert "totalViews" in data
        assert "recentViews" in data
        assert len(data["views"]) == 2
        assert data["totalViews"] == 2
    
    def test_get_profile_views_includes_viewer_details(self, test_users, sample_views, cleanup_profile_views):
        """Test that profile views include viewer profile details"""
        response = client.get("/api/users/profile-views/profile_owner")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check first view has viewer profile
        first_view = data["views"][0]
        assert "viewerProfile" in first_view
        assert "username" in first_view["viewerProfile"]
        assert "firstName" in first_view["viewerProfile"]
        assert "password" not in first_view["viewerProfile"]  # Password should be removed
    
    def test_get_profile_views_sorted_by_recent(self, test_users, sample_views, cleanup_profile_views):
        """Test that profile views are sorted by most recent first"""
        response = client.get("/api/users/profile-views/profile_owner")
        
        assert response.status_code == 200
        data = response.json()
        
        # Most recent should be first (viewer1)
        assert data["views"][0]["viewerProfile"]["username"] == "viewer1"
        assert data["views"][1]["viewerProfile"]["username"] == "viewer2"
    
    def test_get_profile_views_with_limit(self, test_users, sample_views, cleanup_profile_views):
        """Test retrieving profile views with limit parameter"""
        response = client.get("/api/users/profile-views/profile_owner?limit=1")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["views"]) == 1
        assert data["totalViews"] == 2  # Total should still be 2
    
    def test_get_profile_views_empty(self, test_users, cleanup_profile_views):
        """Test retrieving profile views when none exist"""
        response = client.get("/api/users/profile-views/profile_owner")
        
        assert response.status_code == 200
        data = response.json()
        assert data["views"] == []
        assert data["totalViews"] == 0

class TestProfileViewCount:
    """Test profile view count statistics"""
    
    @pytest.fixture
    async def multiple_views(self, test_db, test_users):
        """Create multiple views including duplicates"""
        views = [
            {
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1",
                "viewedAt": datetime.utcnow(),
                "createdAt": datetime.utcnow()
            },
            {
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1",
                "viewedAt": datetime.utcnow() - timedelta(days=2),
                "createdAt": datetime.utcnow() - timedelta(days=2)
            },
            {
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer2",
                "viewedAt": datetime.utcnow(),
                "createdAt": datetime.utcnow()
            }
        ]
        await test_db.profile_views.insert_many(views)
        return views
    
    def test_get_view_count_success(self, test_users, multiple_views, cleanup_profile_views):
        """Test getting profile view count statistics"""
        response = client.get("/api/users/profile-views/profile_owner/count")
        
        assert response.status_code == 200
        data = response.json()
        assert "totalViews" in data
        assert "uniqueViewers" in data
        assert data["totalViews"] == 3
        assert data["uniqueViewers"] == 2  # viewer1 and viewer2
    
    def test_get_view_count_no_views(self, test_users, cleanup_profile_views):
        """Test getting view count when no views exist"""
        response = client.get("/api/users/profile-views/profile_owner/count")
        
        assert response.status_code == 200
        data = response.json()
        assert data["totalViews"] == 0
        assert data["uniqueViewers"] == 0

class TestProfileViewIntegration:
    """Integration tests for profile view workflow"""
    
    def test_full_profile_view_workflow(self, test_users, cleanup_profile_views):
        """Test complete workflow: track view, retrieve views, get count"""
        # Step 1: Track a view
        track_response = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1"
            }
        )
        assert track_response.status_code == 200
        
        # Step 2: Retrieve views
        views_response = client.get("/api/users/profile-views/profile_owner")
        assert views_response.status_code == 200
        assert len(views_response.json()["views"]) == 1
        
        # Step 3: Get count
        count_response = client.get("/api/users/profile-views/profile_owner/count")
        assert count_response.status_code == 200
        assert count_response.json()["totalViews"] == 1
        assert count_response.json()["uniqueViewers"] == 1
    
    def test_multiple_profiles_isolated(self, test_users, cleanup_profile_views):
        """Test that views for different profiles are isolated"""
        # Track view for profile_owner
        client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "profile_owner",
                "viewedByUsername": "viewer1"
            }
        )
        
        # Track view for viewer2
        client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "viewer2",
                "viewedByUsername": "viewer1"
            }
        )
        
        # Check profile_owner views
        response1 = client.get("/api/users/profile-views/profile_owner")
        assert len(response1.json()["views"]) == 1
        
        # Check viewer2 views
        response2 = client.get("/api/users/profile-views/viewer2")
        assert len(response2.json()["views"]) == 1

class TestProfileViewEdgeCases:
    """Test edge cases and error handling"""
    
    def test_invalid_username_format(self, cleanup_profile_views):
        """Test handling of invalid username format"""
        response = client.post(
            "/api/users/profile-views",
            json={
                "profileUsername": "",
                "viewedByUsername": "viewer1"
            }
        )
        # Should fail validation or return 404
        assert response.status_code in [400, 404, 422]
    
    def test_missing_required_fields(self, cleanup_profile_views):
        """Test handling of missing required fields"""
        response = client.post(
            "/api/users/profile-views",
            json={"profileUsername": "profile_owner"}
        )
        assert response.status_code == 422  # Validation error
    
    def test_get_views_invalid_limit(self, test_users, cleanup_profile_views):
        """Test handling of invalid limit parameter"""
        response = client.get("/api/users/profile-views/profile_owner?limit=0")
        assert response.status_code == 422  # Validation error (limit must be >= 1)
    
    def test_get_views_excessive_limit(self, test_users, cleanup_profile_views):
        """Test handling of excessive limit parameter"""
        response = client.get("/api/users/profile-views/profile_owner?limit=1000")
        assert response.status_code == 422  # Validation error (limit must be <= 200)
