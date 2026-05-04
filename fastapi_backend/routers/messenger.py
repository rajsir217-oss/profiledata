"""
Messenger Router — /api/messenger/*
Phase 1: 1:1 conversations, text + media messages, delivery receipts, device tokens.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

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


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send a message (text or media) to a conversation."""
    username = current_user["username"]

    # Content moderation
    if body.contentType == "text" and body.content:
        try:
            from profanity_filter import check_message_content
            content_check = check_message_content(body.content)
            if not content_check["is_clean"]:
                raise HTTPException(
                    status_code=400,
                    detail="Your message contains inappropriate content. Please revise.",
                )
        except ImportError:
            pass  # profanity filter not available

    media_dict = body.media.model_dump() if body.media else None
    msg = await messenger_service.send_message(
        db,
        sender_username=username,
        conversation_id=conversation_id,
        content=body.content,
        content_type=body.contentType.value,
        media=media_dict,
        reply_to=body.replyTo,
    )

    if not msg:
        raise HTTPException(status_code=403, detail="Cannot send message to this conversation")

    msg["id"] = msg.pop("_id")

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
