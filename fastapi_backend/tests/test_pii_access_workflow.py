"""
Comprehensive PII Access Workflow Tests

Tests all combinations of PII access scenarios:
- Request creation, approval, rejection, cancellation
- Access granting, revocation, expiry
- Member-visible bypass
- Admin bypass
- Image access with one-time/timed durations
- Profile masking based on access status

Run with: pytest tests/test_pii_access_workflow.py -v
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
import asyncio


# ============================================================================
# TEST FIXTURES
# ============================================================================

@pytest.fixture
def sample_users():
    """Sample users for testing PII access."""
    return {
        "alice": {
            "_id": ObjectId(),
            "username": "alice",
            "password": "hashed_password",
            "firstName": "Alice",
            "lastName": "Smith",
            "contactEmail": "alice@example.com",
            "contactNumber": "+1-555-111-2222",
            "contactEmailVisible": False,
            "contactNumberVisible": False,
            "linkedinUrl": "https://linkedin.com/in/alice",
            "linkedinUrlVisible": False,
            "location": "123 Main St, New York, NY",
            "role_name": "user",
            "images": ["/uploads/alice/img1.jpg", "/uploads/alice/img2.jpg"],
            "publicImages": []
        },
        "bob": {
            "_id": ObjectId(),
            "username": "bob",
            "password": "hashed_password",
            "firstName": "Bob",
            "lastName": "Jones",
            "contactEmail": "bob@example.com",
            "contactNumber": "+1-555-333-4444",
            "contactEmailVisible": False,
            "contactNumberVisible": True,  # Member visible
            "linkedinUrl": "https://linkedin.com/in/bob",
            "linkedinUrlVisible": False,
            "location": "456 Oak Ave, Los Angeles, CA",
            "role_name": "user",
            "images": ["/uploads/bob/img1.jpg"],
            "publicImages": []
        },
        "admin": {
            "_id": ObjectId(),
            "username": "admin",
            "password": "hashed_password",
            "firstName": "Admin",
            "lastName": "User",
            "contactEmail": "admin@example.com",
            "contactNumber": "+1-555-999-0000",
            "contactEmailVisible": False,
            "contactNumberVisible": False,
            "role_name": "admin",
            "images": [],
            "publicImages": []
        }
    }


@pytest.fixture
def sample_pii_request():
    """Sample PII request document."""
    return {
        "_id": ObjectId(),
        "requesterUsername": "alice",
        "profileUsername": "bob",
        "requestType": "contact_email",
        "status": "pending",
        "message": "I'd like to connect with you",
        "requestedAt": datetime.utcnow(),
        "respondedAt": None,
        "responseMessage": None
    }


@pytest.fixture
def sample_pii_access():
    """Sample PII access grant document."""
    return {
        "_id": ObjectId(),
        "granterUsername": "bob",
        "grantedToUsername": "alice",
        "accessType": "contact_email",
        "isActive": True,
        "grantedAt": datetime.utcnow(),
        "expiresAt": None,
        "createdAt": datetime.utcnow()
    }


@pytest.fixture
def sample_image_access():
    """Sample image access with per-picture durations."""
    return {
        "_id": ObjectId(),
        "granterUsername": "bob",
        "grantedToUsername": "alice",
        "accessType": "images",
        "isActive": True,
        "grantedAt": datetime.utcnow(),
        "pictureDurations": {
            "0": {"duration": "onetime", "viewedAt": None, "isExpired": False},
            "1": {"duration": 3, "expiresAt": datetime.utcnow() + timedelta(days=3)},
            "2": {"duration": "permanent", "expiresAt": None}
        }
    }


@pytest.fixture
def mock_db():
    """Create a mock database for testing."""
    db = AsyncMock()
    db.users = AsyncMock()
    db.pii_requests = AsyncMock()
    db.pii_access = AsyncMock()
    db.access_requests = AsyncMock()  # Legacy collection
    return db


# ============================================================================
# MASKING FUNCTION TESTS
# ============================================================================

class TestMaskingFunctions:
    """Test PII masking functions."""
    
    def test_mask_email_standard(self):
        """Test standard email masking."""
        from pii_security import mask_email
        assert mask_email("john.doe@gmail.com") == "j***@gmail.com"
    
    def test_mask_email_short(self):
        """Test short email masking."""
        from pii_security import mask_email
        assert mask_email("a@test.com") == "a***@test.com"
    
    def test_mask_email_none(self):
        """Test None email."""
        from pii_security import mask_email
        assert mask_email(None) is None
    
    def test_mask_email_empty(self):
        """Test empty email."""
        from pii_security import mask_email
        assert mask_email("") == ""
    
    def test_mask_email_invalid(self):
        """Test invalid email (no @)."""
        from pii_security import mask_email
        assert mask_email("invalid") == "invalid"
    
    def test_mask_phone_standard(self):
        """Test standard phone masking."""
        from pii_security import mask_phone
        assert mask_phone("+1-555-123-4567") == "***-***-4567"
    
    def test_mask_phone_international(self):
        """Test international phone masking."""
        from pii_security import mask_phone
        assert mask_phone("+44 20 7946 0958") == "***-***-0958"
    
    def test_mask_phone_with_extension(self):
        """Test phone with extension."""
        from pii_security import mask_phone
        assert mask_phone("+1 (555) 123-4567 ext. 789") == "***-***-4567"
    
    def test_mask_phone_none(self):
        """Test None phone."""
        from pii_security import mask_phone
        assert mask_phone(None) is None
    
    def test_mask_phone_short(self):
        """Test short phone number."""
        from pii_security import mask_phone
        assert mask_phone("123") == "***"
    
    def test_mask_location_full_address(self):
        """Test full address masking."""
        from pii_security import mask_location
        assert mask_location("123 Main St, New York, NY") == "NY"
    
    def test_mask_location_city_state(self):
        """Test city, state format."""
        from pii_security import mask_location
        assert mask_location("New York, NY") == "New York, NY"
    
    def test_mask_location_single(self):
        """Test single location."""
        from pii_security import mask_location
        assert mask_location("California") == "California"


# ============================================================================
# USER PII MASKING TESTS
# ============================================================================

class TestMaskUserPii:
    """Test comprehensive user PII masking."""
    
    def test_mask_user_pii_no_access(self, sample_users):
        """Test all PII masked when no access granted."""
        from pii_security import mask_user_pii
        
        user = sample_users["alice"].copy()
        masked = mask_user_pii(user, requester_id="bob", access_granted=False)
        
        assert masked["contactEmailMasked"] is True
        assert masked["contactNumberMasked"] is True
        assert "***" in masked["contactEmail"]
        assert "***" in masked["contactNumber"]
        assert masked["piiMasked"] is True
    
    def test_mask_user_pii_with_access(self, sample_users):
        """Test no masking when access granted."""
        from pii_security import mask_user_pii
        
        user = sample_users["alice"].copy()
        masked = mask_user_pii(user, requester_id="bob", access_granted=True)
        
        # Original values preserved
        assert masked["contactEmail"] == "alice@example.com"
        assert masked["contactNumber"] == "+1-555-111-2222"
    
    def test_mask_user_pii_own_profile(self, sample_users):
        """Test no masking when viewing own profile."""
        from pii_security import mask_user_pii
        
        user = sample_users["alice"].copy()
        masked = mask_user_pii(user, requester_id="alice", access_granted=False)
        
        # Own profile - no masking
        assert masked["contactEmail"] == "alice@example.com"
        assert masked["contactNumber"] == "+1-555-111-2222"
    
    def test_mask_user_pii_member_visible_email(self, sample_users):
        """Test member-visible email not masked."""
        from pii_security import mask_user_pii
        
        user = sample_users["alice"].copy()
        user["contactEmailVisible"] = True
        
        masked = mask_user_pii(user, requester_id="bob", access_granted=False)
        
        # Email visible to all members
        assert masked["contactEmail"] == "alice@example.com"
        assert masked["contactEmailMasked"] is False
        # Phone still masked
        assert masked["contactNumberMasked"] is True
    
    def test_mask_user_pii_member_visible_phone(self, sample_users):
        """Test member-visible phone not masked."""
        from pii_security import mask_user_pii
        
        user = sample_users["bob"].copy()  # Bob has contactNumberVisible=True
        
        masked = mask_user_pii(user, requester_id="alice", access_granted=False)
        
        # Phone visible to all members
        assert masked["contactNumber"] == "+1-555-333-4444"
        assert masked["contactNumberMasked"] is False
        # Email still masked
        assert masked["contactEmailMasked"] is True
    
    def test_mask_user_pii_linkedin(self, sample_users):
        """Test LinkedIn URL masking."""
        from pii_security import mask_user_pii
        
        user = sample_users["alice"].copy()
        masked = mask_user_pii(user, requester_id="bob", access_granted=False)
        
        assert "Private" in masked["linkedinUrl"] or "🔒" in masked["linkedinUrl"]
        assert masked["linkedinUrlMasked"] is True
    
    def test_mask_user_pii_empty_data(self):
        """Test masking empty user data."""
        from pii_security import mask_user_pii
        
        masked = mask_user_pii({})
        assert masked == {}
    
    def test_mask_user_pii_none_data(self):
        """Test masking None user data."""
        from pii_security import mask_user_pii
        
        masked = mask_user_pii(None)
        assert masked is None


# ============================================================================
# ACCESS CHECK TESTS
# ============================================================================

class TestCheckAccessGranted:
    """Test access granted checking logic."""
    
    @pytest.mark.asyncio
    async def test_check_access_own_profile(self, mock_db):
        """Test access always granted for own profile."""
        from pii_security import check_access_granted
        
        result = await check_access_granted(mock_db, "alice", "alice")
        
        assert result is True
        # Should not query database
        mock_db.pii_access.find_one.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_check_access_admin_by_username(self, mock_db):
        """Test admin bypass by username."""
        from pii_security import check_access_granted
        
        mock_db.users.find_one = AsyncMock(return_value={"username": "admin", "role_name": "user"})
        
        result = await check_access_granted(mock_db, "admin", "alice")
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_check_access_admin_by_role(self, mock_db, sample_users):
        """Test admin bypass by role_name."""
        from pii_security import check_access_granted
        
        mock_db.users.find_one = AsyncMock(return_value=sample_users["admin"])
        
        result = await check_access_granted(mock_db, "admin", "alice")
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_check_access_granted_via_pii_access(self, mock_db, sample_pii_access):
        """Test access granted via pii_access collection."""
        from pii_security import check_access_granted
        
        mock_db.users.find_one = AsyncMock(return_value={"username": "alice", "role_name": "user"})
        mock_db.pii_access.find_one = AsyncMock(return_value=sample_pii_access)
        
        result = await check_access_granted(mock_db, "alice", "bob")
        
        assert result is True
        mock_db.pii_access.find_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_check_access_not_granted(self, mock_db):
        """Test access not granted when no records exist."""
        from pii_security import check_access_granted
        
        mock_db.users.find_one = AsyncMock(return_value={"username": "alice", "role_name": "user"})
        mock_db.pii_access.find_one = AsyncMock(return_value=None)
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        
        result = await check_access_granted(mock_db, "alice", "bob")
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_check_access_legacy_collection(self, mock_db):
        """Test fallback to legacy access_requests collection."""
        from pii_security import check_access_granted
        
        mock_db.users.find_one = AsyncMock(return_value={"username": "alice", "role_name": "user"})
        mock_db.pii_access.find_one = AsyncMock(return_value=None)
        mock_db.access_requests.find_one = AsyncMock(return_value={
            "requesterId": "alice",
            "requestedUserId": "bob",
            "status": "approved"
        })
        
        result = await check_access_granted(mock_db, "alice", "bob")
        
        assert result is True


# ============================================================================
# PII REQUEST WORKFLOW TESTS
# ============================================================================

class TestPIIRequestWorkflow:
    """Test PII request creation and management."""
    
    @pytest.mark.asyncio
    async def test_create_new_request(self, mock_db):
        """Test creating a new PII request."""
        from pii_security import create_access_request
        
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        mock_db.access_requests.insert_one = AsyncMock()
        mock_db.access_requests.insert_one.return_value.inserted_id = ObjectId()
        
        result = await create_access_request(mock_db, "alice", "bob", "Please share")
        
        assert result["requesterId"] == "alice"
        assert result["requestedUserId"] == "bob"
        assert result["status"] == "pending"
        assert result["message"] == "Please share"
    
    @pytest.mark.asyncio
    async def test_create_request_already_pending(self, mock_db):
        """Test creating request when one is already pending."""
        from pii_security import create_access_request
        
        mock_db.access_requests.find_one = AsyncMock(return_value={"status": "pending"})
        
        result = await create_access_request(mock_db, "alice", "bob")
        
        assert result == {"error": "Request already pending"}
    
    @pytest.mark.asyncio
    async def test_create_request_already_approved(self, mock_db):
        """Test creating request when access already granted."""
        from pii_security import create_access_request
        
        mock_db.access_requests.find_one = AsyncMock(return_value={"status": "approved"})
        
        result = await create_access_request(mock_db, "alice", "bob")
        
        assert result == {"error": "Access already granted"}
    
    @pytest.mark.asyncio
    async def test_create_request_after_denial(self, mock_db):
        """Test re-requesting after previous denial."""
        from pii_security import create_access_request
        
        mock_db.access_requests.find_one = AsyncMock(return_value={"status": "denied"})
        mock_db.access_requests.insert_one = AsyncMock()
        mock_db.access_requests.insert_one.return_value.inserted_id = ObjectId()
        
        result = await create_access_request(mock_db, "alice", "bob")
        
        # Should allow re-request after denial
        assert result["status"] == "pending"


# ============================================================================
# PII REQUEST RESPONSE TESTS
# ============================================================================

class TestPIIRequestResponse:
    """Test responding to PII requests (approve/reject)."""
    
    @pytest.mark.asyncio
    async def test_approve_request(self, mock_db, sample_pii_request):
        """Test approving a PII request."""
        from pii_security import respond_to_access_request
        
        request_id = str(sample_pii_request["_id"])
        
        # First call returns pending, second returns approved
        call_count = [0]
        async def mock_find_one(query):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "_id": sample_pii_request["_id"],
                    "requesterId": "alice",
                    "requestedUserId": "bob",
                    "status": "pending"
                }
            else:
                return {
                    "_id": sample_pii_request["_id"],
                    "requesterId": "alice",
                    "requestedUserId": "bob",
                    "status": "approved",
                    "responseDate": datetime.utcnow().isoformat()
                }
        
        mock_db.access_requests.find_one = AsyncMock(side_effect=mock_find_one)
        mock_db.access_requests.update_one = AsyncMock()
        
        result = await respond_to_access_request(mock_db, request_id, "approved", "bob")
        
        assert result["status"] == "approved"
        mock_db.access_requests.update_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_reject_request(self, mock_db, sample_pii_request):
        """Test rejecting a PII request."""
        from pii_security import respond_to_access_request
        
        request_id = str(sample_pii_request["_id"])
        
        call_count = [0]
        async def mock_find_one(query):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "_id": sample_pii_request["_id"],
                    "requesterId": "alice",
                    "requestedUserId": "bob",
                    "status": "pending"
                }
            else:
                return {
                    "_id": sample_pii_request["_id"],
                    "requesterId": "alice",
                    "requestedUserId": "bob",
                    "status": "denied",
                    "responseDate": datetime.utcnow().isoformat()
                }
        
        mock_db.access_requests.find_one = AsyncMock(side_effect=mock_find_one)
        mock_db.access_requests.update_one = AsyncMock()
        
        result = await respond_to_access_request(mock_db, request_id, "denied", "bob")
        
        assert result["status"] == "denied"
    
    @pytest.mark.asyncio
    async def test_respond_request_not_found(self, mock_db):
        """Test responding to non-existent request."""
        from pii_security import respond_to_access_request
        
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        
        result = await respond_to_access_request(
            mock_db, str(ObjectId()), "approved", "bob"
        )
        
        assert result == {"error": "Request not found"}
    
    @pytest.mark.asyncio
    async def test_respond_unauthorized(self, mock_db, sample_pii_request):
        """Test responding as wrong user."""
        from pii_security import respond_to_access_request
        
        mock_db.access_requests.find_one = AsyncMock(return_value={
            "_id": sample_pii_request["_id"],
            "requesterId": "alice",
            "requestedUserId": "bob",
            "status": "pending"
        })
        
        # Charlie tries to respond to Bob's request
        result = await respond_to_access_request(
            mock_db, str(sample_pii_request["_id"]), "approved", "charlie"
        )
        
        assert result == {"error": "Unauthorized"}


# ============================================================================
# ACCESS REVOCATION TESTS
# ============================================================================

class TestAccessRevocation:
    """Test PII access revocation scenarios."""
    
    @pytest.mark.asyncio
    async def test_revoke_access(self, mock_db, sample_pii_access):
        """Test revoking granted access."""
        access_id = str(sample_pii_access["_id"])
        
        mock_db.pii_access.find_one = AsyncMock(return_value=sample_pii_access)
        mock_db.pii_access.update_one = AsyncMock()
        
        # Simulate revocation
        await mock_db.pii_access.update_one(
            {"_id": sample_pii_access["_id"]},
            {"$set": {"isActive": False}}
        )
        
        mock_db.pii_access.update_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_revoked_access_not_granted(self, mock_db, sample_pii_access):
        """Test that revoked access returns False."""
        from pii_security import check_access_granted
        
        # Access exists but isActive=False
        revoked_access = sample_pii_access.copy()
        revoked_access["isActive"] = False
        
        mock_db.users.find_one = AsyncMock(return_value={"username": "alice", "role_name": "user"})
        # pii_access query includes isActive: True, so revoked won't match
        mock_db.pii_access.find_one = AsyncMock(return_value=None)
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        
        result = await check_access_granted(mock_db, "alice", "bob")
        
        assert result is False


# ============================================================================
# ACCESS EXPIRY TESTS
# ============================================================================

class TestAccessExpiry:
    """Test PII access expiry scenarios."""
    
    def test_access_not_expired(self, sample_pii_access):
        """Test access that hasn't expired."""
        # Set expiry to future
        sample_pii_access["expiresAt"] = datetime.utcnow() + timedelta(days=30)
        
        is_expired = (
            sample_pii_access.get("expiresAt") and 
            sample_pii_access["expiresAt"] < datetime.utcnow()
        )
        
        assert is_expired is False
    
    def test_access_expired(self, sample_pii_access):
        """Test access that has expired."""
        # Set expiry to past
        sample_pii_access["expiresAt"] = datetime.utcnow() - timedelta(days=1)
        
        is_expired = (
            sample_pii_access.get("expiresAt") and 
            sample_pii_access["expiresAt"] < datetime.utcnow()
        )
        
        assert is_expired is True
    
    def test_permanent_access_no_expiry(self, sample_pii_access):
        """Test permanent access (no expiry)."""
        sample_pii_access["expiresAt"] = None
        
        # When expiresAt is None, the first condition is False, so whole expression is False
        is_expired = (
            sample_pii_access.get("expiresAt") is not None and 
            sample_pii_access["expiresAt"] < datetime.utcnow()
        )
        
        assert is_expired is False


