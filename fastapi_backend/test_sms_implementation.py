#!/usr/bin/env python3
"""
Test SMS Implementation Changes
===========================

This script tests the updated EventDispatcher handlers to ensure
SMS notifications are properly queued for the new triggers.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('.env')

async def test_sms_implementation():
    """Test that SMS notifications are being queued for new triggers"""
    
    print("=" * 70)
    print("TESTING SMS IMPLEMENTATION CHANGES")
    print("=" * 70)
    
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client.matrimonialDB
    
    # Clear existing test notifications
    result = await db.notification_queue.delete_many({
        "username": "test_user_sms"
    })
    print(f"🗑️  Cleared {result.deleted_count} existing test notifications")
    
    # Import EventDispatcher
    import sys
    sys.path.append('/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend')
    from services.event_dispatcher import EventDispatcher
    from services.notification_service import NotificationService
    
    # Create instances
    notification_service = NotificationService(db)
    event_dispatcher = EventDispatcher(db)
    
    # Test each updated handler
    test_cases = [
        {
            "event_type": "shortlist_added",
            "actor": "test_actor",
            "target": "test_user_sms",
            "expected_channels": ["email", "push"],
            "description": "Shortlist added notification"
        },
        {
            "event_type": "pii_granted", 
            "actor": "test_granter",
            "target": "test_user_sms",
            "expected_channels": ["email", "push", "sms"],
            "description": "PII granted notification (should include SMS)"
        },
        {
            "event_type": "pii_denied",
            "actor": "test_rejecter", 
            "target": "test_user_sms",
            "expected_channels": ["email", "push", "sms"],
            "description": "PII denied notification (should include SMS)"
        },
        {
            "event_type": "profile_viewed",
            "actor": "test_viewer",
            "target": "test_user_sms", 
            "expected_channels": ["push"],
            "description": "Profile viewed notification (push only)"
        },
        {
            "event_type": "message_read",
            "actor": "test_reader",
            "target": "test_user_sms",
            "expected_channels": ["push"],
            "description": "Message read notification (push only)"
        }
    ]
    
    print("\n🧪 Testing EventDispatcher handlers...")
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['description']}")
        print(f"   Event: {test_case['event_type']}")
        print(f"   Actor: {test_case['actor']} → Target: {test_case['target']}")
        
        try:
            # Dispatch event
            from services.event_dispatcher import UserEventType
            event_type = getattr(UserEventType, test_case['event_type'].upper())
            
            success = await event_dispatcher.dispatch(
                event_type=event_type,
                actor_username=test_case['actor'],
                target_username=test_case['target'],
                metadata={"test": True}
            )
            
            if success:
                # Check if notification was queued
                notification = await db.notification_queue.find_one({
                    "username": test_case['target'],
                    "trigger": test_case['event_type'],
                    "status": "pending"
                })
                
                if notification:
                    actual_channels = [c.value for c in notification.get('channels', [])]
                    expected_channels = test_case['expected_channels']
                    
                    print(f"   ✅ Notification queued!")
                    print(f"   📱 Channels: {actual_channels}")
                    print(f"   🎯 Expected: {expected_channels}")
                    
                    if set(actual_channels) == set(expected_channels):
                        print(f"   ✅ Channels match!")
                    else:
                        print(f"   ❌ Channel mismatch!")
                        
                    # Clean up for next test
                    await db.notification_queue.delete_one({"_id": notification["_id"]})
                else:
                    print(f"   ❌ No notification found in queue")
            else:
                print(f"   ❌ Event dispatch failed")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # Test SMS template generation
    print("\n" + "=" * 70)
    print("TESTING SMS TEMPLATE GENERATION")
    print("=" * 70)
    
    from job_templates.sms_notifier_template import SMSNotifierTemplate
    
    sms_template = SMSNotifierTemplate()
    
    # Test a few key triggers
    sms_tests = [
        {
            "trigger": "pii_granted",
            "template_data": {"match_firstName": "John"},
            "expected_prefix": "[L3V3LMATCHES]"
        },
        {
            "trigger": "shortlist_added", 
            "template_data": {"match_firstName": "Sarah"},
            "expected_prefix": "[L3V3LMATCHES]"
        },
        {
            "trigger": "profile_view",
            "template_data": {"match_firstName": "Mike"},
            "expected_prefix": "[L3V3LMATCHES]"
        }
    ]
    
    print("\n📱 Testing SMS template generation...")
    
    for i, test in enumerate(sms_tests, 1):
        print(f"\n{i}. Testing trigger: {test['trigger']}")
        
        # Create mock notification
        class MockNotification:
            def __init__(self, trigger, template_data):
                self.trigger = trigger
                self.templateData = template_data
        
        mock_notification = MockNotification(test['trigger'], test['template_data'])
        
        try:
            # Generate SMS text
            sms_text = await sms_template._render_sms(
                notification_service, 
                mock_notification, 
                db
            )
            
            print(f"   📄 SMS: {sms_text}")
            
            if sms_text.startswith(test['expected_prefix']):
                print(f"   ✅ Prefix correct!")
            else:
                print(f"   ❌ Prefix wrong!")
                
            if len(sms_text) <= 160:
                print(f"   ✅ Length OK: {len(sms_text)}/160")
            else:
                print(f"   ❌ Too long: {len(sms_text)}/160")
                
        except Exception as e:
            print(f"   ❌ Error generating SMS: {e}")
    
    # Summary
    print("\n" + "=" * 70)
    print("IMPLEMENTATION SUMMARY")
    print("=" * 70)
    
    print("\n✅ COMPLETED CHANGES:")
    print("1. shortlist_added: Added push channel (was email only)")
    print("2. pii_granted: Added SMS channel (was email, push only)")
    print("3. pii_rejected: Added SMS channel (was email only)")
    print("4. profile_viewed: Kept push only (no SMS for privacy)")
    print("5. message_read: Kept push only (no SMS for read receipts)")
    print("6. user_approved: Added SMS and push channels (was email only)")
    print("7. user_suspended: Added SMS and push channels (was email only)")
    
    print("\n📱 NEW SMS TRIGGERS ACTIVE:")
    print("- pii_granted: Contact request approved")
    print("- pii_rejected: Contact request declined")
    print("- user_approved: Account approved/reactivated")
    print("- user_suspended: Account suspended")
    
    print("\n🎯 NEXT STEPS:")
    print("1. Deploy these changes")
    print("2. Test with real user actions")
    print("3. Monitor notification_queue for new triggers")
    print("4. Add scheduled jobs for recurring notifications")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_sms_implementation())
