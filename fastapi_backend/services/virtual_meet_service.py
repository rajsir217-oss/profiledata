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
        # Get poll details (needed for both heal and create paths)
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        if not poll:
            return None

        event_type = poll.get("event_type")
        is_exempt = user_role in ("admin", "moderator")

        # Look up the user's RSVP-paid status (single source of truth: poll_responses).
        # The RSVP payment flow (/api/polls/{id}/pay-and-respond) writes
        # payment_status='completed' on the poll_responses document. We use that
        # as authoritative evidence that the user has paid for this event.
        paid_via_rsvp = False
        rsvp_payment_id = None
        rsvp_payment_amount = None
        try:
            rsvp = await db.poll_responses.find_one(
                {"poll_id": poll_id, "username": username},
                {"payment_status": 1, "payment_id": 1, "payment_amount": 1, "payment_method": 1}
            )
            if rsvp and (rsvp.get("payment_status") or "").lower() == "completed":
                paid_via_rsvp = True
                rsvp_payment_id = rsvp.get("payment_id")
                rsvp_payment_amount = rsvp.get("payment_amount")
        except Exception as e:
            logger.warning(f"get_or_create_session: failed to read poll_responses for {username}/{poll_id}: {e}")

        # Check if session already exists
        session = await db.virtual_meet_sessions.find_one({
            "poll_id": poll_id,
            "username": username
        })

        if session:
            # Self-heal: if the user has already paid via the RSVP flow but the
            # VM session was created before the payment (or before the payment
            # bridge existed), promote it to unlocked now. Fixes the dual
            # source-of-truth bug retroactively for users who paid via the
            # poll widget.
            needs_heal = (
                paid_via_rsvp
                and not session.get("access_unlocked")
                and (session.get("payment_status") or "").lower() != "completed"
            )
            if needs_heal:
                heal_set = {
                    "payment_status": "completed",
                    "access_unlocked": True,
                    "updated_at": datetime.now(timezone.utc),
                }
                if rsvp_payment_id and not session.get("payment_id"):
                    heal_set["payment_id"] = rsvp_payment_id
                if rsvp_payment_amount and not session.get("payment_amount"):
                    heal_set["payment_amount"] = rsvp_payment_amount
                await db.virtual_meet_sessions.update_one(
                    {"_id": session["_id"]},
                    {"$set": heal_set}
                )
                logger.info(
                    f"[VM heal] Promoted session to unlocked for user={username} "
                    f"poll={poll_id} (paid via RSVP flow)"
                )
                session.update(heal_set)
            session["_id"] = str(session["_id"])
            return session

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

        # Determine payment requirement / unlock state for new session.
        payment_amount = poll.get("virtual_meet_payment_amount", 5.00) or 5.00

        # Both 'zoom-call' and 'virtual' event types require payment (unless exempt).
        requires_payment = event_type in ("zoom-call", "virtual")
        if requires_payment and not is_exempt:
            if paid_via_rsvp:
                # User already paid via RSVP flow; create session pre-unlocked.
                payment_status = "completed"
                access_unlocked = True
            else:
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
            "payment_amount": (rsvp_payment_amount if paid_via_rsvp and rsvp_payment_amount else payment_amount),
            "payment_id": (rsvp_payment_id if paid_via_rsvp else None),
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
        if paid_via_rsvp and requires_payment:
            logger.info(
                f"[VM heal] Created pre-unlocked session for user={username} "
                f"poll={poll_id} event_type={event_type} (paid via RSVP flow)"
            )
        return session_doc

    # ─── Events List ──────────────────────────────────────────────────────

    @staticmethod
    async def get_user_events(
        db: AsyncIOMotorDatabase,
        username: str,
        user_role: str
    ) -> List[Dict[str, Any]]:
        """
        Get all active and closed polls the user RSVPed "Yes" to that qualify for Virtual Meets.
        Closed events remain visible so paid users can still view matches and rooms.
        """
        # Get active + closed polls (paid users keep access after close)
        polls = await db.polls.find(
            {"status": {"$in": ["active", "closed"]}},
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

            # Check if event is locked (past start time or closed by admin)
            is_closed = poll.get("status") == "closed"
            is_locked = is_closed or VirtualMeetService._is_event_locked(poll)

            events.append({
                "poll_id": poll_id,
                "title": poll.get("title"),
                "event_type": poll.get("event_type"),
                "event_date": poll.get("event_date") if isinstance(poll.get("event_date"), str) else (poll.get("event_date").isoformat() if poll.get("event_date") else None),
                "event_time": poll.get("event_time"),
                "event_timezone": poll.get("event_timezone"),
                "event_location": poll.get("event_location"),
                "status": poll.get("status"),
                "is_closed": is_closed,
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

        # Get poll for lock status (closed events are also locked)
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        is_closed = poll.get("status") == "closed" if poll else False
        is_locked = is_closed or (VirtualMeetService._is_event_locked(poll) if poll else False)

        user_gender = session.get("gender")
        opposite_gender = "Female" if user_gender == "Male" else "Male"

        # Get all opposite-gender sessions for this poll
        opposite_sessions = await db.virtual_meet_sessions.find({
            "poll_id": poll_id,
            "gender": opposite_gender
        }).to_list(length=500)

        opposite_usernames = [s["username"] for s in opposite_sessions]

        # Get user profiles for all matches
        # Only include active users - exclude paused/inactive/suspended/deleted etc.
        profiles = {}
        if opposite_usernames:
            cursor = db.users.find(
                {
                    "username": {"$in": opposite_usernames},
                    "accountStatus": "active"
                },
                {
                    "username": 1, "firstName": 1, "lastName": 1,
                    "age": 1, "birthMonth": 1, "birthYear": 1, "dateOfBirth": 1,
                    "city": 1, "state": 1, "country": 1,
                    "profession": 1, "occupation": 1, "workExperience": 1,
                    "education": 1, "educationHistory": 1,
                    "height": 1, "heightInches": 1,
                    "tagline": 1, "bio": 1, "aboutMe": 1, "about": 1,
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

        # Batch-fetch room numbers for accepted requests
        accepted_room_ids = []
        for req in my_sent_requests:
            if req.get("status") == "accepted" and req.get("room_id"):
                try:
                    accepted_room_ids.append(ObjectId(req["room_id"]))
                except Exception:
                    pass

        room_number_lookup = {}
        if accepted_room_ids:
            rooms_cursor = db.virtual_rooms.find(
                {"_id": {"$in": accepted_room_ids}},
                {"room_number": 1}
            )
            async for room in rooms_cursor:
                room_number_lookup[str(room["_id"])] = room.get("room_number")

        # Build match list
        matches = []
        for uname in opposite_usernames:
            profile = profiles.get(uname, {})
            sent_req = sent_lookup.get(uname)

            request_status = None
            request_id = None
            room_number = None
            if sent_req:
                request_status = sent_req.get("status")
                request_id = str(sent_req["_id"])
                if request_status == "accepted" and sent_req.get("room_id"):
                    room_number = room_number_lookup.get(sent_req["room_id"])

            matches.append({
                "username": uname,
                "full_name": VirtualMeetService._get_full_name(profile),
                "age": VirtualMeetService._calculate_age(profile),
                "dob_mm_yyyy": VirtualMeetService._get_birth_month_year(profile),
                "height": VirtualMeetService._get_height(profile),
                "location": VirtualMeetService._get_location(profile),
                "profession": VirtualMeetService._get_profession(profile),
                "education": VirtualMeetService._get_education(profile),
                "bio_tag": VirtualMeetService._get_bio_tag(profile),
                "profile_pic_url": f"/api/profile-pic/{uname}",
                "request_status": request_status,
                "request_id": request_id,
                "room_number": room_number
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
                     "birthMonth": 1, "birthYear": 1, "dateOfBirth": 1,
                     "city": 1, "state": 1, "country": 1,
                     "profession": 1, "occupation": 1, "workExperience": 1,
                     "education": 1, "educationHistory": 1,
                     "height": 1, "heightInches": 1,
                     "tagline": 1, "bio": 1, "aboutMe": 1, "about": 1}
                ) or {}

            incoming_requests.append({
                "request_id": str(req["_id"]),
                "from_username": from_user,
                "full_name": VirtualMeetService._get_full_name(profile),
                "age": VirtualMeetService._calculate_age(profile),
                "dob_mm_yyyy": VirtualMeetService._get_birth_month_year(profile),
                "height": VirtualMeetService._get_height(profile),
                "location": VirtualMeetService._get_location(profile),
                "profession": VirtualMeetService._get_profession(profile),
                "education": VirtualMeetService._get_education(profile),
                "bio_tag": VirtualMeetService._get_bio_tag(profile),
                "profile_pic_url": f"/api/profile-pic/{from_user}",
                "requested_at": req.get("requested_at")
            })

        # Get user's rooms
        rooms = await VirtualMeetService.get_user_rooms(db, poll_id, username)

        return {
            "success": True,
            "poll_id": poll_id,
            "is_locked": is_locked,
            "is_closed": is_closed,
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
        logger.info(f"Room request: {requester_username} -> {target_username} for poll {poll_id}")

        # Validate not self-request
        if requester_username == target_username:
            logger.warning(f"Room request blocked: self-request by {requester_username}")
            return {"success": False, "error": "Cannot request a room with yourself."}

        # Check requester session
        session = await db.virtual_meet_sessions.find_one({
            "poll_id": poll_id, "username": requester_username
        })
        if not session or not session.get("access_unlocked"):
            logger.warning(f"Room request blocked: access not unlocked for {requester_username} (session={bool(session)}, unlocked={session.get('access_unlocked') if session else None})")
            return {"success": False, "error": "Access not unlocked. Payment may be required."}

        # Check event not locked or closed
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        if poll and poll.get("status") == "closed":
            logger.warning(f"Room request blocked: event {poll_id} is closed")
            return {"success": False, "error": "This event has ended. Room requests are no longer accepted."}
        if VirtualMeetService._is_event_locked(poll):
            logger.warning(f"Room request blocked: event {poll_id} is locked (in progress)")
            return {"success": False, "error": "Event is in progress. Room requests are locked."}

        # Check target has a session (opposite gender, RSVPed Yes)
        target_session = await db.virtual_meet_sessions.find_one({
            "poll_id": poll_id, "username": target_username
        })
        if not target_session:
            logger.warning(f"Room request blocked: target {target_username} has no session for poll {poll_id}")
            return {"success": False, "error": "Target user is not a participant in this event."}

        # Validate opposite gender
        if session.get("gender") == target_session.get("gender"):
            logger.warning(f"Room request blocked: same gender ({session.get('gender')}) for {requester_username} -> {target_username}")
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
            logger.warning(f"Room request blocked: duplicate request between {requester_username} and {target_username}")
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

    # ─── Cancel Room ───────────────────────────────────────────────────────

    @staticmethod
    async def cancel_room(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        room_id: str,
        username: str
    ) -> Dict[str, Any]:
        """Cancel a confirmed room. Both users are freed to make new requests."""
        try:
            room = await db.virtual_rooms.find_one({
                "_id": ObjectId(room_id),
                "poll_id": poll_id,
                "status": {"$in": ["confirmed", "active"]}
            })
        except Exception:
            return {"success": False, "error": "Invalid room ID."}

        if not room:
            return {"success": False, "error": "Room not found or already cancelled."}

        # Verify user is part of this room
        if username not in (room.get("user_a"), room.get("user_b")):
            return {"success": False, "error": "You are not a participant in this room."}

        # Check event not locked
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        if poll and poll.get("status") == "closed":
            return {"success": False, "error": "This event has ended. Rooms cannot be cancelled."}
        if VirtualMeetService._is_event_locked(poll):
            return {"success": False, "error": "Event is in progress. Rooms cannot be cancelled."}

        now = datetime.now(timezone.utc)
        partner = room["user_b"] if room["user_a"] == username else room["user_a"]

        # Update room status to cancelled
        await db.virtual_rooms.update_one(
            {"_id": ObjectId(room_id)},
            {"$set": {
                "status": "cancelled",
                "cancelled_by": username,
                "cancelled_at": now
            }}
        )

        # Update the associated request to 'cancelled' so both users can re-request
        await db.virtual_room_requests.update_many(
            {
                "poll_id": poll_id,
                "room_id": room_id,
                "status": "accepted"
            },
            {"$set": {
                "status": "cancelled",
                "cancelled_by": username,
                "cancelled_at": now
            }}
        )

        # Notify the partner
        try:
            canceller_profile = await db.users.find_one(
                {"username": username}, {"firstName": 1, "lastName": 1}
            )
            canceller_name = VirtualMeetService._get_full_name(canceller_profile or {})

            await db.notification_queue.insert_one({
                "username": partner,
                "type": "virtual_meet_room_cancelled",
                "title": "Room Cancelled",
                "message": f"{canceller_name} cancelled Room #{room.get('room_number')}. You can now send new room requests.",
                "data": {
                    "poll_id": poll_id,
                    "room_id": room_id,
                    "room_number": room.get("room_number"),
                    "cancelled_by": username
                },
                "status": "pending",
                "createdAt": now,
                "updatedAt": now
            })
        except Exception as e:
            logger.error(f"Failed to queue room cancellation notification: {e}")

        logger.info(f"🎥 Room #{room.get('room_number')} cancelled by {username} (partner: {partner}, poll: {poll_id})")

        return {
            "success": True,
            "message": f"Room #{room.get('room_number')} has been cancelled.",
            "room_number": room.get("room_number"),
            "partner": partner
        }

    # ─── Admin Bulk Pairing ───────────────────────────────────────────────────

    @staticmethod
    async def admin_bulk_pair(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        user_a: str,
        user_b: str
    ) -> Dict[str, Any]:
        """Admin manually pairs two users in a room."""
        try:
            # Validate both users exist and are participants
            session_a = await db.virtual_meet_sessions.find_one({
                "poll_id": poll_id, "username": user_a
            })
            session_b = await db.virtual_meet_sessions.find_one({
                "poll_id": poll_id, "username": user_b
            })

            if not session_a:
                return {"success": False, "error": f"User {user_a} is not a participant in this event."}
            if not session_b:
                return {"success": False, "error": f"User {user_b} is not a participant in this event."}

            # Check if these two users are already paired together
            existing_pair = await db.virtual_rooms.find_one({
                "poll_id": poll_id,
                "$or": [
                    {"user_a": user_a, "user_b": user_b},
                    {"user_a": user_b, "user_b": user_a}
                ],
                "status": {"$in": ["confirmed", "active"]}
            })

            if existing_pair:
                return {"success": False, "error": f"{user_a} and {user_b} are already paired together."}

            # Check if they're opposite gender (optional validation)
            if session_a.get("gender") == session_b.get("gender"):
                logger.warning(f"⚠️ Admin pairing same-gender users: {user_a} and {user_b}")

            # Get next room number
            last_room = await db.virtual_rooms.find_one(
                {"poll_id": poll_id},
                sort=[("room_number", -1)]
            )
            next_room_number = (last_room.get("room_number", 0) + 1) if last_room else 1

            # Create the room
            room_doc = {
                "poll_id": poll_id,
                "user_a": user_a,
                "user_b": user_b,
                "room_number": next_room_number,
                "status": "confirmed",
                "created_at": datetime.utcnow(),
                "created_by": "admin_bulk_pair",
                "paired_at": datetime.utcnow()
            }

            result = await db.virtual_rooms.insert_one(room_doc)
            room_id = str(result.inserted_id)

            # Cancel any pending requests between these users
            await db.virtual_room_requests.update_many(
                {
                    "poll_id": poll_id,
                    "$or": [
                        {"requester_username": user_a, "target_username": user_b},
                        {"requester_username": user_b, "target_username": user_a}
                    ],
                    "status": "pending"
                },
                {"$set": {
                    "status": "cancelled",
                    "responded_at": datetime.utcnow(),
                    "response_note": "Cancelled by admin bulk pairing"
                }}
            )

            # Notify both users
            for username in [user_a, user_b]:
                partner = user_b if username == user_a else user_a
                partner_session = session_a if username == user_b else session_b
                partner_name = f"{partner_session.get('firstName', '')} {partner_session.get('lastName', '')}".strip()

                await db.notification_queue.insert_one({
                    "username": username,
                    "type": "virtual_meet_room_created",
                    "title": "Room Assigned",
                    "message": f"You've been paired with {partner_name} in Room #{next_room_number}.",
                    "data": {
                        "poll_id": poll_id,
                        "room_id": room_id,
                        "room_number": next_room_number,
                        "partner_username": partner,
                        "partner_name": partner_name
                    },
                    "status": "pending",
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                })

            logger.info(f"🔧 Admin bulk paired {user_a} + {user_b} in Room #{next_room_number} (poll: {poll_id})")

            return {
                "success": True,
                "message": f"Successfully paired {user_a} and {user_b} in Room #{next_room_number}.",
                "room_id": room_id,
                "room_number": next_room_number,
                "user_a": user_a,
                "user_b": user_b
            }

        except Exception as e:
            logger.error(f"❌ Admin bulk pairing failed: {e}")
            return {"success": False, "error": "Failed to create room."}

    # ─── Admin Unpair ─────────────────────────────────────────────────────

    @staticmethod
    async def admin_unpair(
        db: AsyncIOMotorDatabase,
        poll_id: str,
        room_id: str
    ) -> Dict[str, Any]:
        """Admin cancels/unpairs a room."""
        try:
            room = await db.virtual_rooms.find_one({
                "_id": ObjectId(room_id),
                "poll_id": poll_id,
                "status": {"$in": ["confirmed", "active"]}
            })

            if not room:
                return {"success": False, "error": "Room not found or already cancelled."}

            user_a = room.get("user_a")
            user_b = room.get("user_b")
            room_number = room.get("room_number")

            # Cancel the room
            await db.virtual_rooms.update_one(
                {"_id": ObjectId(room_id)},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_at": datetime.utcnow(),
                    "cancelled_by": "admin"
                }}
            )

            # Cancel related requests
            await db.virtual_room_requests.update_many(
                {
                    "poll_id": poll_id,
                    "$or": [
                        {"requester_username": user_a, "target_username": user_b},
                        {"requester_username": user_b, "target_username": user_a}
                    ],
                    "status": {"$in": ["pending", "accepted"]}
                },
                {"$set": {
                    "status": "cancelled",
                    "responded_at": datetime.utcnow(),
                    "response_note": "Unpaired by admin"
                }}
            )

            logger.info(f"🔧 Admin unpaired Room-{room_number}: {user_a} + {user_b} (poll: {poll_id})")

            return {
                "success": True,
                "message": f"Room-{room_number} unpaired: {user_a} and {user_b}",
                "room_number": room_number,
                "user_a": user_a,
                "user_b": user_b
            }

        except Exception as e:
            logger.error(f"❌ Admin unpair failed: {e}")
            return {"success": False, "error": "Failed to unpair room."}

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

    # ─── Admin: Backfill Sessions from Yes RSVPs ─────────────────────────

    @staticmethod
    async def backfill_sessions_from_rsvps(
        db: AsyncIOMotorDatabase,
        poll_id: str
    ) -> Dict[str, Any]:
        """
        Create virtual_meet_sessions for every "Yes" RSVP on the poll that
        does not already have a session. Used by admins to ensure every
        Yes-voter is eligible for 1:1 room allocation, even if they never
        opened the Virtual Meets page (which is what normally lazy-creates
        their session row).

        Honors RSVP-flow payment status: a session is pre-unlocked iff the
        poll_responses doc has payment_status=='completed' or the user is
        admin/moderator (exempt). Otherwise the session is created with
        payment_status='pending' / access_unlocked=False so the user is
        prompted to pay on the Virtual Meets page.
        """
        poll = await db.polls.find_one({"_id": ObjectId(poll_id)})
        if not poll:
            return {"success": False, "error": "Poll not found."}

        event_type = poll.get("event_type")
        requires_payment = event_type in ("zoom-call", "virtual")
        event_fee = float(poll.get("virtual_meet_payment_amount", 5.00) or 0)

        # All "Yes" RSVPs on the poll.
        yes_rsvps = await db.poll_responses.find(
            {"poll_id": poll_id, "rsvp_response": "yes"}
        ).to_list(length=10000)

        # Existing sessions for this poll, keyed by username.
        existing_sessions = await db.virtual_meet_sessions.find(
            {"poll_id": poll_id}, {"username": 1}
        ).to_list(length=10000)
        existing_usernames = {s["username"] for s in existing_sessions}

        created = 0
        already_existed = 0
        skipped_no_gender = 0
        skipped_no_user = 0
        errors = 0
        now = datetime.now(timezone.utc)

        for rsvp in yes_rsvps:
            username = rsvp.get("username")
            if not username:
                continue
            if username in existing_usernames:
                already_existed += 1
                continue

            try:
                user = await db.users.find_one({"username": username})
                if not user:
                    skipped_no_user += 1
                    continue
                gender = user.get("gender") or user.get("Gender") or ""
                if gender not in ("Male", "Female"):
                    skipped_no_gender += 1
                    continue

                user_role = user.get("role") or user.get("role_name") or "free_user"
                is_exempt = user_role in ("admin", "moderator")

                rsvp_paid = (rsvp.get("payment_status") or "").lower() == "completed"

                if requires_payment and not is_exempt:
                    if rsvp_paid:
                        payment_status = "completed"
                        access_unlocked = True
                    else:
                        payment_status = "pending"
                        access_unlocked = False
                else:
                    payment_status = "not_required"
                    access_unlocked = True

                session_doc = {
                    "poll_id": poll_id,
                    "username": username,
                    "gender": gender,
                    "event_type": event_type,
                    "payment_status": payment_status,
                    "payment_amount": event_fee if requires_payment else None,
                    "payment_id": rsvp.get("payment_id"),
                    "payment_provider": rsvp.get("payment_method"),
                    "paypal_order_id": None,
                    "clover_order_id": None,
                    "access_unlocked": access_unlocked,
                    "rsvp_response": "yes",
                    "match_list_generated": False,
                    "created_at": now,
                    "updated_at": now,
                    "backfilled": True,
                }
                await db.virtual_meet_sessions.insert_one(session_doc)
                created += 1
                existing_usernames.add(username)
            except Exception as e:
                logger.error(f"[VM backfill] Error for user={username} poll={poll_id}: {e}")
                errors += 1

        logger.info(
            f"[VM backfill] poll={poll_id} yes_rsvps={len(yes_rsvps)} "
            f"created={created} already_existed={already_existed} "
            f"skipped_no_gender={skipped_no_gender} skipped_no_user={skipped_no_user} "
            f"errors={errors}"
        )

        return {
            "success": True,
            "poll_id": poll_id,
            "yes_rsvps": len(yes_rsvps),
            "created": created,
            "already_existed": already_existed,
            "skipped_no_gender": skipped_no_gender,
            "skipped_no_user": skipped_no_user,
            "errors": errors,
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

    # ─── Admin: Delete Event ─────────────────────────────────────────────

    @staticmethod
    async def delete_event(db: AsyncIOMotorDatabase, poll_id: str) -> Dict[str, Any]:
        """
        Delete all virtual meet data for a poll: sessions, room requests, rooms.
        Does NOT delete the poll itself (that's managed via PollManagement).
        """
        try:
            sessions_result = await db.virtual_meet_sessions.delete_many({"poll_id": poll_id})
            requests_result = await db.virtual_room_requests.delete_many({"poll_id": poll_id})
            rooms_result = await db.virtual_rooms.delete_many({"poll_id": poll_id})

            logger.info(
                f"Deleted VM data for poll {poll_id}: "
                f"{sessions_result.deleted_count} sessions, "
                f"{requests_result.deleted_count} requests, "
                f"{rooms_result.deleted_count} rooms"
            )

            return {
                "success": True,
                "deleted_sessions": sessions_result.deleted_count,
                "deleted_requests": requests_result.deleted_count,
                "deleted_rooms": rooms_result.deleted_count
            }
        except Exception as e:
            logger.error(f"Error deleting VM event data for poll {poll_id}: {e}")
            return {"success": False, "error": str(e)}

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
        if age not in ("", None):
            try:
                return int(age)
            except Exception:
                pass

        birth_year = profile.get("birthYear")
        birth_month = profile.get("birthMonth")
        if birth_year not in ("", None):
            try:
                year = int(birth_year)
                month = int(birth_month) if birth_month not in ("", None) else None
                today = datetime.now()
                calculated_age = today.year - year
                if month and today.month < month:
                    calculated_age -= 1
                return calculated_age
            except Exception:
                pass

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

    @staticmethod
    def _get_birth_month_year(profile: Dict[str, Any]) -> str:
        """Get date-of-birth month/year as MM/YYYY."""
        birth_month = profile.get("birthMonth")
        birth_year = profile.get("birthYear")

        if birth_month not in ("", None) and birth_year not in ("", None):
            try:
                month = str(int(birth_month)).zfill(2)
                year = str(int(birth_year))
                return f"{month}/{year}"
            except Exception:
                pass

        dob = profile.get("dateOfBirth")
        if not dob:
            return ""

        try:
            parsed = dob
            if isinstance(dob, str):
                parsed = datetime.fromisoformat(dob.replace("Z", "+00:00"))
            return f"{str(parsed.month).zfill(2)}/{parsed.year}"
        except Exception:
            return ""

    @staticmethod
    def _get_height(profile: Dict[str, Any]) -> str:
        """Get display height string."""
        raw_height = profile.get("height")
        if isinstance(raw_height, str) and raw_height.strip():
            return raw_height.strip()

        height_inches = profile.get("heightInches")
        if height_inches in ("", None):
            return ""

        try:
            total_inches = int(height_inches)
            feet = total_inches // 12
            inches = total_inches % 12
            return f"{feet}' {inches}\""
        except Exception:
            return ""

    @staticmethod
    def _get_profession(profile: Dict[str, Any]) -> str:
        """Get profession with workExperience fallback."""
        direct_profession = profile.get("profession") or profile.get("occupation")
        if isinstance(direct_profession, str) and direct_profession.strip():
            return direct_profession.strip()

        work_experience = profile.get("workExperience")
        if isinstance(work_experience, list) and work_experience:
            current_job = next(
                (
                    job for job in work_experience
                    if isinstance(job, dict)
                    and (
                        job.get("isCurrent") is True
                        or str(job.get("status", "")).lower() == "current"
                    )
                ),
                None,
            )
            selected_job = current_job or next((job for job in work_experience if isinstance(job, dict)), None)
            if selected_job:
                for key in ("description", "position", "title"):
                    value = selected_job.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()

                company = selected_job.get("company")
                if isinstance(company, str) and company.strip():
                    return company.strip()

        return ""

    @staticmethod
    def _get_education(profile: Dict[str, Any]) -> str:
        """Get education text from legacy or structured fields."""
        legacy_education = profile.get("education")
        if isinstance(legacy_education, str) and legacy_education.strip():
            return legacy_education.strip()

        education_history = profile.get("educationHistory")
        if isinstance(education_history, list) and education_history:
            edu = next((item for item in education_history if isinstance(item, dict)), None)
            if edu:
                degree = edu.get("degree")
                institution = edu.get("institution")
                level = edu.get("level")

                if isinstance(degree, str) and degree.strip() and isinstance(institution, str) and institution.strip():
                    return f"{degree.strip()}, {institution.strip()}"
                if isinstance(degree, str) and degree.strip():
                    return degree.strip()
                if isinstance(level, str) and level.strip():
                    return level.strip()
                if isinstance(institution, str) and institution.strip():
                    return institution.strip()

        return ""

    @staticmethod
    def _get_bio_tag(profile: Dict[str, Any]) -> str:
        """Get concise bio/tagline text."""
        for key in ("tagline", "bio", "aboutMe", "about"):
            value = profile.get(key)
            if isinstance(value, str) and value.strip():
                cleaned = value.strip()
                if len(cleaned) > 120:
                    return f"{cleaned[:117].rstrip()}..."
                return cleaned
        return ""