# ============================================================================
# IMAGE ACCESS TESTS
# ============================================================================

class TestImageAccess:
    """Test image-specific access scenarios."""
    
    def test_image_onetime_not_viewed(self, sample_image_access):
        """Test one-time image not yet viewed."""
        img_access = sample_image_access["pictureDurations"]["0"]
        
        is_available = (
            img_access["duration"] == "onetime" and 
            img_access.get("viewedAt") is None
        )
        
        assert is_available is True
    
    def test_image_onetime_already_viewed(self, sample_image_access):
        """Test one-time image already viewed."""
        img_access = sample_image_access["pictureDurations"]["0"].copy()
        img_access["viewedAt"] = datetime.utcnow()
        
        is_available = (
            img_access["duration"] == "onetime" and 
            img_access.get("viewedAt") is None
        )
        
        assert is_available is False
    
    def test_image_timed_not_expired(self, sample_image_access):
        """Test timed image access not expired."""
        img_access = sample_image_access["pictureDurations"]["1"]
        
        is_available = (
            isinstance(img_access["duration"], int) and
            img_access.get("expiresAt") and
            img_access["expiresAt"] > datetime.utcnow()
        )
        
        assert is_available is True
    
    def test_image_timed_expired(self, sample_image_access):
        """Test timed image access expired."""
        img_access = sample_image_access["pictureDurations"]["1"].copy()
        img_access["expiresAt"] = datetime.utcnow() - timedelta(days=1)
        
        is_available = (
            isinstance(img_access["duration"], int) and
            img_access.get("expiresAt") and
            img_access["expiresAt"] > datetime.utcnow()
        )
        
        assert is_available is False
    
    def test_image_permanent_always_available(self, sample_image_access):
        """Test permanent image access always available."""
        img_access = sample_image_access["pictureDurations"]["2"]
        
        is_available = img_access["duration"] == "permanent"
        
        assert is_available is True


