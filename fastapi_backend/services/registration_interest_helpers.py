"""Utility helpers for registration interest workflow transitions."""

from datetime import datetime
from typing import Optional
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def mark_interest_activated(
    db: AsyncIOMotorDatabase,
    email: Optional[str],
    username: Optional[str],
    source: str = "verification",
) -> bool:
    """Mark a registration interest entry as activated.

    Args:
        db: Mongo database handle.
        email: Email address to match (case-insensitive).
        username: Username that completed activation.
        source: Description of what triggered activation (for auditing).

    Returns:
        True if a document was updated, False otherwise.
    """
    if not db or not email:
        return False

    normalized_email = email.strip().lower()
    if not normalized_email:
        return False

    update_fields = {
        "status": "activated",
        "linkedUsername": username,
        "linkedAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    if source:
        update_fields["activationSource"] = source

    result = await db.registration_interests.update_one(
        {
            "email": normalized_email,
            "status": {"$ne": "activated"},
        },
        {"$set": update_fields},
    )

    if result.modified_count:
        logger.info(
            "✅ Registration interest for %s marked activated via %s",
            normalized_email,
            source,
        )
        return True

    if result.matched_count:
        logger.debug(
            "Registration interest for %s already activated; no update needed",
            normalized_email,
        )

    return False
