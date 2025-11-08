"""
Migration: Add Database Indexes for Notifications
Created: 2025-11-07
Description: Add indexes to improve notification query performance
"""

async def up(db):
    """
    Add indexes to notification collections
    """
    print("      📊 Adding notification indexes...")
    
    # Index on notification_queue for fast lookups
    await db.notification_queue.create_index([
        ("status", 1),
        ("scheduledFor", 1)
    ], name="status_scheduled_idx")
    
    await db.notification_queue.create_index([
        ("trigger", 1),
        ("recipient.username", 1)
    ], name="trigger_recipient_idx")
    
    # Index on notification_templates
    await db.notification_templates.create_index([
        ("trigger", 1)
    ], unique=True, name="trigger_unique_idx")
    
    await db.notification_templates.create_index([
        ("channel", 1),
        ("category", 1)
    ], name="channel_category_idx")
    
    # Index on notification_log
    await db.notification_log.create_index([
        ("trigger", 1),
        ("sentAt", -1)
    ], name="trigger_sent_idx")
    
    await db.notification_log.create_index([
        ("recipient.username", 1),
        ("sentAt", -1)
    ], name="recipient_sent_idx")
    
    print("      ✅ Indexes created successfully")
    return True


async def down(db):
    """
    Rollback: Remove indexes
    """
    print("      🔙 Removing notification indexes...")
    
    # Drop indexes
    await db.notification_queue.drop_index("status_scheduled_idx")
    await db.notification_queue.drop_index("trigger_recipient_idx")
    await db.notification_templates.drop_index("trigger_unique_idx")
    await db.notification_templates.drop_index("channel_category_idx")
    await db.notification_log.drop_index("trigger_sent_idx")
    await db.notification_log.drop_index("recipient_sent_idx")
    
    print("      ✅ Indexes removed")
    return True
