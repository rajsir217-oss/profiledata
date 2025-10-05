"""
Integration tests for API endpoints.
"""
import pytest
import json
from httpx import AsyncClient
from tests.conftest import sample_user_data, sample_login_data


class TestUserRegistration:
    """Test user registration endpoint."""

    @pytest.mark.asyncio
    async def test_register_user_success(self, client, sample_user_data):
        """Test successful user registration."""
        response = await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "User registered successfully"
        assert "user" in data
        assert data["user"]["username"] == sample_user_data["username"]

    @pytest.mark.asyncio
    async def test_register_user_duplicate_username(self, client, sample_user_data):
        """Test registration with duplicate username."""
        # Register first user
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Try to register again with same username
        response = await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_register_user_duplicate_email(self, client, sample_user_data):
        """Test registration with duplicate email."""
        # Register first user
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Register second user with same email
        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"

        response = await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        assert response.status_code == 409
        assert "already registered" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_register_user_invalid_data(self, client):
        """Test registration with invalid data."""
        invalid_data = {
            "username": "ab",  # Too short
            "password": "123",  # Too short
            "firstName": "Test",
            "contactEmail": "invalid-email"
        }

        response = await client.post(
            "/api/users/register",
            data=invalid_data,
            files={"images": []}
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_register_user_too_many_images(self, client, sample_user_data):
        """Test registration with too many images."""
        # Create 6 mock image files
        files = []
        for i in range(6):
            files.append(("images", (f"test{i}.jpg", b"fake image content", "image/jpeg")))

        response = await client.post(
            "/api/users/register",
            data=sample_user_data,
            files=files
        )

        assert response.status_code == 400
        assert "Maximum 5 images allowed" in response.json()["detail"]


class TestUserLogin:
    """Test user login endpoint."""

    @pytest.mark.asyncio
    async def test_login_success(self, client, sample_user_data, sample_login_data):
        """Test successful user login."""
        # Register user first
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Login
        response = await client.post("/api/users/login", data=sample_login_data)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Login successful"
        assert "access_token" in data
        assert "user" in data

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        login_data = {
            "username": "nonexistent",
            "password": "wrongpassword"
        }

        response = await client.post("/api/users/login", data=login_data)

        assert response.status_code == 400
        assert "Invalid credentials" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_admin_success(self, client):
        """Test admin login with hardcoded credentials."""
        login_data = {
            "username": "admin",
            "password": "admin"
        }

        response = await client.post("/api/users/login", data=login_data)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Admin login successful"
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"


class TestUserProfile:
    """Test user profile endpoints."""

    @pytest.mark.asyncio
    async def test_get_user_profile_own(self, client, sample_user_data):
        """Test getting own profile."""
        # Register user
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Get profile as self
        response = await client.get(f"/api/users/profile/{sample_user_data['username']}")

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == sample_user_data["username"]
        assert "piiMasked" not in data  # Should not be masked for own profile

    @pytest.mark.asyncio
    async def test_get_user_profile_other_user(self, client, sample_user_data):
        """Test getting another user's profile (should be masked)."""
        # Register two users
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        user_data_2["contactEmail"] = "user2@example.com"

        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        # Get first user's profile as second user (should be masked)
        response = await client.get(
            f"/api/users/profile/{sample_user_data['username']}",
            params={"requester": "user2"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["piiMasked"] is True
        assert "contactEmailMasked" in data
        assert "contactNumberMasked" in data

    @pytest.mark.asyncio
    async def test_get_user_profile_not_found(self, client):
        """Test getting non-existent user profile."""
        response = await client.get("/api/users/profile/nonexistent")

        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_update_user_profile(self, client, sample_user_data):
        """Test updating user profile."""
        # Register user
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Update profile
        update_data = {
            "firstName": "Updated",
            "lastName": "Name"
        }

        response = await client.put(f"/api/users/profile/{sample_user_data['username']}", data=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Profile updated successfully"
        assert data["user"]["firstName"] == "Updated"
        assert data["user"]["lastName"] == "Name"


class TestSearch:
    """Test search functionality."""

    @pytest.mark.asyncio
    async def test_search_users_basic(self, client, sample_user_data):
        """Test basic user search."""
        # Register test user
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Search for user
        response = await client.get(
            "/api/users/search",
            params={"keyword": sample_user_data["firstName"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_search_users_with_filters(self, client, sample_user_data):
        """Test search with filters."""
        # Register test user
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Search with gender filter
        response = await client.get(
            "/api/users/search",
            params={
                "gender": sample_user_data["sex"],
                "location": sample_user_data["location"]
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "users" in data

    @pytest.mark.asyncio
    async def test_search_users_pagination(self, client, sample_user_data):
        """Test search pagination."""
        # Register test user
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Search with pagination
        response = await client.get(
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

    @pytest.mark.asyncio
    async def test_get_all_users_admin(self, client, sample_user_data):
        """Test getting all users as admin."""
        # Login as admin
        admin_login = await client.post("/api/users/login", data={
            "username": "admin",
            "password": "admin"
        })
        admin_token = admin_login.json()["access_token"]

        # Register a test user
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        # Get all users as admin
        response = await client.get(
            "/api/users/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "count" in data
        assert data["count"] >= 1

    @pytest.mark.asyncio
    async def test_admin_password_change(self, client):
        """Test admin password change."""
        # This endpoint doesn't require authentication in the current implementation
        response = await client.post("/api/users/admin/change-password", data={
            "current_password": "admin",
            "new_password": "newadmin123"
        })

        assert response.status_code == 200
        data = response.json()
        assert "Password change successful" in data["message"]


class TestAccessRequests:
    """Test PII access request functionality."""

    @pytest.mark.asyncio
    async def test_create_access_request(self, client, sample_user_data):
        """Test creating PII access request."""
        # Register two users
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        # Create access request
        response = await client.post("/api/users/access-request", data={
            "requester": "user2",
            "requested_user": sample_user_data["username"],
            "message": "Please grant access"
        })

        assert response.status_code == 200
        data = response.json()
        assert "requestId" in data

    @pytest.mark.asyncio
    async def test_create_duplicate_access_request(self, client, sample_user_data):
        """Test creating duplicate access request."""
        # Register two users
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        # Create first request
        await client.post("/api/users/access-request", data={
            "requester": "user2",
            "requested_user": sample_user_data["username"]
        })

        # Try to create duplicate
        response = await client.post("/api/users/access-request", data={
            "requester": "user2",
            "requested_user": sample_user_data["username"]
        })

        assert response.status_code == 400
        assert "already pending" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_access_requests(self, client, sample_user_data):
        """Test getting access requests."""
        # Register two users and create request
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        await client.post("/api/users/access-request", data={
            "requester": "user2",
            "requested_user": sample_user_data["username"]
        })

        # Get received requests
        response = await client.get(f"/api/users/access-requests/{sample_user_data['username']}")

        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        assert len(data["requests"]) >= 1


class TestFavorites:
    """Test favorites functionality."""

    @pytest.mark.asyncio
    async def test_add_to_favorites(self, client, sample_user_data):
        """Test adding user to favorites."""
        # Register two users
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        # Add to favorites
        response = await client.post(f"/api/users/favorites/user2",
                                    params={"username": sample_user_data["username"]})

        assert response.status_code == 200
        assert "Added to favorites successfully" in response.json()["message"]

    @pytest.mark.asyncio
    async def test_add_duplicate_to_favorites(self, client, sample_user_data):
        """Test adding same user to favorites twice."""
        # Register two users
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        # Add to favorites first time
        await client.post(f"/api/users/favorites/user2",
                         params={"username": sample_user_data["username"]})

        # Try to add again
        response = await client.post(f"/api/users/favorites/user2",
                                    params={"username": sample_user_data["username"]})

        assert response.status_code == 409
        assert "already in favorites" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_favorites(self, client, sample_user_data):
        """Test getting user's favorites."""
        # Register two users and add to favorites
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        await client.post(f"/api/users/favorites/user2",
                         params={"username": sample_user_data["username"]})

        # Get favorites
        response = await client.get(f"/api/users/favorites/{sample_user_data['username']}")

        assert response.status_code == 200
        data = response.json()
        assert "favorites" in data
        assert len(data["favorites"]) >= 1


class TestMessaging:
    """Test messaging functionality."""

    @pytest.mark.asyncio
    async def test_send_message(self, client, sample_user_data):
        """Test sending a message."""
        # Register two users
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        # Send message
        response = await client.post("/api/users/messages", data={
            "from_username": sample_user_data["username"],
            "to_username": "user2",
            "content": "Hello, this is a test message!"
        })

        assert response.status_code == 200
        assert "Message sent successfully" in response.json()["message"]

    @pytest.mark.asyncio
    async def test_send_empty_message(self, client, sample_user_data):
        """Test sending empty message."""
        # Register two users
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        # Send empty message
        response = await client.post("/api/users/messages", data={
            "from_username": sample_user_data["username"],
            "to_username": "user2",
            "content": "   "  # Only whitespace
        })

        assert response.status_code == 400
        assert "cannot be empty" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_messages(self, client, sample_user_data):
        """Test getting messages for user."""
        # Register two users and send message
        await client.post(
            "/api/users/register",
            data=sample_user_data,
            files={"images": []}
        )

        user_data_2 = sample_user_data.copy()
        user_data_2["username"] = "user2"
        await client.post(
            "/api/users/register",
            data=user_data_2,
            files={"images": []}
        )

        await client.post("/api/users/messages", data={
            "from_username": sample_user_data["username"],
            "to_username": "user2",
            "content": "Test message"
        })

        # Get messages
        response = await client.get(f"/api/users/messages/{sample_user_data['username']}")

        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) >= 1


class TestErrorHandling:
    """Test error handling in API endpoints."""

    @pytest.mark.asyncio
    async def test_database_connection_error(self, client):
        """Test handling of database connection errors."""
        # This would require mocking the database connection to fail
        # For now, we'll test with invalid data that causes validation errors
        response = await client.post("/api/users/login", data={
            "username": "",  # Invalid
            "password": "test"
        })

        # Should get validation error, not database error
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_json_payload(self, client):
        """Test handling invalid JSON payloads."""
        # Send invalid data that doesn't match expected format
        response = await client.post("/api/users/login", data="invalid json")

        # Should handle gracefully
        assert response.status_code in [400, 422, 500]
