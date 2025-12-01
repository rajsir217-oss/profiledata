"""
Retroactive Invitation Matcher Job Template
============================================

This job runs daily to match registered users with their invitations.
It decrypts user emails and updates invitation status to "ACCEPTED" for users who registered.

Schedule: Daily at 2:00 AM
Purpose: Ensure invitation acceptance tracking is up-to-date
"""

from datetime import datetime
from typing import Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from crypto_utils import PIIEncryption
from .base import JobTemplate, JobExecutionContext, JobResult
import logging

logger = logging.getLogger(__name__)


async def execute(db: AsyncIOMotorDatabase) -> dict:
    """
    Match registered users to their invitations
    
    Args:
        db: MongoDB database instance
        
    Returns:
        dict: Execution results with match counts
    """
    logger.info("🔄 Starting retroactive invitation matching...")
    
    try:
        # Initialize encryption (use config from running app)
        from config import settings as app_settings
        encryption = PIIEncryption(app_settings.encryption_key)
        
    except Exception as e:
        error_msg = f"Failed to initialize encryption: {e}"
        logger.error(f"❌ {error_msg}")
        return {
            "status": "error",
            "error": error_msg,
            "matched": 0,
            "already_matched": 0,
            "not_matched": 0
        }
    
    # Get all users
    users_cursor = db.users.find({})
    users = await users_cursor.to_list(length=None)
    total_users = len(users)
    
    logger.info(f"📊 Found {total_users} registered users to check")
    
    matched_count = 0
    already_matched_count = 0
    not_matched_count = 0
    errors = []
    
    # Check each user
    for user in users:
        username = user.get("username")
        encrypted_email = user.get("contactEmail")
        registered_at = user.get("created_at") or user.get("createdAt")
        
        if not encrypted_email:
            logger.debug(f"User {username} has no contactEmail, skipping")
            continue
        
        # Decrypt email
        try:
            decrypted_email = encryption.decrypt(encrypted_email)
        except Exception as e:
            logger.warning(f"Failed to decrypt email for {username}: {e}")
            errors.append(f"{username}: decrypt failed")
            continue
        
        # Look for invitation with this email
        invitation = await db.invitations.find_one({
            "email": decrypted_email,
            "archived": False
        })
        
        if invitation:
            # Check if already matched
            if invitation.get("registeredUsername"):
                already_matched_count += 1
                logger.debug(f"Invitation for {username} already matched")
                continue
            
            # Update invitation status
            try:
                result = await db.invitations.update_one(
                    {"_id": invitation["_id"]},
                    {
                        "$set": {
                            "emailStatus": "accepted",  # lowercase to match InvitationStatus enum
                            "smsStatus": "accepted",    # lowercase to match InvitationStatus enum
                            "registeredUsername": username,
                            "registeredAt": registered_at,
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
                
                if result.modified_count > 0:
                    matched_count += 1
                    logger.info(f"✅ Matched and updated: {username} ({decrypted_email})")
                else:
                    logger.warning(f"No changes made for {username}")
                    
            except Exception as e:
                logger.error(f"Failed to update invitation for {username}: {e}")
                errors.append(f"{username}: update failed - {e}")
        else:
            not_matched_count += 1
            logger.debug(f"No invitation found for {username} ({decrypted_email})")
    
    # Summary
    logger.info("=" * 80)
    logger.info("📊 RETROACTIVE MATCHING SUMMARY")
    logger.info(f"Total Users Checked: {total_users}")
    logger.info(f"✅ Newly Matched: {matched_count}")
    logger.info(f"↪️  Already Matched: {already_matched_count}")
    logger.info(f"⏭️  Not Matched: {not_matched_count}")
    
    if errors:
        logger.warning(f"⚠️  Errors: {len(errors)}")
        for error in errors[:5]:  # Log first 5 errors
            logger.warning(f"   - {error}")
    
    # Verification
    accepted_count = await db.invitations.count_documents({
        "emailStatus": "accepted"  # lowercase to match InvitationStatus enum
    })
    logger.info(f"🔍 Total Accepted Invitations: {accepted_count}")
    
    return {
        "status": "success",
        "total_users": total_users,
        "matched": matched_count,
        "already_matched": already_matched_count,
        "not_matched": not_matched_count,
        "errors": len(errors),
        "total_accepted_invitations": accepted_count
    }


class RetroactiveInvitationMatcherTemplate(JobTemplate):
    """Job template for retroactively matching users to invitations"""
    
    # Template metadata
    template_type = "retroactive_invitation_matcher"
    template_name = "Retroactive Invitation Matcher"
    template_description = "Matches registered users to their invitations and updates acceptance status"
    category = "invitation_management"
    icon = "🔄"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "low"
    
    def get_default_schedule(self) -> str:
        """Daily at 2:00 AM"""
        return "0 0 2 * * *"  # cron: second minute hour day month weekday
    
    def get_schema(self) -> Dict[str, Any]:
        """Define job parameters schema (no parameters needed)"""
        return {
            "type": "object",
            "properties": {}
        }
    
    def validate_params(self, params: Dict[str, Any]) -> tuple:
        """Validate job parameters (no validation needed)"""
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """
        Execute retroactive invitation matching
        
        Args:
            context: Job execution context containing database and parameters
            
        Returns:
            JobResult with match statistics
        """
        db = context.db
        result = await execute(db)
        
        if result.get("status") == "error":
            return JobResult(
                status="failed",
                message="Retroactive matching failed",
                errors=[result.get("error")],
                duration_seconds=0.0
            )
        
        return JobResult(
            status="completed",
            message=f"Matched {result['matched']} users to invitations",
            details=result,
            duration_seconds=0.0
        )