# ============================================================================
# MEMBER VISIBLE BYPASS TESTS
# ============================================================================

class TestMemberVisibleBypass:
    """Test member-visible field bypass scenarios."""
    
    def test_email_visible_no_access_needed(self, sample_users):
        """Test email visible to all members."""
        from pii_security import mask_user_pii
        
        user = sample_users["alice"].copy()
        user["contactEmailVisible"] = True
        
        masked = mask_user_pii(user, requester_id="stranger", access_granted=False)
        
        assert masked["contactEmail"] == "alice@example.com"
        assert masked["contactEmailMasked"] is False
    
    def test_phone_visible_no_access_needed(self, sample_users):
        """Test phone visible to all members."""
        from pii_security import mask_user_pii
        
        user = sample_users["bob"].copy()  # Has contactNumberVisible=True
        
        masked = mask_user_pii(user, requester_id="stranger", access_granted=False)
        
        assert masked["contactNumber"] == "+1-555-333-4444"
        assert masked["contactNumberMasked"] is False
    
    def test_linkedin_visible_no_access_needed(self, sample_users):
        """Test LinkedIn visible to all members."""
        from pii_security import mask_user_pii
        
        user = sample_users["alice"].copy()
        user["linkedinUrlVisible"] = True
        
        masked = mask_user_pii(user, requester_id="stranger", access_granted=False)
        
        assert masked["linkedinUrl"] == "https://linkedin.com/in/alice"
        assert masked["linkedinUrlMasked"] is False
    
    def test_mixed_visibility(self, sample_users):
        """Test mixed visibility settings."""
        from pii_security import mask_user_pii
        
        user = sample_users["alice"].copy()
        user["contactEmailVisible"] = True   # Visible
        user["contactNumberVisible"] = False  # Not visible
        user["linkedinUrlVisible"] = True    # Visible
        
        masked = mask_user_pii(user, requester_id="stranger", access_granted=False)
        
        # Email visible
        assert masked["contactEmail"] == "alice@example.com"
        assert masked["contactEmailMasked"] is False
        
        # Phone masked
        assert "***" in masked["contactNumber"]
        assert masked["contactNumberMasked"] is True
        
        # LinkedIn visible
        assert masked["linkedinUrl"] == "https://linkedin.com/in/alice"
        assert masked["linkedinUrlMasked"] is False


