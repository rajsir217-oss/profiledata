"""
v2 patch: restore the missing_photo_warning and missing_photo_suspended
email template bodies with clean HTML — correct variables, no stale
{match.profileId}, and a proper profile-link replacing the Profile ID line.

Usage:
    PYTHONPATH=/path/to/fastapi_backend python3 migrations/patch_missing_photo_template_v2.py production
"""
import sys
import os
import asyncio

if len(sys.argv) > 1:
    env = sys.argv[1].lower()
    if env in ["production", "local", "staging"]:
        os.environ["APP_ENVIRONMENT"] = env

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()

WARNING_BODY = """
<p>Hi {recipient.firstName},</p>
<p>Your profile is missing required information. To keep your account active, please resolve the following within <strong>{graceDays} days</strong>:</p>
{compliance_issue_list_html}
<p>
  <a href="{profile_url}" style="display:inline-block;padding:10px 20px;background:#ef4444;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
    Update Your Profile
  </a>
</p>
<p>If these updates aren't completed in time, your account will be automatically suspended.</p>
""".strip()

SUSPENDED_BODY = """
<p>Hi {recipient.firstName},</p>
<p>Your account has been <strong>suspended</strong> because the following requirements were not resolved in time:</p>
{compliance_issue_list_html}
<p>Once you've updated your profile, please <a href="{profile_url}">contact support</a> so we can review and reactivate your account.</p>
<p>
  <a href="{profile_url}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
    Update Your Profile
  </a>
</p>
""".strip()


async def patch():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    patches = [
        ("missing_photo_warning", WARNING_BODY),
        ("missing_photo_suspended", SUSPENDED_BODY),
    ]

    for trigger, new_body in patches:
        template = await db.notification_templates.find_one({"trigger": trigger})
        if not template:
            print(f"  ⚠️  No template found for: {trigger}")
            continue

        updates = {}

        # Flat structure
        if "body" in template or "bodyTemplate" in template or "htmlBody" in template:
            for field in ("body", "bodyTemplate", "htmlBody"):
                if field in template:
                    updates[field] = new_body

        # Nested channels.email structure
        channels = template.get("channels", {})
        if isinstance(channels, dict) and "email" in channels:
            email_cfg = channels["email"]
            for field in ("body", "htmlBody", "bodyTemplate"):
                if field in email_cfg:
                    updates[f"channels.email.{field}"] = new_body

        if updates:
            await db.notification_templates.update_one(
                {"trigger": trigger},
                {"$set": updates}
            )
            print(f"  ✅ Restored {trigger} ({', '.join(updates.keys())})")
        else:
            print(f"  ⚠️  {trigger}: no body field found to update")

    print("\nDone.")
    client.close()


if __name__ == "__main__":
    asyncio.run(patch())
