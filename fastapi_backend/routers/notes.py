"""
Profile Notes Router
Allows users to save private notes about profiles they're interested in.
Notes auto-purge after 90 days.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
import logging

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notes", tags=["notes"])

# Constants
NOTE_EXPIRY_DAYS = 90
NOTE_WARNING_DAYS = 7  # Show warning when note expires within 7 days


class NoteCreate(BaseModel):
    """Request model for creating a note"""
    targetUsername: str = Field(..., description="Username of the profile being noted")
    note: str = Field(..., max_length=2000, description="Note content")


class NoteUpdate(BaseModel):
    """Request model for updating a note"""
    note: str = Field(..., max_length=2000, description="Updated note content")


class NoteResponse(BaseModel):
    """Response model for a note"""
    id: str
    username: str
    targetUsername: str
    targetFirstName: Optional[str] = None
    targetProfileImage: Optional[str] = None
    note: str
    createdAt: datetime
    updatedAt: datetime
    daysUntilExpiry: int
    isExpiringSoon: bool  # True if expires within 7 days


def serialize_note(note: dict, target_user: dict = None) -> dict:
    """Serialize a note document for API response"""
    now = datetime.utcnow()
    updated_at = note.get("updatedAt", note.get("createdAt", now))
    days_since_update = (now - updated_at).days
    days_until_expiry = max(0, NOTE_EXPIRY_DAYS - days_since_update)
    
    return {
        "id": str(note["_id"]),
        "username": note["username"],
        "targetUsername": note["targetUsername"],
        "targetFirstName": target_user.get("firstName", "") if target_user else note.get("targetFirstName", ""),
        "targetProfileImage": target_user.get("profileImage", "") if target_user else note.get("targetProfileImage", ""),
        "note": note["note"],
        "createdAt": note.get("createdAt", now),
        "updatedAt": updated_at,
        "daysUntilExpiry": days_until_expiry,
        "isExpiringSoon": days_until_expiry <= NOTE_WARNING_DAYS
    }


@router.get("")
async def get_notes(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all notes for the current user"""
    try:
        username = current_user["username"]
        
        # Get all notes for this user, sorted by most recently updated
        notes_cursor = db.profile_notes.find(
            {"username": username}
        ).sort("updatedAt", -1)
        
        notes = await notes_cursor.to_list(length=500)
        
        # Get target user info for each note
        target_usernames = [n["targetUsername"] for n in notes]
        target_users = {}
        
        if target_usernames:
            users_cursor = db.users.find(
                {"username": {"$in": target_usernames}},
                {"username": 1, "firstName": 1, "profileImage": 1}
            )
            async for user in users_cursor:
                target_users[user["username"]] = user
        
        # Serialize notes with target user info
        result = []
        for note in notes:
            target_user = target_users.get(note["targetUsername"])
            result.append(serialize_note(note, target_user))
        
        return {
            "success": True,
            "notes": result,
            "count": len(result)
        }
        
    except Exception as e:
        logger.error(f"Error fetching notes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/available-profiles")
