"""
Messenger Service
Single source of truth for L3V3L Messenger business logic.
Handles conversations, messages, delivery receipts, and media references.
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
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
    is_system_bot: bool = False,
    bot_name: Optional[str] = None,
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
            if is_system_bot and not existing.get("isSystemBot"):
                await db.messenger_conversations.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": {
                            "isSystemBot": True,
                            "botName": bot_name or existing.get("botName") or "L3V3L Agent",
                            "updatedAt": datetime.utcnow(),
                        }
                    },
                )
                existing["isSystemBot"] = True
                existing["botName"] = bot_name or existing.get("botName") or "L3V3L Agent"
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
        "isSystemBot": bool(is_system_bot),
        "botName": bot_name if is_system_bot else None,
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
    exclude_group_name: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """Get paginated conversations for a user, sorted by last message time."""
    try:
        from redis_manager import get_redis_manager
        redis = get_redis_manager()
        group_suffix = exclude_group_name or "all"
        cache_key = f"conversation_list:{username}:{page}:{group_suffix}"
        cached = redis.redis_client.get(cache_key)
        if cached:
            import json
            data = json.loads(cached)
            logger.debug(f"✅ Cache hit for conversation list: {cache_key}")
            return data["conversations"], data["total"]
    except Exception as e:
        logger.warning(f"⚠️ Redis cache check failed: {e}")
    
    query: Dict[str, Any] = {"participants.username": username}
    if exclude_group_name:
        query["groupName"] = {"$ne": exclude_group_name}
    total = await db.messenger_conversations.count_documents(query)

    cursor = (
        db.messenger_conversations.find(query)
        .sort("lastMessageAt", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    conversations = await cursor.to_list(length=limit)

    for conv in conversations:
        conv["_id"] = str(conv["_id"])

    if conversations:
        conv_ids = [ObjectId(c["_id"]) for c in conversations]
        pipeline = [
            {"$match": {
                "conversationId": {"$in": conv_ids},
                "senderUsername": {"$ne": username},
                "status": {"$ne": "read"},
                "isDeleted": False,
            }},
            {"$group": {"_id": "$conversationId", "count": {"$sum": 1}}}
        ]
        unread_results = await db.messenger_messages.aggregate(pipeline).to_list(None)
        unread_by_conv = {str(r["_id"]): r["count"] for r in unread_results}

        for conv in conversations:
            conv["unreadCount"] = unread_by_conv.get(str(conv["_id"]), 0)

    try:
        from redis_manager import get_redis_manager
        redis = get_redis_manager()
        from fastapi.encoders import jsonable_encoder
        import json
        group_suffix = exclude_group_name or "all"
        cache_key = f"conversation_list:{username}:{page}:{group_suffix}"
        payload = jsonable_encoder({"conversations": conversations, "total": total})
        redis.redis_client.setex(cache_key, 30, json.dumps(payload))
        logger.debug(f"💾 Cached conversation list: {cache_key}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to cache conversation list: {e}")

    return conversations, total


async def get_conversation(
    db: AsyncIOMotorDatabase,
    conversation_id: str,
    username: str,
    lite: bool = False,
    include_unread_count: bool = True,
) -> Optional[Dict[str, Any]]:
    """Get a single conversation if the user is a participant."""
    query = {"_id": ObjectId(conversation_id), "participants.username": username}
    projection = None
    if lite:
        projection = {
            "participants": 0,
            "publicParticipants": 0,
        }

    conv = await db.messenger_conversations.find_one(query, projection)
    if not conv:
        return None
    conv["_id"] = str(conv["_id"])
    if include_unread_count:
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

    retention_hours = conv.get("messageRetentionHours")
    if isinstance(retention_hours, int) and retention_hours > 0:
        msg["expireAt"] = now + timedelta(hours=retention_hours)

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
    conv = await db.messenger_conversations.find_one(
        {"_id": ObjectId(conversation_id), "participants.username": username},
        {
            "clearedFor": 1,
            "publicParticipants": 1,
            "messageRetentionHours": 1,
        },
    )
    if not conv:
        return [], 0, False

    now = datetime.utcnow()
    retention_hours = conv.get("messageRetentionHours")
    retention_delta = (
        timedelta(hours=retention_hours)
        if isinstance(retention_hours, int) and retention_hours > 0
        else None
    )
    and_clauses: List[Dict[str, Any]] = []
    if before:
        and_clauses.append({"_id": {"$lt": ObjectId(before)}})

    # Per-user "clear chat" filter — hide messages older than the user's clearedAt timestamp
    cleared_for = (conv.get("clearedFor") or {}).get(username)
    if cleared_for:
        and_clauses.append({"createdAt": {"$gt": cleared_for}})

    # Hide expired messages immediately (TTL cleanup is async and can lag).
    # Messages with no expireAt (or null expireAt) live forever.
    and_clauses.append({
        "$or": [
            {"expireAt": {"$exists": False}},
            {"expireAt": None},
            {"expireAt": {"$gt": now}},
        ]
    })

    query: Dict[str, Any] = {"conversationId": ObjectId(conversation_id)}
    if and_clauses:
        query["$and"] = and_clauses

    count_query: Dict[str, Any] = {"conversationId": ObjectId(conversation_id)}
    if cleared_for:
        count_query["createdAt"] = {"$gt": cleared_for}
    count_query["$or"] = [
        {"expireAt": {"$exists": False}},
        {"expireAt": None},
        {"expireAt": {"$gt": now}},
    ]
    total = await db.messenger_messages.count_documents(count_query)
    cursor = (
        db.messenger_messages.find(query)
        .sort("_id", -1)  # newest first
        .limit(limit + 1)
    )
    messages = await cursor.to_list(length=limit + 1)
    has_more = len(messages) > limit
    messages = messages[:limit]

    if retention_delta and messages:
        def _parse_ts(value: Any) -> Optional[datetime]:
            if isinstance(value, datetime):
                if value.tzinfo is not None:
                    return value.astimezone().replace(tzinfo=None)
                return value

            if isinstance(value, (int, float)):
                try:
                    ts = float(value)
                    if ts > 10_000_000_000:
                        ts = ts / 1000.0
                    return datetime.utcfromtimestamp(ts)
                except (TypeError, ValueError, OSError, OverflowError):
                    return None

            if isinstance(value, str):
                candidate = value.strip()
                if not candidate:
                    return None
                if candidate.endswith("Z"):
                    candidate = f"{candidate[:-1]}+00:00"
                try:
                    parsed = datetime.fromisoformat(candidate)
                    if parsed.tzinfo is not None:
                        parsed = parsed.astimezone().replace(tzinfo=None)
                    return parsed
                except ValueError:
                    pass

                fallback_formats = (
                    "%Y-%m-%d %H:%M:%S",
                    "%Y-%m-%d %H:%M:%S.%f",
                    "%m/%d/%Y %I:%M %p",
                    "%m/%d/%y %I:%M %p",
                    "%m/%d/%Y, %I:%M:%S %p",
                    "%m/%d/%y, %I:%M:%S %p",
                )
                for fmt in fallback_formats:
                    try:
                        return datetime.strptime(candidate, fmt)
                    except ValueError:
                        continue

            return None

        expired_ids: List[Any] = []
        kept_messages: List[Dict[str, Any]] = []
        for m in messages:
            expire_at = _parse_ts(m.get("expireAt"))
            is_expired = False

            if expire_at is not None:
                is_expired = expire_at <= now
            else:
                created_at = _parse_ts(m.get("createdAt")) or _parse_ts(m.get("updatedAt"))
                if created_at is None:
                    msg_id = m.get("_id")
                    if isinstance(msg_id, ObjectId):
                        created_at = msg_id.generation_time.astimezone().replace(tzinfo=None)

                if created_at is not None:
                    is_expired = (created_at + retention_delta) <= now

            if is_expired:
                msg_id = m.get("_id")
                if msg_id is not None:
                    expired_ids.append(msg_id)
                continue

            kept_messages.append(m)

        if expired_ids:
            await db.messenger_messages.delete_many({"_id": {"$in": expired_ids}})
            total = max(total - len(expired_ids), 0)

        messages = kept_messages

    # Build a case-insensitive email -> participant lookup for enriching
    # publicEmailsSent on invitation messages with their CURRENT status
    # (invited / interested / replied / opted_out, etc.)
    public_participants = conv.get("publicParticipants") or []
    participants_by_email = {
        (p.get("email") or "").lower(): p
        for p in public_participants
        if p.get("email")
    }

    for m in messages:
        m["_id"] = str(m["_id"])
        m["conversationId"] = str(m["conversationId"])
        if m.get("replyTo"):
            m["replyTo"] = str(m["replyTo"])

        # Enrich publicEmailsSent (US Vedika invitation messages) with the
        # CURRENT status of each invited email so the client can render
        # "Pending activation" / "Interested" / "Replied" / "Opted out"
        # badges inline under the message bubble.
        emails_sent = m.get("publicEmailsSent")
        if isinstance(emails_sent, list) and emails_sent:
            enriched = []
            for r in emails_sent:
                if not isinstance(r, dict):
                    continue
                email = (r.get("email") or "").strip()
                key = email.lower()
                p = participants_by_email.get(key) or {}
                # Default to 'invited' (i.e. pending activation) if the
                # participant doc was somehow not added (race / cleanup).
                status = p.get("status") or "invited"
                enriched.append({
                    "email": email,
                    "displayName": r.get("displayName") or p.get("displayName") or email,
                    "status": status,
                    "addedAt": p.get("addedAt"),
                    "lastEmailSentAt": p.get("lastEmailSentAt"),
                    "lastReplyAt": p.get("lastReplyAt"),
                    "optedOutAt": p.get("optedOutAt"),
                })
            m["publicEmailsSent"] = enriched

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


# ---------------------------------------------------------------------------
# L3V3L Agent (System Bot) Messages
# ---------------------------------------------------------------------------

async def get_or_create_l3v3lagent_conversation(
    db: AsyncIOMotorDatabase,
    username: str
) -> Optional[str]:
    """
    Get or create a l3v3lagent (system bot) conversation for a user.
    Returns the conversation ID.
    """
    # Check if conversation already exists
    existing = await db.messenger_conversations.find_one({
        "type": "direct",
        "participants.username": {"$all": [username, "l3v3lagent"]},
    })
    if existing:
        return str(existing["_id"])

    # Create new conversation with l3v3lagent
    now = datetime.utcnow()
    participants = [
        {"username": username, "role": "member", "joinedAt": now},
        {"username": "l3v3lagent", "role": "admin", "joinedAt": now},
    ]

    result = await db.messenger_conversations.insert_one({
        "type": "direct",
        "participants": participants,
        "createdAt": now,
        "updatedAt": now,
        "lastMessageAt": now,
        "isSystemBot": True,
        "botName": "L3V3L Agent",
    })

    logger.info(f"🤖 Created l3v3lagent conversation for {username}")
    return str(result.inserted_id)


async def send_to_l3v3lagent(
    db: AsyncIOMotorDatabase,
    recipient_username: str,
    content: str,
    content_type: str = "text",
) -> Optional[str]:
    """
    Send a message to a user's l3v3lagent (system bot) conversation.
    Returns the message ID if successful, None otherwise.
    """
    # Get or create conversation
    conv_id = await get_or_create_l3v3lagent_conversation(db, recipient_username)
    if not conv_id:
        logger.error(f"❌ Failed to get/create l3v3lagent conversation for {recipient_username}")
        return None

    # Send message as l3v3lagent
    return await send_message(
        db=db,
        sender_username="l3v3lagent",
        conversation_id=conv_id,
        content=content,
        content_type=content_type,
    )
