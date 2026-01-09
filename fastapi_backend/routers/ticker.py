"""
Ticker Items Router
API endpoints for scrolling info ticker with live personalized data
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel
import logging

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user

router = APIRouter(tags=["ticker"])
logger = logging.getLogger(__name__)

# Ticker Settings Model
class TickerSettings(BaseModel):
    profileViewsHours: int = 24
    profileViewsLimit: int = 5
    favoritesHours: int = 24
    favoritesLimit: int = 5
    shortlistsHours: int = 24
    shortlistsLimit: int = 5
    messagesLimit: int = 3
    piiRequestsLimit: int = 5
    expiringAccessDays: int = 3
    expiringAccessLimit: int = 3
    savedSearchMatchesLimit: int = 3
    savedSearchMatchesDays: int = 7
    totalItemsLimit: int = 15
    enableProfileViews: bool = True
    enableFavorites: bool = True
    enableShortlists: bool = True
    enableMessages: bool = True
    enablePiiRequests: bool = True
    enableExpiringAccess: bool = True
    enableSavedSearchMatches: bool = True
    enableTips: bool = True


@router.get("/items")
async def get_ticker_items(
    username: str = Query(...),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Get unified ticker items combining announcements + user stats
    
    Returns items sorted by priority:
    1. Urgent announcements
    2. High-priority announcements
    3. User action items (pending requests)
    4. User stats (views, messages)
    5. Medium announcements
    6. Tips
    7. Low announcements
    """
    items = []
    now = datetime.utcnow()
    
    # Load ticker settings from database
    settings_doc = await db.ticker_settings.find_one({"_id": "global"})
    if settings_doc:
        settings_doc.pop("_id", None)
        settings = TickerSettings(**settings_doc)
    else:
        settings = TickerSettings()  # Use defaults
    
    # ===== 1. SYSTEM ANNOUNCEMENTS (from existing system) =====
    
    # Get active announcements for this user
    announcement_query = {
        "active": True,
        "$or": [
            {"startDate": {"$lte": now}},
            {"startDate": None}
        ],
        "$and": [
            {"$or": [
                {"endDate": {"$gte": now}},
                {"endDate": None}
            ]}
        ]
    }
    
    # Filter by target audience (reuse existing logic)
    user = await db.users.find_one({"username": username})
    if user:
        user_role = user.get("role") or user.get("role_name") or "free_user"
        
        if user_role == "admin":
            audience_groups = ["all", "authenticated", "admins"]
        elif user_role == "premium_user":
            audience_groups = ["all", "authenticated", "premium"]
        else:
            audience_groups = ["all", "authenticated", "free"]
        
        announcement_query["targetAudience"] = {"$in": audience_groups}
        
        # Exclude dismissed announcements
        dismissed_ids = await db.announcement_dismissals.find(
            {"username": username}
        ).distinct("announcementId")
        
        if dismissed_ids:
            announcement_query["_id"] = {"$nin": [ObjectId(aid) for aid in dismissed_ids if ObjectId.is_valid(aid)]}
    
    # Fetch announcements
    announcements = await db.announcements.find(announcement_query).to_list(100)
    
    # Convert announcements to ticker items
    priority_map = {
        "urgent": 1,
        "high": 2,
        "medium": 5,
        "low": 7
    }
    
    for announcement in announcements:
        items.append({
            "type": "announcement",
            "subtype": announcement.get("type", "info"),
            "icon": announcement.get("icon") or get_announcement_icon(announcement),
            "text": announcement["message"],
            "link": announcement.get("link"),
            "linkText": announcement.get("linkText"),
            "priority": priority_map.get(announcement.get("priority", "medium"), 5),
            "dismissible": announcement.get("dismissible", True),
            "announcementId": str(announcement["_id"])
        })
    
    # ===== 2. USER ACTION ITEMS (High Priority) =====
    # These show INDIVIDUAL items with specific user names from live data
    
    # Pending PII requests - Show individual requests with requester names (Priority 3)
    if settings.enablePiiRequests:
        pending_requests = await db.pii_requests.find({
            "profileUsername": username,
            "status": "pending"
        }).sort("requestedAt", -1).limit(settings.piiRequestsLimit).to_list(settings.piiRequestsLimit)
    else:
        pending_requests = []
    
    for req in pending_requests:
        # Only show requests from active users
        requester = await db.users.find_one({"username": req["requesterUsername"], "accountStatus": "active"})
        if requester:
            requester_name = f"{requester.get('firstName', '')} {requester.get('lastName', '')}".strip() or req["requesterUsername"]
            request_type_label = {
                "contact_email": "email",
                "contact_number": "phone",
                "linkedin_url": "LinkedIn",
                "images": "photos"
            }.get(req["requestType"], req["requestType"])
            
            items.append({
                "type": "action_required",
                "subtype": "pii_request",
                "icon": "📸",
                "text": f"{requester_name} requested access to your {request_type_label}",
                "link": "/pii-management?tab=inbox",
                "priority": 3,
                "dismissible": False,
                "metadata": {
                    "requestId": str(req["_id"]),
                    "requesterUsername": req["requesterUsername"]
                }
            })
    
    # Expiring PII access - Show individual expiring grants with names (Priority 3)
    if settings.enableExpiringAccess:
        expiring_soon = now + timedelta(days=settings.expiringAccessDays)
        expiring_grants = await db.pii_access.find({
            "grantedToUsername": username,
            "isActive": True,
            "expiresAt": {"$lte": expiring_soon, "$gte": now}
        }).sort("expiresAt", 1).limit(settings.expiringAccessLimit).to_list(settings.expiringAccessLimit)
    else:
        expiring_grants = []
    
    for grant in expiring_grants:
        # Only show access to active users
        granter = await db.users.find_one({"username": grant["granterUsername"], "accountStatus": "active"})
        if granter:
            granter_name = f"{granter.get('firstName', '')} {granter.get('lastName', '')}".strip() or grant["granterUsername"]
            days_left = (grant["expiresAt"] - now).days
            
            items.append({
                "type": "action_required",
                "subtype": "pii_expiring",
                "icon": "⏰",
                "text": f"Access to {granter_name}'s info expires in {days_left} day{'s' if days_left != 1 else ''}",
                "link": "/pii-management?tab=sent",
                "priority": 3,
                "dismissible": False,
                "metadata": {
                    "grantId": str(grant["_id"]),
                    "granterUsername": grant["granterUsername"]
                }
            })
    
    # Unread messages - Show individual messages with sender names (Priority 3)
    if settings.enableMessages:
        unread_msgs = await db.messages.find({
            "recipientUsername": username,
            "read": False
        }).sort("sentAt", -1).limit(settings.messagesLimit).to_list(settings.messagesLimit)
    else:
        unread_msgs = []
    
    for msg in unread_msgs:
        # Only show messages from active users
        sender = await db.users.find_one({"username": msg["senderUsername"], "accountStatus": "active"})
        if sender:
            sender_name = f"{sender.get('firstName', '')} {sender.get('lastName', '')}".strip() or msg["senderUsername"]
            # Truncate message preview to 40 chars
            preview = msg.get("content", "")[:40]
            if len(msg.get("content", "")) > 40:
                preview += "..."
            
            items.append({
                "type": "action_required",
                "subtype": "message",
                "icon": "💬",
                "text": f"New message from {sender_name}: \"{preview}\"",
                "link": "/messages",
                "priority": 3,
                "dismissible": False,
                "metadata": {
                    "messageId": str(msg["_id"]),
                    "senderUsername": msg["senderUsername"]
                }
            })
    
    # ===== 3. USER STATS (Medium Priority) =====
    # These show INDIVIDUAL activity items with specific user names from live data
    
    # Profile views - Show latest viewers (Priority 4)
    if settings.enableProfileViews:
        recent_views = await db.profile_views.find({
            "profileUsername": username
        }).sort("lastViewedAt", -1).limit(settings.profileViewsLimit).to_list(settings.profileViewsLimit)
    else:
        recent_views = []
    
    for view in recent_views:
        # Only show views from active users
        viewer = await db.users.find_one({"username": view["viewedByUsername"], "accountStatus": "active"})
        if viewer:
            viewer_name = f"{viewer.get('firstName', '')} {viewer.get('lastName', '')}".strip() or view["viewedByUsername"]
            
            # Calculate time ago
            time_diff = now - view["lastViewedAt"]
            total_seconds = int(time_diff.total_seconds())
            if total_seconds < 3600:
                time_ago = f"{total_seconds // 60}m ago"
            elif total_seconds < 86400:
                time_ago = f"{total_seconds // 3600}h ago"
            else:
                days = total_seconds // 86400
                time_ago = f"{days}d ago"
            
            items.append({
                "type": "stat",
                "subtype": "profile_view",
                "icon": "👁️",
                "text": f"{viewer_name} viewed your profile {time_ago}",
                "link": f"/profile/{view['viewedByUsername']}",
                "priority": 4,
                "dismissible": True,
                "metadata": {
                    "viewerUsername": view["viewedByUsername"],
                    "viewedAt": view["lastViewedAt"].isoformat()
                }
            })
    
    # New favorites - Show latest users who favorited (Priority 4)
    # DB fields: userUsername (who favorited), favoriteUsername (who was favorited)
    if settings.enableFavorites:
        new_favs = await db.favorites.find({
            "favoriteUsername": username
        }).sort("createdAt", -1).limit(settings.favoritesLimit).to_list(settings.favoritesLimit)
    else:
        new_favs = []
    
    for fav in new_favs:
        # Only show favorites from active users
        favoriter = await db.users.find_one({"username": fav["userUsername"], "accountStatus": "active"})
        if favoriter:
            favoriter_name = f"{favoriter.get('firstName', '')} {favoriter.get('lastName', '')}".strip() or fav["userUsername"]
            
            items.append({
                "type": "stat",
                "subtype": "favorite",
                "icon": "⭐",
                "text": f"{favoriter_name} added you to favorites",
                "link": f"/profile/{fav['userUsername']}",
                "priority": 4,
                "dismissible": True,
                "metadata": {
                    "favoriterUsername": fav["userUsername"],
                    "favoritedAt": fav["createdAt"].isoformat()
                }
            })
    
    # New shortlists - Show latest users who shortlisted (Priority 4)
    # DB fields: userUsername (who shortlisted), shortlistedUsername (who was shortlisted)
    if settings.enableShortlists:
        new_shortlists = await db.shortlists.find({
            "shortlistedUsername": username
        }).sort("createdAt", -1).limit(settings.shortlistsLimit).to_list(settings.shortlistsLimit)
    else:
        new_shortlists = []
    
    for shortlist in new_shortlists:
        # Only show shortlists from active users
        shortlister = await db.users.find_one({"username": shortlist["userUsername"], "accountStatus": "active"})
        if shortlister:
            shortlister_name = f"{shortlister.get('firstName', '')} {shortlister.get('lastName', '')}".strip() or shortlist["userUsername"]
            
            items.append({
                "type": "stat",
                "subtype": "shortlist",
                "icon": "📋",
                "text": f"{shortlister_name} added you to shortlist",
                "link": f"/profile/{shortlist['userUsername']}",
                "priority": 4,
                "dismissible": True,
                "metadata": {
                    "shortlisterUsername": shortlist["userUsername"],
                    "shortlistedAt": shortlist["createdAt"].isoformat()
                }
            })
    
    # ===== 3.5. SAVED SEARCH MATCHES (Priority 4) =====
    # Show recent saved search notifications with match counts
    
    if settings.enableSavedSearchMatches:
        cutoff_date = now - timedelta(days=settings.savedSearchMatchesDays)
        
        # Get recent saved search notifications for this user
        recent_notifications = await db.saved_search_notifications.find({
            "username": username,
            "last_notification_at": {"$gte": cutoff_date}
        }).sort("last_notification_at", -1).limit(settings.savedSearchMatchesLimit).to_list(settings.savedSearchMatchesLimit)
        
        for notification in recent_notifications:
            search_id = notification.get("search_id")
            if not search_id:
                continue
            
            # Get the saved search details
            try:
                saved_search = await db.saved_searches.find_one({"_id": ObjectId(search_id)})
            except Exception:
                saved_search = None
            
            if not saved_search:
                continue
            
            search_name = saved_search.get("name", "Saved Search")
            match_count = len(notification.get("notified_matches", []))
            last_notified = notification.get("last_notification_at", now)
            
            # Calculate time ago
            time_diff = now - last_notified
            total_seconds = int(time_diff.total_seconds())
            if total_seconds < 3600:
                time_ago = f"{max(1, total_seconds // 60)}m ago"
            elif total_seconds < 86400:
                time_ago = f"{total_seconds // 3600}h ago"
            else:
                days = total_seconds // 86400
                time_ago = f"{days}d ago"
            
            items.append({
                "type": "stat",
                "subtype": "saved_search_match",
                "icon": "🔍",
                "text": f"{match_count} new match{'es' if match_count != 1 else ''} for \"{search_name}\" {time_ago}",
                "link": f"/search?savedSearchId={search_id}",
                "priority": 4,
                "dismissible": True,
                "metadata": {
                    "searchId": search_id,
                    "searchName": search_name,
                    "matchCount": match_count,
                    "notifiedAt": last_notified.isoformat()
                }
            })
    
    # ===== 4. TIPS & INSIGHTS (Lower Priority) =====
    
    if settings.enableTips and user:
        # Profile completion tip - Priority 6
        completion = calculate_profile_completion(user)
        if completion < 80:
            items.append({
                "type": "tip",
                "subtype": "profile_completion",
                "icon": "💡",
                "text": f"Profile {completion}% complete - Add more details to increase visibility",
                "link": "/edit-profile",
                "priority": 6,
                "dismissible": True
            })
        
        # Photo tip - Priority 6
        if not user.get("images") or len(user.get("images", [])) < 3:
            items.append({
                "type": "tip",
                "subtype": "add_photos",
                "icon": "📸",
                "text": "Profiles with 3+ photos get 5x more views",
                "link": "/edit-profile",
                "priority": 6,
                "dismissible": True
            })
        
        # L3V3L matching tip - always show if no other tips
        if completion >= 80 and len(user.get("images", [])) >= 3:
            items.append({
                "type": "tip",
                "subtype": "l3v3l_tip",
                "icon": "🦋",
                "text": "Try L3V3L Matches for AI-powered compatibility scoring",
                "link": "/l3v3l-matches",
                "priority": 6,
                "dismissible": True
            })
    
    # ===== 5. SORT BY PRIORITY =====
    
    items.sort(key=lambda x: x["priority"])
    
    # Limit to configured total items limit
    items = items[:settings.totalItemsLimit]
    
    # Increment view count for announcements
    for item in items:
        if item["type"] == "announcement" and "announcementId" in item:
            await db.announcements.update_one(
                {"_id": ObjectId(item["announcementId"])},
                {"$inc": {"viewCount": 1}}
            )
    
    logger.info(f"✅ Generated {len(items)} ticker items for {username}")
    return {"items": items}


