"""
Update all seeded email templates to use the latest L3V3L Matches logo asset.

Run with the target MongoDB URL in the environment:
    MONGODB_URL="..." DATABASE_NAME="..." python scripts/update_email_logo_to_latest.py

What it does:
- Replaces emoji/text logo blobs (🦋 L3V3L / 🦋 ProfileData) with <img src="{app.logoUrl}">
- Expands logo width from 120px to 200px for the new horizontal logo
- Fixes alt text to "L3V3L Matches"
- Replaces "ProfileData" and "USVedika" branding with "L3V3L Matches" in plain text
"""
import asyncio
import os
import re
import sys
from datetime import datetime, timezone

# Allow running as a script from fastapi_backend/scripts/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

LOGO_IMG = '<img src="{app.logoUrl}" alt="L3V3L Matches" style="width: 200px; height: auto;" />'
LOGO_CONTAINER_RE = re.compile(
    r'<div[^>]*style="[^"]*font-size:[^"]*"[^>]*>\s*s*🦋\s*(?:L3V3L|ProfileData)\s*</div>',
    re.IGNORECASE
)
ALT_RE = re.compile(r'alt="L3V3L"(?!\s)')
WIDTH_RE = re.compile(r'\.logo-container img \{ width: 120px; height: auto; \}')


async def update_templates():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    templates = await db.notification_templates.find({"channel": "email"}).to_list(None)
    print(f"Found {len(templates)} email templates")

    updated = 0
    skipped = 0

    for template in templates:
        body = template.get("body") or ""
        if not body:
            skipped += 1
            continue

        new_body = body
        # Replace emoji/text logo divs
        new_body = LOGO_CONTAINER_RE.sub(LOGO_IMG, new_body)
        # Replace explicit text-only logos
        new_body = new_body.replace("🦋 L3V3L", "")
        new_body = new_body.replace("🦋 ProfileData", "")
        # Fix alt and size
        new_body = ALT_RE.sub('alt="L3V3L Matches"', new_body)
        new_body = WIDTH_RE.sub(".logo-container img { width: 200px; height: auto; }", new_body)
        # Branding clean-up
        new_body = new_body.replace(">ProfileData", ">L3V3L Matches")
        new_body = new_body.replace("ProfileData. All rights reserved", "L3V3L MATCHES. All rights reserved")
        new_body = new_body.replace("have saved searches on ProfileData", "have saved searches on L3V3L Matches")
        new_body = new_body.replace("Welcome to USVedika", "Welcome to L3V3L Matches")

        if new_body != body:
            await db.notification_templates.update_one(
                {"_id": template["_id"]},
                {
                    "$set": {
                        "body": new_body,
                        "updatedAt": datetime.now(timezone.utc)
                    }
                }
            )
            updated += 1
            print(f"Updated: {template.get('trigger')}")
        else:
            skipped += 1

    print(f"\�nn✅ Done: {updated} updated, {skipped} unchanged")
    client.close()


if __name__ == "__main__":
    asyncio.run(update_templates())
