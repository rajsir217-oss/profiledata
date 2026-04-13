"""
Referrer Auto-Invite Job Template
Automatically verifies referrers on pending registration interests
and sends invitations when the referrer is a verified existing user.

Flow:
1. Fetch all registration interests with status="pending_review" that have referredBy data
2. Verify each referrer against the users collection (using hash fields for encrypted PII)
3. If verified, auto-send invitation with promoCode="PUBLIC"
4. Update interest status to "invited"
"""

import asyncio
import os
import re
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
from urllib.parse import quote
from bson import ObjectId

from .base import JobTemplate, JobExecutionContext, JobResult


class ReferrerAutoInviteTemplate(JobTemplate):
    """Job template for auto-verifying referrers and sending invitations"""

    # Template metadata
    template_type = "referrer_auto_invite"
    template_name = "Referrer Auto-Invite"
    template_description = "Verify referrers on pending interests and auto-send invitations with promo code PUBLIC"
    category = "invitations"
    icon = "🤖"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "low"

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate job parameters"""
        batch_size = params.get("batchSize", 50)
        if not isinstance(batch_size, int) or batch_size < 1 or batch_size > 200:
            return False, "batchSize must be an integer between 1 and 200"

        return True, None

    def get_default_params(self) -> Dict[str, Any]:
        """Get default parameters"""
        return {
            "batchSize": 50,
            "testMode": False,
            "promoCode": "PUBLIC"
        }

    def get_schema(self) -> Dict[str, Any]:
        """Get parameter schema for UI"""
        return {
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Maximum number of interests to process per run",
                "default": 50,
                "min": 1,
                "max": 200
            },
            "testMode": {
                "type": "boolean",
                "label": "Test Mode",
                "description": "Don't actually send invitations, just log what would be sent",
                "default": False
            },
            "promoCode": {
                "type": "string",
                "label": "Promo Code",
                "description": "Promo code to attach to auto-invitations",
                "default": "PUBLIC"
            }
        }

    async def _verify_referrer(self, ref: dict, db) -> Optional[dict]:
        """
        Verify a referrer against the users collection.
        Returns matched user dict or None.
        """
        from crypto_utils import PIIEncryption

        ref_first = (ref.get("firstName") or "").strip()
        ref_last = (ref.get("lastName") or "").strip()
        ref_phone = re.sub(r"\D", "", ref.get("phone") or "")
        ref_email = (ref.get("email") or "").strip().lower()

        if not ref_first and not ref_last:
            return None

        # Build name conditions
        name_conditions = []
        if ref_first:
            name_conditions.append({"firstName": {"$regex": f"^{re.escape(ref_first)}$", "$options": "i"}})
        if ref_last:
            name_conditions.append({"lastName": {"$regex": f"^{re.escape(ref_last)}$", "$options": "i"}})

        # Build contact conditions using hash fields (PII is encrypted)
        contact_conditions = []
        if ref_phone:
            raw_ref_phone = (ref.get("phone") or "").strip()
            phone_hashes = set()
            for variant in [ref_phone[-10:], ref_phone, raw_ref_phone]:
                h = PIIEncryption.hash_for_lookup(variant)
                if h:
                    phone_hashes.add(h)
            if phone_hashes:
                contact_conditions.append({"contactNumberHash": {"$in": list(phone_hashes)}})
        if ref_email:
            email_hash = PIIEncryption.hash_for_lookup(ref_email)
            if email_hash:
                contact_conditions.append({"contactEmailHash": email_hash})

        if not name_conditions or not contact_conditions:
            return None

        # Strategy 1: name AND (phone OR email)
        user_query = {"$and": name_conditions + [{"$or": contact_conditions}]}
        matched_user = await db.users.find_one(user_query, {"username": 1, "firstName": 1, "lastName": 1})

        # Strategy 2: contact-only fallback
        if not matched_user and contact_conditions:
            contact_query = {"$or": contact_conditions} if len(contact_conditions) > 1 else contact_conditions[0]
            matched_user = await db.users.find_one(contact_query, {"username": 1, "firstName": 1, "lastName": 1})

        return matched_user

    async def _send_invitation(self, interest: dict, db, promo_code: str, context: JobExecutionContext) -> Optional[str]:
        """
        Create and send an invitation for a verified interest.
        Returns invitation ID on success, None on failure.
        """
        from services.invitation_service import InvitationService
        from models.invitation_models import InvitationCreate, InvitationChannel, InvitationStatus
        from services.email_sender import send_invitation_email
        from config import settings

        interest_id = interest["_id"]

        # Check for existing invitation
        existing_inv = await db.invitations.find_one({
            "email": interest["email"],
            "archived": False
        })
        if existing_inv:
            # Link interest to existing invitation
            await db.registration_interests.update_one(
                {"_id": interest_id},
                {"$set": {
                    "status": "invited",
                    "invitationId": existing_inv["_id"],
                    "updatedAt": datetime.utcnow()
                }}
            )
            context.log("info", f"🔗 Interest {interest_id} linked to existing invitation {existing_inv['_id']}")
            return str(existing_inv["_id"])

        inv_service = InvitationService(db)
        inv_name = f"{interest['firstName']} {interest['lastName']}"

        try:
            inv_data = InvitationCreate(
                name=inv_name,
                email=interest["email"],
                phone=interest.get("phone"),
                channel=InvitationChannel.EMAIL,
                sendImmediately=True,
                promoCode=promo_code
            )
            new_invitation = await inv_service.create_invitation(
                invitation_data=inv_data,
                invited_by="system"
            )
        except Exception as e:
            context.log("error", f"❌ Failed to create invitation for {interest['email']}: {e}")
            return None

        # Store interestId, verificationPath, and referredBy on the invitation
        update_fields = {
            "interestId": interest_id,
            "verificationPath": "referral"
        }
        if interest.get("referredBy"):
            update_fields["referredByInfo"] = interest["referredBy"]

        await db.invitations.update_one(
            {"_id": ObjectId(new_invitation.id)},
            {"$set": update_fields}
        )

        # Build and send invitation email
        base_url = settings.app_url or settings.frontend_url or "https://l3v3lmatches.com"
        if 'localhost' in base_url and os.environ.get('K_SERVICE'):
            base_url = os.environ.get('APP_URL') or os.environ.get('FRONTEND_URL') or "https://l3v3lmatches.com"
        invitation_link = f"{base_url}/register2?invitation={new_invitation.invitationToken}&email={quote(interest['email'])}&promo={promo_code}"

        try:
            await send_invitation_email(
                to_email=interest["email"],
                to_name=inv_name,
                invitation_link=invitation_link
            )
            await inv_service.update_invitation_status(
                new_invitation.id,
                InvitationChannel.EMAIL,
                InvitationStatus.SENT
            )
        except Exception as e:
            context.log("warning", f"⚠️ Invitation created but email failed for {interest['email']}: {e}")

        # Update interest status to invited
        now = datetime.utcnow()
        await db.registration_interests.update_one(
            {"_id": interest_id},
            {"$set": {
                "status": "invited",
                "verificationPath": "referral",
                "reviewedBy": "system",
                "reviewedAt": now,
                "invitationId": ObjectId(new_invitation.id),
                "updatedAt": now
            }}
        )

        return new_invitation.id

    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the referrer auto-invite job"""
        start_time = datetime.utcnow()
        verified_count = 0
        invited_count = 0
        skipped_count = 0
        failed_count = 0
        no_match_count = 0
        errors = []

        try:
            params = context.parameters
            batch_size = params.get("batchSize", 50)
            test_mode = params.get("testMode", False)
            promo_code = params.get("promoCode", "PUBLIC")

            context.log("info", f"🔍 Searching for pending interests with referrer data (batch={batch_size})")

            # Fetch pending_review interests that have referredBy data
            query = {
                "status": "pending_review",
                "referredBy": {"$ne": None}
            }
            cursor = context.db.registration_interests.find(query).limit(batch_size)
            interests = await cursor.to_list(length=batch_size)

            if not interests:
                return JobResult(
                    status="success",
                    message="No pending interests with referrer data found",
                    details={"checked": 0, "verified": 0, "invited": 0},
                    duration_seconds=(datetime.utcnow() - start_time).total_seconds()
                )

            context.log("info", f"📋 Found {len(interests)} pending interests with referrer data")

            for interest in interests:
                interest_id = interest["_id"]
                email = interest.get("email", "unknown")
                ref = interest.get("referredBy")

                if not ref:
                    skipped_count += 1
                    continue

                try:
                    # Verify the referrer
                    matched_user = await self._verify_referrer(ref, context.db)

                    if not matched_user:
                        no_match_count += 1
                        context.log("info", f"❌ No match for referrer of {email} ({ref.get('firstName', '')} {ref.get('lastName', '')})")
                        continue

                    verified_count += 1
                    matched_name = f"{matched_user.get('firstName', '')} {matched_user.get('lastName', '')}".strip()
                    matched_username = matched_user.get("username", "unknown")
                    context.log("info", f"✅ Referrer verified for {email} → {matched_username} ({matched_name})")

                    if test_mode:
                        context.log("info", f"🧪 [TEST] Would send invitation to {email} with promo={promo_code}")
                        continue

                    # Send invitation
                    inv_id = await self._send_invitation(interest, context.db, promo_code, context)
                    if inv_id:
                        invited_count += 1
                        context.log("info", f"📧 Invitation sent to {email} (inv: {inv_id})")
                    else:
                        failed_count += 1
                        errors.append(f"Failed to send invitation to {email}")

                    # Rate limiting between emails
                    await asyncio.sleep(1.0)

                except Exception as e:
                    failed_count += 1
                    error_msg = f"Error processing interest {interest_id}: {str(e)}"
                    errors.append(error_msg)
                    context.log("error", f"❌ {error_msg}")

            duration = (datetime.utcnow() - start_time).total_seconds()

            status = "success"
            if failed_count > 0 and invited_count == 0 and verified_count > 0:
                status = "failed"
            elif failed_count > 0:
                status = "partial"

            return JobResult(
                status=status,
                message=f"Processed {len(interests)} interests: {verified_count} verified, {invited_count} invited, {no_match_count} no match, {failed_count} failed",
                details={
                    "total": len(interests),
                    "verified": verified_count,
                    "invited": invited_count,
                    "noMatch": no_match_count,
                    "skipped": skipped_count,
                    "failed": failed_count,
                    "testMode": test_mode,
                    "promoCode": promo_code
                },
                records_processed=len(interests),
                records_affected=invited_count,
                errors=errors[:10],
                duration_seconds=duration
            )

        except Exception as e:
            context.log("error", f"Referrer auto-invite job failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Referrer auto-invite job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