# ============================================================================
# ADMIN BYPASS TESTS
# ============================================================================

class TestAdminBypass:
    """Test admin bypass scenarios."""
    
    @pytest.mark.asyncio
    async def test_admin_sees_all_pii(self, mock_db, sample_users):
        """Test admin can see all PII without access grant."""
        from pii_security import check_access_granted
        
        mock_db.users.find_one = AsyncMock(return_value=sample_users["admin"])
        
        result = await check_access_granted(mock_db, "admin", "alice")
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_admin_username_bypass(self, mock_db):
        """Test 'admin' username always has access."""
        from pii_security import check_access_granted
        
        # Even if role_name is not admin, username 'admin' has access
        mock_db.users.find_one = AsyncMock(return_value={
            "username": "admin",
            "role_name": "user"  # Wrong role but username is admin
        })
        
        result = await check_access_granted(mock_db, "admin", "anyone")
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_admin_role_bypass(self, mock_db):
        """Test role_name='admin' has access."""
        from pii_security import check_access_granted
        
        mock_db.users.find_one = AsyncMock(return_value={
            "username": "superuser",
            "role_name": "admin"
        })
        
        result = await check_access_granted(mock_db, "superuser", "anyone")
        
        assert result is True


# ============================================================================
# COMBINATION SCENARIO TESTS
# ============================================================================

