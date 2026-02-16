#!/usr/bin/env python3
"""
How SMS Notification Events Are Triggered in L3V3LMATCHES
======================================================

This document explains the complete flow from user action to SMS notification.
"""

print("""
========================================
HOW SMS NOTIFICATION EVENTS ARE TRIGGERED
========================================

📱 OVERVIEW
----------
SMS notifications are triggered through a 4-step process:

1. USER ACTION → 2. EVENT DISPATCH → 3. NOTIFICATION QUEUE → 4. SMS SENDING

🔄 DETAILED FLOW
---------------

1️⃣ USER ACTION
   • User performs an action (e.g., sends message, views profile)
   • Action is captured in API endpoints/routes
   • Event is dispatched to EventDispatcher

2️⃣ EVENT DISPATCH
   • EventDispatcher receives the event
   • Maps event type to notification trigger
   • Calls notification_service.queue_notification()

3️⃣ NOTIFICATION QUEUE
   • NotificationService creates queue entry
   • Stores in notification_queue collection
   • SMS Notifier job processes queue

4️⃣ SMS SENDING
   • SMSNotifierTemplate reads queue entry
   • Generates SMS text using trigger messages
   • Sends via SimpleTexting service

🎯 SPECIFIC EVENT TRIGGERS
-------------------------

Below are all the SMS notification scenarios and how they're triggered:

========================================
CONTACT INFO REQUESTS (4 triggers)
========================================

1. pending_pii_request
   WHEN: User A requests contact info from User B
   CODE: routes.py - request_contact_info() endpoint
   FLOW:
   - User B gets SMS: "Sarah requested your contact info! Login to respond."
   - Trigger: PII_REQUESTED event
   - Handler: _handle_pii_requested()

2. pii_request  
   WHEN: Same as above (alternative trigger name)
   CODE: Same as pending_pii_request
   FLOW: Identical to pending_pii_request

3. pii_granted
   WHEN: User B approves contact request from User A
   CODE: routes.py - approve_contact_request() endpoint
   FLOW:
   - User A gets SMS: "Your contact info request was approved! Login to view."
   - Trigger: PII_GRANTED event
   - Handler: _handle_pii_granted()

4. pii_denied
   WHEN: User B declines contact request from User A
   CODE: routes.py - deny_contact_request() endpoint
   FLOW:
   - User A gets SMS: "Your contact info request was declined. Login for details."
   - Trigger: PII_REJECTED event
   - Handler: _handle_pii_rejected()

========================================
MESSAGING (4 triggers)
========================================

5. new_message
   WHEN: User A sends message to User B
   CODE: routes.py - send_message() endpoint
   FLOW:
   - User B gets SMS: "You have a new message! Login to read it."
   - Trigger: MESSAGE_SENT event
   - Handler: _handle_message_sent()

6. unread_messages
   WHEN: User has unread messages (digest)
   CODE: Scheduled job - message_digest.py
   FLOW:
   - User gets SMS: "You have unread messages waiting! Login to catch up."
   - Direct queue_notification() call

7. conversation_cold
   WHEN: Conversation hasn't had activity for X days
   CODE: Scheduled job - conversation_cold_reminder.py
   FLOW:
   - User gets SMS: "Your conversation is getting cold! Send a message..."
   - Direct queue_notification() call

8. message_reminder
   WHEN: User has unread message for X hours
   CODE: Scheduled job - message_reminder.py
   FLOW:
   - User gets SMS: "You have an unread message! Login to respond."
   - Direct queue_notification() call

========================================
PROFILE INTERACTIONS (4 triggers)
========================================

9. profile_view
   WHEN: User A views User B's profile
   CODE: routes.py - get_user_profile() endpoint
   FLOW:
   - User B gets SMS: "Someone viewed your profile! Login to see who."
   - Trigger: PROFILE_VIEWED event
   - Handler: _handle_profile_viewed()

10. profile_view_multiple
    WHEN: Multiple users viewed profile in time window
    CODE: Scheduled job - profile_view_digest.py
    FLOW:
    - User gets SMS: "Multiple people viewed your profile! Login to see who."
    - Direct queue_notification() call

11. profile_complete
    WHEN: User has incomplete profile
    CODE: Scheduled job - profile_completion_reminder.py
    FLOW:
    - User gets SMS: "Complete your profile to get better matches! Login now."
    - Direct queue_notification() call

12. photo_upload_reminder
    WHEN: User has no photos
    CODE: Scheduled job - photo_upload_reminder.py
    FLOW:
    - User gets SMS: "Add photos to get 10x more responses! Login to upload."
    - Direct queue_notification() call

========================================
MATCHING & FAVORITES (6 triggers)
========================================

13. new_match
    WHEN: Algorithm finds new match for user
    CODE: routes.py - get_matches() endpoint
    FLOW:
    - User gets SMS: "You have a new match! Login to connect."
    - Trigger: NEW_MATCH event
    - Handler: _handle_new_match()

14. mutual_favorite
    WHEN: Users favorite each other
    CODE: event_dispatcher.py - _handle_favorite_added()
    FLOW:
    - Both users get SMS: "It's a match! You both favorited each other! Login to connect."
    - Trigger: MUTUAL_FAVORITE event
    - Handler: _handle_mutual_favorite()

15. shortlist_added
    WHEN: User A adds User B to shortlist
    CODE: routes.py - add_to_shortlist() endpoint
    FLOW:
    - User B gets SMS: "Someone added you to their shortlist! Login to see who."
    - Trigger: SHORTLIST_ADDED event
    - Handler: _handle_shortlist_added()

16. favorited
    WHEN: User A favorites User B
    CODE: routes.py - favorite_user() endpoint
    FLOW:
    - User B gets SMS: "Someone favorited your profile! Login to see who."
    - Trigger: FAVORITE_ADDED event
    - Handler: _handle_favorite_added()

17. daily_matches
    WHEN: Daily matching algorithm runs
    CODE: Scheduled job - daily_matches.py
    FLOW:
    - User gets SMS: "New daily matches waiting! Login to view them."
    - Direct queue_notification() call

18. smart_matches
    WHEN: AI matching algorithm finds matches
    CODE: Scheduled job - smart_matches.py
    FLOW:
    - User gets SMS: "Smart matches found! Login to connect."
    - Direct queue_notification() call

========================================
SUBSCRIPTION & PREMIUM (4 triggers)
========================================

19. subscription_expired
    WHEN: User's subscription expires
    CODE: Scheduled job - subscription_monitor.py
    FLOW:
    - User gets SMS: "Your subscription has expired! Login to renew."
    - Direct queue_notification() call

20. subscription_renewal
    WHEN: Subscription will renew soon
    CODE: Scheduled job - subscription_renewal_reminder.py
    FLOW:
    - User gets SMS: "Your subscription will renew soon! Login to manage settings."
    - Direct queue_notification() call

21. premium_feature
    WHEN: User eligible for premium upgrade
    CODE: Scheduled job - premium_promotion.py
    FLOW:
    - User gets SMS: "Unlock premium features! Login to upgrade."
    - Direct queue_notification() call

22. trial_ending
    WHEN: Free trial is ending
    CODE: Scheduled job - trial_ending_reminder.py
    FLOW:
    - User gets SMS: "Your free trial ends soon! Login to subscribe."
    - Direct queue_notification() call

========================================
ACTIVITY & ENGAGEMENT (4 triggers)
========================================

23. login_reminder
    WHEN: User hasn't logged in for X days
    CODE: Scheduled job - login_reminder.py
    FLOW:
    - User gets SMS: "We miss you! Login to see new matches."
    - Direct queue_notification() call

24. weekly_summary
    WHEN: Weekly activity digest
    CODE: Scheduled job - weekly_activity_digest.py
    FLOW:
    - User gets SMS: "You have new activity this week! Login to view."
    - Direct queue_notification() call

25. success_story
    WHEN: New success story published
    CODE: routes.py - publish_success_story() endpoint
    FLOW:
    - Users get SMS: "Inspiring success story! Login to read it."
    - Direct queue_notification() call

26. event_invite
    WHEN: Matchmaking event scheduled
    CODE: routes.py - create_event() endpoint
    FLOW:
    - Users get SMS: "Upcoming matchmaking event! Login to RSVP."
    - Direct queue_notification() call

========================================
SAFETY & VERIFICATION (4 triggers)
========================================

27. verify_email
    WHEN: User needs to verify email
    CODE: routes.py - register() endpoint
    FLOW:
    - User gets SMS: "Please verify your email address! Check your inbox for link."
    - Direct queue_notification() call

28. verify_phone
    WHEN: User needs to verify phone
    CODE: routes.py - update_profile() endpoint
    FLOW:
    - User gets SMS: "Verify your phone number for better security! Login to verify."
    - Direct queue_notification() call

29. safety_tip
    WHEN: Weekly safety tip
    CODE: Scheduled job - safety_tips.py
    FLOW:
    - User gets SMS: "New safety tip available! Login to read it."
    - Direct queue_notification() call

30. account_suspended
    WHEN: Admin suspends account
    CODE: admin_routes.py - suspend_user() endpoint
    FLOW:
    - User gets SMS: "Account action required! Login for details."
    - Trigger: USER_SUSPENDED event
    - Handler: _handle_user_suspended()

========================================
CONTRIBUTIONS & DONATIONS (3 triggers)
========================================

31. contribution_reminder
    WHEN: User hasn't contributed
    CODE: Scheduled job - contribution_reminder.py
    FLOW:
    - User gets SMS: "Support our platform! Login to contribute."
    - Direct queue_notification() call

32. contribution_thank_you
    WHEN: User makes contribution
    CODE: routes.py - process_contribution() endpoint
    FLOW:
    - User gets SMS: "Thank you for your contribution! Your support helps us grow."
    - Direct queue_notification() call

33. popup_shown
    WHEN: Contribution popup shown
    CODE: routes.py - get_contribution_status() endpoint
    FLOW:
    - User gets SMS: "Check out our premium features! Login to learn more."
    - Trigger: popup_shown event
    - Handler: _handle_popup_shown()

========================================
ADMIN & SUPPORT (4 triggers)
========================================

34. admin_message
    WHEN: Admin sends message to user
    CODE: admin_routes.py - send_user_message() endpoint
    FLOW:
    - User gets SMS: "Important message from admin! Login to read."
    - Direct queue_notification() call

35. support_response
    WHEN: Support responds to ticket
    CODE: support_routes.py - update_ticket() endpoint
    FLOW:
    - User gets SMS: "Support has responded to your ticket! Login to view."
    - Direct queue_notification() call

36. profile_approved
    WHEN: Admin approves profile
    CODE: admin_routes.py - approve_user() endpoint
    FLOW:
    - User gets SMS: "Your profile has been approved! Login to connect."
    - Trigger: USER_APPROVED event
    - Handler: _handle_user_approved()

37. profile_rejected
    WHEN: Admin rejects profile
    CODE: admin_routes.py - reject_user() endpoint
    FLOW:
    - User gets SMS: "Profile update needed! Login to fix issues."
    - Direct queue_notification() call

========================================
FALLBACK (1 trigger)
========================================

38. unknown_trigger
    WHEN: Unrecognized trigger in queue
    CODE: sms_notifier_template.py fallback
    FLOW:
    - User gets SMS: "You have a new notification! Login to view"
    - Used as safety net for any trigger

🔧 CODE EXAMPLES
---------------

Example 1: Profile View SMS Trigger
----------------------------------
# In routes.py - when User A views User B's profile
async def get_user_profile(username: str, ...):
    # ... profile retrieval logic ...
    
    # Dispatch event to trigger SMS
    await event_dispatcher.dispatch(
        event_type=UserEventType.PROFILE_VIEWED,
        actor_username=current_user["username"],  # Viewer
        target_username=username,  # Profile owner
        metadata={"view_time": datetime.utcnow()}
    )

# In event_dispatcher.py
async def _handle_profile_viewed(self, event_data: Dict):
    target = event_data.get("target")  # Profile owner
    actor = event_data.get("actor")    # Viewer
    
    # Queue SMS notification
    await self.notification_service.queue_notification(
        username=target,
        trigger="profile_view",
        channels=["push"],  # Low priority - push only
        template_data={
            "match": {
                "firstName": viewer.get("firstName", actor),
                "username": actor
            }
        }
    )

Example 2: Message SMS Trigger
-------------------------------
# In routes.py - when User A sends message to User B
async def send_message(message: MessageCreate, ...):
    # ... message sending logic ...
    
    # Dispatch event
    await event_dispatcher.dispatch(
        event_type=UserEventType.MESSAGE_SENT,
        actor_username=current_user["username"],  # Sender
        target_username=message.recipient,        # Receiver
        metadata={"preview": message.content[:50]}
    )

# In event_dispatcher.py
async def _handle_message_sent(self, event_data: Dict):
    target = event_data.get("target")  # Message receiver
    actor = event_data.get("actor")    # Message sender
    
    # Queue SMS notification
    await self.notification_service.queue_notification(
        username=target,
        trigger="new_message",
        channels=["sms", "push"],  # Real-time channels
        template_data={
            "match": {
                "firstName": sender.get("firstName", actor),
                "username": actor
            }
        },
        priority="high"
    )

📋 SCHEDULED JOBS
-----------------

Many SMS notifications are triggered by scheduled jobs:

• Daily at 9:00 AM - Daily matches
• Every 6 hours - Message reminders
• Weekly on Sunday - Activity summaries
• Monthly - Subscription reminders
• Every 30 days - Profile completion reminders

These jobs run automatically and call queue_notification() directly.

🎛️ CONFIGURATION
------------------

SMS notifications can be controlled via:

1. User Preferences (notification_preferences collection):
   - Enable/disable SMS per trigger type
   - Set quiet hours
   - Batch notifications to digest

2. Admin Settings:
   - Global SMS enable/disable
   - Rate limiting
   - Cost controls

3. Job Templates:
   - SMS Notifier job processes queue
   - Batch size limits
   - Priority filtering

🚀 DEPLOYMENT NOTES
------------------

✅ All 38 SMS triggers are ready for deployment
✅ No database changes required
✅ Fallback messages work immediately
✅ Can add custom templates later per trigger

The system will start sending SMS notifications as soon as the code is deployed!
""")
