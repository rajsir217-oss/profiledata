"""
Tests for PII (Personally Identifiable Information) security functions.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from pii_security import (
    mask_email,
    mask_phone,
    mask_location,
    mask_workplace,
    mask_user_pii,
    check_access_granted,
    create_access_request,
    respond_to_access_request
)


class TestMaskEmail:
    """Test cases for email masking function."""

    def test_mask_email_basic(self):
        """Test basic email masking."""
        email = "john.doe@gmail.com"
        masked = mask_email(email)

        assert masked == "j***@gmail.com"

    def test_mask_email_short_local(self):
        """Test email masking with short local part."""
        email = "a@gmail.com"
        masked = mask_email(email)

        assert masked == "a***@gmail.com"

    def test_mask_email_single_char_local(self):
        """Test email masking with single character local part."""
        email = "x@gmail.com"
        masked = mask_email(email)

        assert masked == "x***@gmail.com"

    def test_mask_email_no_at_symbol(self):
        """Test email masking with no @ symbol."""
        email = "invalid-email"
        masked = mask_email(email)

        assert masked == "invalid-email"

    def test_mask_email_empty(self):
        """Test email masking with empty string."""
        email = ""
        masked = mask_email(email)

        assert masked == ""

    def test_mask_email_none(self):
        """Test email masking with None."""
        email = None
        masked = mask_email(email)

        assert masked is None

    def test_mask_email_multiple_at_symbols(self):
        """Test email masking with multiple @ symbols."""
        email = "test@domain@extra.com"
        masked = mask_email(email)

        # Should split on first @ only
        assert masked == "t***@domain@extra.com"

    def test_mask_email_unicode_domain(self):
        """Test email masking with unicode domain."""
        email = "user@тест.рф"
        masked = mask_email(email)

        assert masked == "u***@тест.рф"


class TestMaskPhone:
    """Test cases for phone number masking function."""

    def test_mask_phone_basic(self):
        """Test basic phone number masking."""
        phone = "+1-555-123-4567"
        masked = mask_phone(phone)

        assert masked == "***-***-4567"

    def test_mask_phone_international(self):
        """Test phone masking with international format."""
        phone = "+44 20 7946 0958"
        masked = mask_phone(phone)

        assert masked == "***-***-0958"

    def test_mask_phone_short_number(self):
        """Test phone masking with short number."""
        phone = "123"
        masked = mask_phone(phone)

        assert masked == "***"

    def test_mask_phone_empty(self):
        """Test phone masking with empty string."""
        phone = ""
        masked = mask_phone(phone)

        assert masked == ""

    def test_mask_phone_none(self):
        """Test phone masking with None."""
        phone = None
        masked = mask_phone(phone)

        assert masked is None

    def test_mask_phone_no_digits(self):
        """Test phone masking with no digits."""
        phone = "abc-def-ghi"
        masked = mask_phone(phone)

        assert masked == "***"

    def test_mask_phone_mixed_chars(self):
        """Test phone masking with mixed characters."""
        phone = "+1 (555) 123-4567 ext. 789"
        masked = mask_phone(phone)

        assert masked == "***-***-4567"


class TestMaskLocation:
    """Test cases for location masking function."""

    def test_mask_location_basic(self):
        """Test basic location masking."""
        location = "123 Main St, New York, NY, USA"
        masked = mask_location(location)

        assert masked == "NY, USA"

    def test_mask_location_two_parts(self):
        """Test location masking with two parts."""
        location = "New York, NY"
        masked = mask_location(location)

        assert masked == "New York, NY"

    def test_mask_location_single_part(self):
        """Test location masking with single part."""
        location = "New York"
        masked = mask_location(location)

        assert masked == "New York"

    def test_mask_location_empty(self):
        """Test location masking with empty string."""
        location = ""
        masked = mask_location(location)

        assert masked == ""

    def test_mask_location_none(self):
        """Test location masking with None."""
        location = None
        masked = mask_location(location)

        assert masked is None

    def test_mask_location_no_commas(self):
        """Test location masking with no commas."""
        location = "New York NY"
        masked = mask_location(location)

        assert masked == "New York NY"

    def test_mask_location_many_parts(self):
        """Test location masking with many parts."""
        location = "Apt 5B, 123 Main St, Springfield, IL, USA"
        masked = mask_location(location)

        assert masked == "IL, USA"


class TestMaskWorkplace:
    """Test cases for workplace masking function."""

    def test_mask_workplace_basic(self):
        """Test basic workplace masking."""
        workplace = "Google Inc, 1600 Amphitheatre Pkwy, Mountain View, CA"
        masked = mask_workplace(workplace)

        assert masked == "Google Inc"

    def test_mask_workplace_single_part(self):
        """Test workplace masking with single part."""
        workplace = "Google Inc"
        masked = mask_workplace(workplace)

        assert masked == "Google Inc"

    def test_mask_workplace_empty(self):
        """Test workplace masking with empty string."""
        workplace = ""
        masked = mask_workplace(workplace)

        assert masked == ""

    def test_mask_workplace_none(self):
        """Test workplace masking with None."""
        workplace = None
        masked = mask_workplace(workplace)

        assert masked is None

    def test_mask_workplace_no_commas(self):
        """Test workplace masking with no commas."""
        workplace = "Google Inc 1600 Amphitheatre Pkwy"
        masked = mask_workplace(workplace)

        assert masked == "Google Inc 1600 Amphitheatre Pkwy"

    def test_mask_workplace_multiple_commas(self):
        """Test workplace masking with multiple commas."""
        workplace = "Google, Inc, Mountain View, CA"
        masked = mask_workplace(workplace)

        assert masked == "Google"


class TestMaskUserPii:
    """Test cases for comprehensive user PII masking."""

    def test_mask_user_pii_access_granted(self):
        """Test that no masking occurs when access is granted."""
        user_data = {
            "username": "testuser",
            "contactEmail": "test@example.com",
            "contactNumber": "555-123-4567",
            "location": "New York, NY",
            "workplace": "Google Inc"
        }

        masked = mask_user_pii(user_data, access_granted=True)

        # Should return original data unchanged
        assert masked == user_data
        assert "piiMasked" not in masked

    def test_mask_user_pii_no_access(self):
        """Test PII masking when no access is granted."""
        user_data = {
            "username": "testuser",
            "contactEmail": "john.doe@gmail.com",
            "contactNumber": "+1-555-123-4567",
            "location": "123 Main St, New York, NY",
            "workplace": "Google Inc, Mountain View"
        }

        masked = mask_user_pii(user_data)

        # Check that PII fields are masked
        assert masked["contactEmail"] == "j***@gmail.com"
        assert masked["contactEmailMasked"] is True
        assert masked["contactNumber"] == "***-***-4567"
        assert masked["contactNumberMasked"] is True
        assert masked["location"] == "NY"
        assert masked["locationMasked"] is True
        assert masked["workplace"] == "Google Inc"
        assert masked["workplaceMasked"] is True
        assert masked["piiMasked"] is True

        # Non-PII fields should remain unchanged
        assert masked["username"] == "testuser"

    def test_mask_user_pii_partial_data(self):
        """Test PII masking with partial user data."""
        user_data = {
            "username": "testuser",
            "contactEmail": "test@example.com"
            # Missing other PII fields
        }

        masked = mask_user_pii(user_data)

        # Only email should be masked
        assert masked["contactEmail"] == "t***@example.com"
        assert masked["contactEmailMasked"] is True
        assert "contactNumber" not in masked
        assert masked["piiMasked"] is True

    def test_mask_user_pii_empty_data(self):
        """Test PII masking with empty user data."""
        user_data = {}
        masked = mask_user_pii(user_data)

        assert masked == {}
        assert "piiMasked" not in masked

    def test_mask_user_pii_none_data(self):
        """Test PII masking with None user data."""
        user_data = None
        masked = mask_user_pii(user_data)

        assert masked is None

    def test_mask_user_pii_requester_id_same(self):
        """Test PII masking when requester is the same user."""
        user_data = {
            "username": "testuser",
            "contactEmail": "test@example.com"
        }

        # Even without access_granted=True, should not mask if requester_id == username
        masked = mask_user_pii(user_data, requester_id="testuser")

        assert masked == user_data
        assert "piiMasked" not in masked


class TestCheckAccessGranted:
    """Test cases for access granting logic."""

    @pytest.mark.asyncio
    async def test_check_access_granted_same_user(self):
        """Test access granted for same user."""
        mock_db = AsyncMock()

        result = await check_access_granted(mock_db, "user1", "user1")

        assert result is True
        # Should not query database for same user
        mock_db.access_requests.find_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_check_access_granted_admin(self):
        """Test access granted for admin user."""
        mock_db = AsyncMock()

        result = await check_access_granted(mock_db, "admin", "user1")

        assert result is True
        # Should not query database for admin
        mock_db.access_requests.find_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_check_access_granted_approved_request(self):
        """Test access granted for approved request."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(return_value={
            "requesterId": "user1",
            "requestedUserId": "user2",
            "status": "approved"
        })

        result = await check_access_granted(mock_db, "user1", "user2")

        assert result is True
        mock_db.access_requests.find_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_access_granted_denied_request(self):
        """Test access denied for denied request."""
        mock_db = AsyncMock()
        # When looking for 'approved' status, return None (no approved request exists)
        mock_db.access_requests.find_one = AsyncMock(return_value=None)

        result = await check_access_granted(mock_db, "user1", "user2")

        assert result is False

    @pytest.mark.asyncio
    async def test_check_access_granted_no_request(self):
        """Test access denied when no request exists."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(return_value=None)

        result = await check_access_granted(mock_db, "user1", "user2")

        assert result is False

    @pytest.mark.asyncio
    async def test_check_access_granted_db_error(self):
        """Test access check when database error occurs."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(side_effect=Exception("DB Error"))

        with pytest.raises(Exception) as exc_info:
            await check_access_granted(mock_db, "user1", "user2")

        assert "DB Error" in str(exc_info.value)


