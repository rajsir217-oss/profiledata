"""
Seed script: Insert test data for Virtual Meets feature testing.

Creates:
  - 2 active polls with event_type (zoom-call + in-person)
  - RSVP "Yes" poll_responses for multiple male & female users
  - virtual_meet_sessions for each respondent
  - Sample virtual_room_requests (pending, accepted, declined)
  - Sample virtual_rooms (confirmed)

Usage:
  cd fastapi_backend
  python scripts/seed_virtual_meets_test_data.py
"""

import asyncio
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "matrimonialDB"

# ── Test Users (must exist in your `users` collection) ──────────────────

MALES = [
    "yogeshmukherjee010",
    "sandeepsaxena001",
    "ajayroy002",
    "amansharma003",
    "shivgupta004",
    "aryanpandey005",
]

FEMALES = [
    "testuser",
    "siddharthdas007",
    "mayagupta001",
    "tanvitiwari002",
    "poojagupta003",
    "ritikachatterjee004",
]

ADMIN_USER = "admin"

now = datetime.now(timezone.utc)


def oid():
    """Generate a new ObjectId."""
    return ObjectId()


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # ── 1. Create two test polls ────────────────────────────────────────

    # Poll A — zoom-call (requires payment)
    poll_a_id = oid()
    opt_a_yes_id = str(oid())
    opt_a_no_id = str(oid())
    opt_a_maybe_id = str(oid())
    poll_a = {
        "_id": poll_a_id,
        "title": "Virtual Speed Dating – April 2026",
        "description": "Join us for a fun virtual speed dating event on Zoom! Pay $5 to unlock your match list.",
        "poll_type": "rsvp",
        "event_type": "zoom-call",
        "virtual_meet_payment_amount": 5.00,
        "event_date": (now + timedelta(days=7)).isoformat(),
        "event_time": "19:00",
        "event_timezone": "America/Los_Angeles",
        "event_location": "Zoom (link sent after payment)",
        "event_details": "Each participant gets 5-minute rounds with opposite-gender matches.",
        "status": "active",
        "options": [
            {"id": opt_a_yes_id, "text": "Yes, I can join!", "order": 0},
            {"id": opt_a_no_id, "text": "No, I cannot make it", "order": 1},
            {"id": opt_a_maybe_id, "text": "Maybe, I'll try", "order": 2},
        ],
        "end_date": (now + timedelta(days=6)).isoformat(),
        "end_time": "23:59",
        "end_timezone": "America/Los_Angeles",
        "collect_contact_info": True,
        "allow_comments": True,
        "anonymous": False,
        "target_all_users": True,
        "target_usernames": [],
        "created_by": ADMIN_USER,
        "created_at": now,
        "updated_at": now,
    }

    # Poll B — in-person (no payment)
    poll_b_id = oid()
    opt_b_yes_id = str(oid())
    opt_b_no_id = str(oid())
    poll_b = {
        "_id": poll_b_id,
        "title": "In-Person Mixer – Bay Area",
        "description": "Meet singles from the Bay Area at our in-person mixer event.",
        "poll_type": "rsvp",
        "event_type": "in-person",
        "virtual_meet_payment_amount": None,
        "event_date": (now + timedelta(days=14)).isoformat(),
        "event_time": "18:00",
        "event_timezone": "America/Los_Angeles",
        "event_location": "The Grand Ballroom, San Jose, CA",
        "event_details": "Dress code: smart casual. Light refreshments provided.",
        "status": "active",
        "options": [
            {"id": opt_b_yes_id, "text": "Yes, I can join!", "order": 0},
            {"id": opt_b_no_id, "text": "No, I cannot make it", "order": 1},
        ],
        "end_date": (now + timedelta(days=13)).isoformat(),
        "end_time": "23:59",
        "end_timezone": "America/Los_Angeles",
        "collect_contact_info": True,
        "allow_comments": True,
        "anonymous": False,
        "target_all_users": True,
        "target_usernames": [],
        "created_by": ADMIN_USER,
        "created_at": now,
        "updated_at": now,
    }

    # Insert polls
    await db.polls.insert_many([poll_a, poll_b])
    print(f"✅ Created poll A: {poll_a_id} (zoom-call)")
    print(f"✅ Created poll B: {poll_b_id} (in-person)")

    poll_a_str = str(poll_a_id)
    poll_b_str = str(poll_b_id)

    # ── 2. Create poll_responses (RSVP "Yes") ──────────────────────────

    async def get_user_info(username):
        user = await db.users.find_one(
            {"username": username},
            {"first_name": 1, "last_name": 1, "contactEmail": 1, "email": 1, "contactNumber": 1, "phone": 1}
        )
        if not user:
            return username.replace("_", " ").title(), f"{username}@example.com", ""
        full_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or username
        email = user.get("email") or user.get("contactEmail") or f"{username}@example.com"
        phone = user.get("phone") or user.get("contactNumber") or ""
        return full_name, email, phone

    responses_a = []
    responses_b = []

    # All males + females RSVP "Yes" to Poll A (zoom-call)
    for username in MALES + FEMALES:
        full_name, email, phone = await get_user_info(username)
        responses_a.append({
            "poll_id": poll_a_str,
            "username": username,
            "user_full_name": full_name,
            "user_email": email,
            "user_phone": phone,
            "selected_options": [opt_a_yes_id],
            "rsvp_response": "yes",
            "text_response": None,
            "comment": None,
            "responded_at": now,
            "updated_at": None,
        })

    # Admin also RSVPs to Poll A
    admin_name, admin_email, admin_phone = await get_user_info(ADMIN_USER)
    responses_a.append({
        "poll_id": poll_a_str,
        "username": ADMIN_USER,
        "user_full_name": admin_name,
        "user_email": admin_email,
        "user_phone": admin_phone,
        "selected_options": [opt_a_yes_id],
        "rsvp_response": "yes",
        "text_response": None,
        "comment": None,
        "responded_at": now,
        "updated_at": None,
    })

    # Subset RSVPs "Yes" to Poll B (in-person, no payment)
    for username in MALES[:4] + FEMALES[:4]:
        full_name, email, phone = await get_user_info(username)
        responses_b.append({
            "poll_id": poll_b_str,
            "username": username,
            "user_full_name": full_name,
            "user_email": email,
            "user_phone": phone,
            "selected_options": [opt_b_yes_id],
            "rsvp_response": "yes",
            "text_response": None,
            "comment": None,
            "responded_at": now,
            "updated_at": None,
        })

    await db.poll_responses.insert_many(responses_a + responses_b)
    print(f"✅ Created {len(responses_a)} RSVP responses for Poll A")
    print(f"✅ Created {len(responses_b)} RSVP responses for Poll B")

    # ── 3. Create virtual_meet_sessions ─────────────────────────────────

    sessions_a = []
    sessions_b = []

    def make_session(poll_id, username, gender, event_type, payment_amount, is_exempt=False):
        # Both 'zoom-call' and 'virtual' event types require payment (unless exempt).
        requires_payment = event_type in ("zoom-call", "virtual")
        if requires_payment and not is_exempt:
            payment_status = "pending"
            access_unlocked = False
        else:
            payment_status = "not_required"
            access_unlocked = True
        return {
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
            "updated_at": now,
        }

    # Poll A sessions (zoom-call, $5)
    for username in MALES:
        sessions_a.append(make_session(poll_a_str, username, "Male", "zoom-call", 5.00))
    for username in FEMALES:
        sessions_a.append(make_session(poll_a_str, username, "Female", "zoom-call", 5.00))

    # Admin session for Poll A — exempt (admin role)
    sessions_a.append(make_session(poll_a_str, ADMIN_USER, "Male", "zoom-call", 5.00, is_exempt=True))

    # Mark 2 males and 2 females as "paid" in Poll A for testing
    paid_males = MALES[:2]
    paid_females = FEMALES[:2]
    for s in sessions_a:
        if s["username"] in paid_males + paid_females:
            s["payment_status"] = "completed"
            s["access_unlocked"] = True
            s["payment_provider"] = "paypal"
            s["payment_id"] = f"test-payment-{s['username']}"
            s["paypal_order_id"] = f"PAYPAL-TEST-{s['username'].upper()}"

    # Poll B sessions (in-person, no payment)
    for username in MALES[:4]:
        sessions_b.append(make_session(poll_b_str, username, "Male", "in-person", None))
    for username in FEMALES[:4]:
        sessions_b.append(make_session(poll_b_str, username, "Female", "in-person", None))

    await db.virtual_meet_sessions.insert_many(sessions_a + sessions_b)
    print(f"✅ Created {len(sessions_a)} sessions for Poll A (zoom-call)")
    print(f"✅ Created {len(sessions_b)} sessions for Poll B (in-person)")

    # ── 4. Create sample virtual_room_requests ──────────────────────────

    requests = []

    # Poll A: 1 pending request, 1 accepted, 1 declined
    requests.append({
        "poll_id": poll_a_str,
        "requester_username": paid_males[0],
        "target_username": paid_females[0],
        "status": "pending",
        "room_id": None,
        "requested_at": now - timedelta(hours=2),
        "responded_at": None,
        "created_at": now - timedelta(hours=2),
        "updated_at": now - timedelta(hours=2),
    })
    requests.append({
        "poll_id": poll_a_str,
        "requester_username": paid_males[1],
        "target_username": paid_females[1],
        "status": "accepted",
        "room_id": None,  # will be set after room insert
        "requested_at": now - timedelta(hours=3),
        "responded_at": now - timedelta(hours=1),
        "created_at": now - timedelta(hours=3),
        "updated_at": now - timedelta(hours=1),
    })
    requests.append({
        "poll_id": poll_a_str,
        "requester_username": paid_females[0],
        "target_username": paid_males[1],
        "status": "declined",
        "room_id": None,
        "requested_at": now - timedelta(hours=4),
        "responded_at": now - timedelta(hours=3),
        "created_at": now - timedelta(hours=4),
        "updated_at": now - timedelta(hours=3),
    })

    # Poll B: 1 pending, 1 accepted
    requests.append({
        "poll_id": poll_b_str,
        "requester_username": MALES[0],
        "target_username": FEMALES[0],
        "status": "pending",
        "room_id": None,
        "requested_at": now - timedelta(hours=1),
        "responded_at": None,
        "created_at": now - timedelta(hours=1),
        "updated_at": now - timedelta(hours=1),
    })
    requests.append({
        "poll_id": poll_b_str,
        "requester_username": MALES[1],
        "target_username": FEMALES[1],
        "status": "accepted",
        "room_id": None,  # will be set after room insert
        "requested_at": now - timedelta(hours=5),
        "responded_at": now - timedelta(hours=4),
        "created_at": now - timedelta(hours=5),
        "updated_at": now - timedelta(hours=4),
    })

    await db.virtual_room_requests.insert_many(requests)
    print(f"✅ Created {len(requests)} room requests")

    # ── 5. Create sample virtual_rooms ──────────────────────────────────

    rooms = []

    # Room for the accepted request in Poll A
    rooms.append({
        "poll_id": poll_a_str,
        "room_number": 1,
        "user_a": paid_males[1],
        "user_b": paid_females[1],
        "status": "confirmed",
        "notes": None,
        "zoom_link": None,
        "created_at": now - timedelta(hours=1),
        "updated_at": now - timedelta(hours=1),
        "expires_at": now + timedelta(days=7),
    })

    # Room for the accepted request in Poll B
    rooms.append({
        "poll_id": poll_b_str,
        "room_number": 1,
        "user_a": MALES[1],
        "user_b": FEMALES[1],
        "status": "confirmed",
        "notes": None,
        "zoom_link": None,
        "created_at": now - timedelta(hours=4),
        "updated_at": now - timedelta(hours=4),
        "expires_at": now + timedelta(days=14),
    })

    await db.virtual_rooms.insert_many(rooms)
    print(f"✅ Created {len(rooms)} virtual rooms")

    # ── Summary ─────────────────────────────────────────────────────────

    print("\n" + "=" * 60)
    print("  VIRTUAL MEETS TEST DATA SUMMARY")
    print("=" * 60)
    print(f"\n  Poll A: '{poll_a['title']}'")
    print(f"    ID:           {poll_a_str}")
    print(f"    Event Type:   zoom-call (payment required: $5.00)")
    print(f"    Respondents:  {len(responses_a)} (6M + 6F + admin)")
    print(f"    Sessions:     {len(sessions_a)}")
    print(f"    Paid users:   {', '.join(paid_males + paid_females)}")
    print(f"\n  Poll B: '{poll_b['title']}'")
    print(f"    ID:           {poll_b_str}")
    print(f"    Event Type:   in-person (no payment)")
    print(f"    Respondents:  {len(responses_b)} (4M + 4F)")
    print(f"    Sessions:     {len(sessions_b)}")
    print(f"\n  Room Requests:  {len(requests)} total")
    print(f"  Virtual Rooms:  {len(rooms)} total")
    print(f"\n  Test login hints:")
    print(f"    admin         → Admin, exempt from payment, sees admin panel")
    print(f"    {paid_males[0]:20s} → Male, paid, can view matches in Poll A")
    print(f"    {paid_males[1]:20s} → Male, paid, has a confirmed room")
    print(f"    {paid_females[0]:20s} → Female, paid, has pending incoming request")
    print(f"    {paid_females[1]:20s} → Female, paid, has a confirmed room")
    print(f"    {MALES[2]:20s} → Male, unpaid, sees payment gate")
    print(f"    {FEMALES[2]:20s} → Female, unpaid, sees payment gate")
    print("=" * 60)

    client.close()
    print("\n✅ Done! Restart your backend server to pick up the new data.")


if __name__ == "__main__":
    asyncio.run(main())
