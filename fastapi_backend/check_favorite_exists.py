#!/usr/bin/env python3
"""
Check if siddharthdas007's favorite of admin exists in database
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv('.env.local')

async def check_favorite():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client.matrimonialDB
    
    print("🔍 Checking favorite: siddharthdas007 → admin\n")
    print("=" * 60)
    
    # Check if favorite exists
    favorite = await db.favorites.find_one({
        "userUsername": "siddharthdas007",
        "favoriteUsername": "admin"
    })
    
    if not favorite:
        print("❌ NO FAVORITE FOUND!")
        print("\n   The favorite does NOT exist in the database.")
        print("   siddharthdas007 may not have actually favorited admin.\n")
        
        # Check reverse direction
        reverse = await db.favorites.find_one({
            "userUsername": "admin",
            "favoriteUsername": "siddharthdas007"
        })
        
        if reverse:
            print("⚠️  Found REVERSE favorite: admin → siddharthdas007")
            print("   (Admin favorited siddharthdas007, not the other way)")
        
    else:
        print("✅ FAVORITE EXISTS!")
        print(f"\n   ID: {favorite.get('_id')}")
        print(f"   User: {favorite.get('userUsername')}")
        print(f"   Favorited: {favorite.get('favoriteUsername')}")
        print(f"   Created: {favorite.get('createdAt')}")
        
        # Check time filter
        created_at = favorite.get('createdAt')
        if isinstance(created_at, datetime):
            age_days = (datetime.utcnow() - created_at).days
            print(f"   Age: {age_days} days old")
            
            # Check default 7-day filter
            if age_days > 7:
                print(f"\n   ⚠️  WARNING: Favorite is {age_days} days old")
                print("      Default filter only shows favorites from last 7 days!")
                print("      This is why it's not showing on the dashboard.")
            else:
                print(f"\n   ✅ Within 7-day window (should be visible)")
        else:
            print(f"   ⚠️  createdAt is not a datetime: {type(created_at)}")
    
    # Check all admin's favorites (who favorited admin)
    print("\n" + "=" * 60)
    print("\n📊 All users who favorited admin:\n")
    
    all_favorites = await db.favorites.find({
        "favoriteUsername": "admin"
    }).sort("createdAt", -1).to_list(100)
    
    if not all_favorites:
        print("   No one has favorited admin yet.")
    else:
        for i, fav in enumerate(all_favorites, 1):
            created_at = fav.get('createdAt')
            age = "unknown age"
            if isinstance(created_at, datetime):
                age_days = (datetime.utcnow() - created_at).days
                age = f"{age_days} days ago"
                if age_days > 7:
                    age += " ❌ (filtered out)"
                else:
                    age += " ✅ (visible)"
            
            print(f"   {i}. {fav.get('userUsername')} → admin ({age})")
    
    # Check system settings
    print("\n" + "=" * 60)
    print("\n⚙️  System Settings:\n")
    
    settings = await db.system_settings.find_one({}) or {}
    view_history_days = settings.get("profile_view_history_days", 7)
    print(f"   profile_view_history_days: {view_history_days} days")
    print(f"   (This filter applies to favorites, views, and shortlists)")
    
    print("\n" + "=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_favorite())