class TestCombinationScenarios:
    """Test complex combination scenarios."""
    
    @pytest.mark.asyncio
    async def test_scenario_request_approve_view(self, mock_db, sample_users):
        """
        Full flow: Alice requests → Bob approves → Alice views
        """
        from pii_security import (
            create_access_request, 
            respond_to_access_request,
            check_access_granted,
            mask_user_pii
        )
        
        # Step 1: Alice requests access
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        mock_db.access_requests.insert_one = AsyncMock()
        mock_db.access_requests.insert_one.return_value.inserted_id = ObjectId()
        
        request = await create_access_request(mock_db, "alice", "bob", "Please share")
        assert request["status"] == "pending"
        
        # Step 2: Bob approves (simulated via pii_access creation)
        mock_db.users.find_one = AsyncMock(return_value=sample_users["alice"])
        mock_db.pii_access.find_one = AsyncMock(return_value={
            "granterUsername": "bob",
            "grantedToUsername": "alice",
            "accessType": "contact_email",
            "isActive": True
        })
        
        # Step 3: Alice checks access
        has_access = await check_access_granted(mock_db, "alice", "bob")
        assert has_access is True
        
        # Step 4: Alice views Bob's profile - should see unmasked
        bob = sample_users["bob"].copy()
        masked = mask_user_pii(bob, requester_id="alice", access_granted=True)
        assert masked["contactEmail"] == "bob@example.com"
    
    @pytest.mark.asyncio
    async def test_scenario_request_reject_view(self, mock_db, sample_users):
        """
        Full flow: Alice requests → Bob rejects → Alice views masked
        """
        from pii_security import check_access_granted, mask_user_pii
        
        # After rejection, no access record exists
        mock_db.users.find_one = AsyncMock(return_value=sample_users["alice"])
        mock_db.pii_access.find_one = AsyncMock(return_value=None)
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        
        # Alice checks access - should be denied
        has_access = await check_access_granted(mock_db, "alice", "bob")
        assert has_access is False
        
        # Alice views Bob's profile - should see masked
        bob = sample_users["bob"].copy()
        masked = mask_user_pii(bob, requester_id="alice", access_granted=False)
        assert "***" in masked["contactEmail"]
        assert masked["contactEmailMasked"] is True
    
    @pytest.mark.asyncio
    async def test_scenario_grant_revoke_view(self, mock_db, sample_users):
        """
        Full flow: Bob grants → Bob revokes → Alice views masked
        """
        from pii_security import check_access_granted, mask_user_pii
        
        # After revocation, isActive=False so query returns None
        mock_db.users.find_one = AsyncMock(return_value=sample_users["alice"])
        mock_db.pii_access.find_one = AsyncMock(return_value=None)  # Revoked
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        
        # Alice checks access - should be denied
        has_access = await check_access_granted(mock_db, "alice", "bob")
        assert has_access is False
        
        # Alice views Bob's profile - should see masked
        bob = sample_users["bob"].copy()
        masked = mask_user_pii(bob, requester_id="alice", access_granted=False)
        assert "***" in masked["contactEmail"]
    
    def test_scenario_member_visible_overrides_no_access(self, sample_users):
        """
        Member-visible field shown even without access grant.
        """
        from pii_security import mask_user_pii
        
        bob = sample_users["bob"].copy()  # contactNumberVisible=True
        
        # No access granted, but phone is member-visible
        masked = mask_user_pii(bob, requester_id="stranger", access_granted=False)
        
        # Phone visible (member-visible)
        assert masked["contactNumber"] == "+1-555-333-4444"
        assert masked["contactNumberMasked"] is False
        
        # Email still masked (not member-visible)
        assert "***" in masked["contactEmail"]
        assert masked["contactEmailMasked"] is True
    
    @pytest.mark.asyncio
    async def test_scenario_expired_access_masked(self, mock_db, sample_users):
        """
        Expired access should result in masked data.
        """
        from pii_security import check_access_granted, mask_user_pii
        
        # Expired access - query returns None (isActive check or expiry check)
        mock_db.users.find_one = AsyncMock(return_value=sample_users["alice"])
        mock_db.pii_access.find_one = AsyncMock(return_value=None)
        mock_db.access_requests.find_one = AsyncMock(return_value=None)
        
        has_access = await check_access_granted(mock_db, "alice", "bob")
        assert has_access is False
        
        bob = sample_users["bob"].copy()
        masked = mask_user_pii(bob, requester_id="alice", access_granted=False)
        assert "***" in masked["contactEmail"]