@router.post("/dismiss")
async def dismiss_ticker_item(
    item_type: str = Query(...),
    item_id: Optional[str] = Query(None),
    username: str = Query(...),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Dismiss a ticker item
    
    - For announcements: Record in announcement_dismissals
    - For tips: Record in user_preferences.dismissedTips
    - For stats: No dismissal needed (auto-refresh)
    """
    
    if item_type == "announcement" and item_id:
        # Use existing announcement dismissal system
        existing = await db.announcement_dismissals.find_one({
            "announcementId": item_id,
            "username": username
        })
        
        if not existing:
            await db.announcement_dismissals.insert_one({
                "announcementId": item_id,
                "username": username,
                "dismissedAt": datetime.utcnow()
            })
            
            # Increment dismiss count
            await db.announcements.update_one(
                {"_id": ObjectId(item_id)},
                {"$inc": {"dismissCount": 1}}
            )
        
        logger.info(f"✅ User {username} dismissed announcement {item_id}")
        return {"message": "Announcement dismissed"}
    
    elif item_type == "tip":
        # Store dismissed tips in user preferences
        await db.users.update_one(
            {"username": username},
            {
                "$addToSet": {
                    "dismissedTips": {
                        "type": item_id,
                        "dismissedAt": datetime.utcnow()
                    }
                }
            }
        )
        logger.info(f"✅ User {username} dismissed tip {item_id}")
        return {"message": "Tip dismissed"}
    
    else:
        return {"message": "Item type not dismissible"}


def get_announcement_icon(announcement):
    """Get default icon based on announcement type and priority"""
    type_icons = {
        "info": "ℹ️",
        "warning": "⚠️",
        "error": "❌",
        "success": "✅",
        "maintenance": "🔧",
        "promotion": "🎉"
    }
    
    priority_icons = {
        "urgent": "🚨",
        "high": "⚠️",
        "medium": "📢",
        "low": "💬"
    }
    
    # Priority takes precedence for urgent/high
    if announcement.get("priority") in ["urgent", "high"]:
        return priority_icons[announcement["priority"]]
    
    return type_icons.get(announcement.get("type", "info"), "📢")


def calculate_profile_completion(user):
    """Calculate profile completion percentage"""
    fields = [
        "firstName", "lastName", "age", "gender", "location",
        "occupation", "education", "bio", "interests",
        "contactEmail", "contactNumber", "images"
    ]
    
    filled = sum(1 for field in fields if user.get(field))
    return int((filled / len(fields)) * 100)


@router.get("/settings")
async def get_ticker_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Get ticker configuration settings (admin only)
    """
    user_role = current_user.get("role") or current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Load settings from database
    settings = await db.ticker_settings.find_one({"_id": "global"})
    
    if not settings:
        # Return defaults
        return TickerSettings().dict()
    
    # Remove MongoDB _id field
    settings.pop("_id", None)
    return settings


@router.post("/settings")
async def save_ticker_settings(
    settings: TickerSettings,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """
    Save ticker configuration settings (admin only)
    """
    user_role = current_user.get("role") or current_user.get("role_name")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Save settings to database
    await db.ticker_settings.update_one(
        {"_id": "global"},
        {"$set": settings.dict()},
        upsert=True
    )
    
    logger.info(f"✅ Admin {current_user['username']} updated ticker settings")
    return {"message": "Settings saved successfully", "settings": settings.dict()}
