"""
Messenger Router — /api/messenger/*
Phase 1: 1:1 conversations, text + media messages, delivery receipts, device tokens.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from crypto_utils import get_encryptor
from models.messenger_models import (
    ConversationCreate,
    MessageCreate,
    MessageStatusUpdate,
    DeviceRegister,
)
from services import messenger_service
from services import messenger_media_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/messenger", tags=["messenger"])


def _decrypt_contact_info(value: str) -> str:
    """Decrypt contact info (email/phone) if encrypted"""
    if not value:
        return value

    # Check if it looks encrypted (Fernet encrypted values start with gAAAAA)
    if isinstance(value, str) and value.startswith("gAAAAA"):
        try:
            encryptor = get_encryptor()
            return encryptor.decrypt(value)
        except Exception as e:
            logger.warning(f"Failed to decrypt contact info: {str(e)}")
            return value

    return value


# =========================================================================
# Conversations
# =========================================================================

@router.get("/portal-members-group")
async def get_or_create_portal_members_group(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Get or create the 'Portal Members' group chat that includes all active portal members.
    """
    username = current_user["username"]
    logger.info(f"🌐 Getting/creating Portal Members group for {username}")

    # Check if Portal Members group already exists
    existing = await db.messenger_conversations.find_one({
        "type": "group",
        "groupName": "Portal Members"
    })

    if existing:
        logger.info(f"✅ Portal Members group exists: {existing['_id']}")
        existing["_id"] = str(existing["_id"])
        existing["id"] = existing["_id"]
        return {"success": True, "conversation": existing}

    # Get all active users
    active_users = await db.users.find({
        "accountStatus": "active"
    }, {"username": 1}).to_list(None)

    participant_usernames = [u["username"] for u in active_users]
    logger.info(f"👥 Found {len(participant_usernames)} active users for Portal Members group")

    # Create the group conversation
    conv = await messenger_service.create_conversation(
        db,
        creator_username=username,
        participant_usernames=participant_usernames,
        conv_type="group",
        group_name="Portal Members",
        group_avatar="🦋",
    )
    conv["id"] = conv.pop("_id")
    logger.info(f"✅ Created Portal Members group: {conv['id']}")
    return {"success": True, "conversation": conv}


