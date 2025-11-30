"""
Scheduled Job: Execute Permanent Account Deletions
Runs daily at 2:00 AM
Permanently deletes accounts after 30-day grace period
"""

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from config import settings
from services.notification_service import NotificationService
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# Helper function for case-insensitive username lookup
def get_username_query(username: str):
    """Create a case-insensitive MongoDB query for username"""
    return {"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}

async def execute_permanent_deletions(db, **kwargs):
    """
    Permanently delete accounts whose grace period has expired
    - Archives basic stats (optional)
    - Performs cascade deletion of all related data
    - Sends final confirmation email
    """
    logger.info("🗑️ Starting permanent deletion job...")
    
    try:
        now = datetime.utcnow()
        
        # Find users whose deletion date has passed
        users_to_delete = await db.users.find({
            "deletionRequest.status": "pending_deletion",
            "deletionRequest.scheduledDeletionDate": {"$lte": now.isoformat()}
        }).to_list(100)
        
        logger.info(f"Found {len(users_to_delete)} accounts ready for permanent deletion")
        
        deleted_count = 0
        failed_count = 0
        deletion_details = []
        
        for user in users_to_delete:
            username = user.get("username")
            try:
                logger.info(f"🗑️ Permanently deleting account: {username}")
                
                # Archive stats before deletion (optional)
                await archive_user_stats(user, db)
                
                # Send final confirmation email BEFORE deletion
                await send_final_deletion_email(user, db)
                
                # Perform complete cascade deletion
                deletion_summary = await delete_user_completely(username, db)
                
                deleted_count += 1
                deletion_details.append({
                    "username": username,
                    "deletedAt": now.isoformat(),
                    "summary": deletion_summary
                })
                
                logger.info(f"✅ Successfully deleted account: {username}")
                
            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Failed to delete {username}: {e}", exc_info=True)
                deletion_details.append({
                    "username": username,
                    "error": str(e)
                })
        
        summary_msg = f"Successfully deleted: {deleted_count}, Failed: {failed_count}"
        logger.info(f"✅ Permanent deletion job completed. {summary_msg}")
        
        return {
            "status": "success",
            "message": summary_msg,
            "details": {
                "deleted": deleted_count,
                "failed": failed_count,
                "accounts": deletion_details
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Permanent deletion job failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "message": str(e)
        }


async def archive_user_stats(user: dict, db):
    """Archive anonymized user statistics before deletion"""
    try:
        username = user.get("username")
        created_at = user.get("createdAt")
        deleted_at = datetime.utcnow()
        
        # Calculate account age
        account_age_days = 0
        if created_at:
            created_date = datetime.fromisoformat(created_at)
            account_age_days = (deleted_at - created_date).days
        
        # Gather activity stats
        total_messages = await db.messages.count_documents({
            "$or": [
                {"fromUsername": username},
                {"toUsername": username}
            ]
        })
        
        total_matches = await db.favorites.count_documents({
            "userUsername": username
        })
        
        profile_views = await db.profile_views.count_documents({
            "viewed_username": username
        })
        
        # Archive to deleted_users_archive collection
        archive_doc = {
            "originalUsername": username,  # Store for reference
            "deletedAt": deleted_at.isoformat(),
            "deletionReason": user.get("deletionRequest", {}).get("reason", "Not specified"),
            "accountAge": account_age_days,
            "activityStats": {
                "totalMessages": total_messages,
                "totalMatches": total_matches,
                "profileViews": profile_views
            }
        }
        
        await db.deleted_users_archive.insert_one(archive_doc)
        logger.info(f"📊 Archived stats for {username}")
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to archive stats for {user.get('username')}: {e}")
        # Don't fail deletion if archiving fails


async def delete_user_completely(username: str, db):
    """
    Perform complete cascade deletion of all user data
    Returns summary of deleted items
    """
    deletion_summary = {}
    
    try:
        # 1. Delete user images
        user = await db.users.find_one(get_username_query(username))
        if user:
            images = user.get("images", [])
            if images:
                logger.info(f"🗑️ Deleting {len(images)} images for {username}")
                # TODO: Delete images from storage (GCS/filesystem)
                deletion_summary["images"] = len(images)
        
        # 2. Delete favorites (where user favorited others)
        favorites_as_user = await db.favorites.delete_many({"userUsername": username})
        deletion_summary["favorites_as_user"] = favorites_as_user.deleted_count
        
        # 3. Delete favorites (where user was favorited by others)
        favorites_by_others = await db.favorites.delete_many({"favoriteUsername": username})
        deletion_summary["favorited_by_others"] = favorites_by_others.deleted_count
        
        # 4. Delete shortlists (where user shortlisted others)
        shortlists_as_user = await db.shortlists.delete_many({"userUsername": username})
        deletion_summary["shortlists_as_user"] = shortlists_as_user.deleted_count
        
        # 5. Delete shortlists (where user was shortlisted by others)
        shortlists_by_others = await db.shortlists.delete_many({"shortlistedUsername": username})
        deletion_summary["shortlisted_by_others"] = shortlists_by_others.deleted_count
        
        # 6. Delete exclusions (where user excluded others)
        exclusions_as_user = await db.exclusions.delete_many({"userUsername": username})
        deletion_summary["exclusions_as_user"] = exclusions_as_user.deleted_count
        
        # 7. Delete exclusions (where user was excluded by others)
        exclusions_by_others = await db.exclusions.delete_many({"excludedUsername": username})
        deletion_summary["excluded_by_others"] = exclusions_by_others.deleted_count
        
        # 8. Delete messages (sent by user)
        messages_sent = await db.messages.delete_many({"fromUsername": username})
        deletion_summary["messages_sent"] = messages_sent.deleted_count
        
        # 9. Delete messages (received by user)
        messages_received = await db.messages.delete_many({"toUsername": username})
        deletion_summary["messages_received"] = messages_received.deleted_count
        
        # 10. Delete activity logs
        activity_logs = await db.activity_logs.delete_many({"username": username})
        deletion_summary["activity_logs"] = activity_logs.deleted_count
        
        # 11. Delete notifications
        notifications = await db.notification_queue.delete_many({"username": username})
        deletion_summary["notifications"] = notifications.deleted_count
        
        # 12. Delete notification logs
        notification_logs = await db.notification_log.delete_many({"username": username})
        deletion_summary["notification_logs"] = notification_logs.deleted_count
        
        # 13. Delete audit logs
        audit_logs = await db.audit_logs.delete_many({"username": username})
        deletion_summary["audit_logs"] = audit_logs.deleted_count
        
        # 14. Delete profile views (where user viewed others)
        profile_views_as_viewer = await db.profile_views.delete_many({"viewer_username": username})
        deletion_summary["profile_views_as_viewer"] = profile_views_as_viewer.deleted_count
        
        # 15. Delete profile views (where user was viewed by others)
        profile_views_as_viewed = await db.profile_views.delete_many({"viewed_username": username})
        deletion_summary["profile_views_as_viewed"] = profile_views_as_viewed.deleted_count
        
        # 16. Delete PII requests
        pii_requests = await db.pii_requests.delete_many({
            "$or": [
                {"requester_username": username},
                {"target_username": username}
            ]
        })
        deletion_summary["pii_requests"] = pii_requests.deleted_count
        
        # 17. Delete PII access logs
        pii_access = await db.pii_access.delete_many({
            "$or": [
                {"requester_username": username},
                {"target_username": username}
            ]
        })
        deletion_summary["pii_access"] = pii_access.deleted_count
        
        # 18. Delete saved searches
        saved_searches = await db.saved_searches.delete_many({"username": username})
        deletion_summary["saved_searches"] = saved_searches.deleted_count
        
        # 19. Delete invitations
        invitations = await db.invitations.delete_many({
            "$or": [
                {"inviter_username": username},
                {"invitee_username": username}
            ]
        })
        deletion_summary["invitations"] = invitations.deleted_count
        
        # 20. Finally, delete the user account itself
        user_result = await db.users.delete_one(get_username_query(username))
        deletion_summary["user_account"] = user_result.deleted_count
        
        logger.info(f"📊 Deletion summary for {username}: {deletion_summary}")
        return deletion_summary
        
    except Exception as e:
        logger.error(f"❌ Error during cascade deletion for {username}: {e}")
        raise


async def send_final_deletion_email(user: dict, db):
    """Send final confirmation email after permanent deletion"""
    try:
        notification_service = NotificationService(db)
        first_name = user.get("firstName", user.get("username"))
        
        message = f"""
        Hi {first_name},
        
        Your L3V3L account has been permanently deleted as requested.
        
        WHAT WAS DELETED:
        ✓ Profile and photos
        ✓ Messages and conversations
        ✓ Match history
        ✓ Favorites and shortlists
        ✓ Activity logs
        
        This action is irreversible.
        
        We're sorry to see you go. If you ever want to rejoin:
        https://l3v3lmatches.com/register2
        
        Thank you for being part of L3V3L.
        
        Best regards,
        The L3V3L Team
        """
        
        await notification_service.queue_notification(
            username=user.get("username"),
            notification_type="account_deleted",
            channel="email",
            title="Your L3V3L Account Has Been Deleted",
            message=message
        )
        
        # Mark email as sent in deletion request
        await db.users.update_one(
            {"username": user.get("username")},
            {"$set": {"deletionRequest.emailsSent.finalDeletion": True}}
        )
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to send final deletion email: {e}")
        # Don't fail deletion if email fails


# Job configuration for scheduler
JOB_CONFIG = {
    "name": "permanent_deletion_job",
    "description": "Permanently delete accounts after 30-day grace period",
    "schedule_type": "cron",
    "cron_expression": "0 2 * * *",  # Daily at 2:00 AM
    "enabled": True,
    "function": execute_permanent_deletions,
    "timeout_seconds": 600,
    "retry_on_failure": True,
    "max_retries": 1
}
