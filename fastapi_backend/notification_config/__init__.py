"""
Notification Config Package
Contains notification triggers and other notification configuration modules
"""

from .notification_triggers import (
    should_notify_status_change,
    get_all_notification_triggers,
    update_notification_trigger,
    STATUS_CHANGE_NOTIFICATIONS
)

__all__ = [
    'should_notify_status_change',
    'get_all_notification_triggers',
    'update_notification_trigger',
    'STATUS_CHANGE_NOTIFICATIONS'
]