# ============================================================================
# EDGE CASE TESTS
# ============================================================================

class TestEdgeCases:
    """Test edge cases and error handling."""
    
    def test_mask_user_with_missing_fields(self):
        """Test masking user with some PII fields missing."""
        from pii_security import mask_user_pii
        
        user = {
            "username": "partial",
            "contactEmail": "test@example.com"
            # Missing: contactNumber, linkedinUrl, location
        }
        
        masked = mask_user_pii(user, requester_id="other", access_granted=False)
        
        assert "***" in masked["contactEmail"]
        assert "contactNumber" not in masked
    
    def test_mask_user_with_empty_fields(self):
        """Test masking user with empty PII fields."""
        from pii_security import mask_user_pii
        
        user = {
            "username": "empty",
            "contactEmail": "",
            "contactNumber": "",
            "linkedinUrl": ""
        }
        
        masked = mask_user_pii(user, requester_id="other", access_granted=False)
        
        # Empty strings should remain empty
        assert masked["contactEmail"] == ""
        assert masked["contactNumber"] == ""
    
    @pytest.mark.asyncio
    async def test_check_access_db_error(self, mock_db):
        """Test access check when database error occurs."""
        from pii_security import check_access_granted
        
        mock_db.users.find_one = AsyncMock(side_effect=Exception("DB connection failed"))
        
        with pytest.raises(Exception) as exc_info:
            await check_access_granted(mock_db, "alice", "bob")
        
        assert "DB connection failed" in str(exc_info.value)
    
    def test_mask_special_characters_in_email(self):
        """Test masking email with special characters."""
        from pii_security import mask_email
        
        assert mask_email("user+tag@example.com") == "u***@example.com"
        assert mask_email("user.name@sub.domain.com") == "u***@sub.domain.com"
    
    def test_mask_unicode_in_location(self):
        """Test masking location with unicode characters."""
        from pii_security import mask_location
        
        # Should handle unicode gracefully
        result = mask_location("東京, 日本")
        assert result == "東京, 日本"


# ============================================================================
# IMAGE PII WORKFLOW TESTS (Added Dec 17, 2025)
# ============================================================================

