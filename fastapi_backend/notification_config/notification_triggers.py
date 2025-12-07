"""
Notification Trigger Configuration
Controls which status changes send email notifications to users
Admin-configurable via UI or this file
"""

# Status change notification configuration
# Admin can enable/disable notifications for specific transitions
STATUS_CHANGE_NOTIFICATIONS = {
    # Activation & Reactivation
    "pending_admin_approval → active": {
        "enabled": True,
        "trigger": "status_approved",
        "priority": "high",
        "description": "Profile approved by admin"
    },
    "pending_email_verification → active": {
        "enabled": True,
        "trigger": "status_approved",
        "priority": "high",
        "description": "Profile activated"
    },
    "suspended → active": {
        "enabled": True,
        "trigger": "status_reactivated",
        "priority": "high",
        "description": "Account reactivated after suspension"
    },
    "paused → active": {
        "enabled": True,
        "trigger": "status_reactivated",
        "priority": "high",
        "description": "Account reactivated after pause"
    },
    "deactivated → active": {
        "enabled": True,
        "trigger": "status_reactivated",
        "priority": "medium",
        "description": "Account reactivated"
    },
    
    # Suspensions & Restrictions
    "active → suspended": {
        "enabled": True,
        "trigger": "status_suspended",
        "priority": "high",
        "description": "Account suspended by admin"
    },
    "* → suspended": {  # Any status to suspended
        "enabled": True,
        "trigger": "status_suspended",
        "priority": "high",
        "description": "Account suspended"
    },
    
    # Bans
    "* → banned": {
        "enabled": True,
        "trigger": "status_banned",
        "priority": "critical",
        "description": "Account permanently banned"
    },
    
    # Paused
    "active → paused": {
        "enabled": True,
        "trigger": "status_paused",
        "priority": "medium",
        "description": "Account paused by admin"
    },
    "* → paused": {
        "enabled": True,
        "trigger": "status_paused",
        "priority": "medium",
        "description": "Account paused"
    },
    
    # Deactivation
    "active → deactivated": {
        "enabled": False,  # User initiated, may not need notification
        "trigger": "status_deactivated",
        "priority": "low",
        "description": "Account deactivated"
    },
    
    # Verification states (usually no notification needed)
    "* → pending_email_verification": {
        "enabled": False,
        "trigger": None,
        "priority": "low",
        "description": "Awaiting email verification"
    },
    "* → pending_admin_approval": {
        "enabled": False,
        "trigger": None,
        "priority": "low",
        "description": "Awaiting admin approval"
    },
    
    # Inactive
    "* → inactive": {
        "enabled": False,
        "trigger": None,
        "priority": "low",
        "description": "Account marked inactive"
    }
}


def should_notify_status_change(old_status: str, new_status: str) -> dict:
    """
    Check if status change should trigger notification
    
    Returns:
        dict: {
            "should_notify": bool,
            "trigger": str,  # Template trigger name
            "priority": str,
            "description": str
        }
    """
    # Check exact match first
    transition = f"{old_status} → {new_status}"
    if transition in STATUS_CHANGE_NOTIFICATIONS:
        config = STATUS_CHANGE_NOTIFICATIONS[transition]
        return {
            "should_notify": config["enabled"],
            "trigger": config["trigger"],
            "priority": config["priority"],
            "description": config["description"]
        }
    
    # Check wildcard "* → new_status"
    wildcard_transition = f"* → {new_status}"
    if wildcard_transition in STATUS_CHANGE_NOTIFICATIONS:
        config = STATUS_CHANGE_NOTIFICATIONS[wildcard_transition]
        return {
            "should_notify": config["enabled"],
            "trigger": config["trigger"],
            "priority": config["priority"],
            "description": config["description"]
        }
    
    # Default: no notification
    return {
        "should_notify": False,
        "trigger": None,
        "priority": "low",
        "description": f"Status changed: {old_status} → {new_status}"
    }


def get_all_notification_triggers():
    """Get all configured notification triggers for admin UI"""
    return STATUS_CHANGE_NOTIFICATIONS


def update_notification_trigger(transition: str, enabled: bool):
    """
    Update notification trigger configuration
    Used by admin UI to enable/disable notifications
    
    Args:
        transition: e.g., "active → suspended"
        enabled: True to enable, False to disable
    """
    if transition in STATUS_CHANGE_NOTIFICATIONS:
        STATUS_CHANGE_NOTIFICATIONS[transition]["enabled"] = enabled
        return True
    return False
