"""
End-to-end API tests using test client.
"""
import pytest
import asyncio
from httpx import AsyncClient
from main import app


@pytest.mark.asyncio
async def test_health_check():
    """Test health check endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "matrimonial-api"


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test root endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Matrimonial Profile API" in data["message"]
    assert "docs" in data
    assert "health" in data


@pytest.mark.asyncio
async def test_full_user_lifecycle():
    """Test complete user lifecycle: register -> login -> profile -> update -> delete."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # 1. Register user
        user_data = {
            "username": "lifecycle_user",
            "password": "testpass123",
            "firstName": "Lifecycle",
            "lastName": "Test",
            "contactEmail": "lifecycle@example.com",
            "contactNumber": "1234567890",
            "dob": "1990-01-01",
            "sex": "Male",
            "height": "5'8\"",
            "location": "Test City",
            "education": "Bachelor's Degree",
            "workingStatus": "Employed",
            "citizenshipStatus": "Citizen"
        }

        response = await ac.post("/api/users/register", data=user_data, files={"images": []})
        assert response.status_code == 201
        user_id = response.json()["user"]["username"]

        # 2. Login
        login_response = await ac.post("/api/users/login", data={
            "username": user_id,
            "password": "testpass123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]

        # 3. Get profile
        profile_response = await ac.get(f"/api/users/profile/{user_id}")
        assert profile_response.status_code == 200

        # 4. Update profile
        update_response = await ac.put(f"/api/users/profile/{user_id}", data={
            "firstName": "Updated",
            "lastName": "Name"
        })
        assert update_response.status_code == 200
        assert update_response.json()["user"]["firstName"] == "Updated"

        # 5. Add to favorites (need another user)
        user2_data = user_data.copy()
        user2_data["username"] = "lifecycle_user2"
        user2_data["contactEmail"] = "lifecycle2@example.com"

        await ac.post("/api/users/register", data=user2_data, files={"images": []})

        favorites_response = await ac.post(f"/api/users/favorites/lifecycle_user2",
                                          params={"username": user_id})
        assert favorites_response.status_code == 200

        # 6. Send message
        message_response = await ac.post("/api/users/messages", data={
            "from_username": user_id,
            "to_username": "lifecycle_user2",
            "content": "Hello from lifecycle test!"
        })
        assert message_response.status_code == 200

        # 7. Get messages
        messages_response = await ac.get(f"/api/users/messages/{user_id}")
        assert messages_response.status_code == 200
        assert len(messages_response.json()["messages"]) >= 1

        # 8. Delete user
        delete_response = await ac.delete(f"/api/users/profile/{user_id}")
        assert delete_response.status_code == 200

        # Verify user is deleted
        profile_after_delete = await ac.get(f"/api/users/profile/{user_id}")
        assert profile_after_delete.status_code == 404


@pytest.mark.asyncio
async def test_pii_masking_workflow():
    """Test complete PII masking workflow."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Register two users
        user1_data = {
            "username": "pii_user1",
            "password": "testpass123",
            "firstName": "PII",
            "lastName": "User1",
            "contactEmail": "pii1@example.com",
            "contactNumber": "555-123-4567",
            "location": "123 Main St, New York, NY",
            "workplace": "Google Inc, Mountain View"
        }

        user2_data = user1_data.copy()
        user2_data["username"] = "pii_user2"
        user2_data["contactEmail"] = "pii2@example.com"
        user2_data["contactNumber"] = "555-987-6543"

        await ac.post("/api/users/register", data=user1_data, files={"images": []})
        await ac.post("/api/users/register", data=user2_data, files={"images": []})

        # Get user1's profile as user2 (should be masked)
        profile_response = await ac.get("/api/users/profile/pii_user1",
                                       params={"requester": "pii_user2"})
        assert profile_response.status_code == 200
        data = profile_response.json()
        assert data["piiMasked"] is True
        assert data["contactEmail"] == "p***@example.com"
        assert data["contactNumber"] == "***-***-4567"
        assert data["location"] == "NY"
        assert data["workplace"] == "Google Inc"

        # Create access request
        request_response = await ac.post("/api/users/access-request", data={
            "requester": "pii_user2",
            "requested_user": "pii_user1",
            "message": "Please grant access"
        })
        assert request_response.status_code == 200

        # Get access requests (as user1)
        requests_response = await ac.get("/api/users/access-requests/pii_user1")
        assert requests_response.status_code == 200
        assert len(requests_response.json()["requests"]) >= 1

        # Approve access request (as user1)
        request_id = requests_response.json()["requests"][0]["_id"]
        approve_response = await ac.put(f"/api/users/access-request/{request_id}/respond", data={
            "response": "approved",
            "responder": "pii_user1"
        })
        assert approve_response.status_code == 200

        # Now get profile again (should be unmasked)
        profile_unmasked_response = await ac.get("/api/users/profile/pii_user1",
                                                params={"requester": "pii_user2"})
        assert profile_unmasked_response.status_code == 200
        unmasked_data = profile_unmasked_response.json()
        assert unmasked_data["piiMasked"] is False
        assert unmasked_data["contactEmail"] == "pii1@example.com"
        assert unmasked_data["contactNumber"] == "555-123-4567"


@pytest.mark.asyncio
async def test_search_and_filtering():
    """Test search functionality with various filters."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Register multiple users with different attributes
        users_data = [
            {
                "username": "search_user1",
                "password": "testpass123",
                "firstName": "John",
                "lastName": "Doe",
                "sex": "Male",
                "location": "New York, NY",
                "education": "Bachelor's Degree"
            },
            {
                "username": "search_user2",
                "password": "testpass123",
                "firstName": "Jane",
                "lastName": "Smith",
                "sex": "Female",
                "location": "Los Angeles, CA",
                "education": "Master's Degree"
            },
            {
                "username": "search_user3",
                "password": "testpass123",
                "firstName": "Bob",
                "lastName": "Johnson",
                "sex": "Male",
                "location": "New York, NY",
                "education": "PhD"
            }
        ]

        for user_data in users_data:
            await ac.post("/api/users/register", data=user_data, files={"images": []})

        # Test keyword search
        keyword_response = await ac.get("/api/users/search", params={"keyword": "John"})
        assert keyword_response.status_code == 200
        assert len(keyword_response.json()["users"]) >= 1

        # Test gender filter
        gender_response = await ac.get("/api/users/search", params={"gender": "Male"})
        assert gender_response.status_code == 200
        male_users = [u for u in gender_response.json()["users"] if u["sex"] == "Male"]
        assert len(male_users) == len(gender_response.json()["users"])

        # Test location filter
        location_response = await ac.get("/api/users/search", params={"location": "New York"})
        assert location_response.status_code == 200
        ny_users = [u for u in location_response.json()["users"] if "New York" in u.get("location", "")]
        assert len(ny_users) == len(location_response.json()["users"])

        # Test multiple filters
        multi_response = await ac.get("/api/users/search", params={
            "gender": "Male",
            "location": "New York",
            "education": "Bachelor's Degree"
        })
        assert multi_response.status_code == 200


@pytest.mark.asyncio
async def test_concurrent_requests():
    """Test handling of concurrent requests."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Register a user first
        await ac.post("/api/users/register", data={
            "username": "concurrent_user",
            "password": "testpass123",
            "firstName": "Concurrent",
            "lastName": "Test"
        }, files={"images": []})

        # Send multiple concurrent requests
        tasks = []
        for i in range(10):
            tasks.append(ac.get(f"/api/users/profile/concurrent_user"))

        responses = await asyncio.gather(*tasks)

        # All should succeed
        for response in responses:
            assert response.status_code == 200


@pytest.mark.asyncio
async def test_api_error_scenarios():
    """Test various error scenarios."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Test 404 for non-existent endpoints
        response_404 = await ac.get("/api/users/nonexistent")
        assert response_404.status_code == 404

        # Test method not allowed
        method_response = await ac.delete("/api/users/login")
        assert method_response.status_code == 405

        # Test malformed request data
        malformed_response = await ac.post("/api/users/login", data="malformed")
        assert malformed_response.status_code in [400, 422, 500]


@pytest.mark.asyncio
async def test_cors_headers():
    """Test CORS headers are present."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.options("/api/users/profile/test")
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers
