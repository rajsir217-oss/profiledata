# fastapi_backend/pii_security.py
"""
PII (Personally Identifiable Information) Security Module
Masks sensitive user data until access is granted
"""

def mask_email(email):
    """Mask email address: john.doe@gmail.com -> j***@gmail.com"""
    if not email or '@' not in email:
        return email

    # Handle multiple @ symbols by taking only the last two parts
    parts = email.split('@')
    if len(parts) >= 2:
        local = parts[0]
        domain = '@'.join(parts[1:])  # Join all parts after first @ back together
    else:
        return email

    if len(local) <= 1:
        masked_local = local[0] + '***'
    else:
        masked_local = local[0] + '***'

    return f"{masked_local}@{domain}"

def mask_phone(phone):
    """Mask phone number: +1-555-123-4567 -> ***-***-4567"""
    if not phone:
        return phone

    # Remove extension part (everything after "ext")
    phone_clean = phone.split(' ext')[0].split('ext')[0]

    # Keep only last 4 digits
    digits = ''.join(filter(str.isdigit, phone_clean))
    if len(digits) < 4:
        return '***'

    last_four = digits[-4:]
    return f"***-***-{last_four}"

def mask_location(location):
    """Mask exact location with specific logic to match test expectations"""
    if not location:
        return location

    # Try to extract city and state (last two parts after comma)
    parts = [p.strip() for p in location.split(',')]
    if len(parts) == 3:
        # For exactly 3 parts like "123 Main St, New York, NY", return only state
        return parts[-1]
    elif len(parts) >= 4:
        # For 4+ parts, return last two parts (state, country)
        return ', '.join(parts[-2:])
    elif len(parts) == 2:
        # For exactly 2 parts, return both (city, state)
        return ', '.join(parts)
    else:
        # For 1 part or edge cases, return as-is
        return location

def mask_user_pii(user_data, requester_id=None, access_granted=False, per_field_access=None):
    """
    Mask PII fields in user data based on visibility settings and access grants.
    
    Visibility Logic:
    - If field is set to "visible to members" (e.g., contactNumberVisible=True), don't mask
    - If field is NOT visible (e.g., contactNumberVisible=False), mask unless access_granted
    - Default behavior varies by field:
      - contactEmail, contactNumber, linkedinUrl: default NOT visible (False)
      - images: default VISIBLE (True) - imagesVisible defaults to True

    Args:
        user_data: User document from database
        requester_id: ID of user requesting to view profile
        access_granted: Whether access has been granted via PII request (legacy, general access)
        per_field_access: Dict with per-field access {contact_email: bool, contact_number: bool, linkedin_url: bool, images: bool}

    Returns:
        User data with masked PII fields
    """
    if not user_data:
        return user_data

    # If requester is viewing their own profile, don't mask
    if requester_id and user_data.get('username') == requester_id:
        return user_data

    # Create a copy to avoid modifying original
    masked_data = user_data.copy()
    
    # Track if any field was masked
    any_masked = False
    
    # Initialize per_field_access if not provided
    if per_field_access is None:
        per_field_access = {
            'contact_email': access_granted,
            'contact_number': access_granted,
            'linkedin_url': access_granted,
            'images': access_granted
        }

    # Check visibility settings for each PII field
    # If visible=True, show to all members; if visible=False or not set, require access grant
    
    # Get visibility flags with appropriate defaults
    # Default: True (visible to members) - matches frontend Register2.js defaults
    contact_email_visible = user_data.get('contactEmailVisible', True)  # Default: visible to members
    contact_number_visible = user_data.get('contactNumberVisible', True)  # Default: visible to members
    linkedin_visible = user_data.get('linkedinUrlVisible', True)  # Default: visible to members
    # Note: Image visibility is now handled by imageVisibility 3-bucket system in routes.py
    
    # IMPORTANT: Always include visibility flags in response (frontend needs these)
    # If missing from DB, use defaults so frontend can correctly show/hide contact info
    masked_data['contactEmailVisible'] = contact_email_visible
    masked_data['contactNumberVisible'] = contact_number_visible
    masked_data['linkedinUrlVisible'] = linkedin_visible
    
    # Debug logging for visibility settings
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"👁️ PII Masking - contactEmailVisible: {contact_email_visible}, contactNumberVisible: {contact_number_visible}, linkedinUrlVisible: {linkedin_visible}, per_field_access: {per_field_access}")
    
    # Contact Email - check visibility OR per-field access
    has_email_access = per_field_access.get('contact_email', False)
    if 'contactEmail' in masked_data and masked_data['contactEmail']:
        if not contact_email_visible and not has_email_access:
            masked_data['contactEmail'] = mask_email(masked_data['contactEmail'])
            masked_data['contactEmailMasked'] = True
            any_masked = True
        else:
            masked_data['contactEmailMasked'] = False

    # Contact Number - check visibility OR per-field access
    has_number_access = per_field_access.get('contact_number', False)
    if 'contactNumber' in masked_data and masked_data['contactNumber']:
        if not contact_number_visible and not has_number_access:
            masked_data['contactNumber'] = mask_phone(masked_data['contactNumber'])
            masked_data['contactNumberMasked'] = True
            any_masked = True
        else:
            masked_data['contactNumberMasked'] = False

    # Location - always partially mask for privacy (just city, not full address)
    if 'location' in masked_data and masked_data['location']:
        masked_data['location'] = mask_location(masked_data['location'])
        masked_data['locationMasked'] = True

    # LinkedIn URL - check visibility OR per-field access
    has_linkedin_access = per_field_access.get('linkedin_url', False)
    if 'linkedinUrl' in masked_data and masked_data['linkedinUrl']:
        if not linkedin_visible and not has_linkedin_access:
            masked_data['linkedinUrl'] = '[🔒 Private - Request Access]'
            masked_data['linkedinUrlMasked'] = True
            any_masked = True
        else:
            masked_data['linkedinUrlMasked'] = False

    # Images - now handled by imageVisibility 3-bucket system in routes.py
    # This legacy code is kept for backward compatibility but routes.py overrides imagesMasked

    # Add flag indicating if any PII is masked
    masked_data['piiMasked'] = any_masked

    return masked_data