class TestCreateAccessRequest:
    """Test cases for creating access requests."""

    @pytest.mark.asyncio
    async def test_create_access_request_new(self):
        """Test creating a new access request."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        mock_db.access_requests.insert_one = AsyncMock()
        mock_db.access_requests.insert_one.return_value.inserted_id = "507f1f77bcf86cd799439011"

        result = await create_access_request(mock_db, "user1", "user2", "Please grant access")

        assert result["requesterId"] == "user1"
        assert result["requestedUserId"] == "user2"
        assert result["status"] == "pending"
        assert result["message"] == "Please grant access"
        assert "requestDate" in result
        assert result["_id"] == "507f1f77bcf86cd799439011"

        mock_db.access_requests.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_access_request_existing_pending(self):
        """Test creating request when pending request exists."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(return_value={
            "status": "pending"
        })

        result = await create_access_request(mock_db, "user1", "user2")

        assert result == {"error": "Request already pending"}
        mock_db.access_requests.insert_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_access_request_existing_approved(self):
        """Test creating request when approved request exists."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(return_value={
            "status": "approved"
        })

        result = await create_access_request(mock_db, "user1", "user2")

        assert result == {"error": "Access already granted"}
        mock_db.access_requests.insert_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_access_request_existing_denied(self):
        """Test creating request after previous denial."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(return_value={
            "status": "denied"
        })
        mock_db.access_requests.insert_one = AsyncMock()
        mock_db.access_requests.insert_one.return_value.inserted_id = "507f1f77bcf86cd799439011"

        result = await create_access_request(mock_db, "user1", "user2")

        # Should allow re-request after denial
        assert result["status"] == "pending"
        mock_db.access_requests.insert_one.assert_called_once()


