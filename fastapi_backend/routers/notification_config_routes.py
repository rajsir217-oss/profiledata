"""
Notification Configuration Routes
Admin endpoints to view and manage notification triggers for status changes
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, List
import logging

from auth.authorization import require_admin
from notification_config.notification_triggers import (
    get_all_notification_triggers,
    update_notification_trigger,
    should_notify_status_change
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/notification-config", tags=["Notification Configuration"])


class NotificationTriggerUpdate(BaseModel):
    transition: str  # e.g., "active → suspended"
    enabled: bool


@router.get("/triggers", dependencies=[Depends(require_admin)])
async def get_notification_triggers(current_user: dict = Depends(require_admin)):
    """
    Get all notification trigger configurations
    Shows which status changes trigger notifications
    """
    try:
        triggers = get_all_notification_triggers()
        
        # Format for frontend display
        formatted_triggers = []
        for transition, config in triggers.items():
            formatted_triggers.append({
                "transition": transition,
                "enabled": config["enabled"],
                "trigger": config["trigger"],
                "priority": config["priority"],
                "description": config["description"]
            })
        
        logger.info(f"✅ Admin {current_user.get('username')} retrieved notification triggers")
        return {
            "triggers": formatted_triggers,
            "total": len(formatted_triggers)
        }
    except Exception as e:
        logger.error(f"❌ Error retrieving notification triggers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/triggers/{transition}/toggle", dependencies=[Depends(require_admin)])
async def toggle_notification_trigger(
    transition: str,
    update: NotificationTriggerUpdate,
    current_user: dict = Depends(require_admin)
):
    """
    Enable or disable notification for a specific status transition
    
    Example transitions:
    - "active → suspended"
    - "suspended → active"
    - "* → banned"
    """
    try:
        # URL decode the transition (replace %20 with space, etc.)
        from urllib.parse import unquote
        transition_decoded = unquote(transition)
        
        success = update_notification_trigger(transition_decoded, update.enabled)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"Transition '{transition_decoded}' not found")
        
        action = "enabled" if update.enabled else "disabled"
        logger.info(f"✅ Admin {current_user.get('username')} {action} notification for '{transition_decoded}'")
        
        return {
            "message": f"Notification {action} for transition '{transition_decoded}'",
            "transition": transition_decoded,
            "enabled": update.enabled
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating notification trigger: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/triggers/check", dependencies=[Depends(require_admin)])
async def check_notification_trigger(
    old_status: str,
    new_status: str,
    current_user: dict = Depends(require_admin)
):
    """
    Check if a specific status transition would trigger a notification
    Useful for testing and validation
    """
    try:
        config = should_notify_status_change(old_status, new_status)
        
        return {
            "old_status": old_status,
            "new_status": new_status,
            "transition": f"{old_status} → {new_status}",
            "should_notify": config["should_notify"],
            "trigger": config["trigger"],
            "priority": config["priority"],
            "description": config["description"]
        }
    except Exception as e:
        logger.error(f"❌ Error checking notification trigger: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/triggers/enabled", dependencies=[Depends(require_admin)])
async def get_enabled_triggers(current_user: dict = Depends(require_admin)):
    """
    Get only enabled notification triggers
    """
    try:
        all_triggers = get_all_notification_triggers()
        
        enabled_triggers = {
            transition: config
            for transition, config in all_triggers.items()
            if config["enabled"]
        }
        
        formatted = [
            {
                "transition": transition,
                "trigger": config["trigger"],
                "priority": config["priority"],
                "description": config["description"]
            }
            for transition, config in enabled_triggers.items()
        ]
        
        return {
            "enabled_triggers": formatted,
            "total": len(formatted)
        }
    except Exception as e:
        logger.error(f"❌ Error retrieving enabled triggers: {e}")
        raise HTTPException(status_code=500, detail=str(e))