@router.get("/us-vedika/group")
async def get_or_create_us_vedika_group(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Get or create the 'US Vedika' public group chat.
    This is a singleton group that includes all active members and allows adding external users via email.
    Any active user can create this group if it doesn't exist.
    """
    username = current_user["username"]
    logger.info(f"🇺🇸 Getting/creating US Vedika group for {username}")

    # Check if US Vedika group already exists
    existing = await db.messenger_conversations.find_one({
        "type": "public_group",
        "groupName": "US Vedika"
    })

    if existing:
        logger.info(f"✅ US Vedika group exists: {existing['_id']}")
        existing["_id"] = str(existing["_id"])
        existing["id"] = existing["_id"]
        return {"success": True, "conversation": existing}

    # Get all active users
    active_users = await db.users.find({
        "accountStatus": "active"
    }, {"username": 1}).to_list(None)

    participant_usernames = [u["username"] for u in active_users]
    logger.info(f"👥 Found {len(participant_usernames)} active users for US Vedika group")

    # Create the public group conversation
    now = datetime.utcnow()
    participants = [
        {"username": u, "role": "admin" if u == username else "member", "joinedAt": now}
        for u in participant_usernames
    ]

    doc = {
        "type": "public_group",
        "groupName": "US Vedika",
        "groupAvatar": "🇺🇸",
        "isPublicGroup": True,
        "participants": participants,
        "publicParticipants": [],
        "createdBy": username,
        "lastMessageAt": None,
        "lastMessagePreview": None,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.messenger_conversations.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["id"] = doc["_id"]
    logger.info(f"✅ Created US Vedika public group: {doc['id']}")
    return {"success": True, "conversation": doc}


@router.post("/inbound/email")
async def handle_inbound_email(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Handle inbound email replies from SendGrid Inbound Parse webhook.
    Used for US Vedika public group email-to-chat feature.
    Email format: us-vedika+{token}@inbound.l3v3l.com
    """
    import email
    from email import policy
    from email.message import EmailMessage

    logger.info("📧 Received inbound email from SendGrid")

    # Parse multipart form data from SendGrid
    form_data = await request.form()
    
    # Extract email fields
    email_raw = form_data.get("email", "")
    sender = form_data.get("from", "")
    subject = form_data.get("subject", "")
    to_email = form_data.get("to", "")
    
    # Parse the raw email to get body
    try:
        msg = email.message_from_string(email_raw, policy=policy.default)
        if msg.is_multipart():
            body = ""
            for part in msg.iter_parts():
                if part.get_content_type() == "text/plain":
                    body += part.get_content()
        else:
            body = msg.get_content()
    except Exception as e:
        logger.error(f"❌ Failed to parse email body: {e}")
        body = email_raw  # Fallback to raw content

    # Extract reply token from "to" address
    # Format: us-vedika+{token}@inbound.l3v3l.com
    import re
    token_match = re.search(r"us-vedika\+([a-f0-9\-]+)@", to_email)
    if not token_match:
        logger.warning(f"⚠️ Invalid inbound email address format: {to_email}")
        return {"success": False, "error": "Invalid email address format"}
    
    reply_token = token_match.group(1)
    logger.info(f"🔑 Extracted reply token: {reply_token}")

    # Verify token in database
    token_doc = await db.public_reply_tokens.find_one({"token": reply_token})
    if not token_doc:
        logger.warning(f"⚠️ Invalid or expired reply token: {reply_token}")
        return {"success": False, "error": "Invalid reply token"}
    
    # Check token expiration
    if token_doc["expiresAt"] < datetime.utcnow():
        logger.warning(f"⚠️ Expired reply token: {reply_token}")
        return {"success": False, "error": "Expired reply token"}
    
    # Verify sender email matches the token's publicEmail (anti-spoofing)
    sender_email = sender.split("<")[-1].strip(">")
    if sender_email.lower() != token_doc["publicEmail"].lower():
        logger.warning(f"⚠️ Email spoofing detected: {sender_email} != {token_doc['publicEmail']}")
        return {"success": False, "error": "Email sender verification failed"}
    
    conversation_id = str(token_doc["conversationId"])
    logger.info(f"✅ Token verified for conversation {conversation_id}")

    # Insert message with senderType=public_email
    now = datetime.utcnow()
    message_doc = {
        "conversationId": ObjectId(conversation_id),
        "senderUsername": sender_email,  # Store email as sender
        "senderType": "public_email",
        "contentType": "text",
        "content": body.strip(),
        "status": "sent",
        "publicEmail": sender_email,
        "replyToken": reply_token,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.messenger_messages.insert_one(message_doc)
    message_doc["_id"] = str(result.inserted_id)
    logger.info(f"✅ Inserted public email reply: {message_doc['_id']}")

    # Update conversation lastMessageAt
    await db.messenger_conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {
            "$set": {
                "lastMessageAt": now,
                "lastMessagePreview": body.strip()[:100],
                "updatedAt": now,
            }
        }
    )

    # Update token usage count
    await db.public_reply_tokens.update_one(
        {"token": reply_token},
        {"$inc": {"usedCount": 1}}
    )

    # Update publicParticipant status if exists
    await db.messenger_conversations.update_one(
        {
            "_id": ObjectId(conversation_id),
            "publicParticipants.email": sender_email
        },
        {
            "$set": {
                "publicParticipants.$.status": "interested",
                "publicParticipants.$.lastEmailSentAt": now,
            }
        }
    )

    return {"success": True, "messageId": message_doc["_id"]}


@router.get("/us-vedika/metrics")
async def get_us_vedika_metrics(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Get US Vedika invitee funnel metrics (admin only).
    Shows conversion rates from invited → interested → registered.
    """
    username = current_user["username"]
    
    # Admin check
    role = current_user.get("role") or current_user.get("role_name")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logger.info(f"📊 Fetching US Vedika metrics for {username}")
    
    # Get US Vedika conversation
    us_vedika = await db.messenger_conversations.find_one({
        "type": "public_group",
        "groupName": "US Vedika"
    })
    
    if not us_vedika:
        return {"success": True, "metrics": None, "error": "US Vedika conversation not found"}
    
    public_participants = us_vedika.get("publicParticipants", [])
    
    # Calculate funnel metrics
    total_invited = len(public_participants)
    total_interested = len([p for p in public_participants if p.get("status") == "interested"])
    total_registered = len([p for p in public_participants if p.get("status") == "registered"])
    total_opted_out = len([p for p in public_participants if p.get("status") == "opted_out"])
    
    # Get registration interests with source=us_vedika
    registration_interests = await db.registration_interests.find({
        "source": "us_vedika"
    }).to_list(None)
    
    total_reg_interests = len(registration_interests)
    
    # Calculate conversion rates
    invited_to_interested_rate = (total_interested / total_invited * 100) if total_invited > 0 else 0
    interested_to_registered_rate = (total_registered / total_interested * 100) if total_interested > 0 else 0
    overall_conversion_rate = (total_registered / total_invited * 100) if total_invited > 0 else 0
    
    # Top inviters
    inviters = {}
    for p in public_participants:
        inviter = p.get("addedBy", "unknown")
        inviters[inviter] = inviters.get(inviter, 0) + 1
    
    top_inviters = sorted(inviters.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Message count from public emails
    public_email_messages = await db.messenger_messages.count_documents({
        "conversationId": us_vedika["_id"],
        "senderType": "public_email"
    })
    
    metrics = {
        "funnel": {
            "invited": total_invited,
            "interested": total_interested,
            "registered": total_registered,
            "optedOut": total_opted_out,
            "registrationInterests": total_reg_interests,
        },
        "conversionRates": {
            "invitedToInterested": round(invited_to_interested_rate, 2),
            "interestedToRegistered": round(interested_to_registered_rate, 2),
            "overallConversion": round(overall_conversion_rate, 2),
        },
        "topInviters": [{"username": k, "count": v} for k, v in top_inviters],
        "publicEmailMessages": public_email_messages,
        "publicParticipants": public_participants,
    }
    
    return {"success": True, "metrics": metrics}


@router.post("/us-vedika/unsubscribe")
async def unsubscribe_from_us_vedika(
    email: str = Query(...),
    token: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Unsubscribe an email from US Vedika email notifications.
    Can be called with email+token (for security) or just email (for user-initiated opt-out).
    """
    logger.info(f"🔕 Unsubscribe request for {email}")
    
    # Get US Vedika conversation
    us_vedika = await db.messenger_conversations.find_one({
        "type": "public_group",
        "groupName": "US Vedika"
    })
    
    if not us_vedika:
        return {"success": False, "error": "US Vedika conversation not found"}
    
    conv_id = str(us_vedika["_id"])
    now = datetime.utcnow()
    
    # Verify token if provided (for email link unsubscribe)
    if token:
        token_doc = await db.public_reply_tokens.find_one({"token": token, "publicEmail": email.lower()})
        if not token_doc:
            logger.warning(f"⚠️ Invalid unsubscribe token for {email}")
            return {"success": False, "error": "Invalid unsubscribe token"}
    
    # Update publicParticipant status to opted_out
    result = await db.messenger_conversations.update_one(
        {
            "_id": ObjectId(conv_id),
            "publicParticipants.email": email.lower()
        },
        {
            "$set": {
                "publicParticipants.$.status": "opted_out",
                "publicParticipants.$.optedOutAt": now,
                "updatedAt": now,
            }
        }
    )
    
    if result.matched_count == 0:
        logger.warning(f"⚠️ Email {email} not found in US Vedika public participants")
        return {"success": False, "error": "Email not found in US Vedika"}
    
    # Invalidate all reply tokens for this email
    await db.public_reply_tokens.update_many(
        {"publicEmail": email.lower()},
        {"$set": {"expiresAt": now}}  # Expire all tokens immediately
    )
    
    logger.info(f"✅ {email} unsubscribed from US Vedika")
    return {"success": True, "message": "Successfully unsubscribed from US Vedika emails"}


@router.post("/conversations")
async def create_conversation(
    body: ConversationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create a new conversation (direct or group)."""
    username = current_user["username"]
    conv = await messenger_service.create_conversation(
        db,
        creator_username=username,
        participant_usernames=body.participantUsernames,
        conv_type=body.type.value,
        group_name=body.groupName,
        group_avatar=body.groupAvatar,
    )
    conv["id"] = conv.pop("_id")
    return {"success": True, "conversation": conv}


@router.get("/conversations")
async def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List conversations for the current user (paginated, sorted by lastMessageAt)."""
    username = current_user["username"]
    conversations, total = await messenger_service.get_conversations(db, username, page, limit)

    # Enrich with participant profile info
    for conv in conversations:
        conv["id"] = conv.pop("_id")
        await _enrich_participants(db, conv, username)

    return {"success": True, "conversations": conversations, "total": total, "page": page}


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get a single conversation by ID."""
    conv = await messenger_service.get_conversation(db, conversation_id, current_user["username"])
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv["id"] = conv.pop("_id")
    await _enrich_participants(db, conv, current_user["username"])
    return {"success": True, "conversation": conv}


# =========================================================================
# Messages
# =========================================================================

@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200),
    before: Optional[str] = Query(None, description="Cursor: message _id to paginate before"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get messages for a conversation (cursor-paginated, oldest-first)."""
    messages, total, has_more = await messenger_service.get_messages(
        db, conversation_id, current_user["username"], limit, before
    )
    for m in messages:
        m["id"] = m.pop("_id")
    cursor_val = messages[0]["id"] if messages else None  # oldest in this batch
    return {
        "success": True,
        "messages": messages,
        "total": total,
        "hasMore": has_more,
        "cursor": cursor_val,
    }


@router.put("/conversations/{conversation_id}/retention")
async def set_conversation_retention(
    conversation_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Configure message retention (TTL) for a conversation.

    Body: { "retentionHours": int | null }
        • null / 0 → retention OFF (messages live forever).
        • positive int → new messages auto-delete `retentionHours` after send.

    Existing messages are NOT retroactively expired — only future sends pick
    up the new TTL. This is intentional so an admin enabling retention doesn't
    accidentally nuke years of history.

    Authorization: app-level admins/moderators only (same gate as @{email}
    invites). Per-conversation admin promotion isn't wired up yet; revisit
    if/when groups gain their own moderation roles.
    """
    username = current_user["username"]
    role = current_user.get("role") or current_user.get("role_name")
    if role not in ("admin", "moderator"):
        raise HTTPException(
            status_code=403,
            detail="Only administrators or moderators can change message retention",
        )

    raw = body.get("retentionHours") if isinstance(body, dict) else None
    if raw in (None, 0, "0", ""):
        retention = None
    else:
        try:
            retention = int(raw)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="retentionHours must be an integer")
        # Sanity-clamp to avoid wild values landing in the index.
        if retention < 1 or retention > 24 * 365:
            raise HTTPException(status_code=400, detail="retentionHours out of range (1..8760)")

    conv = await db.messenger_conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not any(p.get("username") == username for p in conv.get("participants", [])):
        raise HTTPException(status_code=403, detail="You are not a participant of this conversation")

    update = {"messageRetentionHours": retention, "updatedAt": datetime.utcnow()}
    await db.messenger_conversations.update_one(
        {"_id": ObjectId(conversation_id)}, {"$set": update}
    )
    logger.info(
        f"⏱️ Retention set on {conversation_id} by {username}: {retention} hour(s)"
    )
    return {"success": True, "retentionHours": retention}


@router.post("/conversations/{conversation_id}/clear")
async def clear_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Per-user soft "clear chat": hide all existing messages from THIS user's view
    by recording a clearedAt timestamp on the conversation. Other participants are
    unaffected. New messages sent after this point will still appear.
    """
    username = current_user["username"]
    conv = await db.messenger_conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not any(p.get("username") == username for p in conv.get("participants", [])):
        raise HTTPException(status_code=403, detail="You are not a participant of this conversation")

    now = datetime.utcnow()
    await db.messenger_conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {f"clearedFor.{username}": now, "updatedAt": now}},
    )
    logger.info(f"🧹 {username} cleared chat for conversation {conversation_id}")
    return {"success": True, "clearedAt": now}


@router.post("/conversations/{conversation_id}/check-recipients")
async def check_public_recipients(
    conversation_id: str,
    body: dict = Body(..., example={"emails": ["alice@x.com", "bob@y.com"]}),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Pre-flight check for `@{email}` mentions in a US Vedika message.

    For each email, returns:
      • isMember + memberUsername — true if the email maps to an active user
      • hasActiveInvitation + invitationStatus/sentAt — true if an unarchived
        invitation already exists for this email
      • alreadyInConversation + lastSentAt — true if the email is already in
        this conversation's publicParticipants

    Also returns `senderCanInvite` so the UI can disable the Send button for
    non-admin/moderator users (the actual enforcement lives in send_message).

    Used by messenger-web ChatScreen to render status bubbles under each
    recipient before the user commits to sending.
    """
    username = current_user["username"]
    sender_role = current_user.get("role") or current_user.get("role_name")
    sender_can_invite = sender_role in ("admin", "moderator")

    # Validate the conversation + participation up front so we don't leak
    # publicParticipants membership across conversations.
    try:
        conv = await db.messenger_conversations.find_one({"_id": ObjectId(conversation_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation id")
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not any(p.get("username") == username for p in conv.get("participants", [])):
        raise HTTPException(status_code=403, detail="You are not a participant of this conversation")

    raw_emails = body.get("emails") or []
    if not isinstance(raw_emails, list):
        raise HTTPException(status_code=400, detail="emails must be a list")

    # Normalize + dedupe (cap to prevent abuse)
    emails = []
    seen = set()
    for e in raw_emails[:50]:
        if not isinstance(e, str):
            continue
        norm = e.strip().lower()
        if not norm or "@" not in norm or norm in seen:
            continue
        seen.add(norm)
        emails.append(norm)

    if not emails:
        return {
            "senderCanInvite": sender_can_invite,
            "senderRole": sender_role,
            "recipients": [],
        }

    # ---- Look up existing members (login email OR contactEmail) ----
    # Email fields may be encrypted (gAAAAA prefix). We fetch all users with
    # any email/contactEmail and decrypt before comparison. This is less
    # efficient than a direct indexed query but necessary for encrypted PII.
    # TODO: add a plaintext searchable email hash index for faster lookups.
    member_cursor = db.users.find(
        {"$or": [
            {"email": {"$exists": True, "$ne": None}},
            {"contactEmail": {"$exists": True, "$ne": None}},
        ]},
        {"_id": 0, "username": 1, "email": 1, "contactEmail": 1, "status.status": 1},
    )
    members_by_email: dict = {}
    async for u in member_cursor:
        # Decrypt both email fields before comparison
        for key in ("email", "contactEmail"):
            encrypted = u.get(key)
            if not encrypted:
                continue
            decrypted = _decrypt_contact_info(encrypted)
            if not decrypted:
                continue
            v = decrypted.strip().lower()
            if v and v in seen:
                members_by_email[v] = u

    # ---- Look up active invitations (not archived) ----
    # Invitations.email may also be encrypted. Fetch all and decrypt.
    # We track BOTH the most recent invitation (for status/timestamp display)
    # and the total count per email (for duplicate-throttling at the UI layer).
    inv_cursor = db.invitations.find(
        {"archived": {"$ne": True}},
        {"_id": 0, "email": 1, "emailStatus": 1, "createdAt": 1, "updatedAt": 1, "status": 1},
    )
    invitations_by_email: dict = {}
    invitation_count_by_email: dict = {}
    async for inv in inv_cursor:
        encrypted = inv.get("email")
        if not encrypted:
            continue
        decrypted = _decrypt_contact_info(encrypted)
        if not decrypted:
            continue
        v = decrypted.strip().lower()
        if v and v in seen:
            invitation_count_by_email[v] = invitation_count_by_email.get(v, 0) + 1
            # Prefer the most recently updated row when multiple exist
            existing = invitations_by_email.get(v)
            if not existing or (inv.get("updatedAt") or inv.get("createdAt")) > (existing.get("updatedAt") or existing.get("createdAt")):
                invitations_by_email[v] = inv

    # ---- Look up existing publicParticipants in THIS conversation ----
    participants_by_email: dict = {}
    for pp in (conv.get("publicParticipants") or []):
        v = (pp.get("email") or "").strip().lower()
        if v in seen:
            participants_by_email[v] = pp

    # ---- Assemble per-recipient response ----
    results = []
    for email in emails:
        m = members_by_email.get(email)
        inv = invitations_by_email.get(email)
        pp = participants_by_email.get(email)

        results.append({
            "email": email,
            "isMember": bool(m),
            "memberUsername": (m or {}).get("username"),
            "hasActiveInvitation": bool(inv),
            "invitationStatus": (inv or {}).get("emailStatus") or (inv or {}).get("status"),
            "invitationSentAt": (inv or {}).get("updatedAt") or (inv or {}).get("createdAt"),
            # Total un-archived invitations to this email. Frontend uses this to
            # throttle repeat invites (e.g. block at >= 2 and direct admin to
            # the main-app invitation queue to manage the existing record).
            "invitationCount": invitation_count_by_email.get(email, 0),
            "alreadyInConversation": bool(pp),
            "lastSentAt": (pp or {}).get("lastEmailSentAt") or (pp or {}).get("addedAt"),
        })

    return {
        "senderCanInvite": sender_can_invite,
        "senderRole": sender_role,
        "recipients": results,
    }


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Send a message to a conversation.
    For US Vedika (public_group), supports publicRecipients for email delivery.
    """
    username = current_user["username"]
    logger.info(f"📤 Sending message to conversation {conversation_id} by {username}")

    # Get conversation
    conv = await db.messenger_conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify sender is a participant
    if not any(p.get("username") == username for p in conv.get("participants", [])):
        raise HTTPException(status_code=403, detail="You are not a participant of this conversation")

    # Check for public recipients (US Vedika OR Portal Members)
    # ------------------------------------------------------------------
    # Conversations that support inviting non-members via @{email}:
    #   • US Vedika      — type="public_group", groupName="US Vedika"  (legacy)
    #   • Portal Members — type="group",        groupName="Portal Members"
    # Both go through the same publicRecipients pipeline below; only the
    # invitation `source`/`trigger` analytics labels differ (see source_label).
    # TODO: replace the name-based gate with an `allowsPublicRecipients` flag
    # on the conversation document once we have more than two such groups.
    is_us_vedika = conv.get("type") == "public_group" and conv.get("groupName") == "US Vedika"
    is_portal_members = conv.get("type") == "group" and conv.get("groupName") == "Portal Members"
    allows_public_recipients = is_us_vedika or is_portal_members

    # Analytics/funnel label propagated into invitations + email queue + register-interest URL
    source_label = "us_vedika" if is_us_vedika else ("portal_members" if is_portal_members else "messenger_group")
    trigger_label = f"{source_label}_message"

    if body.publicRecipients and len(body.publicRecipients) > 0:
        if not allows_public_recipients:
            raise HTTPException(
                status_code=403,
                detail="Public recipients are only allowed in the Portal Members or US Vedika group",
            )

        # Only admins/moderators can send public-recipient (email) invites.
        # The frontend already gates the modal behind `isAdminOrModerator`, but
        # we defend in depth here so a crafted request can't bypass that.
        sender_role = current_user.get("role") or current_user.get("role_name")
        if sender_role not in ("admin", "moderator"):
            logger.warning(
                f"🚫 Blocked @email invite by non-admin: user={username} role={sender_role}"
            )
            raise HTTPException(
                status_code=403,
                detail="Only administrators or moderators can invite external participants by email",
            )

    now = datetime.utcnow()
    
    # Create message document
    msg = {
        "conversationId": ObjectId(conversation_id),
        "senderUsername": username,
        "contentType": body.contentType,
        "content": body.content.strip(),
        "status": "sent",
        "deliveredAt": None,
        "readAt": None,
        "readBy": [],
        "replyTo": ObjectId(body.replyTo) if body.replyTo else None,
        "isForwarded": False,
        "isDeleted": False,
        "moderationStatus": "clean",
        "createdAt": now,
        "updatedAt": now,
    }

    # Persist rich card snapshot for PROFILE_CARD messages so the card stays
    # immutable even if the sender later edits their profile.
    if body.contentType == "profile_card" and body.cardSnapshot:
        msg["cardSnapshot"] = body.cardSnapshot

    # Per-conversation TTL — stamp expireAt so the messenger_messages.expireAt
    # TTL index hard-deletes this row after the configured window. Off (None)
    # means no expireAt is set and the message lives forever. Existing
    # messages are NOT retroactively touched (see PUT /retention docstring).
    retention_hours = conv.get("messageRetentionHours")
    if isinstance(retention_hours, int) and retention_hours > 0:
        msg["expireAt"] = now + timedelta(hours=retention_hours)

    # Insert message
    result = await db.messenger_messages.insert_one(msg)
    msg_id = str(result.inserted_id)
    msg["_id"] = msg_id
    logger.info(f"✅ Message {msg_id} inserted")

    # Update conversation preview
    if body.contentType == "profile_card":
        preview = "📇 Shared profile card"
    elif body.contentType == "text":
        preview = body.content[:100]
    else:
        preview = f"[{body.contentType.capitalize()}]"
    await db.messenger_conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {
            "$set": {
                "lastMessageAt": now,
                "lastMessagePreview": preview,
                "updatedAt": now,
            }
        }
    )

    # Handle public recipients (US Vedika)
    if body.publicRecipients and len(body.publicRecipients) > 0:
        for recipient in body.publicRecipients:
            email = recipient.get("email")
            display_name = recipient.get("displayName", email)

            # Rate limit: Check per-member invite limit (max 10 invites per day per member)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            invites_today = await db.messenger_conversations.count_documents({
                "_id": ObjectId(conversation_id),
                "publicParticipants.addedBy": username,
                "publicParticipants.addedAt": {"$gte": today_start}
            })

            if invites_today >= 10:
                logger.warning(f"⚠️ Rate limit exceeded: {username} has sent {invites_today} invites today")
                raise HTTPException(
                    status_code=429,
                    detail="Daily invite limit reached (10 per day). Please try again tomorrow."
                )

            # Rate limit: Check per-conversation email limit (max 100 emails total per conversation)
            total_emails = len(conv.get("publicParticipants", []))
            if total_emails >= 100:
                logger.warning(f"⚠️ Conversation email limit reached: {total_emails} emails sent")
                raise HTTPException(
                    status_code=429,
                    detail="US Vedika email limit reached (100 total). Contact admin to increase limit."
                )

            # Add to publicParticipants if not already present
            await db.messenger_conversations.update_one(
                {"_id": ObjectId(conversation_id), "publicParticipants.email": {"$ne": email}},
                {
                    "$push": {
                        "publicParticipants": {
                            "email": email,
                            "displayName": display_name,
                            "addedBy": username,
                            "addedAt": now,
                            "status": "invited",
                            "lastEmailSentAt": now,
                        }
                    },
                    "$set": {"updatedAt": now}
                }
            )

            # Generate reply token
            import uuid
            reply_token = str(uuid.uuid4())
            token_expires_at = now + timedelta(days=7)  # 7-day expiry

            await db.public_reply_tokens.insert_one({
                "token": reply_token,
                "conversationId": ObjectId(conversation_id),
                "publicEmail": email,
                "messageId": ObjectId(msg_id),
                "expiresAt": token_expires_at,
                "usedCount": 0,
                "createdAt": now,
            })

            # Update message with delivery metadata
            await db.messenger_messages.update_one(
                {"_id": ObjectId(msg_id)},
                {
                    "$set": {
                        "publicEmailsSent": body.publicRecipients,
                        "deliveryMode": body.deliveryMode or "both",
                        "includeInvitation": body.includeInvitation if body.includeInvitation is not None else True,
                        "updatedAt": now,
                    }
                }
            )

            # Queue actual email send via notification_queue (picked up by email_notifier job)
            try:
                from config import settings as _settings
                # Resolve sender display name
                sender_user = await db.users.find_one(
                    {"username": username},
                    {"firstName": 1, "lastName": 1, "_id": 0},
                )
                sender_name = (
                    f"{(sender_user or {}).get('firstName', '')} {(sender_user or {}).get('lastName', '')}".strip()
                    or username
                )

                from urllib.parse import quote as _quote
                reply_url = f"{_settings.frontend_url}/messenger/public-reply/{reply_token}"

                include_invitation = (
                    body.includeInvitation if body.includeInvitation is not None else True
                )

                # ----------------------------------------------------------
                # Build the "Create Free Profile" link.
                # SEMANTICS:
                #   • includeInvitation=True  ("Send + Invite") → member is
                #     explicitly vouching for this recipient. Use the real
                #     InvitationService funnel (no admin gating).
                #   • includeInvitation=False ("Send Message Only") → no
                #     vouching. Recipient can still self-apply later via the
                #     soft register-interest path (rendered from the public
                #     reply page footer, not in this email).
                # ----------------------------------------------------------
                register_url = None
                invitation_id_for_log = None
                if include_invitation:
                    # Skip if recipient is already a registered user
                    existing_user = await db.users.find_one(
                        {"$or": [
                            {"email": email.lower()},
                            {"contactEmail": email.lower()},
                        ]},
                        {"username": 1, "_id": 0},
                    )
                    if existing_user:
                        logger.info(
                            f"ℹ️ Recipient {email} is already user '{existing_user.get('username')}'; "
                            f"skipping invitation creation"
                        )
                        include_invitation = False  # template will hide CTA
                    else:
                        from services.invitation_service import InvitationService
                        from models.invitation_models import InvitationCreate, InvitationChannel
                        inv_service = InvitationService(db)
                        invitation_token = None
                        try:
                            new_inv = await inv_service.create_invitation(
                                invitation_data=InvitationCreate(
                                    name=display_name or email,
                                    email=email,
                                    channel=InvitationChannel.EMAIL,
                                    sendImmediately=False,  # we embed token in this same email
                                    promoCode="PUBLIC",
                                ),
                                invited_by=username,
                            )
                            invitation_token = new_inv.invitationToken
                            invitation_id_for_log = new_inv.id
                            # Stamp source/conversation linkage for analytics +
                            # later use by funnel-history linkers.
                            # source_label distinguishes Portal Members vs US Vedika invites.
                            await db.invitations.update_one(
                                {"_id": ObjectId(new_inv.id)},
                                {"$set": {
                                    "source": source_label,
                                    "sourceConversationId": ObjectId(conversation_id),
                                    "sourceMessageId": ObjectId(msg_id),
                                    "verificationPath": "referral",
                                }},
                            )
                            logger.info(f"✉️ Invitation {new_inv.id} created for {email} (invitedBy={username})")
                        except ValueError:
                            # Active invitation already exists for this email — reuse its token.
                            existing_inv = await db.invitations.find_one(
                                {"email": email, "archived": False}
                            )
                            if existing_inv:
                                invitation_token = existing_inv.get("invitationToken")
                                invitation_id_for_log = str(existing_inv["_id"])
                                logger.info(
                                    f"♻️ Reusing existing invitation {existing_inv['_id']} for {email}"
                                )

                        if invitation_token:
                            register_url = (
                                f"{_settings.frontend_url}/register2"
                                f"?invitation={invitation_token}"
                                f"&email={_quote(email)}"
                                f"&promo=PUBLIC"
                            )
                        else:
                            # Couldn't create or find an invitation — fall back to interest funnel
                            logger.warning(f"⚠️ No invitation token for {email}; falling back to register-interest")
                            register_url = (
                                f"{_settings.frontend_url}/register-interest"
                                f"?source={source_label}"
                                f"&cid={conversation_id}"
                                f"&invitedBy={_quote(username)}"
                                f"&email={_quote(email)}"
                            )

                queue_doc = {
                    "username": username,  # sender (for logging/lineage); recipientEmail overrides lookup
                    "trigger": trigger_label,
                    "priority": "medium",
                    "channels": ["email"],
                    "templateData": {
                        "recipientEmail": email,
                        "recipientName": display_name,
                        "senderName": sender_name,
                        "senderUsername": username,
                        "messageContent": body.content or "",
                        "replyUrl": reply_url,
                        "registerUrl": register_url,
                        "frontendUrl": _settings.frontend_url,
                        "includeInvitation": include_invitation,
                        "conversationId": str(conversation_id),
                        "messageId": str(msg_id),
                        # Carry invitation id so the email_notifier job can flip
                        # the invitation's emailStatus to SENT/FAILED on actual
                        # delivery (vs. the optimistic update we do below).
                        "invitationId": invitation_id_for_log,
                    },
                    "status": "pending",
                    "scheduledFor": None,
                    "attempts": 0,
                    "lastAttempt": None,
                    "error": None,
                    "createdAt": now,
                    "updatedAt": now,
                }
                await db.notification_queue.insert_one(queue_doc)
                logger.info(f"📧 Email queued in notification_queue for {email} (token: {reply_token}, invitation={include_invitation})")

                # Optimistically mark the invitation as SENT so the
                # InvitationManager UI in the main app doesn't show a
                # forever-"pending" row. The email_notifier job will flip it to
                # FAILED later if delivery actually fails (it has invitationId
                # in templateData above).
                if invitation_id_for_log:
                    try:
                        from services.invitation_service import InvitationService
                        from models.invitation_models import InvitationChannel, InvitationStatus
                        await InvitationService(db).update_invitation_status(
                            invitation_id_for_log,
                            InvitationChannel.EMAIL,
                            InvitationStatus.SENT,
                        )
                    except Exception as status_err:
                        logger.warning(
                            f"⚠️ Failed to mark invitation {invitation_id_for_log} as SENT: {status_err}"
                        )
            except Exception as queue_err:
                logger.error(f"❌ Failed to queue email for {email}: {queue_err}")

    msg["id"] = str(msg.pop("_id"))
    msg["conversationId"] = str(msg["conversationId"])
    if msg.get("replyTo"):
        msg["replyTo"] = str(msg["replyTo"])

    # Real-time delivery via Socket.IO
    try:
        await _notify_realtime(db, conversation_id, username, msg)
    except Exception as e:
        logger.warning(f"⚠️ Real-time notification failed: {e}")

    # Push notification for offline recipients
    try:
        await _send_push(db, conversation_id, username, msg)
    except Exception as e:
        logger.warning(f"⚠️ Push notification failed: {e}")

    return {"success": True, "message": msg}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Soft-delete a message (sender only)."""
    ok = await messenger_service.delete_message(db, message_id, current_user["username"])
    if not ok:
        raise HTTPException(status_code=403, detail="Cannot delete this message")
    return {"success": True, "messageId": message_id}


# =========================================================================
# Delivery Receipts
# =========================================================================

@router.put("/messages/status")
async def update_message_status(
    body: MessageStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update delivery status (delivered / read) for a batch of messages."""
    count = await messenger_service.update_message_status(
        db, body.messageIds, body.status.value, current_user["username"]
    )
    return {"success": True, "updatedCount": count}


