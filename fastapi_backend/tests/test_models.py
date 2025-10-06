"""
Tests for Pydantic models and validation logic.
"""
import pytest
from datetime import datetime
from pydantic import ValidationError
from models import (
    UserBase,
    UserCreate,
    UserInDB,
    UserResponse,
    LoginRequest,
    Token,
    TokenData,
    PyObjectId
)


class TestUserBase:
    """Test cases for UserBase model."""

    def test_valid_user_base_creation(self):
        """Test creating a valid UserBase instance."""
        user_data = {
            "username": "testuser",
            "firstName": "Test",
            "lastName": "User",
            "contactEmail": "test@example.com",
            "sex": "Male",
            "eatingPreference": "Vegetarian",
            "citizenshipStatus": "Citizen"
        }
        user = UserBase(**user_data)
        assert user.username == "testuser"
        assert user.firstName == "Test"
        assert user.sex == "Male"

    def test_username_validation_alphanumeric(self):
        """Test username validation for alphanumeric requirement."""
        with pytest.raises(ValidationError) as exc_info:
            UserBase(username="test-user!")  # Contains invalid character

        assert "Username must be alphanumeric with optional underscores" in str(exc_info.value)

    def test_username_validation_min_length(self):
        """Test username minimum length validation."""
        with pytest.raises(ValidationError) as exc_info:
            UserBase(username="ab")  # Too short

        assert "string_too_short" in str(exc_info.value)

    def test_sex_validation(self):
        """Test sex field validation."""
        # Valid values
        assert UserBase(username="testuser", sex="Male").sex == "Male"
        assert UserBase(username="testuser", sex="Female").sex == "Female"
        assert UserBase(username="testuser", sex="").sex == ""

        # Invalid value - should raise ValidationError
        with pytest.raises(ValidationError):
            UserBase(username="testuser", sex="Other")

    def test_eating_preference_validation(self):
        """Test eating preference validation."""
        valid_preferences = ["Vegetarian", "Eggetarian", "Non-Veg", "Others", ""]

        for pref in valid_preferences:
            user = UserBase(username="testuser", eatingPreference=pref)
            assert user.eatingPreference == pref

        # Invalid value - should raise ValidationError
        with pytest.raises(ValidationError):
            UserBase(username="testuser", eatingPreference="Invalid")

    def test_citizenship_status_validation(self):
        """Test citizenship status validation."""
        valid_statuses = ["Citizen", "Greencard", ""]

        for status in valid_statuses:
            user = UserBase(username="testuser", citizenshipStatus=status)
            assert user.citizenshipStatus == status

        # Invalid value - should raise ValidationError
        with pytest.raises(ValidationError):
            UserBase(username="testuser", citizenshipStatus="Invalid")


class TestUserCreate:
    """Test cases for UserCreate model."""

    def test_valid_user_create(self):
        """Test creating a valid UserCreate instance."""
        user_data = {
            "username": "testuser",
            "password": "testpass123",
            "firstName": "Test",
            "contactEmail": "test@example.com"
        }
        user = UserCreate(**user_data)
        assert user.username == "testuser"
        assert user.password == "testpass123"

    def test_password_validation_min_length(self):
        """Test password minimum length validation."""
        with pytest.raises(ValidationError):
            UserCreate(username="testuser", password="123")  # Too short


class TestUserInDB:
    """Test cases for UserInDB model."""

    def test_valid_user_in_db(self):
        """Test creating a valid UserInDB instance."""
        user_data = {
            "username": "testuser",
            "password": "hashedpassword",
            "firstName": "Test",
            "contactEmail": "test@example.com"
        }
        user = UserInDB(**user_data)
        assert user.username == "testuser"
        assert user.password == "hashedpassword"
        assert isinstance(user.createdAt, datetime)
        assert isinstance(user.updatedAt, datetime)


class TestUserResponse:
    """Test cases for UserResponse model."""

    def test_valid_user_response(self):
        """Test creating a valid UserResponse instance."""
        user_data = {
            "username": "testuser",
            "firstName": "Test",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        user = UserResponse(**user_data)
        assert user.username == "testuser"
        assert user.firstName == "Test"


class TestLoginRequest:
    """Test cases for LoginRequest model."""

    def test_valid_login_request(self):
        """Test creating a valid LoginRequest instance."""
        login_data = {
            "username": "testuser",
            "password": "testpass123"
        }
        login = LoginRequest(**login_data)
        assert login.username == "testuser"
        assert login.password == "testpass123"


class TestToken:
    """Test cases for Token model."""

    def test_valid_token(self):
        """Test creating a valid Token instance."""
        token_data = {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "token_type": "bearer"
        }
        token = Token(**token_data)
        assert token.access_token == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        assert token.token_type == "bearer"


class TestTokenData:
    """Test cases for TokenData model."""

    def test_valid_token_data(self):
        """Test creating a valid TokenData instance."""
        token_data = {"username": "testuser"}
        data = TokenData(**token_data)
        assert data.username == "testuser"

    def test_empty_token_data(self):
        """Test creating TokenData with no username."""
        data = TokenData()
        assert data.username is None


class TestPyObjectId:
    """Test cases for PyObjectId."""

    def test_valid_object_id(self):
        """Test creating a valid PyObjectId."""
        from bson import ObjectId
        obj_id = PyObjectId(ObjectId())
        assert isinstance(obj_id, ObjectId)

    def test_invalid_object_id_string(self):
        """Test invalid ObjectId string."""
        from bson.errors import InvalidId
        with pytest.raises(InvalidId):
            PyObjectId("invalid_id")

    def test_pydantic_json_schema(self):
        """Test that PyObjectId provides correct JSON schema."""
        from pydantic import TypeAdapter
        adapter = TypeAdapter(PyObjectId)
        schema = adapter.json_schema()
        assert schema["type"] == "string"