class TestRespondToAccessRequest:
    """Test cases for responding to access requests."""

    @pytest.mark.asyncio
    async def test_respond_to_access_request_approve(self):
        """Test approving an access request."""
        from bson import ObjectId
        mock_db = AsyncMock()
        request_id = "507f1f77bcf86cd799439011"
        
        # Mock find_one to return pending first, then approved after update
        async def mock_find_one(query):
            if mock_db.access_requests.update_one.call_count > 0:
                # After update
                return {
                    "_id": ObjectId(request_id),
                    "requesterId": "user1",
                    "requestedUserId": "user2",
                    "status": "approved",
                    "responseDate": "2024-01-01T00:00:00"
                }
            else:
                # Before update
                return {
                    "_id": ObjectId(request_id),
                    "requesterId": "user1",
                    "requestedUserId": "user2",
                    "status": "pending"
                }
        
        mock_db.access_requests.find_one = AsyncMock(side_effect=mock_find_one)
        mock_db.access_requests.update_one = AsyncMock()

        result = await respond_to_access_request(mock_db, request_id, "approved", "user2")

        assert result["status"] == "approved"
        assert "responseDate" in result

        mock_db.access_requests.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_respond_to_access_request_deny(self):
        """Test denying an access request."""
        from bson import ObjectId
        mock_db = AsyncMock()
        request_id = "507f1f77bcf86cd799439011"
        
        # Mock find_one to return pending first, then denied after update
        async def mock_find_one(query):
            if mock_db.access_requests.update_one.call_count > 0:
                # After update
                return {
                    "_id": ObjectId(request_id),
                    "requesterId": "user1",
                    "requestedUserId": "user2",
                    "status": "denied",
                    "responseDate": "2024-01-01T00:00:00"
                }
            else:
                # Before update
                return {
                    "_id": ObjectId(request_id),
                    "requesterId": "user1",
                    "requestedUserId": "user2",
                    "status": "pending"
                }
        
        mock_db.access_requests.find_one = AsyncMock(side_effect=mock_find_one)
        mock_db.access_requests.update_one = AsyncMock()

        result = await respond_to_access_request(mock_db, request_id, "denied", "user2")

        assert result["status"] == "denied"

    @pytest.mark.asyncio
    async def test_respond_to_access_request_not_found(self):
        """Test responding to non-existent request."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(return_value=None)

        # Use a valid ObjectId format
        result = await respond_to_access_request(mock_db, "507f1f77bcf86cd799439011", "approved", "user2")

        assert result == {"error": "Request not found"}
        mock_db.access_requests.update_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_respond_to_access_request_unauthorized(self):
        """Test responding to request as wrong user."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(return_value={
            "_id": "507f1f77bcf86cd799439011",
            "requesterId": "user1",
            "requestedUserId": "user2",
            "status": "pending"
        })

        result = await respond_to_access_request(mock_db, "507f1f77bcf86cd799439011", "approved", "user3")

        assert result == {"error": "Unauthorized"}
        mock_db.access_requests.update_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_respond_to_access_request_invalid_object_id(self):
        """Test responding to request with invalid ObjectId."""
        mock_db = AsyncMock()
        mock_db.access_requests.find_one = AsyncMock(side_effect=Exception("Invalid ObjectId"))

        with pytest.raises(Exception):
            await respond_to_access_request(mock_db, "invalid_id", "approved", "user2")