# =========================================================================
# Public Reply (US Vedika external email recipients — no auth)
# =========================================================================

MAX_PUBLIC_REPLY_USES = 20  # allow multiple replies within the 7-day window


@router.get("/public-reply/{token}")
async def get_public_reply_context(
    token: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Validate a public reply token and return the conversation context for the
    reply page. No authentication required — the token itself is the credential.
    """
    token_doc = await db.public_reply_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or unknown reply link")

    # Expiry check
    expires_at = token_doc.get("expiresAt")
    if expires_at and expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This reply link has expired")

    if token_doc.get("usedCount", 0) >= MAX_PUBLIC_REPLY_USES:
        raise HTTPException(status_code=410, detail="This reply link has reached its use limit")

    # Load conversation & original message
    conv = await db.messenger_conversations.find_one({"_id": token_doc["conversationId"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation no longer exists")

    original_msg = await db.messenger_messages.find_one({"_id": token_doc["messageId"]})

    # Resolve sender display name for original message
    sender_username = (original_msg or {}).get("senderUsername")
    sender_name = sender_username
    if sender_username:
        sender_user = await db.users.find_one(
            {"username": sender_username},
            {"firstName": 1, "lastName": 1, "_id": 0},
        )
        if sender_user:
            sender_name = (
                f"{sender_user.get('firstName', '')} {sender_user.get('lastName', '')}".strip()
                or sender_username
            )

    return {
        "success": True,
        "publicEmail": token_doc["publicEmail"],
        "groupName": conv.get("groupName") or "US Vedika",
        "originalMessage": {
            "senderName": sender_name,
            "content": (original_msg or {}).get("content", ""),
            "createdAt": (original_msg or {}).get("createdAt"),
        } if original_msg else None,
        "expiresAt": expires_at,
        "usedCount": token_doc.get("usedCount", 0),
        "maxUses": MAX_PUBLIC_REPLY_USES,
    }


@router.post("/public-reply/{token}")
async def post_public_reply(
    token: str,
    body: dict,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Post a reply from an external (non-member) email recipient into the US
    Vedika public group conversation. The token (emailed to the recipient)
    authorises the reply; no login is required.
    """
    content = (body or {}).get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Reply content is required")
    if len(content) > 4000:
        raise HTTPException(status_code=400, detail="Reply is too long (max 4000 chars)")

    token_doc = await db.public_reply_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or unknown reply link")

    expires_at = token_doc.get("expiresAt")
    if expires_at and expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This reply link has expired")

    if token_doc.get("usedCount", 0) >= MAX_PUBLIC_REPLY_USES:
        raise HTTPException(status_code=410, detail="This reply link has reached its use limit")

    conversation_id = token_doc["conversationId"]
    public_email = token_doc["publicEmail"].lower()
    now = datetime.utcnow()

    # Insert reply as a public_email message
    msg_doc = {
        "conversationId": conversation_id,
        "senderUsername": None,        # no portal user
        "senderType": "public_email",  # matches link_us_vedika_history() semantics
        "publicEmail": public_email,
        "contentType": "text",
        "content": content,
        "status": "sent",
        "deliveredAt": None,
        "readAt": None,
        "readBy": [],
        "replyTo": token_doc.get("messageId"),
        "isForwarded": False,
        "isDeleted": False,
        "moderationStatus": "pending",  # external content — flag for review
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.messenger_messages.insert_one(msg_doc)
    msg_id = str(result.inserted_id)

    # Update conversation preview
    await db.messenger_conversations.update_one(
        {"_id": conversation_id},
        {
            "$set": {
                "lastMessageAt": now,
                "lastMessagePreview": f"[Guest {public_email}] {content[:80]}",
                "updatedAt": now,
            }
        },
    )

    # Mark publicParticipant as replied
    await db.messenger_conversations.update_one(
        {"_id": conversation_id, "publicParticipants.email": public_email},
        {
            "$set": {
                "publicParticipants.$.lastReplyAt": now,
                "publicParticipants.$.status": "replied",
                "updatedAt": now,
            }
        },
    )

    # Increment token usage
    await db.public_reply_tokens.update_one(
        {"token": token},
        {"$inc": {"usedCount": 1}, "$set": {"lastUsedAt": now}},
    )

    # Real-time broadcast to conversation participants
    try:
        broadcast_msg = {
            **msg_doc,
            "_id": msg_id,
            "conversationId": str(conversation_id),
            "replyTo": str(msg_doc["replyTo"]) if msg_doc.get("replyTo") else None,
        }
        await _notify_realtime(db, str(conversation_id), public_email, broadcast_msg)
    except Exception as e:
        logger.warning(f"⚠️ Real-time broadcast of public reply failed: {e}")

    logger.info(f"✉️ Public reply posted by {public_email} to conversation {conversation_id} (msg {msg_id})")
    return {"success": True, "messageId": msg_id}


# =========================================================================
# Media Upload
# =========================================================================

@router.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a media file. Returns URL metadata to attach to a message."""
    file_bytes = await file.read()

    is_valid, error, category = messenger_media_service.validate_file(
        file_bytes, file.filename or "file", file.content_type
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    result = await messenger_media_service.upload_file(
        file_bytes,
        file.filename or "file",
        current_user["username"],
        file.content_type,
    )
    return {"success": True, "media": result}


# =========================================================================
# Device Tokens (Push Notifications)
# =========================================================================

@router.post("/devices/register")
async def register_device(
    body: DeviceRegister,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Register an FCM device token for push notifications."""
    await messenger_service.register_device(
        db, current_user["username"], body.token, body.platform.value, body.deviceName
    )
    return {"success": True}


@router.delete("/devices/{token}")
async def unregister_device(
    token: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Unregister a device token."""
    ok = await messenger_service.unregister_device(db, current_user["username"], token)
    if not ok:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"success": True}


# =========================================================================
# Helpers (internal)
# =========================================================================

async def _enrich_participants(
    db: AsyncIOMotorDatabase,
    conv: dict,
    current_username: str,
):
    """
    Add basic profile info (firstName/lastName/profileImage) to each participant.

    OPTIMIZED: previously this ran N sequential `find_one` calls, which on
    Portal Members (~600 participants) meant ~600 round-trips and 10–20s of
    latency on every chat-open. Now we issue ONE batched `$in` query and join
    the results back in memory — single round-trip regardless of group size.
    """
    participants = conv.get("participants", []) or []
    usernames = [p.get("username") for p in participants if p.get("username")]
    if not usernames:
        return

    cursor = db.users.find(
        {"username": {"$in": usernames}},
        {
            "_id": 0,
            "username": 1,
            "firstName": 1,
            "lastName": 1,
            "images": 1,
            "publicImages": 1,
            "imageVisibility": 1,
            "profileImage": 1,
        },
    )
    by_username = {u["username"]: u async for u in cursor if u.get("username")}

    for p in participants:
        uname = p.get("username")
        if not uname:
            continue
        user = by_username.get(uname)
        if not user:
            continue
        p["firstName"] = user.get("firstName", "")
        p["lastName"] = user.get("lastName", "")
        images = user.get("images", [])
        p["profileImage"] = images[0] if images else None


async def _notify_realtime(
    db: AsyncIOMotorDatabase,
    conversation_id: str,
    sender_username: str,
    message: dict,
):
    """Send real-time notification to online participants via Socket.IO."""
    from websocket_manager import online_users, sio

    conv = await db.messenger_conversations.find_one(
        {"_id": __import__("bson").ObjectId(conversation_id)}
    )
    if not conv:
        return

    for p in conv.get("participants", []):
        recipient = p.get("username")
        if recipient and recipient != sender_username and recipient in online_users:
            await sio.emit(
                "messenger:new_message",
                {"conversationId": conversation_id, "message": _serialize_for_socket(message)},
                room=online_users[recipient],
            )


async def _send_push(
    db: AsyncIOMotorDatabase,
    conversation_id: str,
    sender_username: str,
    message: dict,
):
    """Send push notification to offline participants."""
    from services.push_service import PushNotificationService

    conv = await db.messenger_conversations.find_one(
        {"_id": __import__("bson").ObjectId(conversation_id)}
    )
    if not conv:
        return

    from websocket_manager import online_users

    push = PushNotificationService()
    sender_profile = await db.users.find_one({"username": sender_username}, {"firstName": 1, "lastName": 1})
    sender_name = sender_profile.get("firstName", sender_username) if sender_profile else sender_username

    content_type = message.get("contentType", "text")
    body_text = message.get("content", "")[:100] if content_type == "text" else f"📎 {content_type.capitalize()}"

    for p in conv.get("participants", []):
        recipient = p.get("username")
        if not recipient or recipient == sender_username:
            continue
        # Skip if user is online (already got real-time)
        if recipient in online_users:
            continue

        tokens = await messenger_service.get_device_tokens(db, recipient)
        if tokens:
            await push.send_to_multiple_tokens(
                tokens=tokens,
                title=sender_name,
                body=body_text,
                data={
                    "type": "messenger_new_message",
                    "conversationId": conversation_id,
                    "senderUsername": sender_username,
                    "messageId": message.get("id", ""),
                },
            )


def _serialize_for_socket(msg: dict) -> dict:
    """Ensure datetime fields are ISO strings for JSON serialization."""
    import copy
    from datetime import datetime as dt

    out = copy.copy(msg)
    for key, val in out.items():
        if isinstance(val, dt):
            out[key] = val.isoformat()
    return out
