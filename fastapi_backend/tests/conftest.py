"""
Test configuration and fixtures for the FastAPI backend tests.
"""
import pytest
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from httpx import AsyncClient
from main import app
from database import get_database
import os
from pathlib import Path


# Test database URL - use a separate test database
TEST_MONGODB_URL = os.getenv("TEST_MONGODB_URL", "mongodb://localhost:27017")
TEST_DATABASE_NAME = "test_profiledata"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def test_db():
    """Create a test database connection."""
    client = AsyncIOMotorClient(TEST_MONGODB_URL)
    db = client[TEST_DATABASE_NAME]

    # Clear test database before tests
    for collection_name in await db.list_collection_names():
        await db[collection_name].drop()

    yield db

    # Cleanup after tests
    client.drop_database(TEST_DATABASE_NAME)
    client.close()


@pytest.fixture
async def client(test_db):
    """Create a test client for API testing."""

    async def override_get_database():
        return test_db

    # Override the database dependency
    app.dependency_overrides[get_database] = override_get_database

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    # Clean up dependency overrides
    app.dependency_overrides.clear()


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "username": "testuser",
        "password": "testpass123",
        "firstName": "Test",
        "lastName": "User",
        "contactEmail": "test@example.com",
        "contactNumber": "1234567890",
        "dob": "1990-01-01",
        "sex": "Male",
        "height": "5'8\"",
        "location": "Test City",
        "education": "Bachelor's Degree",
        "workingStatus": "Employed",
        "citizenshipStatus": "Citizen"
    }


@pytest.fixture
def sample_login_data():
    """Sample login data for testing."""
    return {
        "username": "testuser",
        "password": "testpass123"
    }


@pytest.fixture
def invalid_user_data():
    """Invalid user data for testing validation."""
    return {
        "username": "ab",  # Too short
        "password": "123",  # Too short
        "firstName": "Test",
        "contactEmail": "invalid-email"
    }