async def get_available_profiles_for_note(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get profiles from Messages, Favorites, and Shortlists that can have notes added.
    IMPORTANT: This route must be defined BEFORE /{target_username} routes!
    """
    try:
        username = current_user["username"]
        logger.info(f"📝 Getting available profiles for notes for user: {username}")
        
        # Get profiles that already have notes
        existing_notes = await db.profile_notes.distinct(
            "targetUsername",
            {"username": username}
        )
        logger.info(f"📝 Existing notes for: {existing_notes}")
        
        # Get usernames from Messages (conversations)
        # Note: messages collection uses fromUsername/toUsername fields
        message_usernames = set()
        conversations = await db.messages.aggregate([
            {"$match": {"$or": [{"fromUsername": username}, {"toUsername": username}]}},
            {"$group": {"_id": None, "users": {"$addToSet": "$fromUsername"}, "users2": {"$addToSet": "$toUsername"}}}
        ]).to_list(length=1)
        
        logger.info(f"📝 Raw conversations result: {conversations}")
        
        if conversations:
            conv = conversations[0]
            message_usernames = set(conv.get("users", [])) | set(conv.get("users2", []))
            message_usernames.discard(username)  # Remove self
        
        logger.info(f"📝 Message usernames: {message_usernames}")
        
        # Get usernames from Favorites
        favorites_doc = await db.favorites.find_one({"username": username})
        favorite_usernames = set(favorites_doc.get("favorites", [])) if favorites_doc else set()
        logger.info(f"📝 Favorite usernames: {favorite_usernames}")
        
        # Get usernames from Shortlists
        shortlist_doc = await db.shortlists.find_one({"username": username})
        shortlist_usernames = set(shortlist_doc.get("shortlist", [])) if shortlist_doc else set()
        logger.info(f"📝 Shortlist usernames: {shortlist_usernames}")
        
        # Combine all usernames and exclude those with existing notes
        all_usernames = (message_usernames | favorite_usernames | shortlist_usernames) - set(existing_notes)
        logger.info(f"📝 Combined usernames (after excluding existing notes): {all_usernames}")
        
        if not all_usernames:
            return {
                "success": True,
                "profiles": [],
                "message": "No profiles available. Add profiles to Messages, Favorites, or Shortlists first."
            }
        
        # Get profile details for these usernames
        profiles_cursor = db.users.find(
            {"username": {"$in": list(all_usernames)}},
            {"username": 1, "firstName": 1, "lastName": 1, "profileImage": 1}
        ).sort("firstName", 1)
        
        profiles = await profiles_cursor.to_list(length=100)
        
        # Categorize profiles by source
        result = []
        for p in profiles:
            uname = p["username"]
            sources = []
            if uname in message_usernames:
                sources.append("messages")
            if uname in favorite_usernames:
                sources.append("favorites")
            if uname in shortlist_usernames:
                sources.append("shortlist")
            
            result.append({
                "username": uname,
                "firstName": p.get("firstName", ""),
                "lastName": p.get("lastName", ""),
                "profileImage": p.get("profileImage", ""),
                "displayName": f"{p.get('firstName', '')} {p.get('lastName', '')}".strip() or uname,
                "sources": sources
            })
        
        logger.info(f"📝 Returning {len(result)} available profiles")
        return {
            "success": True,
            "profiles": result,
            "count": len(result)
        }
        
    except Exception as e:
        logger.error(f"Error getting available profiles: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_note(
    note_data: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a new note for a profile"""
    try:
        username = current_user["username"]
        
        # Check if note already exists for this target
        existing = await db.profile_notes.find_one({
            "username": username,
            "targetUsername": note_data.targetUsername
        })
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail="Note already exists for this profile. Use PUT to update."
            )
        
        # Get target user info
        target_user = await db.users.find_one(
            {"username": note_data.targetUsername},
            {"firstName": 1, "profileImage": 1}
        )
        
        if not target_user:
            raise HTTPException(status_code=404, detail="Target profile not found")
        
        # Create the note
        now = datetime.utcnow()
        note_doc = {
            "username": username,
            "targetUsername": note_data.targetUsername,
            "targetFirstName": target_user.get("firstName", ""),
            "targetProfileImage": target_user.get("profileImage", ""),
            "note": note_data.note,
            "createdAt": now,
            "updatedAt": now
        }
        
        result = await db.profile_notes.insert_one(note_doc)
        note_doc["_id"] = result.inserted_id
        
        logger.info(f"📝 Note created by {username} for {note_data.targetUsername}")
        
        return {
            "success": True,
            "message": "Note created successfully",
            "note": serialize_note(note_doc, target_user)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating note: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{target_username}")
async def update_note(
    target_username: str,
    note_data: NoteUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update an existing note (auto-save)"""
    try:
        username = current_user["username"]
        
        # Find and update the note
        result = await db.profile_notes.find_one_and_update(
            {
                "username": username,
                "targetUsername": target_username
            },
            {
                "$set": {
                    "note": note_data.note,
                    "updatedAt": datetime.utcnow()
                }
            },
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Get target user info
        target_user = await db.users.find_one(
            {"username": target_username},
            {"firstName": 1, "profileImage": 1}
        )
        
        logger.info(f"📝 Note updated by {username} for {target_username}")
        
        return {
            "success": True,
            "message": "Note updated successfully",
            "note": serialize_note(result, target_user)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating note: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{target_username}")
async def delete_note(
    target_username: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a note"""
    try:
        username = current_user["username"]
        
        result = await db.profile_notes.delete_one({
            "username": username,
            "targetUsername": target_username
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        
        logger.info(f"🗑️ Note deleted by {username} for {target_username}")
        
        return {
            "success": True,
            "message": "Note deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting note: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def purge_expired_notes(db) -> int:
    """
    Purge notes older than 90 days.
    Called by the scheduler job.
    Returns the number of notes deleted.
    """
    try:
        expiry_date = datetime.utcnow() - timedelta(days=NOTE_EXPIRY_DAYS)
        
        result = await db.profile_notes.delete_many({
            "updatedAt": {"$lt": expiry_date}
        })
        
        if result.deleted_count > 0:
            logger.info(f"🗑️ Purged {result.deleted_count} expired notes (older than {NOTE_EXPIRY_DAYS} days)")
        
        return result.deleted_count
        
    except Exception as e:
        logger.error(f"Error purging expired notes: {e}", exc_info=True)
        return 0
