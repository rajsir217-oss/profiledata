#!/usr/bin/env python3
"""
Check admin user's notification preferences for profile views
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import json

load_dotenv('.env.local')

async def check_prefs():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🔍 Checking admin notification preferences...\n")
    
    # Get admin preferences
    prefs = await db.notification_preferences.find_one({"username": "admin"})
    
    if not prefs:
        print("❌ No notification preferences found for admin!")
        print("   Creating default preferences...\n")
        client.close()
        return
    
    print("✅ Found preferences for admin\n")
    print("=" * 60)
    
    # Check profile_view trigger
    channels = prefs.get("channels", {})
    profile_view_channels = channels.get("profile_view", [])
    
    print("📊 PROFILE_VIEW Notification Settings:")
    print(f"   Channels: {profile_view_channels}")
    
    if not profile_view_channels:
        print("   ⚠️  No channels enabled for profile views!")
    else:
        print(f"   ✅ Enabled: {', '.join(profile_view_channels).upper()}")
    
    print("\n" + "=" * 60)
    print("\n📋 All Notification Triggers:\n")
    
    for trigger, trigger_channels in channels.items():
        if trigger_channels:
            status = "✅" if trigger_channels else "❌"
            print(f"{status} {trigger:30} → {', '.join(trigger_channels)}")
    
    print("\n" + "=" * 60)
    print("\n⚙️  Other Settings:\n")
    
    # Check frequency
    frequency = prefs.get("frequency", {})
    print(f"Profile Views Frequency: {frequency.get('profile_view', 'instant')}")
    
    # Check quiet hours
    quiet_hours = prefs.get("quietHours", {})
    if quiet_hours.get("enabled"):
        start = quiet_hours.get("start", "22:00")
        end = quiet_hours.get("end", "08:00")
        print(f"Quiet Hours: {start} - {end}")
    else:
        print("Quiet Hours: Disabled")
    
    # Check do not disturb
    dnd = prefs.get("doNotDisturb", False)
    print(f"Do Not Disturb: {'ON' if dnd else 'OFF'}")
    
    print("\n" + "=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_prefs())