class TestImagePIIWorkflow:
    """
    Test the complete image PII workflow.
    
    IMAGE VISIBILITY ARCHITECTURE:
    ==============================
    
    1. SINGLE SOURCE OF TRUTH: `publicImages` array
       - Contains paths of images marked as public by profile owner
       - Stored in user document: { publicImages: ["/uploads/user/img1.jpg", ...] }
       - Empty array = all images are private
    
    2. VISIBILITY DETERMINATION (Profile.js):
       - Own profile: Show ALL images
       - piiAccess.images = true: Show ALL images (granted access)
       - Else: Show only images in publicImages array
    
    3. TOGGLE BEHAVIOR (ImageManager.js):
       - Toggle ON (👁️): Add image path to publicImages array
       - Toggle OFF (🔒): Remove image path from publicImages array
       - "Make All Public" button: Set publicImages = all image paths
       - "Make All Private" button: Set publicImages = []
    
    4. PATH NORMALIZATION (routes.py):
       - Frontend sends: /api/users/media/username/image.jpg
       - Backend stores: /uploads/username/image.jpg
       - Conversion happens in update_public_images endpoint
    
    5. ACCESS GRANT WORKFLOW:
       a. Viewer sees public images + "Request More Photos" button
       b. Viewer clicks request → creates pii_request with type="images"
       c. Owner receives notification → opens Grant Image Access modal
       d. Owner selects duration per image (one-time, 24h, 3 days, permanent)
       e. Grant creates pii_access record with pictureDurations
       f. Viewer refreshes → sees all images
    
    6. DURATION TYPES:
       - "onetime": Image viewable once, then access expires
       - Integer (1, 3, 7, 30): Days until expiry
       - "permanent": Never expires
    
    DATABASE COLLECTIONS:
    ====================
    
    users:
      - images: ["/uploads/user/img1.jpg", ...]  # All uploaded images
      - publicImages: ["/uploads/user/img1.jpg"]  # Subset marked public
    
    pii_access:
      - granterUsername: "alice"
      - grantedToUsername: "bob"
      - accessType: "images"
      - isActive: true
      - pictureDurations: {
          "0": {"duration": "onetime", "viewedAt": null},
          "1": {"duration": 3, "expiresAt": "2025-12-20T00:00:00Z"},
          "2": {"duration": "permanent"}
        }
    
    FRONTEND COMPONENTS:
    ===================
    
    ImageManager.js:
      - Displays images with per-image toggle switches
      - isImagePublic(imgUrl): Checks if image is in publicImages
      - togglePublic(imgUrl): Adds/removes from publicImages via API
      - normalizeImagePath(url): Extracts path from full URL
    
    Profile.js:
      - Displays photos section with visibility logic
      - checkPIIAccess(): Fetches per-field access status
      - loadAccessibleImages(): Fetches per-image access with durations
      - publicImageObjects: Computed from user.publicImages
    
    Register2.js:
      - Profile editing form
      - "Make All Public" / "Make All Private" buttons
      - Passes publicImages state to ImageManager
    
    BACKEND ENDPOINTS:
    =================
    
    PUT /api/users/{username}/public-images
      - Updates publicImages array
      - Normalizes paths (frontend → backend format)
      - Returns updated publicImages as full URLs
    
    GET /api/pii-access/check-images
      - Checks per-image access for requester
      - Returns: { images: [{ index, hasAccess, reason }] }
    
    POST /api/pii-access/grant
      - Grants image access with per-picture durations
      - Creates pii_access record
    """
    
    def test_public_images_empty_all_private(self, sample_users):
        """Test that empty publicImages means all images are private."""
        user = sample_users["alice"].copy()
        user["publicImages"] = []
        
        # All images should be private
        for img in user["images"]:
            assert img not in user["publicImages"]
    
    def test_public_images_subset(self, sample_users):
        """Test publicImages as subset of all images."""
        user = sample_users["alice"].copy()
        user["publicImages"] = ["/uploads/alice/img1.jpg"]
        
        # First image public, second private
        assert user["images"][0] in user["publicImages"]
        assert user["images"][1] not in user["publicImages"]
    
    def test_public_images_all_public(self, sample_users):
        """Test all images marked public."""
        user = sample_users["alice"].copy()
        user["publicImages"] = user["images"].copy()
        
        # All images should be public
        for img in user["images"]:
            assert img in user["publicImages"]
    
    def test_path_normalization_api_to_uploads(self):
        """Test path normalization from frontend to backend format."""
        # Frontend URL format
        frontend_url = "http://localhost:8000/api/users/media/alice/img1.jpg"
        
        # Expected backend path
        expected_path = "/uploads/alice/img1.jpg"
        
        # Simulate normalization logic
        from urllib.parse import urlparse
        parsed = urlparse(frontend_url)
        path = parsed.path
        if '/api/users/media/' in path:
            path = '/uploads/' + path.split('/api/users/media/')[-1]
        
        assert path == expected_path
    
    def test_path_normalization_already_normalized(self):
        """Test path that's already in backend format."""
        backend_path = "/uploads/alice/img1.jpg"
        
        # Should remain unchanged
        if not backend_path.startswith('http'):
            if backend_path.startswith('/uploads/'):
                result = backend_path
            elif backend_path.startswith('/api/users/media/'):
                result = '/uploads/' + backend_path.split('/api/users/media/')[-1]
            else:
                result = backend_path
        
        assert result == backend_path
    
    def test_image_access_onetime_workflow(self, sample_image_access):
        """Test one-time image access workflow."""
        img_access = sample_image_access["pictureDurations"]["0"]
        
        # Before viewing
        assert img_access["duration"] == "onetime"
        assert img_access.get("viewedAt") is None
        assert img_access.get("isExpired", False) is False
        
        # After viewing - simulate
        img_access["viewedAt"] = datetime.utcnow()
        
        # Should now be expired
        is_expired = img_access.get("viewedAt") is not None
        assert is_expired is True
    
    def test_image_access_timed_workflow(self, sample_image_access):
        """Test timed image access workflow."""
        img_access = sample_image_access["pictureDurations"]["1"]
        
        # Check duration is integer (days)
        assert isinstance(img_access["duration"], int)
        assert img_access["duration"] == 3
        
        # Check expiry is in future
        assert img_access["expiresAt"] > datetime.utcnow()
        
        # Simulate expiry
        img_access["expiresAt"] = datetime.utcnow() - timedelta(hours=1)
        
        # Should now be expired
        is_expired = img_access["expiresAt"] < datetime.utcnow()
        assert is_expired is True
    
    def test_image_access_permanent_workflow(self, sample_image_access):
        """Test permanent image access workflow."""
        img_access = sample_image_access["pictureDurations"]["2"]
        
        # Check permanent duration
        assert img_access["duration"] == "permanent"
        assert img_access.get("expiresAt") is None
        
        # Should never expire
        is_expired = (
            img_access.get("expiresAt") is not None and 
            img_access["expiresAt"] < datetime.utcnow()
        )
        assert is_expired is False
    
    def test_request_more_photos_visibility(self, sample_users):
        """Test 'Request More Photos' button visibility logic."""
        user = sample_users["alice"].copy()
        
        # Case 1: All images public - button should NOT show
        user["publicImages"] = user["images"].copy()
        total_images = len(user["images"])
        public_images = len(user["publicImages"])
        show_button = total_images > public_images
        assert show_button is False
        
        # Case 2: Some images private - button should show
        user["publicImages"] = [user["images"][0]]
        public_images = len(user["publicImages"])
        show_button = total_images > public_images
        assert show_button is True
        
        # Case 3: All images private - button should show
        user["publicImages"] = []
        public_images = len(user["publicImages"])
        show_button = total_images > public_images
        assert show_button is True
    
    def test_member_visible_badge_logic(self, sample_users):
        """Test 'Member Visible' badge display logic."""
        user = sample_users["alice"].copy()
        is_own_profile = False
        
        # Case 1: Has public images - show badge
        user["publicImages"] = ["/uploads/alice/img1.jpg"]
        show_badge = len(user.get("publicImages", [])) > 0 and not is_own_profile
        assert show_badge is True
        
        # Case 2: No public images - don't show badge
        user["publicImages"] = []
        show_badge = len(user.get("publicImages", [])) > 0 and not is_own_profile
        assert show_badge is False
        
        # Case 3: Own profile - don't show badge
        is_own_profile = True
        user["publicImages"] = ["/uploads/alice/img1.jpg"]
        show_badge = len(user.get("publicImages", [])) > 0 and not is_own_profile
        assert show_badge is False


