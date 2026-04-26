"""
Registration Interest Router
Handles pre-registration interest form submissions.
Users submit basic info + optional referral data before any verification or invitation.
Admin endpoints for review queue management.
"""

import logging
import os
import re
from datetime import datetime
from typing import Optional, List
from urllib.parse import quote
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, Request, Query
from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from crypto_utils import PIIEncryption
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/registration-interest",
    tags=["registration-interest"]
)


# --- Models ---

class ReferredByInfo(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=20, pattern=r"^[\d\s\-\(\)\.\+]+$")
    email: Optional[str] = None


class RegistrationInterestCreate(BaseModel):
    registeringFor: str = Field(..., pattern="^(myself|my_son|my_daughter)$")
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20, pattern=r"^[\d\s\-\(\)\.\+]+$")
    linkedInUrl: Optional[str] = Field(None, max_length=500)
    residencyStatus: str = Field(..., pattern="^(us_citizen|green_card)$")
    referredBy: Optional[ReferredByInfo] = None
    howDidYouHear: Optional[str] = Field(None, max_length=200)


class RegistrationInterestResponse(BaseModel):
    success: bool
    message: str


# --- Public Endpoint ---

@router.post("", response_model=RegistrationInterestResponse)
async def submit_registration_interest(
    data: RegistrationInterestCreate,
    request: Request,
    db=Depends(get_database)
):
    """
    Submit a registration interest form.
    No auth required — this is a public endpoint for prospective users.
    """
    # Check for duplicate email
    existing = await db.registration_interests.find_one({
        "email": data.email.lower(),
        "status": {"$nin": ["rejected"]}
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An interest form with this email has already been submitted. We'll be in touch soon!"
        )

    # Check if email is already registered
    existing_user = await db.users.find_one({"contactEmail": data.email.lower()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already associated with an existing account. Please log in instead."
        )

    # Build referredBy subdoc (only if at least one field provided)
    referred_by = None
    if data.referredBy:
        has_referral = any([
            data.referredBy.firstName,
            data.referredBy.lastName,
            data.referredBy.phone,
            data.referredBy.email
        ])
        if has_referral:
            referred_by = {
                "firstName": data.referredBy.firstName or "",
                "lastName": data.referredBy.lastName or "",
                "phone": data.referredBy.phone or "",
                "email": data.referredBy.email or ""
            }

    now = datetime.utcnow()
    doc = {
        "registeringFor": data.registeringFor,
        "firstName": data.firstName.strip(),
        "lastName": data.lastName.strip(),
        "email": data.email.lower().strip(),
        "phone": data.phone.strip(),
        "linkedInUrl": data.linkedInUrl.strip() if data.linkedInUrl else None,
        "residencyStatus": data.residencyStatus,
        "referredBy": referred_by,
        "howDidYouHear": data.howDidYouHear.strip() if data.howDidYouHear else None,
        "status": "pending_review",
        "verificationPath": None,
        "idmeVerified": False,
        "idmeUuid": None,
        "idmeVerifiedAt": None,
        "invitationId": None,
        "reviewedBy": None,
        "reviewedAt": None,
        "reviewNotes": None,
        "ipAddress": request.client.host if request else None,
        "userAgent": request.headers.get("user-agent") if request else None,
        "createdAt": now,
        "updatedAt": now
    }

    result = await db.registration_interests.insert_one(doc)
    logger.info(f"✅ Registration interest submitted: {data.firstName} {data.lastName} ({data.email}) — ID: {result.inserted_id}")

    return RegistrationInterestResponse(
        success=True,
        message="Thank you for your interest! We'll review your submission and get back to you soon."
    )


# --- Admin Helper ---

def check_admin(current_user: dict):
    """Check if user is admin or moderator"""
    role = current_user.get("role") or current_user.get("role_name")
    if role not in ["admin", "moderator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage registration interests"
        )


def serialize_interest(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-safe dict"""
    doc["_id"] = str(doc["_id"])
    if doc.get("invitationId"):
        doc["invitationId"] = str(doc["invitationId"])
    return doc


async def _auto_send_invitation(interest: dict, db, verified_by: str = "system") -> Optional[str]:
    """
    Auto-create and send an invitation for a verified interest.
    Returns invitation ID on success, None on failure.
    Stores referredBy info on the invitation for transfer to user profile.
    """
    from services.invitation_service import InvitationService
    from models.invitation_models import InvitationCreate, InvitationChannel, InvitationStatus
    from services.email_sender import send_invitation_email

    interest_id = interest["_id"]

    # Skip if already invited
    if interest.get("status") == "invited":
        return None

    # Check for existing invitation
    existing_inv = await db.invitations.find_one({
        "email": interest["email"],
        "archived": False
    })
    if existing_inv:
        # Link interest to existing invitation
        await db.registration_interests.update_one(
            {"_id": interest_id},
            {"$set": {
                "status": "invited",
                "invitationId": existing_inv["_id"],
                "updatedAt": datetime.utcnow()
            }}
        )
        logger.info(f"🔗 Interest {interest_id} linked to existing invitation {existing_inv['_id']}")
        return str(existing_inv["_id"])

    inv_service = InvitationService(db)
    inv_name = f"{interest['firstName']} {interest['lastName']}"

    try:
        inv_data = InvitationCreate(
            name=inv_name,
            email=interest["email"],
            phone=interest.get("phone"),
            channel=InvitationChannel.EMAIL,
            sendImmediately=True,
            promoCode="PUBLIC"
        )
        new_invitation = await inv_service.create_invitation(
            invitation_data=inv_data,
            invited_by=verified_by
        )
    except Exception as e:
        logger.error(f"❌ Failed to create invitation for interest {interest_id}: {e}")
        return None

    # Store interestId, verificationPath, and referredBy on the invitation
    update_fields = {
        "interestId": interest_id,
        "verificationPath": "referral"
    }
    if interest.get("referredBy"):
        update_fields["referredByInfo"] = interest["referredBy"]

    await db.invitations.update_one(
        {"_id": ObjectId(new_invitation.id)},
        {"$set": update_fields}
    )

    # Build and send invitation email
    base_url = settings.app_url or settings.frontend_url or "https://l3v3lmatches.com"
    if 'localhost' in base_url and os.environ.get('K_SERVICE'):
        base_url = os.environ.get('APP_URL') or os.environ.get('FRONTEND_URL') or "https://l3v3lmatches.com"
    invitation_link = f"{base_url}/register2?invitation={new_invitation.invitationToken}&email={quote(interest['email'])}&promo=PUBLIC"

    try:
        await send_invitation_email(
            to_email=interest["email"],
            to_name=inv_name,
            invitation_link=invitation_link
        )
        await inv_service.update_invitation_status(
            new_invitation.id,
            InvitationChannel.EMAIL,
            InvitationStatus.SENT
        )
    except Exception as e:
        logger.error(f"⚠️ Invitation created but email failed for interest {interest_id}: {e}")

    # Update interest status to invited
    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": interest_id},
        {"$set": {
            "status": "invited",
            "verificationPath": "referral",
            "reviewedBy": verified_by,
            "reviewedAt": now,
            "invitationId": ObjectId(new_invitation.id),
            "updatedAt": now
        }}
    )

    logger.info(f"📧 Auto-invitation sent for interest {interest_id} → invitation {new_invitation.id}")
    return new_invitation.id


# --- Admin Endpoints ---

VALID_STATUSES = [
    "pending_review", "reference_validated", "idme_sent",
    "idme_verified", "idme_failed", "invited", "rejected"
]


@router.get("/admin/pending-count")
async def get_pending_count(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get count of pending interest requests (for sidebar badge)"""
    check_admin(current_user)
    count = await db.registration_interests.count_documents({"status": "pending_review"})
    return {"count": count}


@router.get("/admin/all")
async def list_all_interests(
    status_filter: Optional[str] = Query(None, alias="status"),
    archived_filter: Optional[bool] = Query(None, alias="archived"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """List all registration interests with optional status filter and archived filter"""
    check_admin(current_user)

    query = {}
    if status_filter and status_filter in VALID_STATUSES:
        query["status"] = status_filter
    
    # By default, exclude archived interests unless explicitly requested
    if archived_filter is None:
        query["archived"] = {"$ne": True}
    elif archived_filter is True:
        query["archived"] = True

    cursor = db.registration_interests.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    interests = []
    emails = []
    async for doc in cursor:
        interests.append(serialize_interest(doc))
        emails.append(doc.get("email", "").lower())

    # Batch lookup invitation status for all interest emails
    invitation_map = {}
    if emails:
        inv_cursor = db.invitations.find(
            {"email": {"$in": emails}, "archived": False},
            {"email": 1, "emailStatus": 1, "emailSentAt": 1, "registeredUsername": 1, "createdAt": 1}
        )
        async for inv in inv_cursor:
            inv_email = inv.get("email", "").lower()
            invitation_map[inv_email] = {
                "invitationId": str(inv["_id"]),
                "emailStatus": str(inv.get("emailStatus", "unknown")).lower(),
                "sentAt": inv.get("emailSentAt"),
                "registeredUsername": inv.get("registeredUsername"),
                "createdAt": inv.get("createdAt")
            }

    # Attach invitation info to each interest
    for interest in interests:
        email = interest.get("email", "").lower()
        interest["invitationInfo"] = invitation_map.get(email)

    # Verify referrers against existing users
    for interest in interests:
        ref = interest.get("referredBy")
        if not ref:
            interest["referrerVerification"] = None
            continue

        ref_first = (ref.get("firstName") or "").strip()
        ref_last = (ref.get("lastName") or "").strip()
        ref_phone = re.sub(r"\D", "", ref.get("phone") or "")  # digits only
        ref_email = (ref.get("email") or "").strip().lower()

        if not ref_first and not ref_last:
            interest["referrerVerification"] = None
            continue

        # Build query: match name (case-insensitive) AND (phone hash OR email hash)
        # contactEmail/contactNumber are Fernet-encrypted — use hash fields for lookup
        name_conditions = []
        if ref_first:
            name_conditions.append({"firstName": {"$regex": f"^{re.escape(ref_first)}$", "$options": "i"}})
        if ref_last:
            name_conditions.append({"lastName": {"$regex": f"^{re.escape(ref_last)}$", "$options": "i"}})

        contact_conditions = []
        if ref_phone:
            # Try multiple phone formats since hash depends on how user registered
            raw_ref_phone = (ref.get("phone") or "").strip()
            phone_hashes = set()
            for variant in [ref_phone[-10:], ref_phone, raw_ref_phone]:
                h = PIIEncryption.hash_for_lookup(variant)
                if h:
                    phone_hashes.add(h)
            if phone_hashes:
                contact_conditions.append({"contactNumberHash": {"$in": list(phone_hashes)}})
        if ref_email:
            email_hash = PIIEncryption.hash_for_lookup(ref_email)
            if email_hash:
                contact_conditions.append({"contactEmailHash": email_hash})

        if not name_conditions or not contact_conditions:
            # Need at least name + one contact to verify
            interest["referrerVerification"] = {"verified": False, "reason": "insufficient_info"}
            continue

        # Strategy 1: Strict match — name AND (phone OR email)
        matched_user = None
        if name_conditions and contact_conditions:
            user_query = {"$and": name_conditions + [{"$or": contact_conditions}]}
            matched_user = await db.users.find_one(user_query, {"username": 1, "firstName": 1, "lastName": 1})

        # Strategy 2: Fallback — contact-only match (email hash is reliable, phone format varies)
        if not matched_user and contact_conditions:
            contact_query = {"$or": contact_conditions} if len(contact_conditions) > 1 else contact_conditions[0]
            matched_user = await db.users.find_one(contact_query, {"username": 1, "firstName": 1, "lastName": 1})

        if matched_user:
            interest["referrerVerification"] = {
                "verified": True,
                "matchedUsername": matched_user.get("username"),
                "matchedName": f"{matched_user.get('firstName', '')} {matched_user.get('lastName', '')}".strip()
            }

            # Auto-send invitation if interest is still pending_review
            if interest.get("status") == "pending_review":
                try:
                    # Re-fetch raw doc (with ObjectId) for the helper
                    raw_doc = await db.registration_interests.find_one({"_id": ObjectId(interest["_id"])})
                    if raw_doc:
                        inv_id = await _auto_send_invitation(raw_doc, db, verified_by="system")
                        if inv_id:
                            interest["status"] = "invited"
                            interest["invitationId"] = inv_id
                            logger.info(f"🤖 Auto-invited interest {interest['_id']} — referrer verified as {matched_user.get('username')}")
                except Exception as e:
                    logger.error(f"⚠️ Auto-invitation failed for interest {interest['_id']}: {e}")
        else:
            interest["referrerVerification"] = {"verified": False, "reason": "no_match"}

    total = await db.registration_interests.count_documents(query)

    # Get counts per status for filters
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = {}
    async for s in db.registration_interests.aggregate(pipeline):
        status_counts[s["_id"]] = s["count"]

    return {
        "interests": interests,
        "total": total,
        "statusCounts": status_counts
    }


@router.put("/{interest_id}/validate")
async def validate_reference(
    interest_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Admin validates the reference → marks as reference_validated. Also allows switching from ID.me path."""
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    # Allow from pending_review OR switching from ID.me path statuses
    allowed = ["pending_review", "idme_sent", "idme_failed"]
    if interest["status"] not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot validate — current status is '{interest['status']}'")

    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$set": {
            "status": "reference_validated",
            "verificationPath": "referral",
            "reviewedBy": current_user.get("username"),
            "reviewedAt": now,
            "updatedAt": now
        }}
    )

    logger.info(f"✅ Interest {interest_id} reference validated by {current_user.get('username')}")
    return {"success": True, "message": "Reference validated successfully", "status": "reference_validated"}


@router.put("/{interest_id}/send-idme")
async def send_idme_verification(
    interest_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Admin triggers ID.me verification email to the user. Also allows switching from referral path."""
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    # Allow from pending_review OR switching from referral path
    allowed = ["pending_review", "reference_validated"]
    if interest["status"] not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot send ID.me — current status is '{interest['status']}'")

    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$set": {
            "status": "idme_sent",
            "verificationPath": "idme",
            "reviewedBy": current_user.get("username"),
            "reviewedAt": now,
            "updatedAt": now
        }}
    )

    # TODO: Send actual ID.me verification email once OAuth integration is built
    logger.info(f"🛡️ ID.me verification triggered for interest {interest_id} by {current_user.get('username')}")
    return {"success": True, "message": "ID.me verification request sent", "status": "idme_sent"}


@router.put("/{interest_id}/reject")
async def reject_interest(
    interest_id: str,
    body: dict = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Admin rejects the interest request"""
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    if interest["status"] == "invited":
        raise HTTPException(status_code=400, detail="Cannot reject — invitation already sent")

    reason = (body or {}).get("reason", "")
    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$set": {
            "status": "rejected",
            "reviewedBy": current_user.get("username"),
            "reviewedAt": now,
            "reviewNotes": reason if reason else interest.get("reviewNotes"),
            "updatedAt": now
        }}
    )

    logger.info(f"❌ Interest {interest_id} rejected by {current_user.get('username')}")
    return {"success": True, "message": "Interest rejected", "status": "rejected"}


@router.put("/{interest_id}/reopen")
async def reopen_interest(
    interest_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Admin re-opens a rejected or failed interest back to pending_review"""
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    if interest["status"] == "invited":
        raise HTTPException(status_code=400, detail="Cannot reopen — invitation already sent")

    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$set": {
            "status": "pending_review",
            "verificationPath": None,
            "updatedAt": now
        }}
    )

    logger.info(f"🔄 Interest {interest_id} reopened by {current_user.get('username')}")
    return {"success": True, "message": "Interest reopened for review", "status": "pending_review"}


@router.put("/{interest_id}/send-invitation")
async def send_invitation_from_interest(
    interest_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Create and send an invitation email from a validated/verified interest.
    Uses existing InvitationService + email sender.
    """
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    # Only allow sending invitation from validated/verified statuses
    allowed = ["reference_validated", "idme_verified"]
    if interest["status"] not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send invitation — status must be reference_validated or idme_verified, got '{interest['status']}'"
        )

    from services.invitation_service import InvitationService
    from models.invitation_models import InvitationCreate, InvitationChannel, InvitationStatus
    from services.email_sender import send_invitation_email

    inv_service = InvitationService(db)

    # Check if active invitation already exists for this email (raw query to avoid Pydantic parsing issues)
    existing_inv = await db.invitations.find_one({
        "email": interest["email"],
        "archived": False
    })
    if existing_inv:
        # Link the interest to the existing invitation if not already linked
        now = datetime.utcnow()
        update_fields = {"updatedAt": now}
        if not interest.get("invitationId"):
            update_fields["invitationId"] = existing_inv["_id"]
        if interest["status"] in ["reference_validated", "idme_verified"]:
            update_fields["status"] = "invited"
        await db.registration_interests.update_one(
            {"_id": ObjectId(interest_id)},
            {"$set": update_fields}
        )

        # Build a friendly detail message
        email_status = str(existing_inv.get("emailStatus", "unknown")).lower()
        sent_at = existing_inv.get("emailSentAt")
        registered = existing_inv.get("registeredUsername")
        if registered:
            detail_msg = f"Invitation already sent and user '{registered}' has registered."
        elif email_status in ["sent", "delivered"]:
            sent_info = f" on {sent_at.strftime('%b %d, %Y')}" if sent_at else ""
            detail_msg = f"Invitation already sent to {interest['email']}{sent_info}. Status: {email_status}."
        else:
            detail_msg = f"An invitation already exists for {interest['email']}. Email status: {email_status}."

        raise HTTPException(
            status_code=409,
            detail=detail_msg
        )

    # Create invitation via InvitationService
    inv_name = f"{interest['firstName']} {interest['lastName']}"
    try:
        inv_data = InvitationCreate(
            name=inv_name,
            email=interest["email"],
            phone=interest.get("phone"),
            channel=InvitationChannel.EMAIL,
            sendImmediately=True,
            promoCode="PUBLIC"
        )
        new_invitation = await inv_service.create_invitation(
            invitation_data=inv_data,
            invited_by=current_user["username"]
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Add interestId, verificationPath, and referredBy info to the invitation doc
    inv_update_fields = {
        "interestId": ObjectId(interest_id),
        "verificationPath": interest.get("verificationPath")
    }
    if interest.get("referredBy"):
        inv_update_fields["referredByInfo"] = interest["referredBy"]

    await db.invitations.update_one(
        {"_id": ObjectId(new_invitation.id)},
        {"$set": inv_update_fields}
    )

    # Build invitation link and send email
    base_url = settings.app_url or settings.frontend_url or "https://l3v3lmatches.com"
    if 'localhost' in base_url and os.environ.get('K_SERVICE'):
        base_url = os.environ.get('APP_URL') or os.environ.get('FRONTEND_URL') or "https://l3v3lmatches.com"
    invitation_link = f"{base_url}/register2?invitation={new_invitation.invitationToken}&email={quote(interest['email'])}&promo=PUBLIC"

    try:
        await send_invitation_email(
            to_email=interest["email"],
            to_name=inv_name,
            invitation_link=invitation_link
        )
        # Update invitation email status to sent
        await inv_service.update_invitation_status(
            new_invitation.id,
            InvitationChannel.EMAIL,
            InvitationStatus.SENT
        )
    except Exception as e:
        logger.error(f"⚠️ Invitation created but email failed: {e}")

    # Update interest status to invited
    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$set": {
            "status": "invited",
            "invitationId": ObjectId(new_invitation.id),
            "updatedAt": now
        }}
    )

    logger.info(f"📧 Invitation sent for interest {interest_id} → invitation {new_invitation.id}")
    return {
        "success": True,
        "message": f"Invitation sent to {interest['email']}",
        "status": "invited",
        "invitationId": new_invitation.id
    }


@router.put("/{interest_id}/notes")
async def update_notes(
    interest_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Admin adds/updates notes on an interest"""
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    notes = body.get("notes", "")
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$set": {
            "reviewNotes": notes,
            "updatedAt": datetime.utcnow()
        }}
    )

    return {"success": True, "message": "Notes updated"}


