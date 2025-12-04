# fastapi_backend/admin_routes.py
"""
Admin Management Endpoints - User, Role, and Permission Management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import sys
import os
import logging
import re

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database
from .jwt_auth import get_current_user_dependency
from .authorization import require_admin, PermissionChecker, RoleChecker
from .security_models import (
    UserManagementRequest, RoleAssignmentRequest, PermissionGrantRequest,
    UserSecurityStatus, UserRole, Permission
)
from .security_config import DEFAULT_PERMISSIONS, USER_STATUS, SECURITY_EVENTS
from .password_utils import PasswordManager
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["Admin Management"])

# ===== USER MANAGEMENT =====

@router.get("/users", dependencies=[Depends(require_admin)])
async def get_all_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=10000),
    status: Optional[str] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    db = Depends(get_database)
):
    """
    Get all users with pagination and filtering (Admin only)
    """
    try:
        # Build query
        query = {}
        
        if status:
            # Use accountStatus (unified field) - no fallback to legacy status.status
            query["accountStatus"] = status
        
        if role:
            query["role_name"] = role
        
        if search:
            query["$or"] = [
                {"username": {"$regex": search, "$options": "i"}},
                {"contactEmail": {"$regex": search, "$options": "i"}},  # Primary email field
                {"firstName": {"$regex": search, "$options": "i"}},
                {"lastName": {"$regex": search, "$options": "i"}}
            ]
        
        # Get total count
        total = await db.users.count_documents(query)
        
        # Get users
        skip = (page - 1) * limit
        users_cursor = db.users.find(query).skip(skip).limit(limit).sort("created_at", -1)
        users = await users_cursor.to_list(length=limit)
        
        # Remove sensitive data and decrypt PII
        from crypto_utils import get_encryptor
        
        for i, user in enumerate(users):
            user["_id"] = str(user["_id"])
            
            # 🔓 DECRYPT PII fields
            try:
                encryptor = get_encryptor()
                users[i] = encryptor.decrypt_user_pii(user)
                logger.debug(f"✅ Decrypted PII for user: {user.get('username', 'unknown')}")
            except Exception as decrypt_err:
                logger.error(f"❌ Decryption failed for {user.get('username', 'unknown')}: {decrypt_err}")
            
            if "security" in users[i]:
                users[i]["security"].pop("password_hash", None)
                users[i]["security"].pop("password_history", None)
            if "mfa" in users[i]:
                users[i]["mfa"].pop("mfa_secret", None)
                users[i]["mfa"].pop("mfa_backup_codes", None)
        
        return {
            "users": users,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/{username}", dependencies=[Depends(require_admin)])
async def get_user_details(
    username: str,
    db = Depends(get_database)
):
    """Get detailed user information (Admin only)"""
    try:
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user["_id"] = str(user["_id"])
        
        # 🔓 DECRYPT PII fields
        from crypto_utils import get_encryptor
        try:
            encryptor = get_encryptor()
            user = encryptor.decrypt_user_pii(user)
            logger.debug(f"✅ Decrypted PII for user: {username}")
        except Exception as decrypt_err:
            logger.error(f"❌ Decryption failed for {username}: {decrypt_err}")
        
        # Remove sensitive data
        if "security" in user:
            user["security"].pop("password_hash", None)
            user["security"].pop("password_history", None)
        if "mfa" in user:
            user["mfa"].pop("mfa_secret", None)
            user["mfa"].pop("mfa_backup_codes", None)
        
        # Get user's active sessions
        sessions = await db.sessions.count_documents({
            "username": username,
            "revoked": False,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        # Get recent audit logs
        recent_logs = await db.audit_logs.find({
            "username": username
        }).sort("timestamp", -1).limit(10).to_list(length=10)
        
        for log in recent_logs:
            log["_id"] = str(log["_id"])
        
        return {
            "user": user,
            "active_sessions": sessions,
            "recent_activity": recent_logs
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users/{username}/manage", dependencies=[Depends(require_admin)])
async def manage_user(
    username: str,
    request: UserManagementRequest,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Manage user account (activate, deactivate, suspend, ban, unlock, verify_email)
    Admin only
    """
    try:
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent self-management
        if username == current_user.get("username"):
            raise HTTPException(status_code=400, detail="Cannot manage your own account")
        
        update_data = {
            "updated_at": datetime.utcnow(),
            "updated_by": current_user.get("username")
        }
        
        action = request.action
        
        if action == "activate":
            update_data["accountStatus"] = "active"  # Use accountStatus (unified field)
            # CRITICAL FIX: Also approve admin approval when activating
            update_data["adminApprovalStatus"] = "approved"
            update_data["adminApprovedBy"] = current_user.get("username")
            update_data["adminApprovedAt"] = datetime.utcnow().isoformat()
            event = SECURITY_EVENTS["ACCOUNT_UNLOCKED"]
            logger.info(f"✅ Setting adminApprovalStatus='approved' for user '{username}' (activated by {current_user.get('username')})")
            
            # Clear all content violations when reactivating user
            violation_result = await db.content_violations.delete_many({
                "username": username,
                "type": "message_profanity"
            })
            if violation_result.deleted_count > 0:
                logger.info(f"✅ Cleared {violation_result.deleted_count} violations for user '{username}' during activation")
        
        elif action == "deactivate":
            update_data["accountStatus"] = "deactivated"  # Use accountStatus (unified field)
            event = "account_deactivated"
        
        elif action == "suspend":
            update_data["accountStatus"] = "suspended"  # Use accountStatus (unified field)
            event = "account_suspended"
        
        elif action == "ban":
            update_data["accountStatus"] = "suspended"  # Use accountStatus (banned → suspended)
            # Revoke all sessions
            await db.sessions.update_many(
                {"username": username},
                {"$set": {"revoked": True, "revoked_at": datetime.utcnow(), "revoked_reason": "Account banned"}}
            )
            event = "account_banned"
        
        elif action == "unlock":
            update_data["security.locked_until"] = None
            update_data["security.failed_login_attempts"] = 0
            event = SECURITY_EVENTS["ACCOUNT_UNLOCKED"]
        
        elif action == "verify_email":
            update_data["status.email_verified"] = True
            update_data["status.email_verification_token"] = None
            event = SECURITY_EVENTS["EMAIL_VERIFIED"]
        
        else:
            raise HTTPException(status_code=400, detail=f"Invalid action: {action}")
        
        # Update user
        result = await db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to update user")
        
        # Log audit event
        await db.audit_logs.insert_one({
            "user_id": str(user["_id"]),
            "username": username,
            "action": event,
            "resource": "user",
            "resource_id": str(user["_id"]),
            "status": "success",
            "details": {
                "action": action,
                "reason": request.reason,
                "performed_by": current_user.get("username")
            },
            "timestamp": datetime.utcnow(),
            "severity": "warning" if action in ["suspend", "ban"] else "info"
        })
        
        return {
            "message": f"User {action}d successfully",
            "username": username,
            "action": action
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error managing user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ROLE ASSIGNMENT =====

@router.post("/users/{username}/assign-role", dependencies=[Depends(require_admin)])
async def assign_role_to_user(
    username: str,
    request: RoleAssignmentRequest,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Assign a role to a user (Admin only)
    This is the key feature you requested!
    """
    try:
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate role exists
        if request.role_name not in DEFAULT_PERMISSIONS:
            raise HTTPException(status_code=400, detail=f"Invalid role: {request.role_name}")
        
        # Prevent self-demotion from admin
        if username == current_user.get("username") and request.role_name != "admin":
            raise HTTPException(status_code=400, detail="Cannot change your own admin role")
        
        old_role = user.get("role_name", "free_user")
        
        # Update user role
        result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "role_name": request.role_name,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user.get("username")
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to assign role")
        
        # Log audit event
        await db.audit_logs.insert_one({
            "user_id": str(user["_id"]),
            "username": username,
            "action": SECURITY_EVENTS["ROLE_CHANGED"],
            "resource": "user_role",
            "resource_id": str(user["_id"]),
            "status": "success",
            "details": {
                "old_role": old_role,
                "new_role": request.role_name,
                "reason": request.reason,
                "performed_by": current_user.get("username")
            },
            "timestamp": datetime.utcnow(),
            "severity": "warning"
        })
        
        logger.info(f"Admin {current_user.get('username')} assigned role '{request.role_name}' to user '{username}'")
        
        return {
            "message": f"Role '{request.role_name}' assigned successfully",
            "username": username,
            "old_role": old_role,
            "new_role": request.role_name,
            "permissions": DEFAULT_PERMISSIONS.get(request.role_name, [])
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning role: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== STATUS MANAGEMENT =====

class StatusUpdateRequest(BaseModel):
    status: str
    reason: Optional[str] = None  # Admin's reason for status change

@router.patch("/users/{username}/status", dependencies=[Depends(require_admin)])
async def update_user_status(
    username: str,
    request: StatusUpdateRequest,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Update user account status (Admin only)
    Valid statuses: pending, active, inactive, suspended, banned
    """
    try:
        # Validate status (accept both old and new status values)
        valid_statuses = [
            'pending', 'active', 'inactive', 'suspended', 'banned',  # Legacy values
            'pending_email_verification', 'pending_admin_approval', 'deactivated'  # New accountStatus values
        ]
        if request.status not in valid_statuses:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        # Find user
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get old status
        old_status = user.get('status', {})
        if isinstance(old_status, dict):
            old_status_value = old_status.get('status', 'pending')
        else:
            old_status_value = old_status or 'pending'
        
        # Map legacy status values to accountStatus if needed
        # Accept both old names (pending, banned) and new names (pending_admin_approval)
        status_to_account_status_map = {
            'pending': 'pending_admin_approval',
            'active': 'active',
            'inactive': 'deactivated',
            'suspended': 'suspended',
            'banned': 'suspended',
            'paused': 'paused',
            # New values (pass through)
            'pending_email_verification': 'pending_email_verification',
            'pending_admin_approval': 'pending_admin_approval',
            'deactivated': 'deactivated',
        }
        new_account_status = status_to_account_status_map.get(request.status, request.status)
        
        # If changing to active from suspended/banned, clear violations
        if new_account_status == 'active' and old_status_value in ['suspended', 'banned']:
            violation_result = await db.content_violations.delete_many({
                "username": username,
                "type": "message_profanity"
            })
            if violation_result.deleted_count > 0:
                logger.info(f"✅ Cleared {violation_result.deleted_count} violations for user '{username}' during status change to active")
        
        # Prepare update data
        now = datetime.utcnow()
        update_data = {
            "accountStatus": new_account_status,
            "status.updated_by": current_user.get("username"),  # Track who made change
            "status.updated_at": now,
            "updated_at": now
        }
        
        # CRITICAL FIX: When setting status to 'active', also approve admin approval
        # This prevents mismatch between accountStatus and adminApprovalStatus
        if new_account_status == 'active':
            update_data["adminApprovalStatus"] = "approved"
            update_data["adminApprovedBy"] = current_user.get("username")
            update_data["adminApprovedAt"] = now.isoformat()
            logger.info(f"✅ Setting adminApprovalStatus='approved' for user '{username}' (activated by {current_user.get('username')})")
        
        # Update accountStatus (unified field)
        result = await db.users.update_one(
            {"username": username},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to update status")
        
        # Log audit event
        await db.audit_logs.insert_one({
            "user_id": str(user["_id"]),
            "username": username,
            "action": "status_change",
            "resource": "user",
            "resource_id": str(user["_id"]),
            "status": "success",
            "details": {
                "old_status": old_status_value,
                "new_status": request.status,
                "performed_by": current_user.get("username")
            },
            "timestamp": datetime.utcnow(),
            "severity": "warning" if request.status in ["suspended", "banned"] else "info"
        })
        
        logger.info(f"✅ Admin {current_user.get('username')} changed status for '{username}' from '{old_status_value}' to '{request.status}'")
        
        # Queue email notification for specific status changes
        await _queue_status_change_notification(
            db=db,
            username=username,
            user_email=user.get("contactEmail") or user.get("email"),
            firstname=user.get("firstName", ""),
            lastname=user.get("lastName", ""),
            old_status=old_status_value,
            new_status=new_account_status,
            reason=request.reason,
            admin_username=current_user.get("username")
        )
        
        return {
            "message": f"Status updated to '{request.status}' successfully",
            "username": username,
            "old_status": old_status_value,
            "new_status": request.status
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def _queue_status_change_notification(
    db,
    username: str,
    user_email: str,
    firstname: str,
    lastname: str,
    old_status: str,
    new_status: str,
    reason: Optional[str],
    admin_username: str
):
    """
    Queue email notification for status changes (approval, suspension, ban)
    """
    # Only send for specific status transitions
    should_notify = (
        (old_status in ['pending_admin_approval', 'pending'] and new_status == 'active') or  # Approval
        (new_status == 'suspended') or  # Suspension
        (old_status != 'suspended' and new_status == 'suspended') or  # Ban (mapped to suspended)
        (new_status == 'paused')  # Paused
    )
    
    if not should_notify or not user_email:
        return
    
    # Determine notification type and template
    if new_status == 'active':
        notification_type = 'status_approved'
        subject = "🎉 Your Profile is Now Active - Welcome to USVedika!"
        template_data = {
            "username": username,
            "firstname": firstname,
            "lastname": lastname,
            "status": "active",
            "message": "Your profile has been approved and is now active. You can now access all features and start connecting with matches!"
        }
    elif new_status == 'suspended':
        # Check if it's a ban or suspension based on old status
        if reason and ('ban' in reason.lower() or 'permanent' in reason.lower()):
            notification_type = 'status_banned'
            subject = "⛔ Your Account Has Been Banned"
            template_data = {
                "username": username,
                "status": "banned",
                "reason": reason or "Violation of terms of service",
                "message": "Your account has been permanently banned and you can no longer access USVedika."
            }
        else:
            notification_type = 'status_suspended'
            subject = "⚠️ Your Account Has Been Suspended"
            template_data = {
                "username": username,
                "status": "suspended",
                "reason": reason or "Pending investigation",
                "message": "Your account has been temporarily suspended. Please contact support for more information."
            }
    elif new_status == 'paused':
        notification_type = 'status_paused'
        subject = "⏸️ Your Account Has Been Paused by Admin"
        template_data = {
            "username": username,
            "status": "paused",
            "reason": reason or "Administrative action",
            "message": "Your account has been paused by an administrator. Your profile is temporarily hidden and you cannot access certain features."
        }
    else:
        return  # No notification needed
    
    # Queue notification
    try:
        await db.notification_queue.insert_one({
            "username": username,
            "email": user_email,
            "trigger": notification_type,  # Use "trigger" not "type" to match notification schema
            "type": notification_type,      # Keep "type" for backwards compatibility
            "channels": ["email"],          # ARRAY format to match service query
            "channel": "email",             # Keep singular for backwards compatibility
            "subject": subject,
            "templateData": template_data,
            "status": "pending",
            "attempts": 0,
            "priority": "high",
            "metadata": {
                "old_status": old_status,
                "new_status": new_status,
                "reason": reason,
                "changed_by": admin_username
            },
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        })
        logger.info(f"📧 Queued {notification_type} notification for {username} ({user_email})")
    except Exception as e:
        logger.error(f"❌ Failed to queue status change notification: {e}")
        # Don't fail the status change if notification fails

@router.post("/users/{username}/grant-permissions", dependencies=[Depends(require_admin)])
async def grant_custom_permissions(
    username: str,
    request: PermissionGrantRequest,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Grant custom permissions to a user (Admin only)
    These are in addition to role permissions
    """
    try:
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate permissions format
        for perm in request.permissions:
            if not re.match(r'^[a-z_]+\.[a-z_*]+$', perm):
                raise HTTPException(status_code=400, detail=f"Invalid permission format: {perm}")
        
        # Update user permissions
        result = await db.users.update_one(
            {"username": username},
            {
                "$addToSet": {"custom_permissions": {"$each": request.permissions}},
                "$set": {
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user.get("username")
                }
            }
        )
        
        # Log audit event
        await db.audit_logs.insert_one({
            "user_id": str(user["_id"]),
            "username": username,
            "action": SECURITY_EVENTS["PERMISSION_GRANTED"],
            "resource": "user_permissions",
            "resource_id": str(user["_id"]),
            "status": "success",
            "details": {
                "permissions": request.permissions,
                "reason": request.reason,
                "performed_by": current_user.get("username")
            },
            "timestamp": datetime.utcnow(),
            "severity": "warning"
        })
        
        return {
            "message": "Permissions granted successfully",
            "username": username,
            "granted_permissions": request.permissions
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error granting permissions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{username}/revoke-permissions", dependencies=[Depends(require_admin)])
async def revoke_custom_permissions(
    username: str,
    permissions: List[str] = Query(...),
    reason: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """
    Revoke custom permissions from a user (Admin only)
    """
    try:
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update user permissions
        result = await db.users.update_one(
            {"username": username},
            {
                "$pullAll": {"custom_permissions": permissions},
                "$set": {
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user.get("username")
                }
            }
        )
        
        # Log audit event
        await db.audit_logs.insert_one({
            "user_id": str(user["_id"]),
            "username": username,
            "action": SECURITY_EVENTS["PERMISSION_REVOKED"],
            "resource": "user_permissions",
            "resource_id": str(user["_id"]),
            "status": "success",
            "details": {
                "permissions": permissions,
                "reason": reason,
                "performed_by": current_user.get("username")
            },
            "timestamp": datetime.utcnow(),
            "severity": "warning"
        })
        
        return {
            "message": "Permissions revoked successfully",
            "username": username,
            "revoked_permissions": permissions
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking permissions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== ROLE MANAGEMENT =====

@router.get("/roles", dependencies=[Depends(require_admin)])
async def get_all_roles():
    """Get all available roles and their permissions"""
    roles = []
    for role_name, permissions in DEFAULT_PERMISSIONS.items():
        roles.append({
            "name": role_name,
            "permissions": permissions,
            "is_system_role": True
        })
    
    return {"roles": roles}

@router.get("/permissions", dependencies=[Depends(require_admin)])
async def get_all_permissions():
    """Get all available permissions"""
    all_permissions = set()
    for permissions in DEFAULT_PERMISSIONS.values():
        all_permissions.update(permissions)
    
    return {"permissions": sorted(list(all_permissions))}

# ===== USER SECURITY STATUS =====

@router.get("/users/{username}/security-status", dependencies=[Depends(require_admin)])
async def get_user_security_status(
    username: str,
    db = Depends(get_database)
):
    """Get user security status (Admin only)"""
    try:
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        security = user.get("security", {})
        status_info = user.get("status", {})
        mfa = user.get("mfa", {})
        
        # Calculate password expiry
        password_expires_at = security.get("password_expires_at")
        days_until_expiry = 0
        password_expired = False
        
        if password_expires_at:
            days_until_expiry = PasswordManager.get_days_until_expiry(password_expires_at)
            password_expired = PasswordManager.is_password_expired(password_expires_at)
        
        # Check if account is locked
        locked_until = security.get("locked_until")
        account_locked = False
        if locked_until:
            account_locked = datetime.utcnow() < locked_until
        
        # Get active sessions count
        active_sessions = await db.sessions.count_documents({
            "username": username,
            "revoked": False,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        return UserSecurityStatus(
            username=username,
            status=status_info.get("status", "unknown"),
            email_verified=status_info.get("email_verified", False),
            mfa_enabled=mfa.get("mfa_enabled", False),
            password_expires_in_days=days_until_expiry,
            password_expired=password_expired,
            account_locked=account_locked,
            locked_until=locked_until,
            failed_attempts=security.get("failed_login_attempts", 0),
            last_login=security.get("last_login_at"),
            active_sessions=active_sessions
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting security status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== FORCE PASSWORD RESET =====

@router.post("/users/{username}/force-password-reset", dependencies=[Depends(require_admin)])
async def force_password_reset(
    username: str,
    reason: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Force user to change password on next login (Admin only)"""
    try:
        user = await db.users.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update user
        result = await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    "security.force_password_change": True,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user.get("username")
                }
            }
        )
        
        # Log audit event
        await db.audit_logs.insert_one({
            "user_id": str(user["_id"]),
            "username": username,
            "action": "force_password_reset",
            "resource": "user",
            "resource_id": str(user["_id"]),
            "status": "success",
            "details": {
                "reason": reason,
                "performed_by": current_user.get("username")
            },
            "timestamp": datetime.utcnow(),
            "severity": "warning"
        })
        
        return {
            "message": "User will be required to change password on next login",
            "username": username
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error forcing password reset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== IMAGE VALIDATION =====

@router.post("/users/{username}/validate-images", dependencies=[Depends(require_admin)])
async def validate_user_images_endpoint(
    username: str,
    db = Depends(get_database)
):
    """
    Validate all images for a specific user (Admin only)
    Checks for inappropriate content, image quality, and legal compliance
    """
    try:
        from image_validator import validate_user_images
        
        logger.info(f"🔍 Admin validating images for user: {username}")
        
        result = await validate_user_images(db, username)
        
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating user images: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate-all-images", dependencies=[Depends(require_admin)])
async def validate_all_users_images(
    limit: int = Query(100, ge=1, le=1000),
    db = Depends(get_database)
):
    """
    Validate images for all users (Admin only)
    Useful for bulk validation after deployment
    """
    try:
        from image_validator import validate_user_images
        
        logger.info(f"🔍 Admin running bulk image validation (limit: {limit})")
        
        # Get all users
        users_cursor = db.users.find({}).limit(limit)
        users = await users_cursor.to_list(length=limit)
        
        results = []
        stats = {
            'total_users': 0,
            'total_images': 0,
            'flagged_users': 0,
            'users_needing_review': []
        }
        
        for user in users:
            username = user.get('username')
            if not username:
                continue
            
            result = await validate_user_images(db, username)
            
            if 'error' not in result:
                stats['total_users'] += 1
                stats['total_images'] += result.get('total_images', 0)
                
                if result.get('validation_summary', {}).get('needs_review', False):
                    stats['flagged_users'] += 1
                    stats['users_needing_review'].append({
                        'username': username,
                        'total_images': result.get('total_images', 0),
                        'invalid_images': result.get('validation_summary', {}).get('invalid_images', 0),
                        'flagged_images': result.get('validation_summary', {}).get('flagged_images', 0)
                    })
                
                results.append({
                    'username': username,
                    'summary': result.get('validation_summary', {})
                })
        
        logger.info(f"✅ Bulk validation complete: {stats['total_users']} users, {stats['flagged_users']} flagged")
        
        return {
            'stats': stats,
            'results': results
        }
    
    except Exception as e:
        logger.error(f"Error in bulk validation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{username}/image-validation-status", dependencies=[Depends(require_admin)])
async def get_image_validation_status(
    username: str,
    db = Depends(get_database)
):
    """Get image validation status for a user (Admin only)"""
    try:
        user = await db.users.find_one({'username': username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        validation_status = user.get('imageValidation', {
            'last_validated': None,
            'summary': {
                'total_images': len(user.get('images', [])),
                'valid_images': 0,
                'invalid_images': 0,
                'flagged_images': 0,
                'needs_review': False,
                'all_verified': False
            },
            'needs_review': False,
            'all_verified': False
        })
        
        return {
            'username': username,
            'validation_status': validation_status,
            'total_images': len(user.get('images', []))
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting validation status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
