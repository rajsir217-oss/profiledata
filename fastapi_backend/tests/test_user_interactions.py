"""
Test suite for User Interactions
Tests favorites, shortlist, and exclusions functionality including:
- Adding/removing favorites
- Adding/removing shortlist
- Adding/removing exclusions
- Duplicate handling
- Cross-feature interactions
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from main import app
from database import get_database

client = TestClient(app)

@pytest.fixture
async def interaction_users(test_db):
    """Create test users for interaction testing"""
    users = [
        {
            "username": "user_a",
            "password": "hashed_password",
            "firstName": "User",
            "lastName": "A",
            "contactEmail": "usera@test.com"
        },
        {
            "username": "user_b",
            "password": "hashed_password",
            "firstName": "User",
            "lastName": "B",
            "contactEmail": "userb@test.com"
        },
        {
            "username": "user_c",
            "password": "hashed_password",
            "firstName": "User",
            "lastName": "C",
            "contactEmail": "userc@test.com"
        }
    ]
    
    await test_db.users.insert_many(users)
    return users

@pytest.fixture
async def cleanup_interactions(test_db):
    """Clean up after interaction tests"""
    yield
    await test_db.favorites.delete_many({})
    await test_db.shortlists.delete_many({})
    await test_db.exclusions.delete_many({})

class TestFavorites:
    """Test favorites functionality"""
    
    def test_add_to_favorites_success(self, interaction_users, cleanup_interactions):
        """Test successfully adding user to favorites"""
        response = client.post(
            "/api/users/favorites/user_b?username=user_a"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "added" in data["message"].lower() or "success" in data["message"].lower()
    
    def test_add_to_favorites_nonexistent_user(self, interaction_users, cleanup_interactions):
        """Test adding non-existent user to favorites"""
        response = client.post(
            "/api/users/favorites/nonexistent?username=user_a"
        )
        
        assert response.status_code == 404
    
    def test_add_self_to_favorites(self, interaction_users, cleanup_interactions):
        """Test that user cannot favorite themselves"""
        response = client.post(
            "/api/users/favorites/user_a?username=user_a"
        )
        
        # Should return error or be prevented
        assert response.status_code in [400, 422]
    
    def test_duplicate_favorite(self, interaction_users, cleanup_interactions):
        """Test adding same user to favorites twice"""
        # First add
        response1 = client.post(
            "/api/users/favorites/user_b?username=user_a"
        )
        assert response1.status_code == 200
        
        # Second add (duplicate)
        response2 = client.post(
            "/api/users/favorites/user_b?username=user_a"
        )
        
        # Should handle gracefully (already exists or success)
        assert response2.status_code in [200, 409]
    
    def test_remove_from_favorites_success(self, interaction_users, cleanup_interactions):
        """Test successfully removing user from favorites"""
        # First add
        client.post("/api/users/favorites/user_b?username=user_a")
        
        # Then remove
        response = client.delete("/api/users/favorites/user_b?username=user_a")
        
        assert response.status_code == 200
        assert "removed" in response.json()["message"].lower()
    
    def test_remove_nonexistent_favorite(self, interaction_users, cleanup_interactions):
        """Test removing user that's not in favorites"""
        response = client.delete("/api/users/favorites/user_b?username=user_a")
        
        # Should return 404 or success message
        assert response.status_code in [200, 404]
    
    def test_get_favorites_list(self, interaction_users, cleanup_interactions):
        """Test retrieving list of favorites"""
        # Add multiple favorites
        client.post("/api/users/favorites/user_b?username=user_a")
        client.post("/api/users/favorites/user_c?username=user_a")
        
        # Get favorites
        response = client.get("/api/users/favorites/user_a")
        
        assert response.status_code == 200
        data = response.json()
        assert "favorites" in data
        assert len(data["favorites"]) == 2