@router.put("/{interest_id}/archive")
async def archive_interest(
    interest_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Admin archives an interest (hides from main view but keeps in database)"""
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    # Only allow archiving invited interests
    if interest.get("status") != "invited":
        raise HTTPException(
            status_code=400,
            detail="Can only archive interests with 'invited' status"
        )

    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$set": {
            "archived": True,
            "archivedAt": now,
            "archivedBy": current_user.get("username"),
            "updatedAt": now
        }}
    )

    logger.info(f"📦 Interest {interest_id} archived by {current_user.get('username')}")
    return {"success": True, "message": "Interest archived"}


@router.put("/{interest_id}/unarchive")
async def unarchive_interest(
    interest_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Admin un-archives an interest (restores to main view)"""
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$unset": {
            "archived": "",
            "archivedAt": "",
            "archivedBy": ""
        },
        "$set": {
            "updatedAt": now
        }}
    )

    logger.info(f"📦 Interest {interest_id} un-archived by {current_user.get('username')}")
    return {"success": True, "message": "Interest restored to main view"}


@router.put("/{interest_id}/send-details-request")
async def send_details_request(
    interest_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Admin sends SMS or email to request more details from interest submitter"""
    check_admin(current_user)

    if not ObjectId.is_valid(interest_id):
        raise HTTPException(status_code=400, detail="Invalid interest ID")

    interest = await db.registration_interests.find_one({"_id": ObjectId(interest_id)})
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    channel = body.get("channel")  # "email" or "sms"
    message = body.get("message", "")

    if channel not in ["email", "sms"]:
        raise HTTPException(status_code=400, detail="Channel must be 'email' or 'sms'")

    to_email = interest.get("email")
    to_phone = interest.get("phone")
    to_name = f"{interest.get('firstName')} {interest.get('lastName')}"

    sent = False
    error_msg = None

    if channel == "email" and to_email:
        try:
            from services.email_sender import send_custom_email
            subject = "More Information Needed - Your Registration Interest"
            await send_custom_email(
                to_email=to_email,
                to_name=to_name,
                subject=subject,
                message=message
            )
            sent = True
            logger.info(f"📧 Details request email sent to {to_email} for interest {interest_id}")
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send details request email: {e}")

    elif channel == "sms" and to_phone:
        try:
            from services.sms_sender import send_sms
            await send_sms(
                to_phone=to_phone,
                message=message
            )
            sent = True
            logger.info(f"📱 Details request SMS sent to {to_phone} for interest {interest_id}")
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send details request SMS: {e}")

    if not sent:
        raise HTTPException(
            status_code=500,
            detail=error_msg or f"Failed to send {channel} message"
        )

    # Log the action
    now = datetime.utcnow()
    await db.registration_interests.update_one(
        {"_id": ObjectId(interest_id)},
        {"$set": {
            "detailsRequestedAt": now,
            "detailsRequestedBy": current_user.get("username"),
            "detailsRequestChannel": channel,
            "updatedAt": now
        }}
    )

    return {"success": True, "message": f"{channel.capitalize()} sent successfully"}
