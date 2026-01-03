"""
Poll Routes
API endpoints for the polling system
"""

import logging
import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from models.poll_models import (
    PollCreate, PollUpdate, PollResponseCreate, PollStatus
)
from services.poll_service import PollService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/polls", tags=["polls"])


# ==================== USER ENDPOINTS ====================

@router.get("/active")
async def get_active_polls(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all active polls for the current user"""
    # Non-active users cannot see/respond to polls
    if current_user.get("accountStatus") != "active":
        return {"success": True, "polls": [], "count": 0}
        
    service = PollService(db)
    t0 = time.perf_counter()
    polls = await service.get_active_polls_for_user(current_user["username"])
    svc_s = time.perf_counter() - t0
    svc_ms = svc_s * 1000.0

    response.headers["Server-Timing"] = f"polls_svc;dur={svc_ms:.2f}"
    response.headers["X-Polls-Service-Time"] = f"{svc_s:.3f}"
    return {
        "success": True,
        "polls": polls,
        "count": len(polls)
    }


@router.get("/{poll_id}")
async def get_poll(
    poll_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get a specific poll"""
    service = PollService(db)
    poll = await service.get_poll(poll_id, include_stats=False)
    
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    
    # Check if user has responded
    existing = await db.poll_responses.find_one({
        "poll_id": poll_id,
        "username": current_user["username"]
    })
    
    poll["user_has_responded"] = existing is not None
    if existing:
        existing["_id"] = str(existing["_id"])
        poll["user_response"] = existing
    
    return {
        "success": True,
        "poll": poll
    }


@router.post("/{poll_id}/respond")
async def submit_poll_response(
    poll_id: str,
    response_data: PollResponseCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Submit a response to a poll"""
    # Ensure poll_id matches
    response_data.poll_id = poll_id
    
    service = PollService(db)
    result = await service.submit_response(response_data, current_user["username"])
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.put("/{poll_id}/respond")
async def update_poll_response(
    poll_id: str,
    response_data: PollResponseCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update an existing response to a poll"""
    response_data.poll_id = poll_id
    
    service = PollService(db)
    result = await service.update_response(poll_id, current_user["username"], response_data)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


# ==================== ADMIN ENDPOINTS ====================

def require_admin_or_moderator(current_user: dict = Depends(get_current_user)):
    """Dependency to require admin or moderator role"""
    # Check both role and role_name fields for status
    role = current_user.get("role") or current_user.get("role_name")
    if role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Admin or Moderator access required")
    return current_user


@router.post("/admin/create")
async def create_poll(
    poll_data: PollCreate,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a new poll (admin only)"""
    service = PollService(db)
    result = await service.create_poll(poll_data, current_user["username"])
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.get("/admin/list")
async def list_polls(
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """List all polls with optional filtering (admin only)"""
    service = PollService(db)
    
    poll_status = None
    if status:
        try:
            poll_status = PollStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    result = await service.list_polls(
        status=poll_status,
        page=page,
        page_size=page_size,
        include_stats=True
    )
    
    return {
        "success": True,
        **result
    }


@router.put("/admin/{poll_id}")
async def update_poll(
    poll_id: str,
    poll_data: PollUpdate,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update a poll (admin only)"""
    service = PollService(db)
    result = await service.update_poll(poll_id, poll_data)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.delete("/admin/{poll_id}")
async def delete_poll(
    poll_id: str,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a poll and all its responses (admin only)"""
    service = PollService(db)
    result = await service.delete_poll(poll_id)
    
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    
    return result


@router.post("/admin/{poll_id}/activate")
async def activate_poll(
    poll_id: str,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Activate a poll (admin only)"""
    service = PollService(db)
    result = await service.set_poll_status(poll_id, PollStatus.ACTIVE)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.post("/admin/{poll_id}/close")
async def close_poll(
    poll_id: str,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Close a poll (admin only)"""
    service = PollService(db)
    result = await service.set_poll_status(poll_id, PollStatus.CLOSED)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.post("/admin/{poll_id}/archive")
async def archive_poll(
    poll_id: str,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Archive a poll (admin only)"""
    service = PollService(db)
    result = await service.set_poll_status(poll_id, PollStatus.ARCHIVED)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.get("/admin/{poll_id}/results")
async def get_poll_results(
    poll_id: str,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get detailed poll results (admin only)"""
    service = PollService(db)
    result = await service.get_poll_results(poll_id)
    
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    
    return result


@router.get("/admin/{poll_id}/export")
async def export_poll_responses(
    poll_id: str,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Export poll responses for download (admin only)"""
    service = PollService(db)
    
    # Get poll info
    poll = await service.get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    
    # Get export data
    export_data = await service.export_responses(poll_id)
    
    return {
        "success": True,
        "poll_title": poll["title"],
        "export_date": datetime.utcnow().isoformat(),
        "total_responses": len(export_data),
        "data": export_data
    }