class TestShortlist:
    """Test shortlist functionality"""
    
    def test_add_to_shortlist_success(self, interaction_users, cleanup_interactions):
        """Test successfully adding user to shortlist"""
        response = client.post(
            "/api/users/shortlist/user_b?username=user_a"
        )
        
        assert response.status_code == 200
    
    def test_add_to_shortlist_with_notes(self, interaction_users, cleanup_interactions):
        """Test adding user to shortlist with notes"""
        # This depends on API implementation
        # Placeholder for future enhancement
        pass
    
    def test_remove_from_shortlist_success(self, interaction_users, cleanup_interactions):
        """Test successfully removing user from shortlist"""
        # First add
        client.post("/api/users/shortlist/user_b?username=user_a")
        
        # Then remove
        response = client.delete("/api/users/shortlist/user_b?username=user_a")
        
        assert response.status_code == 200
    
    def test_get_shortlist(self, interaction_users, cleanup_interactions):
        """Test retrieving shortlist"""
        # Add users to shortlist
        client.post("/api/users/shortlist/user_b?username=user_a")
        client.post("/api/users/shortlist/user_c?username=user_a")
        
        # Get shortlist
        response = client.get("/api/users/shortlist/user_a")
        
        assert response.status_code == 200
        data = response.json()
        assert "shortlist" in data
        assert len(data["shortlist"]) == 2
    
    def test_duplicate_shortlist(self, interaction_users, cleanup_interactions):
        """Test adding same user to shortlist twice"""
        response1 = client.post("/api/users/shortlist/user_b?username=user_a")
        response2 = client.post("/api/users/shortlist/user_b?username=user_a")
        
        assert response1.status_code == 200
        assert response2.status_code in [200, 409]

class TestExclusions:
    """Test exclusions/blocking functionality"""
    
    def test_add_to_exclusions_success(self, interaction_users, cleanup_interactions):
        """Test successfully adding user to exclusions"""
        response = client.post(
            "/api/users/exclusions/user_b?username=user_a"
        )
        
        assert response.status_code == 200
    
    def test_add_to_exclusions_with_reason(self, interaction_users, cleanup_interactions):
        """Test adding user to exclusions with reason"""
        # This depends on API implementation
        pass
    
    def test_remove_from_exclusions_success(self, interaction_users, cleanup_interactions):
        """Test successfully removing user from exclusions (unblock)"""
        # First add
        client.post("/api/users/exclusions/user_b?username=user_a")
        
        # Then remove
        response = client.delete("/api/users/exclusions/user_b?username=user_a")
        
        assert response.status_code == 200
    
    def test_get_exclusions_list(self, interaction_users, cleanup_interactions):
        """Test retrieving exclusions list"""
        # Add exclusions
        client.post("/api/users/exclusions/user_b?username=user_a")
        client.post("/api/users/exclusions/user_c?username=user_a")
        
        # Get exclusions
        response = client.get("/api/users/exclusions/user_a")
        
        assert response.status_code == 200
        data = response.json()
        assert "exclusions" in data
        assert len(data["exclusions"]) == 2
    
    def test_exclusion_affects_search_results(self, interaction_users, cleanup_interactions):
        """Test that excluded users don't appear in search results"""
        # Add exclusion
        client.post("/api/users/exclusions/user_b?username=user_a")
        
        # Search as user_a
        response = client.get("/api/users/search?username=user_a")
        
        assert response.status_code == 200
        data = response.json()
        
        # user_b should not be in results
        usernames = [user["username"] for user in data["users"]]
        assert "user_b" not in usernames

class TestGetTheirFavorites:
    """Test retrieving users who favorited you"""
    
    @pytest.fixture
    async def setup_their_favorites(self, test_db, interaction_users):
        """Setup: Other users favorite user_a"""
        favorites = [
            {
                "userUsername": "user_b",
                "favoriteUsername": "user_a",
                "createdAt": datetime.utcnow()
            },
            {
                "userUsername": "user_c",
                "favoriteUsername": "user_a",
                "createdAt": datetime.utcnow()
            }
        ]
        await test_db.favorites.insert_many(favorites)
        return favorites
    
    def test_get_their_favorites(self, interaction_users, setup_their_favorites, cleanup_interactions):
        """Test getting list of users who favorited you"""
        response = client.get("/api/users/their-favorites/user_a")
        
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert len(data["users"]) == 2
        
        # Check that user_b and user_c are in the list
        usernames = [user["username"] for user in data["users"]]
        assert "user_b" in usernames
        assert "user_c" in usernames

