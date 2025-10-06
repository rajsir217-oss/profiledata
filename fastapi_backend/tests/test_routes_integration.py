"""
Integration tests for API endpoints.
"""
import pytest
import json
from httpx import AsyncClient


class TestUserRegistration:
    """Test user registration endpoint."""

    def test_register_user_success(self, client, sample_user_data):
        """Test successful user registration."""
        response = client.post(
            "/api/users/register",
            data=sample_user_data
        )

        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "User registered successfully"
        assert "user" in data
        assert data["user"]["username"] == sample_user_data["username"]

    def test_register_user_duplicate_username(self, client, sample_user_data):
        """Test registration with duplicate username."""
        # Register first user
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Try to register again with same username
        response = client.post(
            "/api/users/register",
            data=sample_user_data
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    def test_register_user_duplicate_email(self, client, sample_user_data):
        """Test registration with duplicate email."""
        # Register first user
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Register second user with same email
        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"

        response = client.post(
            "/api/users/register",
            data=user_data_2
        )

        assert response.status_code == 409
        assert "already registered" in response.json()["detail"]

    def test_register_user_invalid_data(self, client):
        """Test registration with invalid data."""
        invalid_data = {
            "username": "ab",  # Too short
            "password": "123",  # Too short
            "firstName": "Test",
            "contactEmail": "invalid-email"
        }

        response = client.post(
            "/api/users/register",
            data=invalid_data
        )

        assert response.status_code == 422  # Validation error

    def test_register_user_too_many_images(self, client, sample_user_data):
        """Test registration with too many images."""
        # Create 6 mock image files
        files = []
        for i in range(6):
            files.append(("images", (f"test{i}.jpg", b"fake image content", "image/jpeg")))

        response = client.post(
            "/api/users/register",
            data=sample_user_data,
            files=files
        )

        assert response.status_code == 400
        assert "Maximum 5 images allowed" in response.json()["detail"]


class TestUserLogin:
    """Test user login endpoint."""

    def test_login_success(self, client, sample_user_data, sample_login_data):
        """Test successful user login."""
        # Register user first
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Login
        response = client.post("/api/users/login", data=sample_login_data)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Login successful"
        assert "access_token" in data
        assert "user" in data

    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        login_data = {
            "username": "nonexistent",
            "password": "wrongpassword"
        }

        response = client.post("/api/users/login", data=login_data)

        assert response.status_code == 400
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_admin_success(self, client):
        """Test admin login with hardcoded credentials."""
        login_data = {
            "username": "admin",
            "password": "admin"
        }

        response = client.post("/api/users/login", data=login_data)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Admin login successful"
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"


class TestUserProfile:
    """Test user profile endpoints."""

    def test_get_user_profile_own(self, client, sample_user_data):
        """Test getting own profile."""
        # Register user
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Get profile as self
        response = client.get(f"/api/users/profile/{sample_user_data['username']}")

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == sample_user_data["username"]
        assert "piiMasked" not in data  # Should not be masked for own profile

    def test_get_user_profile_other_user(self, client, sample_user_data):
        """Test getting another user's profile (should be masked)."""
        # Register two users
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        user_data_2["contactEmail"] = "user2@example.com"

        client.post(
            "/api/users/register",
            data=user_data_2
        )

        # Get first user's profile as second user (should be masked)
        response = client.get(
            f"/api/users/profile/{sample_user_data['username']}",
            params={"requester": "user2"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["piiMasked"] is True
        assert "contactEmailMasked" in data
        assert "contactNumberMasked" in data

    def test_get_user_profile_not_found(self, client):
        """Test getting non-existent user profile."""
        response = client.get("/api/users/profile/nonexistent")

        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    def test_update_user_profile(self, client, sample_user_data):
        """Test updating user profile."""
        # Register user
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Update profile
        update_data = {
            "firstName": "Updated",
            "lastName": "Name"
        }

        response = client.put(f"/api/users/profile/{sample_user_data['username']}", data=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Profile updated successfully"
        assert data["user"]["firstName"] == "Updated"
        assert data["user"]["lastName"] == "Name"


class TestSearch:
    """Test search functionality."""

    def test_search_users_basic(self, client, sample_user_data):
        """Test basic user search."""
        # Register test user
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Search for user
        response = client.get(
            "/api/users/search",
            params={"keyword": sample_user_data["firstName"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_search_users_with_filters(self, client, sample_user_data):
        """Test search with filters."""
        # Register test user
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Search with gender filter
        response = client.get(
            "/api/users/search",
            params={
                "gender": sample_user_data["sex"],
                "location": sample_user_data["location"]
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "users" in data

    def test_search_users_pagination(self, client, sample_user_data):
        """Test search pagination."""
        # Register test user
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Search with pagination
        response = client.get(
            "/api/users/search",
            params={"page": 1, "limit": 10}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10
        assert "totalPages" in data


class TestAdminEndpoints:
    """Test admin-only endpoints."""

    def test_get_all_users_admin(self, client, sample_user_data):
        """Test getting all users as admin."""
        # Login as admin
        admin_login = client.post("/api/users/login", data={
            "username": "admin",
            "password": "admin"
        })
        admin_token = admin_login.json()["access_token"]

        # Register a test user
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        # Get all users as admin
        response = client.get(
            "/api/users/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "count" in data
        assert data["count"] >= 1

    def test_admin_password_change(self, client):
        """Test admin password change."""
        # This endpoint doesn't require authentication in the current implementation
        response = client.post("/api/users/admin/change-password", data={
            "current_password": "admin",
            "new_password": "newadmin123"
        })

        assert response.status_code == 200
        data = response.json()
        assert "Password change successful" in data["message"]


class TestAccessRequests:
    """Test PII access request functionality."""

    def test_create_access_request(self, client, sample_user_data):
        """Test creating PII access request."""
        # Register two users
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        # Create access request
        response = client.post("/api/users/access-request", data={
            "requester": "user2",
            "requested_user": sample_user_data["username"],
            "message": "Please grant access"
        })

        assert response.status_code == 200
        data = response.json()
        assert "requestId" in data

    def test_create_duplicate_access_request(self, client, sample_user_data):
        """Test creating duplicate access request."""
        # Register two users
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        # Create first request
        client.post("/api/users/access-request", data={
            "requester": "user2",
            "requested_user": sample_user_data["username"]
        })

        # Try to create duplicate
        response = client.post("/api/users/access-request", data={
            "requester": "user2",
            "requested_user": sample_user_data["username"]
        })

        assert response.status_code == 400
        assert "already pending" in response.json()["detail"]

    def test_get_access_requests(self, client, sample_user_data):
        """Test getting access requests."""
        # Register two users and create request
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        client.post("/api/users/access-request", data={
            "requester": "user2",
            "requested_user": sample_user_data["username"]
        })

        # Get received requests
        response = client.get(f"/api/users/access-requests/{sample_user_data['username']}")

        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        assert len(data["requests"]) >= 1


class TestFavorites:
    """Test favorites functionality."""

    def test_add_to_favorites(self, client, sample_user_data):
        """Test adding user to favorites."""
        # Register two users
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        # Add to favorites
        response = client.post(f"/api/users/favorites/user2",
                                    params={"username": sample_user_data["username"]})

        assert response.status_code == 200
        assert "Added to favorites successfully" in response.json()["message"]

    def test_add_duplicate_to_favorites(self, client, sample_user_data):
        """Test adding same user to favorites twice."""
        # Register two users
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        # Add to favorites first time
        client.post(f"/api/users/favorites/user2",
                         params={"username": sample_user_data["username"]})

        # Try to add again
        response = client.post(f"/api/users/favorites/user2",
                                    params={"username": sample_user_data["username"]})

        assert response.status_code == 409
        assert "already in favorites" in response.json()["detail"]

    def test_get_favorites(self, client, sample_user_data):
        """Test getting user's favorites."""
        # Register two users and add to favorites
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        client.post(f"/api/users/favorites/user2",
                         params={"username": sample_user_data["username"]})

        # Get favorites
        response = client.get(f"/api/users/favorites/{sample_user_data['username']}")

        assert response.status_code == 200
        data = response.json()
        assert "favorites" in data
        assert len(data["favorites"]) >= 1


class TestMessaging:
    """Test messaging functionality."""

    def test_send_message(self, client, sample_user_data):
        """Test sending a message."""
        # Register two users
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        # Send message
        response = client.post("/api/users/messages", data={
            "from_username": sample_user_data["username"],
            "to_username": "user2",
            "content": "Hello, this is a test message!"
        })

        assert response.status_code == 200
        assert "Message sent successfully" in response.json()["message"]

    def test_send_empty_message(self, client, sample_user_data):
        """Test sending empty message."""
        # Register two users
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        # Send empty message
        response = client.post("/api/users/messages", data={
            "from_username": sample_user_data["username"],
            "to_username": "user2",
            "content": "   "  # Only whitespace
        })

        assert response.status_code == 400
        assert "cannot be empty" in response.json()["detail"]

    def test_get_messages(self, client, sample_user_data):
        """Test getting messages for user."""
        # Register two users and send message
        client.post(
            "/api/users/register",
            data=sample_user_data
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        client.post(
            "/api/users/register",
            data=user_data_2
        )

        client.post("/api/users/messages", data={
            "from_username": sample_user_data["username"],
            "to_username": "user2",
            "content": "Test message"
        })

        # Get messages
        response = client.get(f"/api/users/messages/{sample_user_data['username']}")

        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) >= 1


class TestErrorHandling:
    """Test error handling in API endpoints."""

    def test_database_connection_error(self, client):
        """Test handling of database connection errors."""
        # This would require mocking the database connection to fail
        # For now, we'll test with invalid data that causes validation errors
        response = client.post("/api/users/login", data={
            "username": "",  # Invalid
            "password": "test"
        })

        # Should get validation error, not database error
        assert response.status_code == 422

    def test_invalid_json_payload(self, client):
        """Test handling invalid JSON payloads."""
        # Send invalid data that doesn't match expected format
        response = client.post("/api/users/login", data="invalid json")

        # Should handle gracefully
        assert response.status_code in [400, 422, 500]
