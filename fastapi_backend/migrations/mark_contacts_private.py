"""Mark non-primary contactNumbers entries as private (visible=False).

Context:
  The profile-share SMS flow historically auto-created contactNumbers entries
  with visible=True, exposing the sender's SMS-recipient phone numbers on their
  public profile. New entries now default to visible=True only for "primary";
  all other recipient types default to visible=False (see /send-sms).

  This migration flips every non-primary contactNumbers[].visible to False so
  those numbers are no longer member-visible. The "primary" contact stays
  visible. Users can re-enable visibility via profile edit if they
  intentionally want a number public.

Run (production — default):
    python migrations/mark_contacts_private.py

Run against local dev:
    ENV_FILE=.env python migrations/mark_contacts_private.py

Idempotent: safe to run multiple times.
"""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ENV_FILE = os.getenv("ENV_FILE", ".env.production")
load_dotenv(ENV_FILE)
URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB = os.getenv("DATABASE_NAME", os.getenv("DB_NAME", "matrimonialDB"))


async def main():
    c = AsyncIOMotorClient(URL)
    db = c[DB]

    # Find users that have a non-primary contactNumbers entry with visible=True
    users = await db.users.find(
        {"contactNumbers": {"$elemMatch": {"visible": True, "label": {"$ne": "primary"}}}},
        {"username": 1, "contactNumbers": 1}
    ).to_list(length=None)

    if not users:
        print("✅ No users with visible non-primary contactNumbers found.")
        c.close()
        return

    total_updated = 0
    for user in users:
        username = user.get("username")
        contacts = user.get("contactNumbers") or []
        # Flip any non-primary visible=True entry to False (preserve number/label)
        updated_contacts = []
        changed_count = 0
        for entry in contacts:
            if (
                isinstance(entry, dict)
                and entry.get("visible") is True
                and str(entry.get("label", "")).lower() != "primary"
            ):
                updated_contacts.append({**entry, "visible": False})
                changed_count += 1
            else:
                updated_contacts.append(entry)

        if changed_count:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"contactNumbers": updated_contacts}}
            )
            total_updated += changed_count
            print(f"   ✅ {username}: marked {changed_count} non-primary contact(s) private")
        else:
            print(f"   ➖ {username}: no change")

    print(f"\n✅ Done. Marked {total_updated} contact entries private across {len(users)} user(s).")
    c.close()


if __name__ == "__main__":
    asyncio.run(main())
