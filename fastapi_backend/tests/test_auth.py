import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from jose import JWTError, jwt
from config import settings
from auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user
)
from models import TokenData, UserCreate


class TestPasswordFunctions:
    """Test password hashing and verification functions."""

    def test_get_password_hash(self):
        """Test password hashing."""
        password = "testpassword123"
        hashed = get_password_hash(password)

        assert hashed != password  # Should be hashed
        assert len(hashed) > 0  # Should not be empty

        # Test that the same password produces different hashes
        hashed2 = get_password_hash(password)
        assert hashed != hashed2  # bcrypt adds salt

    def test_verify_password_correct(self):
        """Test password verification with correct password."""
        password = "testpassword123"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password."""
        password = "testpassword123"
        wrong_password = "wrongpassword"
        hashed = get_password_hash(password)

        assert verify_password(wrong_password, hashed) is False

    def test_verify_password_with_unicode(self):
        """Test password verification with unicode characters."""
        password = "testpasswörd123"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_password_truncation(self):
        """Test that passwords are properly truncated for bcrypt."""
        # Create a very long password
        long_password = "a" * 100
        hashed = get_password_hash(long_password)

        # Should still work
        assert verify_password(long_password, hashed) is True

        # Test with a password that has unicode that might be truncated
        unicode_password = "パスワード123" * 10  # Japanese characters
        hashed_unicode = get_password_hash(unicode_password)

        assert verify_password(unicode_password, hashed_unicode) is True


class TestJWTTokenFunctions:
    """Test JWT token creation and validation."""

    def test_create_access_token(self):
        """Test creating a basic access token."""
        data = {"sub": "testuser"}
        token = create_access_token(data)

        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_with_expiry(self):
        """Test creating a token with custom expiry."""
        data = {"sub": "testuser"}
        expires_delta = timedelta(hours=1)
        token = create_access_token(data, expires_delta)

        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_without_sub(self):
        """Test creating a token without 'sub' field."""
        data = {"username": "testuser"}  # No 'sub' field
        token = create_access_token(data)

        assert isinstance(token, str)
        assert len(token) > 0

    @patch('auth.settings')
    def test_create_access_token_with_custom_settings(self, mock_settings):
        """Test token creation with custom settings."""
        mock_settings.secret_key = "test_secret_key"
        mock_settings.algorithm = "HS256"

        data = {"sub": "testuser"}
        token = create_access_token(data)

        assert isinstance(token, str)
        assert len(token) > 0


class TestGetCurrentUser:
    """Test current user extraction from JWT token."""

    @patch('auth.settings')
    @pytest.mark.asyncio
    async def test_get_current_user_valid_token(self, mock_settings):
        """Test extracting user from valid token."""
        mock_settings.secret_key = "test_secret_key"
        mock_settings.algorithm = "HS256"

        # Create a valid token
        data = {"sub": "testuser"}
        token = create_access_token(data)

        # Mock the dependency to return our token
        async def mock_oauth2_scheme():
            return token

        # Test the function
        with patch('auth.oauth2_scheme', mock_oauth2_scheme):
            token_data = await get_current_user(token)
            assert isinstance(token_data, TokenData)
            assert token_data.username == "testuser"

    @patch('auth.settings')
    def test_get_current_user_invalid_token(self, mock_settings):
        """Test error handling for invalid token."""
        mock_settings.secret_key = "test_secret_key"
        mock_settings.algorithm = "HS256"

        invalid_token = "invalid.jwt.token"

        with pytest.raises(Exception) as exc_info:
            # Run in event loop since get_current_user is async
            import asyncio
            asyncio.run(get_current_user(invalid_token))

        # Should raise an HTTPException due to JWTError
        assert "Could not validate credentials" in str(exc_info.value)

    @patch('auth.settings')
    def test_get_current_user_expired_token(self, mock_settings):
        """Test error handling for expired token."""
        mock_settings.secret_key = "test_secret_key"
        mock_settings.algorithm = "HS256"

        # Create a token that expires immediately
        data = {"sub": "testuser"}
        expired_token = create_access_token(data, expires_delta=timedelta(seconds=-1))

        with pytest.raises(Exception) as exc_info:
            # Run in event loop since get_current_user is async
            import asyncio
            asyncio.run(get_current_user(expired_token))

        assert "Could not validate credentials" in str(exc_info.value)

    @patch('auth.settings')
    def test_get_current_user_no_sub(self, mock_settings):
        """Test error handling for token without 'sub' field."""
        mock_settings.secret_key = "test_secret_key"
        mock_settings.algorithm = "HS256"

        # Create token without 'sub' field
        data = {"username": "testuser"}
        token = create_access_token(data)

        with pytest.raises(Exception) as exc_info:
            # Run in event loop since get_current_user is async
            import asyncio
            asyncio.run(get_current_user(token))

        assert "Could not validate credentials" in str(exc_info.value)

    @patch('auth.settings')
    def test_get_current_user_wrong_secret(self, mock_settings):
        """Test error handling for token signed with wrong secret."""
        # Set up initial settings for token creation
        mock_settings.secret_key = "original_secret_key"
        mock_settings.algorithm = "HS256"

        # Create token with original secret
        data = {"sub": "testuser"}
        token = create_access_token(data)

        # Try to decode with different secret
        mock_settings.secret_key = "different_secret_key"
        mock_settings.algorithm = "HS256"

        with pytest.raises(Exception) as exc_info:
            # Run in event loop since get_current_user is async
            import asyncio
            asyncio.run(get_current_user(token))

        assert "Could not validate credentials" in str(exc_info.value)


class TestIntegrationScenarios:
    """Integration test scenarios for auth functions."""

    def test_full_authentication_flow(self):
        """Test complete authentication flow."""
        # 1. Hash a password
        password = "testpassword123"
        hashed = get_password_hash(password)

        # 2. Verify the password
        assert verify_password(password, hashed) is True

        # 3. Create a token for the user with mocked settings
        with patch('auth.settings') as mock_settings:
            mock_settings.secret_key = "test_secret_key"
            mock_settings.algorithm = "HS256"

            data = {"sub": "testuser"}
            token = create_access_token(data)

            # 4. Extract user from token (simulate)
            # Use the same mocked settings for decoding
            decoded_payload = jwt.decode(token, mock_settings.secret_key, algorithms=[mock_settings.algorithm])
            assert decoded_payload["sub"] == "testuser"

    def test_password_security_edge_cases(self):
        """Test password security edge cases."""
        # Test empty password validation at model level
        with pytest.raises(Exception):
            UserCreate(username="testuser", password="")

        # Test very long password (bcrypt handles up to 72 bytes)
        very_long_password = "a" * 200
        hashed = get_password_hash(very_long_password)
        assert verify_password(very_long_password, hashed) is True

        # Test password with special characters
        special_password = "!@#$%^&*()_+{}[]|\\:;\"'<>?,./"
        hashed = get_password_hash(special_password)
        assert verify_password(special_password, hashed) is True