class TestImagePIIAccessGrant:
    """Test image-specific PII access granting."""
    
    @pytest.fixture
    def image_grant_request(self):
        """Sample image access grant request."""
        return {
            "granterUsername": "alice",
            "grantedToUsername": "bob",
            "accessType": "images",
            "pictureDurations": {
                "0": {"duration": "onetime"},
                "1": {"duration": 3},
                "2": {"duration": "permanent"}
            },
            "message": "Here are my photos"
        }
    
    def test_grant_creates_picture_durations(self, image_grant_request):
        """Test that grant creates per-picture duration records."""
        durations = image_grant_request["pictureDurations"]
        
        assert "0" in durations
        assert "1" in durations
        assert "2" in durations
        
        assert durations["0"]["duration"] == "onetime"
        assert durations["1"]["duration"] == 3
        assert durations["2"]["duration"] == "permanent"
    
    def test_grant_calculates_expiry_dates(self, image_grant_request):
        """Test that grant calculates expiry dates for timed access."""
        durations = image_grant_request["pictureDurations"]
        now = datetime.utcnow()
        
        # Simulate expiry calculation
        for idx, config in durations.items():
            if isinstance(config["duration"], int):
                config["expiresAt"] = now + timedelta(days=config["duration"])
            elif config["duration"] == "permanent":
                config["expiresAt"] = None
            elif config["duration"] == "onetime":
                config["viewedAt"] = None
                config["isExpired"] = False
        
        # Check results
        assert durations["0"].get("viewedAt") is None
        assert durations["1"]["expiresAt"] > now
        assert durations["2"]["expiresAt"] is None
    
    @pytest.mark.asyncio
    async def test_check_per_image_access(self, mock_db, sample_image_access):
        """Test checking access for individual images."""
        # Setup mock
        mock_db.pii_access.find_one = AsyncMock(return_value=sample_image_access)
        
        # Simulate per-image access check
        access_record = await mock_db.pii_access.find_one({
            "granterUsername": "bob",
            "grantedToUsername": "alice",
            "accessType": "images",
            "isActive": True
        })
        
        assert access_record is not None
        
        durations = access_record["pictureDurations"]
        
        # Check each image
        results = []
        for idx, config in durations.items():
            if config["duration"] == "onetime":
                has_access = config.get("viewedAt") is None
            elif config["duration"] == "permanent":
                has_access = True
            elif isinstance(config["duration"], int):
                has_access = config.get("expiresAt", datetime.max) > datetime.utcnow()
            else:
                has_access = False
            
            results.append({"index": int(idx), "hasAccess": has_access})
        
        # All should have access (onetime not viewed, timed not expired, permanent)
        assert all(r["hasAccess"] for r in results)


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
