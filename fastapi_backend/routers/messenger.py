"""
Messenger Router — /api/messenger/*
Phase 1: 1:1 conversations, text + media messages, delivery receipts, device tokens.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
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

    # Check for public recipients in US Vedika (public_group)
    if body.publicRecipients and len(body.publicRecipients) > 0:
        if conv.get("type") != "public_group":
            raise HTTPException(status_code=403, detail="Public recipients only allowed in US Vedika (public_group) conversations")

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

    # Insert message
    result = await db.messenger_messages.insert_one(msg)
    msg_id = str(result.inserted_id)
    msg["_id"] = msg_id
    logger.info(f"✅ Message {msg_id} inserted")

    # Update conversation preview
    preview = body.content[:100] if body.contentType == "text" else f"[{body.contentType.capitalize()}]"
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
                            # later use by link_us_vedika_history()
                            await db.invitations.update_one(
                                {"_id": ObjectId(new_inv.id)},
                                {"$set": {
                                    "source": "us_vedika",
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
                                f"?source=us_vedika"
                                f"&cid={conversation_id}"
                                f"&invitedBy={_quote(username)}"
                                f"&email={_quote(email)}"
                            )

                queue_doc = {
                    "username": username,  # sender (for logging/lineage); recipientEmail overrides lookup
                    "trigger": "us_vedika_message",
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
    """Add basic profile info for each participant (avatar, name)."""
    for p in conv.get("participants", []):
        uname = p.get("username")
        if not uname:
            continue
        user = await db.users.find_one(
            {"username": uname},
            {"firstName": 1, "lastName": 1, "images": 1, "publicImages": 1, "imageVisibility": 1, "profileImage": 1, "_id": 0},
        )
        if user:
            p["firstName"] = user.get("firstName", "")
            p["lastName"] = user.get("lastName", "")
            # Profile pic — reuse existing image visibility logic
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
