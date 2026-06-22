"""
One-time patch: remove stale {match.profileId} / Profile ID lines from the
missing_photo_warning and missing_photo_suspended notification templates.

Usage:
    python3 migrations/patch_missing_photo_template.py            # local
    python3 migrations/patch_missing_photo_template.py production # production
"""
import sys
import os
import re
import asyncio

if len(sys.argv) > 1:
    env = sys.argv[1].lower()
    if env in ["production", "local", "staging"]:
        os.environ["APP_ENVIRONMENT"] = env

from motor.motor_asyncio import AsyncIOMotorClient
from config import Settings

settings = Settings()

# Patterns to scrub from template bodies (HTML and plain-text variants)
_SCRUB_PATTERNS = [
    # Whole <p> or <div> containing the placeholder
    re.compile(r'<p[^>]*>[^<]*Profile\s*ID\s*:?\s*\{[^}]+\}[^<]*</p>', re.IGNORECASE),
    re.compile(r'<div[^>]*>[^<]*Profile\s*ID\s*:?\s*\{[^}]+\}[^<]*</div>', re.IGNORECASE),
    # Inline span/label
    re.compile(r'<[^>]+>[^<]*Profile\s*ID\s*:?\s*\{[^}]+\}[^<]*</[^>]+>', re.IGNORECASE),
    # Plain-text lines: "Profile ID: {match.profileId}" or similar
    re.compile(r'Profile\s*ID\s*:?\s*\{[\w.]+\}', re.IGNORECASE),
    # Any residual unresolved single/double brace placeholders
    re.compile(r'\{\{[\w. ]+\}\}'),
    re.compile(r'\{[\w.]+\}'),
]


def _scrub(text: str) -> str:
    if not text:
        return text
    for pattern in _SCRUB_PATTERNS:
        text = pattern.sub('', text)
    return text.strip()


async def patch():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    triggers = ["missing_photo_warning", "missing_photo_suspended"]
    patched = 0

    for trigger in triggers:
        template = await db.notification_templates.find_one({"trigger": trigger})
        if not template:
            print(f"  ⚠️  No template found for trigger: {trigger}")
            continue

        updates = {}

        # Flat structure: body / bodyTemplate field
        for field in ("body", "bodyTemplate", "htmlBody"):
            if field in template:
                cleaned = _scrub(template[field])
                if cleaned != template[field]:
                    updates[field] = cleaned
                    print(f"  📝 {trigger}.{field}: removed stale placeholder")

        # Nested structure: channels.email.body / htmlBody
        channels = template.get("channels", {})
        if isinstance(channels, dict):
            for channel_name, channel_cfg in channels.items():
                if not isinstance(channel_cfg, dict):
                    continue
                for field in ("body", "htmlBody", "bodyTemplate"):
                    if field in channel_cfg:
                        cleaned = _scrub(channel_cfg[field])
                        if cleaned != channel_cfg[field]:
                            updates[f"channels.{channel_name}.{field}"] = cleaned
                            print(f"  📝 {trigger}.channels.{channel_name}.{field}: removed stale placeholder")

        if updates:
            await db.notification_templates.update_one(
                {"trigger": trigger},
                {"$set": updates}
            )
            patched += 1
            print(f"  ✅ Patched {trigger}")
        else:
            print(f"  ✓  {trigger}: nothing to patch")

    print(f"\nDone — {patched} template(s) updated.")
    client.close()


if __name__ == "__main__":
    asyncio.run(patch())
