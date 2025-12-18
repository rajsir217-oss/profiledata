"""
Test configuration and fixtures for the FastAPI backend tests.
"""
import pytest
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from httpx import AsyncClient
import sys
import os

# Add the parent directory to Python path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from main import app
from database import get_database


# Test database URL - use a separate test database
TEST_MONGODB_URL = os.getenv("TEST_MONGODB_URL", "mongodb://localhost:27017")
TEST_DATABASE_NAME = "test_profiledata"


@pytest.fixture(scope="function")
def test_db():
    """Create a test database connection."""
    # Get or create event loop
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    client = AsyncIOMotorClient(TEST_MONGODB_URL)
    db = client[TEST_DATABASE_NAME]

    # Clear test database before tests
    async def clear_db():
        for collection_name in await db.list_collection_names():
            await db[collection_name].drop()
    
    loop.run_until_complete(clear_db())

    yield db

    # Cleanup after tests
    loop.run_until_complete(client.drop_database(TEST_DATABASE_NAME))
    client.close()


@pytest.fixture
def client(test_db):
    """Create a test client for API testing."""

    async def override_get_database():
        return test_db

    # Override the database dependency
    app.dependency_overrides[get_database] = override_get_database

    from fastapi.testclient import TestClient
    test_client = TestClient(app)
    
    yield test_client

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
        "dateOfBirth": "1990-01-01",
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


@pytest.fixture
def test_client(test_db):
    """Create a test client for API testing (alias for client fixture)."""
    async def override_get_database():
        return test_db

    # Override the database dependency
    app.dependency_overrides[get_database] = override_get_database

    from fastapi.testclient import TestClient
    test_client = TestClient(app)
    
    yield test_client

    # Clean up dependency overrides
    app.dependency_overrides.clear()


@pytest.fixture
def test_token():
    """Generate a test JWT token."""
    import jwt
    from datetime import datetime, timedelta
    
    def _create_token(username: str, expires_delta: timedelta = None):
        SECRET_KEY = os.getenv("SECRET_KEY", "test_secret_key_for_testing")
        ALGORITHM = "HS256"
        
        if expires_delta is None:
            expires_delta = timedelta(minutes=30)
        
        expire = datetime.utcnow() + expires_delta
        to_encode = {
            "sub": username,
            "exp": expire
        }
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    return _create_token


@pytest.fixture
def auth_headers(test_token):
    """Generate authorization headers for API requests."""
    def _auth_headers(username: str):
        token = test_token(username)
        return {"Authorization": f"Bearer {token}"}
    
    return _auth_headers
