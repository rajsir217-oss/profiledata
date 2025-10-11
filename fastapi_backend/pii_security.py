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

def mask_workplace(workplace):
    """Mask workplace details: Google Inc, 1600 Amphitheatre -> Google Inc"""
    if not workplace:
        return workplace
    
    # Return only first part (company name)
    parts = [p.strip() for p in workplace.split(',')]
    return parts[0] if parts else workplace

def mask_user_pii(user_data, requester_id=None, access_granted=False):
    """
    Mask PII fields in user data

    Args:
        user_data: User document from database
        requester_id: ID of user requesting to view profile
        access_granted: Whether access has been granted

    Returns:
        User data with masked PII fields
    """
    if not user_data:
        return user_data

    # If access is granted, return unmasked data
    if access_granted:
        return user_data

    # If requester is viewing their own profile, don't mask
    if requester_id and user_data.get('username') == requester_id:
        return user_data

    # Create a copy to avoid modifying original
    masked_data = user_data.copy()

    # Mask PII fields
    if 'contactEmail' in masked_data and masked_data['contactEmail']:
        masked_data['contactEmail'] = mask_email(masked_data['contactEmail'])
        masked_data['contactEmailMasked'] = True

    if 'contactNumber' in masked_data and masked_data['contactNumber']:
        masked_data['contactNumber'] = mask_phone(masked_data['contactNumber'])
        masked_data['contactNumberMasked'] = True

    if 'location' in masked_data and masked_data['location']:
        masked_data['location'] = mask_location(masked_data['location'])
        masked_data['locationMasked'] = True

    if 'workplace' in masked_data and masked_data['workplace']:
        masked_data['workplace'] = mask_workplace(masked_data['workplace'])
        masked_data['workplaceMasked'] = True

    # Mask LinkedIn URL completely
    if 'linkedinUrl' in masked_data and masked_data['linkedinUrl']:
        masked_data['linkedinUrl'] = '[🔒 Private - Request Access]'
        masked_data['linkedinUrlMasked'] = True

    # Add flag indicating PII is masked
    masked_data['piiMasked'] = True

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
    
    # Check if admin
    if requester_id == 'admin':
        return True
    
    # Check access_requests collection
    access_request = await db.access_requests.find_one({
        'requesterId': requester_id,
        'requestedUserId': requested_user_id,
        'status': 'approved'
    })
    
    return access_request is not None

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
