"""
Messenger Service
Single source of truth for L3V3L Messenger business logic.
Handles conversations, messages, delivery receipts, and media references.
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

async def create_conversation(
    db: AsyncIOMotorDatabase,
    creator_username: str,
    participant_usernames: List[str],
    conv_type: str = "direct",
    group_name: Optional[str] = None,
    group_avatar: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new conversation.
    For direct chats, reuse existing conversation if one already exists.
    """
    all_participants = list(set([creator_username] + participant_usernames))

    # For direct chats, check if conversation already exists
    if conv_type == "direct" and len(all_participants) == 2:
        existing = await db.messenger_conversations.find_one({
            "type": "direct",
            "participants.username": {"$all": all_participants},
        })
        if existing:
            existing["_id"] = str(existing["_id"])
            logger.info(f"💬 Reusing existing direct conversation {existing['_id']}")
            return existing

    now = datetime.utcnow()
    participants = [
        {"username": u, "role": "admin" if u == creator_username and conv_type == "group" else "member", "joinedAt": now}
        for u in all_participants
    ]

    doc = {
        "type": conv_type,
        "participants": participants,
        "groupName": group_name if conv_type == "group" else None,
        "groupAvatar": group_avatar if conv_type == "group" else None,
        "createdBy": creator_username,
        "lastMessageAt": None,
        "lastMessagePreview": None,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.messenger_conversations.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    logger.info(f"💬 Created {conv_type} conversation {doc['_id']} with {len(all_participants)} participants")
    return doc


async def get_conversations(
    db: AsyncIOMotorDatabase,
    username: str,
    page: int = 1,
    limit: int = 50,
) -> Tuple[List[Dict[str, Any]], int]:
    """Get paginated conversations for a user, sorted by last message time."""
    query = {"participants.username": username}
    total = await db.messenger_conversations.count_documents(query)

    cursor = (
        db.messenger_conversations.find(query)
        .sort("lastMessageAt", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    conversations = await cursor.to_list(length=limit)

    # Stringify ObjectIds and compute unread counts
    for conv in conversations:
        conv["_id"] = str(conv["_id"])
        conv["unreadCount"] = await _unread_count(db, str(conv["_id"]), username)

    return conversations, total


async def get_conversation(
    db: AsyncIOMotorDatabase,
    conversation_id: str,
    username: str,
) -> Optional[Dict[str, Any]]:
    """Get a single conversation if the user is a participant."""
    conv = await db.messenger_conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conv:
        return None
    if not any(p.get("username") == username for p in conv.get("participants", [])):
        return None
    conv["_id"] = str(conv["_id"])
    conv["unreadCount"] = await _unread_count(db, conv["_id"], username)
    return conv


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

async def send_message(
    db: AsyncIOMotorDatabase,
    sender_username: str,
    conversation_id: str,
    content: str,
    content_type: str = "text",
    media: Optional[Dict[str, Any]] = None,
    reply_to: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Persist a new message and update the parent conversation.
    Returns the created message document (with stringified _id).
    """
    # Verify sender is a participant
    conv = await db.messenger_conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conv:
        logger.warning(f"⚠️ Conversation {conversation_id} not found")
        return None
    if not any(p.get("username") == sender_username for p in conv.get("participants", [])):
        logger.warning(f"⚠️ {sender_username} is not a participant of {conversation_id}")
        return None

    now = datetime.utcnow()
    msg = {
        "conversationId": ObjectId(conversation_id),
        "senderUsername": sender_username,
        "contentType": content_type,
        "content": content.strip() if content else "",
        "media": media,
        "status": "sent",
        "deliveredAt": None,
        "readAt": None,
        "readBy": [],
        "replyTo": ObjectId(reply_to) if reply_to else None,
        "isForwarded": False,
        "isDeleted": False,
        "moderationStatus": "clean",
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.messenger_messages.insert_one(msg)
    msg["_id"] = str(result.inserted_id)
    msg["conversationId"] = conversation_id
    if msg.get("replyTo"):
        msg["replyTo"] = reply_to

    # Update conversation preview
    preview = content[:100] if content_type == "text" else f"[{content_type.capitalize()}]"
    await db.messenger_conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {"lastMessageAt": now, "lastMessagePreview": preview, "updatedAt": now}},
    )

    logger.info(f"💬 Message {msg['_id']} sent by {sender_username} in {conversation_id}")
    return msg


async def get_messages(
    db: AsyncIOMotorDatabase,
    conversation_id: str,
    username: str,
    limit: int = 50,
    before: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int, bool]:
    """
    Cursor-paginated messages for a conversation.
    Returns (messages, total, has_more).
    """
    # Verify participant
    conv = await db.messenger_conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conv or not any(p.get("username") == username for p in conv.get("participants", [])):
        return [], 0, False

    query: Dict[str, Any] = {"conversationId": ObjectId(conversation_id)}
    if before:
        query["_id"] = {"$lt": ObjectId(before)}

    total = await db.messenger_messages.count_documents({"conversationId": ObjectId(conversation_id)})
    cursor = (
        db.messenger_messages.find(query)
        .sort("_id", -1)  # newest first
        .limit(limit + 1)
    )
    messages = await cursor.to_list(length=limit + 1)
    has_more = len(messages) > limit
    messages = messages[:limit]

    for m in messages:
        m["_id"] = str(m["_id"])
        m["conversationId"] = str(m["conversationId"])
        if m.get("replyTo"):
            m["replyTo"] = str(m["replyTo"])

    # Return in chronological order (oldest first) for display
    messages.reverse()
    return messages, total, has_more


async def delete_message(
    db: AsyncIOMotorDatabase,
    message_id: str,
    username: str,
) -> bool:
    """Soft-delete a message (only sender can delete)."""
    msg = await db.messenger_messages.find_one({"_id": ObjectId(message_id)})
    if not msg or msg.get("senderUsername") != username:
        return False

    await db.messenger_messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {
            "isDeleted": True,
            "content": "",
            "media": None,
            "deletedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }},
    )
    logger.info(f"🗑️ Message {message_id} soft-deleted by {username}")
    return True


# ---------------------------------------------------------------------------
# Delivery Receipts
# ---------------------------------------------------------------------------

async def update_message_status(
    db: AsyncIOMotorDatabase,
    message_ids: List[str],
    status: str,
    username: str,
) -> int:
    """
    Batch-update delivery status for messages.
    - 'delivered': sets deliveredAt
    - 'read': sets readAt and appends to readBy
    Only updates messages where the user is NOT the sender (you don't deliver to yourself).
    """
    now = datetime.utcnow()
    oids = [ObjectId(mid) for mid in message_ids]

    update: Dict[str, Any] = {"$set": {"updatedAt": now}}
    if status == "delivered":
        update["$set"]["status"] = "delivered"
        update["$set"]["deliveredAt"] = now
    elif status == "read":
        update["$set"]["status"] = "read"
        update["$set"]["readAt"] = now
        # Also push to readBy for group support
        update["$addToSet"] = {"readBy": {"username": username, "readAt": now}}

    result = await db.messenger_messages.update_many(
        {"_id": {"$in": oids}, "senderUsername": {"$ne": username}},
        update,
    )
    logger.info(f"✅ Updated {result.modified_count} messages to '{status}' for {username}")
    return result.modified_count


# ---------------------------------------------------------------------------
# Device Tokens
# ---------------------------------------------------------------------------

async def register_device(
    db: AsyncIOMotorDatabase,
    username: str,
    token: str,
    platform: str,
    device_name: Optional[str] = None,
) -> bool:
    """Register (or refresh) an FCM device token for push notifications."""
    now = datetime.utcnow()
    token_doc = {
        "token": token,
        "platform": platform,
        "deviceName": device_name,
        "lastActive": now,
        "createdAt": now,
    }

    # Upsert: add token if not present, refresh lastActive if present
    result = await db.messenger_device_tokens.update_one(
        {"username": username, "tokens.token": token},
        {"$set": {"tokens.$.lastActive": now, "updatedAt": now}},
    )

    if result.matched_count == 0:
        # Token not found — push it
        await db.messenger_device_tokens.update_one(
            {"username": username},
            {
                "$push": {"tokens": token_doc},
                "$set": {"updatedAt": now},
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )

    logger.info(f"📱 Device token registered for {username} ({platform})")
    return True


async def unregister_device(
    db: AsyncIOMotorDatabase,
    username: str,
    token: str,
) -> bool:
    """Remove a device token."""
    result = await db.messenger_device_tokens.update_one(
        {"username": username},
        {"$pull": {"tokens": {"token": token}}},
    )
    return result.modified_count > 0


async def get_device_tokens(
    db: AsyncIOMotorDatabase,
    username: str,
) -> List[str]:
    """Get all FCM tokens for a user."""
    doc = await db.messenger_device_tokens.find_one({"username": username})
    if not doc or not doc.get("tokens"):
        return []
    return [t["token"] for t in doc["tokens"]]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _unread_count(
    db: AsyncIOMotorDatabase,
    conversation_id: str,
    username: str,
) -> int:
    """Count unread messages in a conversation for a specific user."""
    return await db.messenger_messages.count_documents({
        "conversationId": ObjectId(conversation_id),
        "senderUsername": {"$ne": username},
        "status": {"$ne": "read"},
        "isDeleted": False,
    })


# ---------------------------------------------------------------------------
# US Vedika Public Group Integration
# ---------------------------------------------------------------------------

async def link_us_vedika_history(
    db: AsyncIOMotorDatabase,
    email: str,
    username: str,
    registration_interest_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Post-registration hook to merge US Vedika public message history to new username.
    Called when a user who was invited via US Vedika completes registration.
    
    Args:
        db: Database instance
        email: The email used during registration (matches publicParticipant.email)
        username: The new username of the registered user
        registration_interest_id: Optional link to the registration_interest document
    
    Returns:
        Summary of changes made (messages updated, conversations updated)
    """
    logger.info(f"🔗 Linking US Vedika history for {email} -> {username}")
    
    now = datetime.utcnow()
    messages_updated = 0
    conversations_updated = 0
    
    # Find US Vedika public_group conversation
    us_vedika_conv = await db.messenger_conversations.find_one({
        "type": "public_group",
        "groupName": "US Vedika"
    })
    
    if not us_vedika_conv:
        logger.warning("⚠️ US Vedika conversation not found")
        return {"success": False, "error": "US Vedika conversation not found"}
    
    conv_id = str(us_vedika_conv["_id"])
    
    # Update all messages with senderType=public_email and matching email
    result = await db.messenger_messages.update_many(
        {
            "senderType": "public_email",
            "publicEmail": email.lower()
        },
        {
            "$set": {
                "senderUsername": username,
                "senderType": "member",  # Now a full member
                "convertedAt": now,
                "updatedAt": now,
            }
        }
    )
    messages_updated = result.modified_count
    logger.info(f"✅ Updated {messages_updated} public email messages to username {username}")
    
    # Update publicParticipants in US Vedika conversation
    result = await db.messenger_conversations.update_one(
        {
            "_id": ObjectId(conv_id),
            "publicParticipants.email": email.lower()
        },
        {
            "$set": {
                "publicParticipants.$.status": "registered",
                "publicParticipants.$.convertedUsername": username,
                "publicParticipants.$.convertedAt": now,
            },
            "$set": {"updatedAt": now}
        }
    )
    if result.modified_count > 0:
        conversations_updated = 1
        logger.info(f"✅ Updated publicParticipant status to registered for {email}")
    
    # Link registration_interest if provided
    if registration_interest_id:
        await db.registration_interests.update_one(
            {"_id": ObjectId(registration_interest_id)},
            {
                "$set": {
                    "linkedUsername": username,
                    "linkedAt": now,
                }
            }
        )
        logger.info(f"✅ Linked registration interest {registration_interest_id} to {username}")
    
    # Add user as a participant to US Vedika if not already
    existing_participant = any(p.get("username") == username for p in us_vedika_conv.get("participants", []))
    if not existing_participant:
        await db.messenger_conversations.update_one(
            {"_id": ObjectId(conv_id)},
            {
                "$push": {
                    "participants": {
                        "username": username,
                        "role": "member",
                        "joinedAt": now,
                    }
                },
                "$set": {"updatedAt": now}
            }
        )
        logger.info(f"✅ Added {username} as participant to US Vedika")
    
    return {
        "success": True,
        "messagesUpdated": messages_updated,
        "conversationsUpdated": conversations_updated,
        "conversationId": conv_id,
    }
