"""
Virtual Meet Service
Business logic for the Virtual Meets system (RSVP-driven match list + 1:1 virtual room flow)
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class VirtualMeetService:
    """Service class for Virtual Meet operations."""

    # ─── Session Management ───────────────────────────────────────────────

    @staticmethod
    async def get_or_create_session(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        username: str,
        user_role: str
    ) -> Dict[str, Any]:
        """
        Get or lazily create a virtual meet session for a user+poll.
        Called when user accesses the Virtual Meets page.
        """
        # Check if session already exists
        session = await db.virtual_meet_sessions.find_one({
            "poll_id": poll_id,
            "username": username
        })

        if session:
            session["_id"] = str(session["_id"])
            return session

        # Get poll details
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        if not poll:
            return None

        # Get user profile for gender
        user = await db.users.find_one(
            {"username": username},
            {"gender": 1, "Gender": 1}
        )
        if not user:
            return None

        gender = user.get("gender") or user.get("Gender") or ""
        if gender not in ("Male", "Female"):
            logger.warning(f"User {username} has invalid gender '{gender}' for Virtual Meets")
            return None

        # Determine payment requirement
        event_type = poll.get("event_type")
        is_exempt = user_role in ("admin", "moderator")
        payment_amount = poll.get("virtual_meet_payment_amount", 5.00) or 5.00

        if event_type == "zoom-call" and not is_exempt:
            payment_status = "pending"
            access_unlocked = False
        else:
            payment_status = "not_required"
            access_unlocked = True

        now = datetime.now(timezone.utc)
        session_doc = {
            "poll_id": poll_id,
            "username": username,
            "gender": gender,
            "event_type": event_type,
            "payment_status": payment_status,
            "payment_amount": payment_amount,
            "payment_id": None,
            "payment_provider": None,
            "paypal_order_id": None,
            "clover_order_id": None,
            "access_unlocked": access_unlocked,
            "rsvp_response": "yes",
            "match_list_generated": False,
            "created_at": now,
            "updated_at": now
        }

        result = await db.virtual_meet_sessions.insert_one(session_doc)
        session_doc["_id"] = str(result.inserted_id)
        return session_doc

    # ─── Events List ──────────────────────────────────────────────────────

    @staticmethod
    async def get_user_events(
        db: AsyncIOMotorDatabase,
        username: str,
        user_role: str
    ) -> List[Dict[str, Any]]:
        """
        Get all active polls the user RSVPed "Yes" to that qualify for Virtual Meets.
        """
        # Get active polls
        polls = await db.polls.find(
            {"status": "active"},
            {
                "title": 1, "event_type": 1, "event_date": 1,
                "event_time": 1, "event_timezone": 1, "event_location": 1,
                "status": 1, "options": 1, "virtual_meet_payment_amount": 1
            }
        ).to_list(length=100)

        events = []
        for poll in polls:
            poll_id = str(poll["_id"])

            # Check if user RSVPed "Yes"
            response = await db.poll_responses.find_one({
                "poll_id": poll_id,
                "username": username
            })

            if not response:
                continue

            # Check if the first selected option is a "Yes" type
            selected_options = response.get("selected_options", [])
            if not selected_options:
                continue

            selected_opt_id = selected_options[0]
            options = poll.get("options", [])
            selected_opt = next((o for o in options if o.get("id") == selected_opt_id), None)
            if not selected_opt:
                continue

            opt_text = (selected_opt.get("text") or "").lower()
            if "yes" not in opt_text and "can join" not in opt_text:
                continue

            # Get or create session
            session = await VirtualMeetService.get_or_create_session(
                db, poll_id, username, user_role
            )
            if not session:
                continue

            # Count matches (opposite gender YES respondents)
            user_gender = session.get("gender")
            opposite_gender = "Female" if user_gender == "Male" else "Male"
            match_count = await db.virtual_meet_sessions.count_documents({
                "poll_id": poll_id,
                "gender": opposite_gender
            })

            # Count user's rooms
            room_count = await db.virtual_rooms.count_documents({
                "poll_id": poll_id,
                "$or": [{"user_a": username}, {"user_b": username}],
                "status": {"$in": ["confirmed", "active"]}
            })

            # Count pending incoming requests
            pending_requests = await db.virtual_room_requests.count_documents({
                "poll_id": poll_id,
                "target_username": username,
                "status": "pending"
            })

            # Check if event is locked (past start time)
            is_locked = VirtualMeetService._is_event_locked(poll)

            events.append({
                "poll_id": poll_id,
                "title": poll.get("title"),
                "event_type": poll.get("event_type"),
                "event_date": poll.get("event_date").isoformat() if poll.get("event_date") else None,
                "event_time": poll.get("event_time"),
                "event_timezone": poll.get("event_timezone"),
                "event_location": poll.get("event_location"),
                "status": poll.get("status"),
                "payment_required": session.get("payment_status") != "not_required",
                "payment_status": session.get("payment_status"),
                "payment_amount": session.get("payment_amount", 5.00),
                "access_unlocked": session.get("access_unlocked", False),
                "match_count": match_count,
                "room_count": room_count,
                "pending_requests_received": pending_requests,
                "is_locked": is_locked
            })

        return events

    # ─── Match List ───────────────────────────────────────────────────────

    @staticmethod
    async def get_match_list(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        username: str,
        user_role: str
    ) -> Dict[str, Any]:
        """
        Get opposite-gender match list for the user in a specific poll.
        Returns matches, incoming requests, and confirmed rooms.
        """
        # Get user's session
        session = await VirtualMeetService.get_or_create_session(
            db, poll_id, username, user_role
        )
        if not session:
            return {"success": False, "error": "Session not found. Check your RSVP and gender profile."}

        # Check access
        if not session.get("access_unlocked"):
            return {"success": False, "error": "Payment required to access match list.", "payment_required": True}

        # Get poll for lock status
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        is_locked = VirtualMeetService._is_event_locked(poll) if poll else False

        user_gender = session.get("gender")
        opposite_gender = "Female" if user_gender == "Male" else "Male"

        # Get all opposite-gender sessions for this poll
        opposite_sessions = await db.virtual_meet_sessions.find({
            "poll_id": poll_id,
            "gender": opposite_gender
        }).to_list(length=500)

        opposite_usernames = [s["username"] for s in opposite_sessions]

        # Get user profiles for all matches
        profiles = {}
        if opposite_usernames:
            cursor = db.users.find(
                {"username": {"$in": opposite_usernames}},
                {
                    "username": 1, "firstName": 1, "lastName": 1,
                    "age": 1, "dateOfBirth": 1,
                    "city": 1, "state": 1, "country": 1,
                    "profession": 1, "occupation": 1,
                    "profileImages": 1
                }
            )
            async for user in cursor:
                uname = user["username"]
                profiles[uname] = user

        # Get all requests involving this user for this poll
        my_sent_requests = await db.virtual_room_requests.find({
            "poll_id": poll_id,
            "requester_username": username
        }).to_list(length=500)

        my_received_requests = await db.virtual_room_requests.find({
            "poll_id": poll_id,
            "target_username": username,
            "status": "pending"
        }).to_list(length=500)

        # Build sent request lookup: target_username -> request
        sent_lookup = {}
        for req in my_sent_requests:
            sent_lookup[req["target_username"]] = req

        # Build match list
        matches = []
        for uname in opposite_usernames:
            profile = profiles.get(uname, {})
            sent_req = sent_lookup.get(uname)

            request_status = None
            request_id = None
            if sent_req:
                request_status = sent_req.get("status")
                request_id = str(sent_req["_id"])

            matches.append({
                "username": uname,
                "full_name": VirtualMeetService._get_full_name(profile),
                "age": VirtualMeetService._calculate_age(profile),
                "location": VirtualMeetService._get_location(profile),
                "profession": profile.get("profession") or profile.get("occupation") or "",
                "profile_pic_url": f"/api/profile-pic/{uname}",
                "request_status": request_status,
                "request_id": request_id
            })

        # Build incoming requests with full profile info
        incoming_requests = []
        for req in my_received_requests:
            from_user = req["requester_username"]
            profile = profiles.get(from_user)
            if not profile:
                # Fetch profile if not in opposite_usernames (shouldn't happen, but safety)
                profile = await db.users.find_one(
                    {"username": from_user},
                    {"username": 1, "firstName": 1, "lastName": 1, "age": 1,
                     "dateOfBirth": 1, "city": 1, "state": 1, "profession": 1, "occupation": 1}
                ) or {}

            incoming_requests.append({
                "request_id": str(req["_id"]),
                "from_username": from_user,
                "full_name": VirtualMeetService._get_full_name(profile),
                "age": VirtualMeetService._calculate_age(profile),
                "location": VirtualMeetService._get_location(profile),
                "profession": profile.get("profession") or profile.get("occupation") or "",
                "profile_pic_url": f"/api/profile-pic/{from_user}",
                "requested_at": req.get("requested_at")
            })

        # Get user's rooms
        rooms = await VirtualMeetService.get_user_rooms(db, poll_id, username)

        return {
            "success": True,
            "poll_id": poll_id,
            "is_locked": is_locked,
            "matches": matches,
            "my_requests_sent": [uname for uname in sent_lookup.keys()],
            "my_requests_received": incoming_requests,
            "my_rooms": rooms
        }

    # ─── Room Request ─────────────────────────────────────────────────────

    @staticmethod
    async def send_room_request(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        requester_username: str,
        target_username: str,
        user_role: str
    ) -> Dict[str, Any]:
        """Send a 1:1 virtual room request to another participant."""

        # Validate not self-request
        if requester_username == target_username:
            return {"success": False, "error": "Cannot request a room with yourself."}

        # Check requester session
        session = await db.virtual_meet_sessions.find_one({
            "poll_id": poll_id, "username": requester_username
        })
        if not session or not session.get("access_unlocked"):
            return {"success": False, "error": "Access not unlocked. Payment may be required."}

        # Check event not locked
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        if VirtualMeetService._is_event_locked(poll):
            return {"success": False, "error": "Event is in progress. Room requests are locked."}

        # Check target has a session (opposite gender, RSVPed Yes)
        target_session = await db.virtual_meet_sessions.find_one({
            "poll_id": poll_id, "username": target_username
        })
        if not target_session:
            return {"success": False, "error": "Target user is not a participant in this event."}

        # Validate opposite gender
        if session.get("gender") == target_session.get("gender"):
            return {"success": False, "error": "Room requests can only be sent to opposite-gender participants."}

        # Check for duplicate request (in either direction)
        existing = await db.virtual_room_requests.find_one({
            "poll_id": poll_id,
            "$or": [
                {"requester_username": requester_username, "target_username": target_username},
                {"requester_username": target_username, "target_username": requester_username}
            ],
            "status": {"$in": ["pending", "accepted"]}
        })
        if existing:
            return {"success": False, "error": "A request already exists between you and this user."}

        # Create request
        now = datetime.now(timezone.utc)
        request_doc = {
            "poll_id": poll_id,
            "requester_username": requester_username,
            "target_username": target_username,
            "status": "pending",
            "room_id": None,
            "requested_at": now,
            "responded_at": None,
            "response_note": None
        }

        result = await db.virtual_room_requests.insert_one(request_doc)
        request_id = str(result.inserted_id)

        # Queue notification for target user
        try:
            requester_profile = await db.users.find_one(
                {"username": requester_username},
                {"firstName": 1, "lastName": 1}
            )
            requester_name = VirtualMeetService._get_full_name(requester_profile or {})

            notification_doc = {
                "username": target_username,
                "type": "virtual_meet_request",
                "title": "New Virtual Meet Request",
                "message": f"{requester_name} wants to connect with you in a 1:1 virtual room!",
                "data": {
                    "poll_id": poll_id,
                    "request_id": request_id,
                    "from_username": requester_username
                },
                "status": "pending",
                "createdAt": now,
                "updatedAt": now
            }
            await db.notification_queue.insert_one(notification_doc)
        except Exception as e:
            logger.error(f"Failed to queue notification for room request: {e}")

        logger.info(f"🎥 Room request sent: {requester_username} → {target_username} (poll: {poll_id})")

        return {
            "success": True,
            "request_id": request_id,
            "message": f"Room request sent!"
        }

    # ─── Room Request Response ────────────────────────────────────────────

    @staticmethod
    async def respond_to_request(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        username: str,
        request_id: str,
        action: str,
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """Accept or decline a room request."""

        if action not in ("accept", "decline"):
            return {"success": False, "error": "Action must be 'accept' or 'decline'."}

        # Find the request
        try:
            request = await db.virtual_room_requests.find_one({
                "_id": ObjectId(request_id),
                "poll_id": poll_id,
                "target_username": username,
                "status": "pending"
            })
        except Exception:
            return {"success": False, "error": "Invalid request ID."}

        if not request:
            return {"success": False, "error": "Request not found or already responded to."}

        now = datetime.now(timezone.utc)
        requester_username = request["requester_username"]

        if action == "accept":
            # Get next room number for this poll
            last_room = await db.virtual_rooms.find_one(
                {"poll_id": poll_id},
                sort=[("room_number", -1)]
            )
            room_number = (last_room.get("room_number", 0) if last_room else 0) + 1

            # Create virtual room
            room_doc = {
                "poll_id": poll_id,
                "room_number": room_number,
                "user_a": requester_username,
                "user_b": username,
                "status": "confirmed",
                "zoom_link": None,
                "notes": None,
                "created_at": now,
                "started_at": None,
                "ended_at": None
            }
            room_result = await db.virtual_rooms.insert_one(room_doc)
            room_id = str(room_result.inserted_id)

            # Update request
            await db.virtual_room_requests.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {
                    "status": "accepted",
                    "room_id": room_id,
                    "responded_at": now,
                    "response_note": note
                }}
            )

            # Queue notification for requester
            try:
                responder_profile = await db.users.find_one(
                    {"username": username}, {"firstName": 1, "lastName": 1}
                )
                responder_name = VirtualMeetService._get_full_name(responder_profile or {})

                await db.notification_queue.insert_one({
                    "username": requester_username,
                    "type": "virtual_meet_accepted",
                    "title": "Room Request Accepted!",
                    "message": f"{responder_name} accepted your room request! Room #{room_number} is ready.",
                    "data": {
                        "poll_id": poll_id,
                        "room_id": room_id,
                        "room_number": room_number,
                        "by_username": username
                    },
                    "status": "pending",
                    "createdAt": now,
                    "updatedAt": now
                })
            except Exception as e:
                logger.error(f"Failed to queue accept notification: {e}")

            logger.info(f"🎥 Room request accepted: {username} accepted {requester_username} → Room #{room_number}")

            return {
                "success": True,
                "action": "accepted",
                "room": {
                    "room_id": room_id,
                    "room_number": room_number,
                    "partner": requester_username,
                    "status": "confirmed"
                }
            }

        else:  # decline
            await db.virtual_room_requests.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {
                    "status": "declined",
                    "responded_at": now,
                    "response_note": note
                }}
            )

            # Queue notification for requester (in-app only)
            try:
                await db.notification_queue.insert_one({
                    "username": requester_username,
                    "type": "virtual_meet_declined",
                    "title": "Room Request Update",
                    "message": "Your room request was not accepted.",
                    "data": {
                        "poll_id": poll_id,
                        "by_username": username
                    },
                    "status": "pending",
                    "createdAt": now,
                    "updatedAt": now
                })
            except Exception as e:
                logger.error(f"Failed to queue decline notification: {e}")

            logger.info(f"🎥 Room request declined: {username} declined {requester_username}")

            return {
                "success": True,
                "action": "declined",
                "message": "Request declined."
            }

    # ─── User Rooms ───────────────────────────────────────────────────────

    @staticmethod
    async def get_user_rooms(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        username: str
    ) -> List[Dict[str, Any]]:
        """Get all confirmed/active rooms for the user in a poll."""
        rooms = await db.virtual_rooms.find({
            "poll_id": poll_id,
            "$or": [{"user_a": username}, {"user_b": username}],
            "status": {"$in": ["confirmed", "active"]}
        }).to_list(length=100)

        room_list = []
        for room in rooms:
            partner = room["user_b"] if room["user_a"] == username else room["user_a"]
            partner_profile = await db.users.find_one(
                {"username": partner},
                {"firstName": 1, "lastName": 1}
            )

            room_list.append({
                "room_id": str(room["_id"]),
                "room_number": room.get("room_number"),
                "partner_username": partner,
                "partner_name": VirtualMeetService._get_full_name(partner_profile or {}),
                "partner_pic_url": f"/api/profile-pic/{partner}",
                "status": room.get("status"),
                "zoom_link": room.get("zoom_link"),
                "created_at": room.get("created_at")
            })

        return room_list

    # ─── Payment ──────────────────────────────────────────────────────────

    @staticmethod
    async def initiate_payment(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        username: str,
        payment_method: str = "paypal"
    ) -> Dict[str, Any]:
        """Initiate payment for a zoom-call event. Returns PayPal/Clover order info."""

        session = await db.virtual_meet_sessions.find_one({
            "poll_id": poll_id, "username": username
        })

        if not session:
            return {"success": False, "error": "Session not found."}

        if session.get("payment_status") == "completed":
            return {"success": False, "error": "Payment already completed."}

        if session.get("payment_status") == "not_required":
            return {"success": False, "error": "Payment not required for this event."}

        amount = session.get("payment_amount", 5.00)

        if payment_method == "paypal":
            from services.paypal_service import paypal_service
            if not paypal_service.is_configured():
                return {"success": False, "error": "PayPal is not configured."}

            result = await paypal_service.create_order(
                amount=str(amount),
                currency="USD",
                description=f"Virtual Meet participation fee",
                custom_id=f"vm_{poll_id}_{username}"
            )

            if not result.get("success"):
                return {"success": False, "error": result.get("error", "PayPal order creation failed.")}

            # Store order ID in session
            await db.virtual_meet_sessions.update_one(
                {"_id": session["_id"]},
                {"$set": {
                    "paypal_order_id": result["order_id"],
                    "payment_provider": "paypal",
                    "updated_at": datetime.now(timezone.utc)
                }}
            )

            return {
                "success": True,
                "order_id": result["order_id"],
                "approval_url": result.get("approval_url"),
                "amount": str(amount),
                "payment_method": "paypal"
            }

        elif payment_method == "clover":
            from services.clover_service import clover_service
            if not clover_service.is_configured():
                return {"success": False, "error": "Clover is not configured."}

            amount_cents = int(round(amount * 100))
            result = await clover_service.create_hosted_checkout(
                amount_cents=amount_cents,
                description=f"Virtual Meet participation fee",
                customer_note=f"vm_{poll_id}_{username}"
            )

            if not result.get("success"):
                return {"success": False, "error": result.get("error", "Clover order creation failed.")}

            await db.virtual_meet_sessions.update_one(
                {"_id": session["_id"]},
                {"$set": {
                    "clover_order_id": result.get("checkout_id"),
                    "payment_provider": "clover",
                    "updated_at": datetime.now(timezone.utc)
                }}
            )

            return {
                "success": True,
                "checkout_url": result.get("checkout_url"),
                "checkout_id": result.get("checkout_id"),
                "amount": str(amount),
                "payment_method": "clover"
            }

        else:
            return {"success": False, "error": f"Unsupported payment method: {payment_method}"}

    @staticmethod
    async def confirm_payment(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        username: str,
        order_id: str,
        payment_method: str = "paypal"
    ) -> Dict[str, Any]:
        """Capture/confirm payment after user approval."""

        session = await db.virtual_meet_sessions.find_one({
            "poll_id": poll_id, "username": username
        })

        if not session:
            return {"success": False, "error": "Session not found."}

        if session.get("payment_status") == "completed":
            return {"success": False, "error": "Payment already completed."}

        now = datetime.now(timezone.utc)
        amount = session.get("payment_amount", 5.00)

        if payment_method == "paypal":
            from services.paypal_service import paypal_service
            result = await paypal_service.capture_order(order_id)

            if not result.get("success"):
                return {"success": False, "error": result.get("error", "PayPal capture failed.")}

            capture_id = result.get("capture_id")

            # Log to payments collection
            payment_doc = {
                "username": username,
                "amount": amount,
                "paymentType": "virtual_meet_fee",
                "paymentProvider": "paypal",
                "status": "completed",
                "paypalOrderId": order_id,
                "paypalCaptureId": capture_id,
                "payerEmail": result.get("payer_email"),
                "description": f"Virtual Meet fee - ${amount:.2f}",
                "poll_id": poll_id,
                "createdAt": now,
                "updatedAt": now
            }
            payment_result = await db.payments.insert_one(payment_doc)
            payment_id = str(payment_result.inserted_id)

        elif payment_method == "clover":
            # For Clover, the checkout is confirmed via webhook or redirect
            payment_doc = {
                "username": username,
                "amount": amount,
                "paymentType": "virtual_meet_fee",
                "paymentProvider": "clover",
                "status": "completed",
                "cloverOrderId": order_id,
                "description": f"Virtual Meet fee - ${amount:.2f}",
                "poll_id": poll_id,
                "createdAt": now,
                "updatedAt": now
            }
            payment_result = await db.payments.insert_one(payment_doc)
            payment_id = str(payment_result.inserted_id)
        else:
            return {"success": False, "error": f"Unsupported payment method: {payment_method}"}

        # Update session - unlock access
        await db.virtual_meet_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {
                "payment_status": "completed",
                "payment_id": payment_id,
                "access_unlocked": True,
                "updated_at": now
            }}
        )

        logger.info(f"💳 Virtual Meet payment confirmed: {username} paid ${amount:.2f} via {payment_method} (poll: {poll_id})")

        return {
            "success": True,
            "message": "Payment successful. Match list unlocked!",
            "access_unlocked": True
        }

    # ─── Admin Operations ─────────────────────────────────────────────────

    @staticmethod
    async def admin_pair_users(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        user_a: str,
        user_b: str,
        admin_username: str
    ) -> Dict[str, Any]:
        """Admin force-pairs two users into a virtual room."""

        # Validate both users have sessions
        session_a = await db.virtual_meet_sessions.find_one({"poll_id": poll_id, "username": user_a})
        session_b = await db.virtual_meet_sessions.find_one({"poll_id": poll_id, "username": user_b})

        if not session_a or not session_b:
            return {"success": False, "error": "Both users must be participants in this event."}

        # Check opposite gender
        if session_a.get("gender") == session_b.get("gender"):
            return {"success": False, "error": "Users must be of opposite genders."}

        # Check no existing room between them
        existing_room = await db.virtual_rooms.find_one({
            "poll_id": poll_id,
            "$or": [
                {"user_a": user_a, "user_b": user_b},
                {"user_a": user_b, "user_b": user_a}
            ],
            "status": {"$in": ["confirmed", "active"]}
        })
        if existing_room:
            return {"success": False, "error": "These users already have an active room."}

        now = datetime.now(timezone.utc)

        # Get next room number
        last_room = await db.virtual_rooms.find_one(
            {"poll_id": poll_id},
            sort=[("room_number", -1)]
        )
        room_number = (last_room.get("room_number", 0) if last_room else 0) + 1

        # Create room
        room_doc = {
            "poll_id": poll_id,
            "room_number": room_number,
            "user_a": user_a,
            "user_b": user_b,
            "status": "confirmed",
            "zoom_link": None,
            "notes": f"Admin-paired by {admin_username}",
            "created_at": now,
            "started_at": None,
            "ended_at": None
        }
        result = await db.virtual_rooms.insert_one(room_doc)
        room_id = str(result.inserted_id)

        # Cancel any pending requests between them
        await db.virtual_room_requests.update_many(
            {
                "poll_id": poll_id,
                "$or": [
                    {"requester_username": user_a, "target_username": user_b},
                    {"requester_username": user_b, "target_username": user_a}
                ],
                "status": "pending"
            },
            {"$set": {"status": "cancelled", "responded_at": now, "response_note": "Admin-paired"}}
        )

        logger.info(f"🎥 Admin {admin_username} paired {user_a} + {user_b} → Room #{room_number}")

        return {
            "success": True,
            "room_id": room_id,
            "room_number": room_number,
            "message": f"Users paired into Room #{room_number}"
        }

    @staticmethod
    async def admin_overview(
        db: AsyncIOMotorDatabase,
        poll_id: str
    ) -> Dict[str, Any]:
        """Admin overview of a virtual meet event."""
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        if not poll:
            return {"success": False, "error": "Poll not found."}

        sessions = await db.virtual_meet_sessions.find({"poll_id": poll_id}).to_list(length=1000)
        rooms = await db.virtual_rooms.find({"poll_id": poll_id}).to_list(length=1000)
        requests = await db.virtual_room_requests.find({"poll_id": poll_id}).to_list(length=5000)

        male_count = sum(1 for s in sessions if s.get("gender") == "Male")
        female_count = sum(1 for s in sessions if s.get("gender") == "Female")
        paid_count = sum(1 for s in sessions if s.get("payment_status") == "completed")
        unpaid_count = sum(1 for s in sessions if s.get("payment_status") == "pending")
        exempt_count = sum(1 for s in sessions if s.get("payment_status") == "not_required")

        accepted_requests = sum(1 for r in requests if r.get("status") == "accepted")
        declined_requests = sum(1 for r in requests if r.get("status") == "declined")
        pending_requests = sum(1 for r in requests if r.get("status") == "pending")

        # Serialize for response
        for s in sessions:
            s["_id"] = str(s["_id"])
        for r in rooms:
            r["_id"] = str(r["_id"])

        return {
            "success": True,
            "poll_id": poll_id,
            "title": poll.get("title"),
            "total_participants": len(sessions),
            "male_count": male_count,
            "female_count": female_count,
            "paid_count": paid_count,
            "unpaid_count": unpaid_count,
            "exempt_count": exempt_count,
            "total_requests": len(requests),
            "accepted_requests": accepted_requests,
            "declined_requests": declined_requests,
            "pending_requests": pending_requests,
            "total_rooms": len(rooms),
            "participants": sessions,
            "rooms": rooms
        }

    # ─── RSVP Change Cascade ─────────────────────────────────────────────

    @staticmethod
    async def cancel_user_participation(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        username: str
    ) -> Dict[str, Any]:
        """
        Called when a user changes their RSVP from Yes to No.
        Cancels all pending/confirmed requests and rooms.
        """
        now = datetime.now(timezone.utc)

        # Cancel pending requests (sent by user)
        sent_result = await db.virtual_room_requests.update_many(
            {"poll_id": poll_id, "requester_username": username, "status": "pending"},
            {"$set": {"status": "cancelled", "responded_at": now, "response_note": "User changed RSVP"}}
        )

        # Cancel pending requests (received by user)
        received_result = await db.virtual_room_requests.update_many(
            {"poll_id": poll_id, "target_username": username, "status": "pending"},
            {"$set": {"status": "cancelled", "responded_at": now, "response_note": "User changed RSVP"}}
        )

        # Cancel confirmed rooms
        rooms_result = await db.virtual_rooms.update_many(
            {
                "poll_id": poll_id,
                "$or": [{"user_a": username}, {"user_b": username}],
                "status": {"$in": ["confirmed", "active"]}
            },
            {"$set": {"status": "cancelled", "ended_at": now}}
        )

        # Remove session
        await db.virtual_meet_sessions.delete_one({
            "poll_id": poll_id, "username": username
        })

        logger.info(
            f"🎥 User {username} cancelled participation in poll {poll_id}: "
            f"{sent_result.modified_count} sent requests, "
            f"{received_result.modified_count} received requests, "
            f"{rooms_result.modified_count} rooms cancelled"
        )

        return {
            "success": True,
            "cancelled_sent": sent_result.modified_count,
            "cancelled_received": received_result.modified_count,
            "cancelled_rooms": rooms_result.modified_count
        }

    # ─── Room Expiry ──────────────────────────────────────────────────────

    @staticmethod
    async def expire_unused_rooms(
        db: AsyncIOMotorDatabase,
        poll_id: str
    ) -> Dict[str, Any]:
        """
        Auto-expire confirmed rooms that were never activated on event day.
        Called by scheduler after event ends.
        """
        now = datetime.now(timezone.utc)

        result = await db.virtual_rooms.update_many(
            {
                "poll_id": poll_id,
                "status": "confirmed",  # Never became "active"
            },
            {"$set": {"status": "expired", "ended_at": now}}
        )

        # Also expire pending requests
        req_result = await db.virtual_room_requests.update_many(
            {"poll_id": poll_id, "status": "pending"},
            {"$set": {"status": "expired", "responded_at": now, "response_note": "Event ended"}}
        )

        logger.info(f"🎥 Expired {result.modified_count} rooms and {req_result.modified_count} requests for poll {poll_id}")

        return {
            "expired_rooms": result.modified_count,
            "expired_requests": req_result.modified_count
        }

    # ─── Helper Methods ───────────────────────────────────────────────────

    @staticmethod
    def _is_event_locked(poll: Dict[str, Any]) -> bool:
        """Check if event has started (lockdown mode)."""
        if not poll:
            return False

        event_date = poll.get("event_date")
        event_time = poll.get("event_time")
        event_timezone = poll.get("event_timezone", "America/Los_Angeles")

        if not event_date:
            return False

        try:
            if isinstance(event_date, str):
                event_date = datetime.fromisoformat(event_date.replace("Z", "+00:00"))

            if event_time:
                parts = event_time.split(":")
                hour = int(parts[0]) if len(parts) > 0 else 0
                minute = int(parts[1]) if len(parts) > 1 else 0

                # Use Intl-like offset calculation (simplified for Python)
                tz_offsets = {
                    "America/Los_Angeles": -7, "America/Denver": -6,
                    "America/Chicago": -5, "America/New_York": -4,
                    "America/Phoenix": -7, "Pacific/Honolulu": -10,
                    "America/Anchorage": -8, "UTC": 0
                }

                try:
                    import pytz
                    tz = pytz.timezone(event_timezone)
                    naive_dt = event_date.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=None)
                    local_dt = tz.localize(naive_dt)
                    utc_dt = local_dt.astimezone(pytz.utc)
                except Exception:
                    offset = tz_offsets.get(event_timezone, -7)
                    from datetime import timedelta
                    utc_dt = event_date.replace(
                        hour=hour, minute=minute, second=0, microsecond=0, tzinfo=timezone.utc
                    ) - timedelta(hours=offset)
            else:
                utc_dt = event_date.replace(tzinfo=timezone.utc) if event_date.tzinfo is None else event_date

            return datetime.now(timezone.utc) >= utc_dt

        except Exception as e:
            logger.error(f"Error checking event lock: {e}")
            return False

    @staticmethod
    def _get_full_name(profile: Dict[str, Any]) -> str:
        """Get full name from profile."""
        first = profile.get("firstName") or ""
        last = profile.get("lastName") or ""
        name = f"{first} {last}".strip()
        return name or profile.get("username", "Unknown")

    @staticmethod
    def _calculate_age(profile: Dict[str, Any]) -> Optional[int]:
        """Calculate age from profile."""
        age = profile.get("age")
        if age:
            raw = age if age not in ('', None) else None
            return int(raw) if raw else None

        dob = profile.get("dateOfBirth")
        if dob:
            try:
                if isinstance(dob, str):
                    dob = datetime.fromisoformat(dob.replace("Z", "+00:00"))
                today = datetime.now()
                return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            except Exception:
                pass
        return None

    @staticmethod
    def _get_location(profile: Dict[str, Any]) -> str:
        """Get location string from profile."""
        parts = []
        if profile.get("city"):
            parts.append(profile["city"])
        if profile.get("state"):
            parts.append(profile["state"])
        if not parts and profile.get("country"):
            parts.append(profile["country"])
        return ", ".join(parts)
