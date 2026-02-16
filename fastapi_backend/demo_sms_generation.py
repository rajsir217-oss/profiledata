#!/usr/bin/env python3
"""
Demo script showing how SMS text is generated in the notification system
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment
load_dotenv('.env')

# Simulate the SMS generation logic
PREFIX = "[L3V3LMATCHES] "

def generate_sms_fallback(trigger, template_data=None):
    """Generate SMS text using fallback messages (what we just updated)"""
    
    # Extract requester name from template data
    requester_name = "Someone"
    if template_data and isinstance(template_data, dict):
        match_data = template_data.get("match", {})
        if isinstance(match_data, dict):
            first = match_data.get("firstName", "")
            username = match_data.get("username", "")
            if first:
                requester_name = first
            elif username:
                requester_name = username
        
        # Also check flat format
        if requester_name == "Someone":
            flat_first = template_data.get("match_firstName", "")
            flat_username = template_data.get("match_username", "")
            if flat_first:
                requester_name = flat_first
            elif flat_username:
                requester_name = flat_username
    
    # Updated trigger messages from our code changes (shorter, no L3V3LMATCHES.com)
    trigger_messages = {
        # Contact Info Requests
        "pending_pii_request": f"{requester_name} requested your contact info! Login to respond.",
        "pii_request": f"{requester_name} requested your contact info! Login to respond.",
        "pii_granted": "Your contact info request was approved! Login to view.",
        "pii_denied": "Your contact info request was declined. Login for details.",
        
        # Messaging
        "new_message": "You have a new message! Login to read it.",
        "unread_messages": "You have unread messages waiting! Login to catch up.",
        "conversation_cold": "Your conversation is getting cold! Send a message to rekindle the connection.",
        "message_reminder": "You have an unread message! Login to respond.",
        
        # Profile Interactions
        "profile_view": "Someone viewed your profile! Login to see who.",
        "profile_view_multiple": "Multiple people viewed your profile! Login to see who.",
        "profile_complete": "Complete your profile to get better matches! Login now.",
        "photo_upload_reminder": "Add photos to get 10x more responses! Login to upload.",
        
        # Matching & Favorites
        "new_match": "You have a new match! Login to connect.",
        "mutual_favorite": "It's a match! You both favorited each other! Login to connect.",
        "shortlist_added": "Someone added you to their shortlist! Login to see who.",
        "favorited": "Someone favorited your profile! Login to see who.",
        "daily_matches": "New daily matches waiting! Login to view them.",
        "smart_matches": "Smart matches found! Login to connect.",
        
        # Subscription & Premium
        "subscription_expired": "Your subscription has expired! Login to renew.",
        "subscription_renewal": "Your subscription will renew soon! Login to manage settings.",
        "premium_feature": "Unlock premium features! Login to upgrade.",
        "trial_ending": "Your free trial ends soon! Login to subscribe.",
        
        # Activity & Engagement
        "login_reminder": "We miss you! Login to see new matches.",
        "weekly_summary": "You have new activity this week! Login to view.",
        "success_story": "Inspiring success story! Login to read it.",
        "event_invite": "Upcoming matchmaking event! Login to RSVP.",
        
        # Safety & Verification
        "verify_email": "Please verify your email address! Check your inbox for link.",
        "verify_phone": "Verify your phone number for better security! Login to verify.",
        "safety_tip": "New safety tip available! Login to read it.",
        "account_suspended": "Account action required! Login for details.",
        
        # Contributions & Donations
        "contribution_reminder": "Support our platform! Login to contribute.",
        "contribution_thank_you": "Thank you for your contribution! Your support helps us grow.",
        "popup_shown": "Check out our premium features! Login to learn more.",
        
        # Admin & Support
        "admin_message": "Important message from admin! Login to read.",
        "support_response": "Support has responded to your ticket! Login to view.",
        "profile_approved": "Your profile has been approved! Login to connect.",
        "profile_rejected": "Profile update needed! Login to fix issues.",
    }
    
    message = trigger_messages.get(
        trigger,
        "You have a new notification! Login to view"
    )
    
    return f"{PREFIX}{message}"

def demonstrate_sms_generation():
    """Show how SMS text is generated for different scenarios"""
    
    print("=" * 70)
    print("SMS TEXT GENERATION DEMO")
    print("=" * 70)
    print("\n📱 How SMS text is generated:")
    print("1. System checks for custom template in database")
    print("2. If no template found, uses fallback messages from code")
    print("3. Adds [L3V3LMATCHES] prefix")
    print("4. Ensures message is under 160 characters")
    
    print("\n" + "=" * 70)
    print("EXAMPLE SMS MESSAGES")
    print("=" * 70)
    
    # Example scenarios with template data
    examples = [
        {
            "trigger": "pending_pii_request",
            "template_data": {"match": {"firstName": "Sarah"}},
            "description": "Contact info request with name"
        },
        {
            "trigger": "pending_pii_request",
            "template_data": {"match_username": "john_doe"},
            "description": "Contact info request with username"
        },
        {
            "trigger": "new_match",
            "template_data": None,
            "description": "New match notification"
        },
        {
            "trigger": "conversation_cold",
            "template_data": None,
            "description": "Cold conversation reminder"
        },
        {
            "trigger": "profile_view_multiple",
            "template_data": None,
            "description": "Multiple profile views"
        },
        {
            "trigger": "subscription_expired",
            "template_data": None,
            "description": "Subscription expired"
        },
        {
            "trigger": "verify_email",
            "template_data": None,
            "description": "Email verification"
        },
        {
            "trigger": "daily_matches",
            "template_data": None,
            "description": "Daily matches"
        },
        {
            "trigger": "contribution_reminder",
            "template_data": None,
            "description": "Contribution reminder"
        },
        {
            "trigger": "unknown_trigger",
            "template_data": None,
            "description": "Unknown trigger (fallback)"
        }
    ]
    
    for i, example in enumerate(examples, 1):
        trigger = example["trigger"]
        template_data = example["template_data"]
        description = example["description"]
        
        sms_text = generate_sms_fallback(trigger, template_data)
        
        print(f"\n{i}. {description}")
        print(f"   Trigger: {trigger}")
        print(f"   Template Data: {template_data}")
        print(f"   SMS Text: {sms_text}")
        print(f"   Length: {len(sms_text)}/160 chars")
    
    print("\n" + "=" * 70)
    print("DATABASE REQUIREMENTS")
    print("=" * 70)
    print("\n❌ NO DATABASE UPDATE REQUIRED!")
    print("\nWhy:")
    print("• There are currently 0 SMS templates in the database")
    print("• The system uses fallback messages from code when no template exists")
    print("• We just updated these fallback messages with 30+ scenarios")
    print("• All new triggers will work immediately without DB changes")
    
    print("\n" + "=" * 70)
    print("HOW IT WORKS")
    print("=" * 70)
    print("""
1. Notification is queued with trigger type
2. SMS notifier checks database for custom template:
   db.notification_templates.find({
       "trigger": "pending_pii_request",
       "channel": "sms",
       "active": True
   })
3. If template exists → Use custom template
4. If no template → Use fallback messages from our code
5. Add [L3V3LMATCHES] prefix
6. Send SMS via SimpleTexting service
    """)
    
    print("\n" + "=" * 70)
    print("BENEFITS OF THIS APPROACH")
    print("=" * 70)
    print("✅ Immediate deployment - no DB migration needed")
    print("✅ Fallback messages work for all 30+ scenarios")
    print("✅ Can still add custom templates later per trigger")
    print("✅ Consistent messaging across all notifications")
    print("✅ Easy to update messages in code")

if __name__ == "__main__":
    demonstrate_sms_generation()