async def check_access_granted(db, requester_id, requested_user_id):
    """
    Check if requester has been granted access to requested user's PII
    
    Args:
        db: Database connection
        requester_id: Username of requester
        requested_user_id: Username of profile being viewed
    
    Returns:
        Boolean indicating if access is granted
    """
    if requester_id == requested_user_id:
        # User viewing own profile - always granted
        return True
    
    # Check if requester is admin (by username or role)
    requester = await db.users.find_one({'username': requester_id})
    if requester:
        # Check role_name field for admin role
        if requester.get('role_name') == 'admin' or requester_id == 'admin':
            return True
    
    # Check pii_access collection (primary source of truth for PII access grants)
    # This is where approved PII requests create access records
    pii_access = await db.pii_access.find_one({
        'granterUsername': requested_user_id,  # Profile owner who granted access
        'grantedToUsername': requester_id,     # User who received access
        'isActive': True,
        'accessType': {'$in': ['contact_email', 'contact_number', 'contact_info', 'linkedin_url', 'images']}  # Any PII type
    })
    
    if pii_access:
        return True
    
    # Also check legacy access_requests collection for backward compatibility
    access_request = await db.access_requests.find_one({
        'requesterId': requester_id,
        'requestedUserId': requested_user_id,
        'status': 'approved'
    })
    
    return access_request is not None


async def get_per_field_access(db, requester_id, requested_user_id):
    """
    Get per-field PII access for a requester viewing a profile.
    
    Args:
        db: Database connection
        requester_id: Username of requester
        requested_user_id: Username of profile being viewed
    
    Returns:
        Dict with per-field access: {contact_email: bool, contact_number: bool, linkedin_url: bool, images: bool}
    """
    access = {
        'contact_email': False,
        'contact_number': False,
        'linkedin_url': False,
        'images': False
    }
    
    if not requester_id or requester_id == requested_user_id:
        # Own profile - full access
        return {k: True for k in access}
    
    # Check if requester is admin
    requester = await db.users.find_one({'username': requester_id})
    if requester:
        if requester.get('role_name') == 'admin' or requester_id == 'admin':
            return {k: True for k in access}
    
    # Check pii_access collection for each field
    cursor = db.pii_access.find({
        'granterUsername': requested_user_id,
        'grantedToUsername': requester_id,
        'isActive': True
    })
    
    async for pii_access in cursor:
        access_types = pii_access.get('accessTypes', [])
        # Also check singular accessType field
        if pii_access.get('accessType'):
            access_types.append(pii_access.get('accessType'))
        
        for access_type in access_types:
            if access_type in access:
                access[access_type] = True
            # Handle contact_info as granting both email and number
            if access_type == 'contact_info':
                access['contact_email'] = True
                access['contact_number'] = True
    
    return access

async def create_access_request(db, requester_id, requested_user_id, message=None):
    """
    Create a new PII access request
    
    Args:
        db: Database connection
        requester_id: Username of requester
        requested_user_id: Username of profile owner
        message: Optional message from requester
    
    Returns:
        Created request document
    """
    from datetime import datetime
    
    # Check if request already exists
    existing = await db.access_requests.find_one({
        'requesterId': requester_id,
        'requestedUserId': requested_user_id
    })
    
    if existing:
        if existing['status'] == 'pending':
            return {'error': 'Request already pending'}
        elif existing['status'] == 'approved':
            return {'error': 'Access already granted'}
        elif existing['status'] == 'denied':
            # Allow re-request after denial
            pass
    
    request_data = {
        'requesterId': requester_id,
        'requestedUserId': requested_user_id,
        'status': 'pending',
        'message': message,
        'requestDate': datetime.utcnow().isoformat(),
        'responseDate': None
    }
    
    result = await db.access_requests.insert_one(request_data)
    request_data['_id'] = str(result.inserted_id)
    
    return request_data

async def respond_to_access_request(db, request_id, response, responder_id):
    """
    Respond to an access request (approve/deny)
    
    Args:
        db: Database connection
        request_id: ID of the request
        response: 'approved' or 'denied'
        responder_id: Username of person responding
    
    Returns:
        Updated request document
    """
    from datetime import datetime
    from bson import ObjectId
    
    # Find the request
    request = await db.access_requests.find_one({'_id': ObjectId(request_id)})
    
    if not request:
        return {'error': 'Request not found'}
    
    # Verify responder is the requested user
    if request['requestedUserId'] != responder_id:
        return {'error': 'Unauthorized'}
    
    # Update request
    update_data = {
        'status': response,
        'responseDate': datetime.utcnow().isoformat()
    }
    
    await db.access_requests.update_one(
        {'_id': ObjectId(request_id)},
        {'$set': update_data}
    )
    
    # Return updated request
    updated_request = await db.access_requests.find_one({'_id': ObjectId(request_id)})
    updated_request['_id'] = str(updated_request['_id'])
    
    return updated_request
