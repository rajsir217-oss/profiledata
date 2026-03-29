"""
Virtual Meets API Routes

RSVP-driven match list + 1:1 virtual room flow + payment gate.
"""

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from services.virtual_meet_service import VirtualMeetService
from models.virtual_meet_models import (
    RoomRequestCreate,
    RoomRequestRespond,
    VirtualMeetPaymentRequest,
    VirtualMeetPaymentConfirm,
    AdminPairRequest,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/virtual-meets", tags=["Virtual Meets"])


# ─── Events List ──────────────────────────────────────────────────────────────

@router.get("/events")
async def get_virtual_meet_events(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List all active polls the user RSVPed "Yes" to that have Virtual Meet capability.
    """
    username = current_user.get("username")
    user_role = current_user.get("role") or current_user.get("role_name") or "free_user"

    try:
        events = await VirtualMeetService.get_user_events(db, username, user_role)
        return {"success": True, "events": events}
    except Exception as e:
        logger.error(f"Error fetching virtual meet events for {username}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch events")


# ─── Match List ───────────────────────────────────────────────────────────────

@router.get("/{poll_id}/matches")
async def get_match_list(
    poll_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get opposite-gender match list for the user in a specific poll.
    Requires RSVP "Yes" and payment (if zoom-call event).
    """
    username = current_user.get("username")
    user_role = current_user.get("role") or current_user.get("role_name") or "free_user"

    result = await VirtualMeetService.get_match_list(db, poll_id, username, user_role)

    if not result.get("success"):
        if result.get("payment_required"):
            raise HTTPException(status_code=402, detail=result.get("error", "Payment required"))
        raise HTTPException(status_code=403, detail=result.get("error", "Access denied"))

    return result


# ─── Room Request ─────────────────────────────────────────────────────────────

@router.post("/{poll_id}/request-room")
async def send_room_request(
    poll_id: str,
    request: RoomRequestCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Send a 1:1 virtual room request to another participant."""
    username = current_user.get("username")
    user_role = current_user.get("role") or current_user.get("role_name") or "free_user"

    result = await VirtualMeetService.send_room_request(
        db, poll_id, username, request.target_username, user_role
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# ─── Room Request Response ────────────────────────────────────────────────────

@router.post("/{poll_id}/respond-request")
async def respond_to_request(
    poll_id: str,
    request: RoomRequestRespond,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Accept or decline a room request."""
    username = current_user.get("username")

    result = await VirtualMeetService.respond_to_request(
        db, poll_id, username, request.request_id, request.action, request.note
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# ─── My Rooms ─────────────────────────────────────────────────────────────────

@router.get("/{poll_id}/my-rooms")
async def get_my_rooms(
    poll_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all confirmed rooms for the user in a poll."""
    username = current_user.get("username")

    rooms = await VirtualMeetService.get_user_rooms(db, poll_id, username)
    return {"success": True, "rooms": rooms}


# ─── Payment ──────────────────────────────────────────────────────────────────

@router.post("/{poll_id}/pay")
async def initiate_payment(
    poll_id: str,
    request: VirtualMeetPaymentRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Initiate payment for a zoom-call event.
    Returns PayPal order_id or Clover checkout_url for frontend processing.
    """
    username = current_user.get("username")

    result = await VirtualMeetService.initiate_payment(
        db, poll_id, username, request.payment_method
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/{poll_id}/confirm-payment")
async def confirm_payment(
    poll_id: str,
    request: VirtualMeetPaymentConfirm,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Capture/confirm payment after user approval.
    Unlocks access to match list and room features.
    """
    username = current_user.get("username")

    result = await VirtualMeetService.confirm_payment(
        db, poll_id, username, request.order_id, request.payment_method
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# ─── Admin Endpoints ──────────────────────────────────────────────────────────

@router.get("/{poll_id}/admin/overview")
async def admin_overview(
    poll_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Admin overview of a virtual meet event (participants, rooms, stats)."""
    user_role = current_user.get("role") or current_user.get("role_name") or "free_user"
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await VirtualMeetService.admin_overview(db, poll_id)

    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))

    return result


@router.post("/{poll_id}/admin/pair")
async def admin_pair_users(
    poll_id: str,
    request: AdminPairRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Admin force-pairs two users into a virtual room."""
    user_role = current_user.get("role") or current_user.get("role_name") or "free_user"
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    admin_username = current_user.get("username")

    result = await VirtualMeetService.admin_pair_users(
        db, poll_id, request.user_a, request.user_b, admin_username
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/{poll_id}/admin/expire-rooms")
async def admin_expire_rooms(
    poll_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Admin manually expires unused rooms and pending requests for a poll."""
    user_role = current_user.get("role") or current_user.get("role_name") or "free_user"
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await VirtualMeetService.expire_unused_rooms(db, poll_id)
    return {"success": True, **result}
