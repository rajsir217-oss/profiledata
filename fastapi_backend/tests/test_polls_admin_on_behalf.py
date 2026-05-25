import asyncio

from auth.jwt_auth import get_current_user_dependency
from main import app
from database import get_database


def _run(coro):
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)


def test_admin_can_add_member_and_respond_on_behalf(test_client, test_db):
    # Seed users
    _run(
        test_db.users.insert_many(
            [
                {"username": "admin1", "role": "admin", "accountStatus": "active"},
                {"username": "member1", "role": "free_user", "accountStatus": "active"},
            ]
        )
    )

    # Create a poll directly in DB
    poll_doc = {
        "title": "Test RSVP",
        "description": "test",
        "poll_type": "rsvp",
        "options": [
            {"id": "opt_yes", "text": "Yes, I can join!", "order": 0},
            {"id": "opt_no", "text": "No, I cannot make it", "order": 1},
        ],
        "event_type": None,
        "collect_contact_info": False,
        "allow_comments": True,
        "anonymous": False,
        "start_date": None,
        "end_date": None,
        "status": "active",
        "target_all_users": False,
        "target_usernames": [],
        "created_by": "admin1",
        "created_at": None,
        "updated_at": None,
    }
    result = _run(test_db.polls.insert_one(poll_doc))
    poll_id = str(result.inserted_id)

    # Override auth to be admin
    app.dependency_overrides[get_database] = lambda: test_db
    app.dependency_overrides[get_current_user_dependency] = lambda: {
        "username": "admin1",
        "role": "admin",
        "accountStatus": "active",
    }

    try:
        res = test_client.post(f"/api/polls/admin/{poll_id}/members", params={"username": "member1"})
        assert res.status_code == 200
        assert res.json().get("success") is True

        res2 = test_client.post(
            f"/api/polls/admin/{poll_id}/respond-on-behalf",
            json={"username": "member1", "rsvp_response": "yes", "comment": "admin override"},
        )
        assert res2.status_code == 200
        assert res2.json().get("success") is True

        # Verify response recorded
        saved = _run(test_db.poll_responses.find_one({"poll_id": poll_id, "username": "member1"}))
        assert saved is not None
        assert saved.get("rsvp_response") == "yes"
        assert saved.get("admin_on_behalf") is True
        assert saved.get("admin_username") == "admin1"
        assert saved.get("selected_options") == ["opt_yes"]

    finally:
        app.dependency_overrides.clear()