class TestGetTheirShortlists:
    """Test retrieving users who shortlisted you"""
    
    @pytest.fixture
    async def setup_their_shortlists(self, test_db, interaction_users):
        """Setup: Other users shortlist user_a"""
        shortlists = [
            {
                "userUsername": "user_b",
                "shortlistedUsername": "user_a",
                "notes": "Interesting profile",
                "createdAt": datetime.utcnow()
            }
        ]
        await test_db.shortlists.insert_many(shortlists)
        return shortlists
    
    def test_get_their_shortlists(self, interaction_users, setup_their_shortlists, cleanup_interactions):
        """Test getting list of users who shortlisted you"""
        response = client.get("/api/users/their-shortlists/user_a")
        
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert len(data["users"]) == 1

class TestCrossFeatureInteractions:
    """Test interactions between different features"""
    
    def test_favorite_and_shortlist_same_user(self, interaction_users, cleanup_interactions):
        """Test that user can be both favorited and shortlisted"""
        # Add to favorites
        fav_response = client.post("/api/users/favorites/user_b?username=user_a")
        assert fav_response.status_code == 200
        
        # Add to shortlist
        short_response = client.post("/api/users/shortlist/user_b?username=user_a")
        assert short_response.status_code == 200
        
        # Both should succeed
    
    def test_favorite_then_exclude(self, interaction_users, cleanup_interactions):
        """Test favoriting then excluding same user"""
        # Add to favorites
        client.post("/api/users/favorites/user_b?username=user_a")
        
        # Add to exclusions
        response = client.post("/api/users/exclusions/user_b?username=user_a")
        
        assert response.status_code == 200
        # Both can coexist (user might want to track who they blocked)
    
    def test_exclude_removes_from_search(self, interaction_users, cleanup_interactions):
        """Test that excluding user removes them from search results"""
        # Exclude user_b
        client.post("/api/users/exclusions/user_b?username=user_a")
        
        # Search should not include user_b
        response = client.get("/api/users/search?username=user_a")
        
        assert response.status_code == 200
        usernames = [user["username"] for user in response.json()["users"]]
        assert "user_b" not in usernames

class TestInteractionEdgeCases:
    """Test edge cases for user interactions"""
    
    def test_multiple_users_favorite_same_profile(self, interaction_users, cleanup_interactions):
        """Test multiple users can favorite the same profile"""
        response1 = client.post("/api/users/favorites/user_c?username=user_a")
        response2 = client.post("/api/users/favorites/user_c?username=user_b")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # user_c should have 2 people who favorited them
        their_favs = client.get("/api/users/their-favorites/user_c")
        assert len(their_favs.json()["users"]) == 2
    
    def test_bidirectional_favorites(self, interaction_users, cleanup_interactions):
        """Test that both users can favorite each other"""
        response1 = client.post("/api/users/favorites/user_b?username=user_a")
        response2 = client.post("/api/users/favorites/user_a?username=user_b")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
    
    def test_remove_all_interactions(self, interaction_users, cleanup_interactions):
        """Test removing all interactions with a user"""
        # Add to all lists
        client.post("/api/users/favorites/user_b?username=user_a")
        client.post("/api/users/shortlist/user_b?username=user_a")
        client.post("/api/users/exclusions/user_b?username=user_a")
        
        # Remove from all
        fav_response = client.delete("/api/users/favorites/user_b?username=user_a")
        short_response = client.delete("/api/users/shortlist/user_b?username=user_a")
        excl_response = client.delete("/api/users/exclusions/user_b?username=user_a")
        
        assert fav_response.status_code == 200
        assert short_response.status_code == 200
        assert excl_response.status_code == 200
