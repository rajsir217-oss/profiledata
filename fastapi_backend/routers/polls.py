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
from pydantic import BaseModel

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from models.poll_models import (
    PollCreate, PollUpdate, PollResponseCreate, PollStatus
)
from services.poll_service import PollService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/polls", tags=["polls"])


class AdminOnBehalfRsvpRequest(BaseModel):
    username: str
    rsvp_response: str
    comment: Optional[str] = None
    payment_status: Optional[str] = None


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


@router.post("/{poll_id}/pay-and-respond")
async def pay_and_respond(
    poll_id: str,
    response_data: PollResponseCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Submit a poll response with payment for Virtual Meet / paid events.

    Security:
      - PayPal: server-side captures the order AND verifies the captured
        amount matches the poll's expected amount (within 1 cent).
      - Clover: server-side fetches the charge and verifies status="paid"
        and amount matches the expected amount.
      - The persisted payment_amount and payment_status are derived from the
        verified provider response, never from the client-supplied payload.
    """
    # Ensure poll_id matches
    response_data.poll_id = poll_id

    service = PollService(db)

    # First check if payment is required
    poll = await service.get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    # Check if this is a Virtual Meet poll with "Yes" response
    if not (poll.get("event_type") and poll.get("event_type") in ["in-person", "virtual", "zoom-call", "hybrid"]):
        raise HTTPException(status_code=400, detail="Payment not required for this poll")

    # Expected amount in dollars. Reject if poll has no configured amount.
    expected_amount = poll.get("virtual_meet_payment_amount")
    if expected_amount is None or float(expected_amount) <= 0:
        raise HTTPException(status_code=400, detail="Poll payment amount is not configured")
    expected_amount = float(expected_amount)

    if not response_data.payment_id:
        raise HTTPException(status_code=400, detail="Missing payment id")

    # ---- PayPal verification ----
    if response_data.payment_method == "paypal":
        from services.paypal_service import paypal_service

        result = await paypal_service.capture_order(response_data.payment_id)
        if not result.get("success"):
            logger.warning(
                f"[pay-and-respond] PayPal capture failed user={current_user.get('username')} "
                f"poll={poll_id} order={response_data.payment_id} error={result.get('error')}"
            )
            raise HTTPException(status_code=400, detail=result.get("error", "PayPal payment failed"))

        # PayPal returns amount as a string in dollars (e.g., "5.00").
        try:
            captured_amount = float(result.get("amount") or 0)
        except (TypeError, ValueError):
            captured_amount = 0.0

        if abs(captured_amount - expected_amount) > 0.01:
            logger.error(
                f"[pay-and-respond] PayPal amount mismatch user={current_user.get('username')} "
                f"poll={poll_id} expected={expected_amount} captured={captured_amount}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"Payment amount mismatch (expected ${expected_amount:.2f})",
            )

        response_data.payment_status = "completed"
        response_data.payment_amount = captured_amount
        # Persist the provider's capture id for traceability/idempotency.
        response_data.payment_id = result.get("capture_id") or response_data.payment_id

    # ---- Clover verification ----
    elif response_data.payment_method == "clover":
        from services.clover_service import clover_service

        result = await clover_service.get_charge(response_data.payment_id)
        if not result.get("success"):
            logger.warning(
                f"[pay-and-respond] Clover charge lookup failed user={current_user.get('username')} "
                f"poll={poll_id} charge={response_data.payment_id} error={result.get('error')}"
            )
            raise HTTPException(status_code=400, detail="Could not verify card payment")

        if (result.get("status") or "").lower() not in ("paid", "succeeded"):
            logger.warning(
                f"[pay-and-respond] Clover charge not paid user={current_user.get('username')} "
                f"poll={poll_id} charge={response_data.payment_id} status={result.get('status')}"
            )
            raise HTTPException(status_code=400, detail="Card payment is not in a paid state")

        # Clover returns amount in cents.
        try:
            captured_cents = int(result.get("amount") or 0)
        except (TypeError, ValueError):
            captured_cents = 0
        expected_cents = round(expected_amount * 100)
        if abs(captured_cents - expected_cents) > 1:
            logger.error(
                f"[pay-and-respond] Clover amount mismatch user={current_user.get('username')} "
                f"poll={poll_id} expected_cents={expected_cents} captured_cents={captured_cents}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"Payment amount mismatch (expected ${expected_amount:.2f})",
            )

        response_data.payment_status = "completed"
        response_data.payment_amount = captured_cents / 100.0

    else:
        raise HTTPException(status_code=400, detail="Unsupported payment method")

    # Now submit the response with verified payment info
    result = await service.submit_response(response_data, current_user["username"])

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Bridge the payment into the Virtual Meet session so the user is not
    # asked to pay again on the Virtual Meets page. This upsert is idempotent
    # and only flips access_unlocked to True for the matching poll/user.
    # Failures here must NOT roll back the successful RSVP payment - we log
    # and return success; get_or_create_session() will self-heal on next visit.
    try:
        username = current_user["username"]
        now = datetime.utcnow()

        # Look up gender so a freshly-inserted session is usable for matching.
        # (Existing sessions keep their gender via $set excluding gender.)
        user_doc = await db.users.find_one(
            {"username": username},
            {"gender": 1, "Gender": 1},
        ) or {}
        gender = user_doc.get("gender") or user_doc.get("Gender") or ""

        set_on_insert = {
            "poll_id": poll_id,
            "username": username,
            "event_type": poll.get("event_type"),
            "rsvp_response": "yes",
            "match_list_generated": False,
            "created_at": now,
        }
        if gender in ("Male", "Female"):
            set_on_insert["gender"] = gender

        await db.virtual_meet_sessions.update_one(
            {"poll_id": poll_id, "username": username},
            {
                "$set": {
                    "payment_status": "completed",
                    "payment_id": response_data.payment_id,
                    "payment_provider": response_data.payment_method,
                    "payment_amount": response_data.payment_amount,
                    "access_unlocked": True,
                    "updated_at": now,
                },
                "$setOnInsert": set_on_insert,
            },
            upsert=True,
        )
    except Exception as e:
        logger.error(
            f"[pay-and-respond] Failed to bridge payment to virtual_meet_sessions "
            f"user={current_user.get('username')} poll={poll_id} error={e}"
        )

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


@router.post("/admin/{poll_id}/members")
async def admin_add_poll_member(
    poll_id: str,
    username: str,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = PollService(db)
    result = await service.add_member_to_poll(poll_id=poll_id, username=username, acted_by=current_user["username"])
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message") or "Failed to add member")
    return result


@router.post("/admin/{poll_id}/respond-on-behalf")
async def admin_respond_on_behalf(
    poll_id: str,
    payload: AdminOnBehalfRsvpRequest,
    current_user: dict = Depends(require_admin_or_moderator),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = PollService(db)
    result = await service.admin_upsert_rsvp_response(
        poll_id=poll_id,
        target_username=payload.username,
        rsvp_response=payload.rsvp_response,
        acted_by=current_user["username"],
        comment=payload.comment,
        payment_status=payload.payment_status,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message") or "Failed to submit response")
    return result
